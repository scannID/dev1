package com.scanny.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.scanny.dto.PublicTicketDtos;
import com.scanny.dto.TicketDtos;
import com.scanny.dto.TicketResponse;
import com.scanny.entity.Ticket;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.PaymentStatus;
import com.scanny.model.enums.TicketStatus;
import com.scanny.payment.PaymentIntentStatus;
import com.scanny.repository.TicketRepository;
import com.scanny.util.PhoneUtils;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TicketPurchaseService {

    private static final Pattern EMAIL_PATTERN = Pattern.compile(
        "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$"
    );
    private static final int SERVICE_FEE_PER_TRANSACTION = 700;

    private final TicketRepository ticketRepository;
    private final WhatsAppNotificationService whatsAppNotificationService;
    private final TicketService ticketService;
    private final ObjectMapper objectMapper;
    private final Environment environment;
    private final long holdTtlMinutes;

    @Value("${scanny.scan-base-url:https://scanny.app}")
    private String customerUrl;

    public TicketPurchaseService(
            TicketRepository ticketRepository,
            WhatsAppNotificationService whatsAppNotificationService,
            TicketService ticketService,
            ObjectMapper objectMapper,
            Environment environment,
            @Value("${scanny.tickets.hold-ttl-minutes:10}") long holdTtlMinutes) {
        this.ticketRepository = ticketRepository;
        this.whatsAppNotificationService = whatsAppNotificationService;
        this.ticketService = ticketService;
        this.objectMapper = objectMapper;
        this.environment = environment;
        this.holdTtlMinutes = Math.max(1, holdTtlMinutes);
    }

    @Transactional
    public TicketResponse createPublicEvent(TicketDtos.CreateTicketRequest request) {
        if (request == null || request.eventName() == null || request.eventName().isBlank()) {
            throw new ApiException(400, "Event name is required");
        }
        TicketDtos.CreateTicketRequest normalized = new TicketDtos.CreateTicketRequest(
            request.ticketType() != null && !request.ticketType().isBlank() ? request.ticketType() : "EVENT",
            request.eventName().trim(),
            request.eventDate(),
            "",
            "",
            "",
            Math.max(0, request.price()),
            request.currency() != null && !request.currency().isBlank() ? request.currency() : "UGX",
            1_000_000_000,
            request.expiresAt(),
            "public-web",
            request.metadata()
        );
        return ticketService.createTicket(normalized);
    }

    @Transactional(readOnly = true)
    public PublicTicketDtos.EventInfoResponse getEventForPurchase(String masterQrToken) {
        Ticket master = requireEventTemplate(masterQrToken);
        Map<String, Object> meta = parseMetadata(master.getMetadata());
        Instant now = Instant.now();
        List<PublicTicketDtos.TicketClassOption> classes = parseClasses(
            meta, master.getTicketType(), master.getPrice(), master.getId(), now);
        List<PublicTicketDtos.TicketTableOption> tables = parseTables(meta, master.getId(), now);
        return new PublicTicketDtos.EventInfoResponse(
            master.getId(),
            master.getEventName(),
            master.getEventDate() != null ? master.getEventDate().toString() : null,
            master.getCurrency(),
            stringMeta(meta, "template", "classic"),
            classes,
            tables,
            stringMeta(meta, "payTo", ""),
            customerUrl + "/ticket/" + master.getQrToken(),
            stringMeta(meta, "eventImageUrl", ""),
            stringMeta(meta, "host", "")
        );
    }

    @Transactional
    public PublicTicketDtos.PurchaseResponse startPurchase(PublicTicketDtos.PurchaseRequest request) {
        Ticket master = requireEventTemplateForUpdate(request.masterQrToken());
        String email = optionalEmail(request.holderEmail());
        String name = requireText(request.holderName(), "Your name is required");
        String phone = requirePhone(request.holderPhone());
        String ticketClass = requireText(request.ticketClass(), "Select a ticket class or table");
        org.slf4j.LoggerFactory.getLogger(TicketPurchaseService.class)
                .info("Ticket purchase start phone={} event={}", phone, master.getEventName());

        if (ticketRepository.existsByEventNameAndHolderPhoneAndPaymentStatusAndMasterTicketIdIsNotNull(
                master.getEventName(), phone, PaymentStatus.Paid)) {
            // Local H2 retests: allow repurchase so WhatsApp delivery can be tried again.
            // Production/dev Postgres keeps one paid ticket per phone per event.
            if (!h2ProfileActive()) {
                throw new ApiException(409, "This WhatsApp number already has a paid ticket for this event. Check WhatsApp or use a different number.");
            }
        }

        Map<String, Object> masterMeta = parseMetadata(master.getMetadata());
        int basePrice = resolveSelectionPrice(masterMeta, ticketClass, master.getPrice());
        if (basePrice < 0) {
            throw new ApiException(400, "Unknown ticket class or table");
        }
        int price = basePrice + SERVICE_FEE_PER_TRANSACTION;

        Instant now = Instant.now();
        Integer capacity = resolveSelectionCapacity(masterMeta, ticketClass);
        assertInventoryAvailable(master.getId(), ticketClass, capacity, now);

        Ticket attendee = new Ticket();
        attendee.setId(generateUniqueTicketId());
        attendee.setQrToken(generateQrToken());
        attendee.setAccessToken(generateAccessToken());
        attendee.setMasterTicketId(master.getId());
        attendee.setTicketType(ticketClass);
        attendee.setEventName(master.getEventName());
        attendee.setEventDate(master.getEventDate());
        attendee.setHolderName(name);
        attendee.setHolderPhone(phone);
        attendee.setHolderEmail(email);
        attendee.setPrice(price);
        attendee.setCurrency(master.getCurrency());
        attendee.setUsageLimit(1);
        attendee.setUsageCount(0);
        attendee.setExpiresAt(master.getExpiresAt());
        attendee.setStatus(TicketStatus.Active);
        attendee.setPaymentStatus(PaymentStatus.Unpaid);
        attendee.setHoldExpiresAt(now.plus(holdTtlMinutes, ChronoUnit.MINUTES));
        attendee.setIssuedBy("public-purchase");
        attendee.setMetadata(serializeAttendeeMetadata(masterMeta, ticketClass));
        attendee.setCreatedAt(now);

        attendee = ticketRepository.save(attendee);

        // Local instant-pay path: convert hold → sold in the same transaction.
        String paymentId = generateImmediatePaymentId();
        attendee.setPaymentStatus(PaymentStatus.Paid);
        attendee.setPaymentReference(paymentId);
        attendee.setHoldExpiresAt(null);
        attendee.setUpdatedAt(Instant.now());
        ticketRepository.save(attendee);

        String viewUrl = buildViewUrl(attendee.getAccessToken());
        String ticketId = attendee.getId();
        ticketService.refreshStatsBroadcast();

        return new PublicTicketDtos.PurchaseResponse(
            ticketId,
            shortCodeForTicketId(ticketId),
            paymentId,
            PaymentIntentStatus.Paid,
            "Ticket created and marked paid",
            viewUrl
        );
    }

    @Transactional
    public void confirmPurchaseFromPayment(String attendeeTicketId, String paymentId) {
        Ticket ticket = ticketRepository.findById(attendeeTicketId)
            .orElseThrow(() -> new ApiException(404, "Ticket not found"));

        if (!ticket.isAttendeeTicket()) {
            throw new ApiException(400, "Not an attendee ticket");
        }
        if (ticket.getPaymentStatus() == PaymentStatus.Paid) {
            return;
        }

        ticket.setPaymentStatus(PaymentStatus.Paid);
        ticket.setPaymentReference(paymentId != null ? paymentId : "");
        ticket.setHoldExpiresAt(null);
        ticket.setUpdatedAt(Instant.now());
        ticketRepository.save(ticket);

        ticketService.refreshStatsBroadcast();
    }

    /** Call after purchase transaction commits (from controller). */
    public void deliverTicketWhatsApp(String attendeeTicketId, String viewUrl) {
        try {
            Ticket ticket = ticketRepository.findById(attendeeTicketId).orElse(null);
            if (ticket == null) {
                org.slf4j.LoggerFactory.getLogger(TicketPurchaseService.class)
                        .warn("WhatsApp skipped — ticket {} not found", attendeeTicketId);
                return;
            }
            whatsAppNotificationService.sendAttendeeTicket(ticket, viewUrl, buildGateQrPayload(ticket));
        } catch (Exception ex) {
            org.slf4j.LoggerFactory.getLogger(TicketPurchaseService.class)
                    .warn("WhatsApp delivery error for {}: {}", attendeeTicketId, ex.toString());
        }
    }

    @Transactional(readOnly = true)
    public PublicTicketDtos.AttendeeTicketView getAttendeeView(String accessToken) {
        Ticket ticket = ticketRepository.findByAccessToken(accessToken.trim())
            .orElseThrow(() -> new ApiException(404, "Ticket not found"));

        if (!ticket.isAttendeeTicket()) {
            throw new ApiException(404, "Ticket not found");
        }

        Map<String, Object> meta = parseMetadata(ticket.getMetadata());
        String purchaseUrl = "";
        if (ticket.getMasterTicketId() != null) {
            purchaseUrl = ticketRepository.findById(ticket.getMasterTicketId())
                .map(master -> customerUrl + "/ticket/" + master.getQrToken())
                .orElse("");
        }
        return new PublicTicketDtos.AttendeeTicketView(
            ticket.getId(),
            ticket.getTicketType(),
            ticket.getEventName(),
            ticket.getEventDate() != null ? ticket.getEventDate().toString() : null,
            ticket.getHolderName(),
            ticket.getHolderEmail(),
            ticket.getHolderPhone(),
            ticket.getPrice(),
            ticket.getCurrency(),
            ticket.getStatus().name(),
            ticket.getPaymentStatus().name(),
            ticket.canBeUsed(),
            stringMeta(meta, "template", "classic"),
            ticket.getMetadata(),
            buildViewUrl(ticket.getAccessToken()),
            ticket.getQrToken(),
            shortCodeForTicketId(ticket.getId()),
            buildGateQrPayload(ticket),
            buildGateUrl(ticket),
            purchaseUrl
        );
    }

    @Transactional
    public TicketDtos.ScanValidationResponse validateGatePayload(TicketDtos.ScanPayloadRequest request) {
        return ticketService.scanTicketPayload(request);
    }

    @Transactional(readOnly = true)
    public PublicTicketDtos.EventTrackingMetrics getEventTrackingMetrics(String rawTicketId) {
        String ticketId = normalizeTicketId(rawTicketId);
        Ticket seed = ticketRepository.findById(ticketId)
            .orElseThrow(() -> new ApiException(404, "No event found for that ticket ID"));

        Ticket master;
        if (seed.isEventTemplate()) {
            master = seed;
        } else if (seed.isAttendeeTicket() && seed.getMasterTicketId() != null) {
            master = ticketRepository.findById(seed.getMasterTicketId())
                .orElseThrow(() -> new ApiException(404, "No event found for that ticket ID"));
        } else {
            throw new ApiException(400, "That ticket ID is not an event tracking code");
        }
        List<Ticket> attendees = ticketRepository.findByMasterTicketIdOrderByCreatedAtDesc(master.getId());
        long ordered = attendees.size();
        long purchased = attendees.stream().filter(t -> t.getPaymentStatus() == PaymentStatus.Paid).count();
        long pending = attendees.stream().filter(t -> t.getPaymentStatus() == PaymentStatus.Unpaid).count();
        long redeemed = attendees.stream().filter(t -> t.getStatus() == TicketStatus.Redeemed).count();
        long totalCollected = attendees.stream()
            .filter(t -> t.getPaymentStatus() == PaymentStatus.Paid)
            .mapToLong(Ticket::getPrice)
            .sum();

        Map<String, Object> meta = parseMetadata(master.getMetadata());
        List<PublicTicketDtos.RecentAttendee> recent = attendees.stream()
            .limit(25)
            .map(t -> {
                boolean paid = t.getPaymentStatus() == PaymentStatus.Paid;
                String viewUrl = paid && t.getAccessToken() != null && !t.getAccessToken().isBlank()
                    ? buildViewUrl(t.getAccessToken())
                    : "";
                String qrPayload = paid ? buildGateQrPayload(t) : "";
                String gateUrl = paid ? buildGateUrl(t) : "";
                return new PublicTicketDtos.RecentAttendee(
                    t.getId(),
                    t.getHolderName(),
                    t.getHolderEmail(),
                    t.getHolderPhone(),
                    t.getTicketType(),
                    t.getPrice(),
                    t.getCurrency(),
                    t.getPaymentStatus().name(),
                    t.getStatus().name(),
                    t.getCreatedAt(),
                    viewUrl,
                    qrPayload,
                    gateUrl
                );
            })
            .toList();

        return new PublicTicketDtos.EventTrackingMetrics(
            master.getId(),
            master.getEventName(),
            master.getEventDate() != null ? master.getEventDate().toString() : null,
            stringMeta(meta, "host", ""),
            stringMeta(meta, "eventImageUrl", ""),
            master.getStatus().name(),
            ordered,
            purchased,
            pending,
            redeemed,
            totalCollected,
            master.getCurrency() != null ? master.getCurrency() : "UGX",
            customerUrl + "/ticket/" + master.getQrToken(),
            master.getCreatedAt(),
            recent
        );
    }

    @Transactional(readOnly = true)
    public List<PublicTicketDtos.RedeemedAttendee> getRedeemedAttendees(String rawEventId, String query) {
        String eventId = normalizeTicketId(rawEventId);
        Ticket seed = ticketRepository.findById(eventId)
            .orElseThrow(() -> new ApiException(404, "No event found for that ticket ID"));

        Ticket master;
        if (seed.isEventTemplate()) {
            master = seed;
        } else if (seed.isAttendeeTicket() && seed.getMasterTicketId() != null) {
            master = ticketRepository.findById(seed.getMasterTicketId())
                .orElseThrow(() -> new ApiException(404, "No event found for that ticket ID"));
        } else {
            throw new ApiException(400, "That ticket ID is not an event tracking code");
        }

        String codeQuery = query == null ? "" : query.trim().replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
        boolean hasSearch = !codeQuery.isBlank();
        if (hasSearch && codeQuery.length() != 4) {
            return List.of();
        }

        return ticketRepository.findByMasterTicketIdOrderByCreatedAtDesc(master.getId()).stream()
            .filter(Ticket::isAttendeeTicket)
            .filter(t -> t.getStatus() == TicketStatus.Redeemed)
            .filter(t -> {
                if (!hasSearch) return true;
                String ticketCode = shortCodeForTicketId(t.getId());
                return ticketCode.equalsIgnoreCase(codeQuery);
            })
            .map(t -> new PublicTicketDtos.RedeemedAttendee(
                t.getId(),
                shortCodeForTicketId(t.getId()),
                t.getHolderName(),
                t.getHolderPhone(),
                t.getTicketType(),
                t.getPaymentStatus() != null ? t.getPaymentStatus().name() : "",
                t.getStatus() != null ? t.getStatus().name() : "",
                t.getRedeemedAt() != null ? t.getRedeemedAt() : t.getUpdatedAt()
            ))
            .toList();
    }

    private String normalizeTicketId(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ApiException(400, "Ticket ID is required");
        }
        String normalized = raw.trim().toUpperCase(Locale.ROOT);
        if (normalized.startsWith("#")) {
            normalized = normalized.substring(1).trim();
        }
        if (normalized.isBlank()) {
            throw new ApiException(400, "Ticket ID is required");
        }
        return normalized;
    }

    private Ticket requireEventTemplate(String qrToken) {
        Ticket ticket = ticketRepository.findByQrToken(qrToken.trim())
            .orElseThrow(() -> new ApiException(404, "Event not found"));
        if (!ticket.isEventTemplate()) {
            throw new ApiException(400, "This QR is an individual ticket, not an event purchase link");
        }
        if (ticket.getStatus() == TicketStatus.Cancelled) {
            throw new ApiException(410, "Ticket sales for this event have been stopped");
        }
        return ticket;
    }

    /** Lock the master event row so concurrent purchases cannot oversell. */
    private Ticket requireEventTemplateForUpdate(String qrToken) {
        Ticket unlocked = requireEventTemplate(qrToken);
        return ticketRepository.findByIdForUpdate(unlocked.getId())
            .orElseThrow(() -> new ApiException(404, "Event not found"));
    }

    private void assertInventoryAvailable(String masterId, String selection, Integer capacity, Instant now) {
        if (capacity == null) {
            return;
        }
        long sold = ticketRepository.countSoldByMasterAndType(masterId, selection);
        long held = ticketRepository.countActiveHoldsByMasterAndType(masterId, selection, now);
        if (sold + held >= capacity) {
            throw new ApiException(409, "Sold out — no more tickets left for " + selection);
        }
    }

    private InventorySnapshot inventoryFor(String masterId, String selection, Integer capacity, Instant now) {
        int sold = (int) ticketRepository.countSoldByMasterAndType(masterId, selection);
        int held = (int) ticketRepository.countActiveHoldsByMasterAndType(masterId, selection, now);
        if (capacity == null) {
            return new InventorySnapshot(null, sold, held, null, false);
        }
        int remaining = Math.max(0, capacity - sold - held);
        return new InventorySnapshot(capacity, sold, held, remaining, remaining == 0);
    }

    private record InventorySnapshot(
        Integer capacity,
        int sold,
        int held,
        Integer remaining,
        boolean soldOut
    ) {}

    private String buildViewUrl(String accessToken) {
        return customerUrl + "/ticket/view/" + accessToken;
    }

    private String buildGateQrPayload(Ticket ticket) {
        Map<String, String> payload = new LinkedHashMap<>();
        payload.put("v", "1");
        payload.put("ticketId", ticket.getId());
        payload.put("code", shortCodeForTicketId(ticket.getId()));
        payload.put("eventId", ticket.getMasterTicketId() != null ? ticket.getMasterTicketId() : "");
        payload.put("paymentId", ticket.getPaymentReference() != null ? ticket.getPaymentReference() : "");
        payload.put("qrToken", ticket.getQrToken());
        try {
            String json = objectMapper.writeValueAsString(payload);
            String encoded = Base64.getUrlEncoder().withoutPadding().encodeToString(json.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return "SCANNY:TICKET:" + encoded;
        } catch (Exception e) {
            return ticket.getQrToken();
        }
    }

    private String buildGateUrl(Ticket ticket) {
        String payload = buildGateQrPayload(ticket);
        try {
            return customerUrl + "/ticket/gate?p=" + java.net.URLEncoder.encode(payload, java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception e) {
            return customerUrl + "/ticket/gate?p=" + payload;
        }
    }

    private String serializeAttendeeMetadata(Map<String, Object> masterMeta, String ticketClass) {
        try {
            Map<String, Object> copy = new LinkedHashMap<>(masterMeta);
            copy.put("selectedClass", ticketClass);
            copy.put("issuedVia", "public-purchase");
            return objectMapper.writeValueAsString(copy);
        } catch (Exception e) {
            return "{}";
        }
    }

    @SuppressWarnings("unchecked")
    private List<PublicTicketDtos.TicketClassOption> parseClasses(
            Map<String, Object> meta,
            String fallbackType,
            int fallbackPrice,
            String masterId,
            Instant now) {
        Object raw = meta.get("ticketClasses");
        List<PublicTicketDtos.TicketClassOption> classes = new ArrayList<>();
        if (raw instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> map) {
                    String name = String.valueOf(map.get("name"));
                    int price = parsePrice(map.get("fee"), fallbackPrice);
                    if (!name.isBlank() && !"null".equalsIgnoreCase(name)) {
                        Integer capacity = parseOptionalCapacity(map.get("capacity"));
                        InventorySnapshot inv = inventoryFor(masterId, name, capacity, now);
                        classes.add(new PublicTicketDtos.TicketClassOption(
                            name,
                            price,
                            inv.capacity(),
                            inv.sold(),
                            inv.held(),
                            inv.remaining(),
                            inv.soldOut()
                        ));
                    }
                }
            }
        }
        if (classes.isEmpty()) {
            InventorySnapshot inv = inventoryFor(masterId, fallbackType, null, now);
            classes.add(new PublicTicketDtos.TicketClassOption(
                fallbackType,
                fallbackPrice,
                inv.capacity(),
                inv.sold(),
                inv.held(),
                inv.remaining(),
                inv.soldOut()
            ));
        }
        return classes;
    }

    @SuppressWarnings("unchecked")
    private List<PublicTicketDtos.TicketTableOption> parseTables(
            Map<String, Object> meta,
            String masterId,
            Instant now) {
        Object raw = meta.get("tables");
        List<PublicTicketDtos.TicketTableOption> tables = new ArrayList<>();
        if (!(raw instanceof List<?> list)) {
            return tables;
        }
        for (Object item : list) {
            if (item instanceof Map<?, ?> map) {
                String name = String.valueOf(map.get("name"));
                if (name.isBlank() || "null".equalsIgnoreCase(name)) {
                    continue;
                }
                int seats = parsePrice(map.get("seats"), 0);
                int price = parsePrice(map.get("price"), 0);
                Integer capacity = parseOptionalCapacity(map.get("capacity"));
                InventorySnapshot inv = inventoryFor(masterId, name, capacity, now);
                tables.add(new PublicTicketDtos.TicketTableOption(
                    name,
                    seats,
                    price,
                    inv.capacity(),
                    inv.sold(),
                    inv.held(),
                    inv.remaining(),
                    inv.soldOut()
                ));
            }
        }
        return tables;
    }

    private int resolveSelectionPrice(Map<String, Object> meta, String selection, int fallbackPrice) {
        Object rawClasses = meta.get("ticketClasses");
        boolean hasClasses = false;
        if (rawClasses instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> map) {
                    String name = String.valueOf(map.get("name"));
                    if (name.isBlank() || "null".equalsIgnoreCase(name)) {
                        continue;
                    }
                    hasClasses = true;
                    if (name.equalsIgnoreCase(selection)) {
                        return parsePrice(map.get("fee"), fallbackPrice);
                    }
                }
            }
        }
        Object rawTables = meta.get("tables");
        if (rawTables instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> map) {
                    String name = String.valueOf(map.get("name"));
                    if (name.equalsIgnoreCase(selection)) {
                        return parsePrice(map.get("price"), 0);
                    }
                }
            }
        }
        if (!hasClasses) {
            return fallbackPrice;
        }
        return -1;
    }

    private Integer resolveSelectionCapacity(Map<String, Object> meta, String selection) {
        Object rawClasses = meta.get("ticketClasses");
        if (rawClasses instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> map) {
                    String name = String.valueOf(map.get("name"));
                    if (name.equalsIgnoreCase(selection)) {
                        return parseOptionalCapacity(map.get("capacity"));
                    }
                }
            }
        }
        Object rawTables = meta.get("tables");
        if (rawTables instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> map) {
                    String name = String.valueOf(map.get("name"));
                    if (name.equalsIgnoreCase(selection)) {
                        return parseOptionalCapacity(map.get("capacity"));
                    }
                }
            }
        }
        return null;
    }

    private Integer parseOptionalCapacity(Object value) {
        if (value == null) {
            return null;
        }
        String digits = String.valueOf(value).replaceAll("[^0-9]", "").trim();
        if (digits.isBlank()) {
            return null;
        }
        int capacity = Integer.parseInt(digits);
        return capacity > 0 ? capacity : null;
    }

    private int parsePrice(Object fee, int fallback) {
        if (fee == null) {
            return fallback;
        }
        String digits = String.valueOf(fee).replaceAll("[^0-9]", "");
        if (digits.isBlank()) {
            return fallback;
        }
        return Integer.parseInt(digits);
    }

    private Map<String, Object> parseMetadata(String metadata) {
        if (metadata == null || metadata.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(metadata, new TypeReference<>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }

    private static String stringMeta(Map<String, Object> meta, String key, String fallback) {
        Object value = meta.get(key);
        return value == null ? fallback : String.valueOf(value);
    }

    private static String optionalEmail(String email) {
        if (email == null || email.isBlank()) {
            return "";
        }
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        if (!EMAIL_PATTERN.matcher(normalized).matches()) {
            throw new ApiException(400, "Enter a valid email address");
        }
        return normalized;
    }

    private static String requirePhone(String phone) {
        String normalized = PhoneUtils.normalize(phone);
        if (normalized.isBlank() || normalized.length() < 9) {
            throw new ApiException(400, "WhatsApp number is required");
        }
        return normalized;
    }

    private static String requireText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new ApiException(400, message);
        }
        return value.trim();
    }

    private boolean h2ProfileActive() {
        for (String profile : environment.getActiveProfiles()) {
            if ("h2".equalsIgnoreCase(profile)) {
                return true;
            }
        }
        return false;
    }

    private String generateUniqueTicketId() {
        for (int i = 0; i < 12; i++) {
            String candidate = generateTicketId();
            if (!ticketRepository.existsById(candidate)) {
                return candidate;
            }
        }
        throw new ApiException(500, "Could not generate a unique ticket code");
    }

    private static String generateTicketId() {
        final char[] alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".toCharArray();
        ThreadLocalRandom random = ThreadLocalRandom.current();
        char[] out = new char[4];
        for (int i = 0; i < out.length; i++) {
            out[i] = alphabet[random.nextInt(alphabet.length)];
        }
        return new String(out);
    }

    private static String generateQrToken() {
        return UUID.randomUUID().toString().replace("-", "");
    }

    private static String generateAccessToken() {
        return UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    }

    private static String generateImmediatePaymentId() {
        return "PAY-LOCAL-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
    }

    private static String shortCodeForTicketId(String ticketId) {
        if (ticketId == null || ticketId.isBlank()) {
            return "";
        }
        String normalized = ticketId.replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
        if (normalized.length() <= 4) {
            return normalized;
        }
        return normalized.substring(normalized.length() - 4);
    }
}
