package com.scanny.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.scanny.dto.PaymentDtos;
import com.scanny.dto.PublicTicketDtos;
import com.scanny.entity.PromotedEvent;
import com.scanny.entity.Ticket;
import com.scanny.exception.ApiException;
import com.scanny.payment.PaymentContext;
import com.scanny.payment.PaymentIntentStatus;
import com.scanny.payment.service.PaymentGatewayService;
import com.scanny.repository.PromotedEventRepository;
import com.scanny.repository.TicketRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Handles all promotion lifecycle:
 *  1. initiate()        — organiser requests to promote; MoMo charge kicked off
 *  2. getStatus()       — poll payment + promo status
 *  3. handlePaymentPaid() — called from PaymentController webhook; activates promo
 *  4. findNearby()      — customer feed query by restaurant lat/lng
 *  5. recordImpression()
 *  6. recordClick()
 *  7. expireStale()     — scheduler, every 30 min
 */
@Service
public class PromotionService {

    private static final Logger log = LoggerFactory.getLogger(PromotionService.class);

    private final PromotedEventRepository promoRepo;
    private final TicketRepository ticketRepository;
    private final PaymentGatewayService paymentGatewayService;
    private final PromotionTierService promotionTierService;
    private final ObjectMapper objectMapper;

    @Value("${scanny.scan-base-url:https://scanny.app}")
    private String scanBaseUrl;

    public PromotionService(
            PromotedEventRepository promoRepo,
            TicketRepository ticketRepository,
            PaymentGatewayService paymentGatewayService,
            PromotionTierService promotionTierService,
            ObjectMapper objectMapper) {
        this.promoRepo = promoRepo;
        this.ticketRepository = ticketRepository;
        this.paymentGatewayService = paymentGatewayService;
        this.promotionTierService = promotionTierService;
        this.objectMapper = objectMapper;
    }

    // ── Initiate ─────────────────────────────────────────────────────────────

    @Transactional
    public PublicTicketDtos.PromotionInitiateResponse initiate(PublicTicketDtos.PromoteEventRequest req) {
        if (req == null) throw new ApiException(400, "Request body is required");

        String masterTicketId = requireText(req.masterTicketId(), "masterTicketId is required");
        String paymentPhone   = requirePhone(req.paymentPhone());
        String provider       = requireText(req.provider(), "provider is required (MTN or Airtel)");
        String organiserName  = req.organiserName() != null ? req.organiserName().trim() : "";
        String category       = req.category() != null ? req.category().trim() : "Other";
        String venueAddress   = req.venueAddress() != null ? req.venueAddress().trim() : "";
        String tier           = PromotionTierService.normalizeTier(req.tier());

        // Resolve fee and radius from config (admin-configurable)
        int promotionFee = promotionTierService.getFeeForTier(tier);
        int radiusKm     = promotionTierService.getRadiusForTier(tier);
        int maxActive    = promotionTierService.getMaxActivePerPhone();
        int maxDays      = promotionTierService.getMaxDays();

        // Load master ticket to pull event metadata
        Ticket master = ticketRepository.findById(masterTicketId)
                .orElseThrow(() -> new ApiException(404, "Event not found: " + masterTicketId));

        if (master.getMasterTicketId() != null) {
            throw new ApiException(400, "Provide the master event id, not an attendee ticket id");
        }

        // Rate-limit: no more than maxActive active promos per phone
        long activeCount = promoRepo.countByOrganiserPhoneAndStatus(paymentPhone, "ACTIVE");
        if (activeCount >= maxActive) {
            throw new ApiException(429, "Too many active promotions for this number. Cancel one before adding another.");
        }

        Map<String, Object> meta = parseMetadata(master.getMetadata());
        String eventImageUrl = stringMeta(meta, "eventImageUrl", "");
        String host          = stringMeta(meta, "host", "");
        String purchaseUrl   = scanBaseUrl + "/ticket/" + master.getQrToken();

        // Create the PromotedEvent record (PENDING_PAYMENT)
        String promoId = "PRO-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase();
        PromotedEvent promo = new PromotedEvent();
        promo.setId(promoId);
        promo.setMasterTicketId(master.getId());
        promo.setEventName(master.getEventName());
        promo.setEventDate(master.getEventDate());
        promo.setEventImageUrl(eventImageUrl);
        promo.setPurchaseUrl(purchaseUrl);
        promo.setHost(host);
        promo.setCategory(category);
        promo.setVenueLat(req.venueLat());
        promo.setVenueLng(req.venueLng());
        promo.setVenueAddress(venueAddress);
        promo.setRadiusKm(radiusKm);
        promo.setTier(tier);
        promo.setOrganiserPhone(paymentPhone);
        promo.setOrganiserName(organiserName);
        promo.setPaymentPhone(paymentPhone);
        promo.setPromotionFee(promotionFee);
        promo.setStatus("PENDING_PAYMENT");
        promo.setPaymentStatus("UNPAID");
        promo.setCreatedAt(Instant.now());
        promoRepo.save(promo);

        // Kick off the MoMo charge
        PaymentDtos.InitiateResponse payment = paymentGatewayService.initiate(
                new PaymentDtos.InitiateRequest(
                        PaymentContext.EVENT_PROMOTION,
                        promoId,
                        provider,
                        promotionFee,
                        "UGX",
                        paymentPhone,
                        organiserName.isBlank() ? "Event Organiser" : organiserName,
                        null,
                        "Event promotion (" + tier + "): " + master.getEventName()
                ));

        promo.setPaymentId(payment.paymentId());
        promo.setPaymentStatus(payment.status() == PaymentIntentStatus.Paid ? "PAID" : "UNPAID");
        promo.setUpdatedAt(Instant.now());

        // If payment was immediately confirmed (dev/test mode), activate at once
        if (payment.status() == PaymentIntentStatus.Paid) {
            activatePromotion(promo);
        }
        promoRepo.save(promo);

        log.info("Promotion initiated promoId={} event={} phone={} paymentId={}",
                promoId, master.getEventName(), paymentPhone, payment.paymentId());

        return new PublicTicketDtos.PromotionInitiateResponse(
                promoId,
                payment.paymentId(),
                promo.getPaymentStatus(),
                promo.getStatus(),
                payment.status() == PaymentIntentStatus.Paid
                        ? "Promotion is now active!"
                        : "Check your phone for the MoMo prompt. Promotion activates on payment.",
                promotionFee,
                "UGX"
        );
    }

    // ── Status poll ───────────────────────────────────────────────────────────

    @Transactional
    public PublicTicketDtos.PromotionStatusResponse getStatus(String promotionId) {
        PromotedEvent promo = requirePromo(promotionId);

        // If still pending, try a live payment status refresh
        if ("PENDING_PAYMENT".equals(promo.getStatus()) && !promo.getPaymentId().isBlank()) {
            try {
                PaymentDtos.StatusResponse ps = paymentGatewayService.refreshStatus(promo.getPaymentId());
                if (ps.status() == PaymentIntentStatus.Paid && !"PAID".equals(promo.getPaymentStatus())) {
                    promo.setPaymentStatus("PAID");
                    activatePromotion(promo);
                    promo.setUpdatedAt(Instant.now());
                    promoRepo.save(promo);
                } else if (ps.status() == PaymentIntentStatus.Failed || ps.status() == PaymentIntentStatus.Cancelled) {
                    promo.setPaymentStatus("FAILED");
                    promo.setUpdatedAt(Instant.now());
                    promoRepo.save(promo);
                }
            } catch (Exception ex) {
                log.warn("Could not refresh payment status for promo {}: {}", promotionId, ex.getMessage());
            }
        }

        return toStatusResponse(promo);
    }

    // ── Payment webhook callback ──────────────────────────────────────────────

    /**
     * Called by PaymentController after a webhook confirms a payment is Paid.
     * Activates the promotion if referenceId matches a PromotedEvent.
     */
    @Transactional
    public void handlePaymentPaid(String paymentId) {
        List<PromotedEvent> promos = promoRepo.findByPaymentId(paymentId);
        for (PromotedEvent promo : promos) {
            if ("PENDING_PAYMENT".equals(promo.getStatus())) {
                promo.setPaymentStatus("PAID");
                activatePromotion(promo);
                promo.setUpdatedAt(Instant.now());
                promoRepo.save(promo);
                log.info("Promotion ACTIVATED via webhook promoId={} event={}",
                        promo.getId(), promo.getEventName());
            }
        }
    }

    // ── Nearby feed ───────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public PublicTicketDtos.NearbyEventsResponse findNearby(Double lat, Double lng) {
        Instant now = Instant.now();
        List<PromotedEvent> promos;

        if (lat != null && lng != null) {
            promos = promoRepo.findActiveNearby(lat, lng, now);
        } else {
            promos = promoRepo.findAllActive(now);
        }

        List<PublicTicketDtos.NearbyEventItem> items = promos.stream()
                .map(p -> toNearbyItem(p, lat, lng))
                .toList();

        return new PublicTicketDtos.NearbyEventsResponse(items, items.size());
    }

    // ── Impression / click tracking ───────────────────────────────────────────

    @Transactional
    public void recordImpression(String promotionId) {
        promoRepo.findById(promotionId).ifPresent(p -> {
            p.setImpressions(p.getImpressions() + 1);
            promoRepo.save(p);
        });
    }

    @Transactional
    public void recordClick(String promotionId) {
        promoRepo.findById(promotionId).ifPresent(p -> {
            p.setClicks(p.getClicks() + 1);
            promoRepo.save(p);
        });
    }

    // ── Scheduler: expire stale promos ───────────────────────────────────────

    @Scheduled(fixedDelayString = "${scanny.promotions.expiry-check-ms:1800000}")
    @Transactional
    public void expireStale() {
        int expired = promoRepo.expireStale(Instant.now());
        if (expired > 0) {
            log.info("Expired {} stale promotion(s)", expired);
        }
    }

    // ── Admin: list promotions for an event ───────────────────────────────────

    @Transactional(readOnly = true)
    public List<PublicTicketDtos.PromotionStatusResponse> listForEvent(String masterTicketId) {
        return promoRepo.findByMasterTicketIdOrderByCreatedAtDesc(masterTicketId)
                .stream()
                .map(this::toStatusResponse)
                .toList();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void activatePromotion(PromotedEvent promo) {
        Instant now  = Instant.now();
        int maxDays  = promotionTierService.getMaxDays();
        Instant cap  = now.plus(maxDays, java.time.temporal.ChronoUnit.DAYS);
        Instant until = promo.getEventDate() != null && promo.getEventDate().isBefore(cap)
                ? promo.getEventDate()
                : cap;
        promo.setStatus("ACTIVE");
        promo.setPromotedFrom(now);
        promo.setPromotedUntil(until);
    }

    private PublicTicketDtos.PromotionStatusResponse toStatusResponse(PromotedEvent p) {
        return new PublicTicketDtos.PromotionStatusResponse(
                p.getId(),
                p.getPaymentId(),
                p.getPaymentStatus(),
                p.getStatus(),
                p.getPromotedFrom() != null ? p.getPromotedFrom().toString() : null,
                p.getPromotedUntil() != null ? p.getPromotedUntil().toString() : null,
                p.getEventName(),
                p.getPromotionFee(),
                p.getCurrency(),
                p.getImpressions()
        );
    }

    private PublicTicketDtos.NearbyEventItem toNearbyItem(PromotedEvent p, Double lat, Double lng) {
        double dist = -1.0;
        if (lat != null && lng != null && p.getVenueLat() != null && p.getVenueLng() != null) {
            dist = haversineKm(lat, lng, p.getVenueLat(), p.getVenueLng());
        }

        // Pull lowest price from master ticket metadata
        List<String> classNames = new ArrayList<>();
        int lowestPrice = 0;
        try {
            Ticket master = ticketRepository.findById(p.getMasterTicketId()).orElse(null);
            if (master != null) {
                Map<String, Object> meta = parseMetadata(master.getMetadata());
                Object classes = meta.get("ticketClasses");
                if (classes instanceof List<?> list) {
                    int min = Integer.MAX_VALUE;
                    for (Object cls : list) {
                        if (cls instanceof Map<?, ?> m) {
                            Object name = m.get("name");
                            Object fee  = m.get("fee");
                            if (name instanceof String n) classNames.add(n);
                            if (fee instanceof Number f && f.intValue() < min) min = f.intValue();
                        }
                    }
                    lowestPrice = (min == Integer.MAX_VALUE) ? 0 : min;
                }
            }
        } catch (Exception ex) {
            log.debug("Could not parse ticket classes for promo {}: {}", p.getId(), ex.getMessage());
        }

        return new PublicTicketDtos.NearbyEventItem(
                p.getId(),
                p.getMasterTicketId(),
                p.getEventName(),
                p.getEventDate() != null ? p.getEventDate().toString() : null,
                p.getEventImageUrl(),
                p.getPurchaseUrl(),
                p.getHost(),
                p.getCategory(),
                p.getVenueAddress(),
                Math.round(dist * 10.0) / 10.0,
                classNames,
                lowestPrice,
                p.getTier() != null ? p.getTier() : PromotionTierService.TIER_LOCAL
        );
    }

    private static double haversineKm(double lat1, double lng1, double lat2, double lng2) {
        final double R = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseMetadata(String raw) {
        if (raw == null || raw.isBlank()) return Map.of();
        try {
            Object parsed = objectMapper.readValue(raw, Object.class);
            if (parsed instanceof Map<?, ?> m) return (Map<String, Object>) m;
            if (parsed instanceof String s) {
                Object inner = objectMapper.readValue(s, Object.class);
                if (inner instanceof Map<?, ?> im) return (Map<String, Object>) im;
            }
        } catch (Exception ignored) { }
        return Map.of();
    }

    private static String stringMeta(Map<String, Object> meta, String key, String def) {
        Object v = meta.get(key);
        return (v instanceof String s && !s.isBlank()) ? s : def;
    }

    private PromotedEvent requirePromo(String id) {
        if (id == null || id.isBlank()) throw new ApiException(400, "Promotion id is required");
        return promoRepo.findById(id.trim())
                .orElseThrow(() -> new ApiException(404, "Promotion not found: " + id));
    }

    private static String requireText(String value, String message) {
        if (value == null || value.isBlank()) throw new ApiException(400, message);
        return value.trim();
    }

    private static String requirePhone(String value) {
        if (value == null || value.isBlank()) throw new ApiException(400, "Payment phone is required");
        String digits = value.replaceAll("\\D", "");
        if (digits.length() < 9) throw new ApiException(400, "Invalid phone number");
        return value.trim();
    }
}
