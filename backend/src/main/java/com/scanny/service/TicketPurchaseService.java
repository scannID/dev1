package com.scanny.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.scanny.dto.PaymentDtos;
import com.scanny.dto.PublicTicketDtos;
import com.scanny.dto.TicketDtos;
import com.scanny.dto.TicketResponse;
import com.scanny.entity.Ticket;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.PaymentStatus;
import com.scanny.model.enums.TicketStatus;
import com.scanny.payment.PaymentContext;
import com.scanny.payment.service.PaymentGatewayService;
import com.scanny.repository.TicketRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TicketPurchaseService {

    private static final Pattern EMAIL_PATTERN = Pattern.compile(
        "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$"
    );

    private final TicketRepository ticketRepository;
    private final PaymentGatewayService paymentGatewayService;
    private final TicketMailService ticketMailService;
    private final TicketService ticketService;
    private final ObjectMapper objectMapper;

    @Value("${scanny.scan-base-url:https://scanny.app}")
    private String customerUrl;

    public TicketPurchaseService(
            TicketRepository ticketRepository,
            @Lazy PaymentGatewayService paymentGatewayService,
            TicketMailService ticketMailService,
            TicketService ticketService,
            ObjectMapper objectMapper) {
        this.ticketRepository = ticketRepository;
        this.paymentGatewayService = paymentGatewayService;
        this.ticketMailService = ticketMailService;
        this.ticketService = ticketService;
        this.objectMapper = objectMapper;
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
        List<PublicTicketDtos.TicketClassOption> classes = parseClasses(meta, master.getTicketType(), master.getPrice());
        List<PublicTicketDtos.TicketTableOption> tables = parseTables(meta);
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
        Ticket master = requireEventTemplate(request.masterQrToken());
        String email = requireEmail(request.holderEmail());
        String name = requireText(request.holderName(), "Your name is required");
        String phone = requireText(request.holderPhone(), "Mobile money number is required");
        String ticketClass = requireText(request.ticketClass(), "Select a ticket class or table");

        if (ticketRepository.existsByEventNameAndHolderEmailIgnoreCaseAndPaymentStatusAndMasterTicketIdIsNotNull(
                master.getEventName(), email, PaymentStatus.Paid)) {
            throw new ApiException(409, "This email already has a paid ticket for this event. Check your inbox or use a different email.");
        }

        Map<String, Object> masterMeta = parseMetadata(master.getMetadata());
        int price = resolveSelectionPrice(masterMeta, ticketClass, master.getPrice());
        if (price < 0) {
            throw new ApiException(400, "Unknown ticket class or table");
        }

        Ticket attendee = new Ticket();
        attendee.setId(generateTicketId());
        attendee.setQrToken(generateQrToken());
        attendee.setAccessToken(generateAccessToken());
        attendee.setMasterTicketId(master.getId());
        attendee.setTicketType(ticketClass);
        attendee.setEventName(master.getEventName());
        attendee.setEventDate(master.getEventDate());
        attendee.setHolderName(name);
        attendee.setHolderPhone(phone.trim());
        attendee.setHolderEmail(email);
        attendee.setPrice(price);
        attendee.setCurrency(master.getCurrency());
        attendee.setUsageLimit(1);
        attendee.setUsageCount(0);
        attendee.setExpiresAt(master.getExpiresAt());
        attendee.setStatus(TicketStatus.Active);
        attendee.setPaymentStatus(PaymentStatus.Unpaid);
        attendee.setIssuedBy("public-purchase");
        attendee.setMetadata(serializeAttendeeMetadata(masterMeta, ticketClass));
        attendee.setCreatedAt(Instant.now());

        attendee = ticketRepository.save(attendee);

        PaymentDtos.InitiateResponse payment = paymentGatewayService.initiate(new PaymentDtos.InitiateRequest(
            PaymentContext.TICKET,
            attendee.getId(),
            request.provider(),
            price,
            master.getCurrency(),
            phone.trim(),
            name,
            null,
            master.getEventName() + " — " + ticketClass
        ));

        return new PublicTicketDtos.PurchaseResponse(
            attendee.getId(),
            payment.paymentId(),
            payment.status(),
            payment.message(),
            buildViewUrl(attendee.getAccessToken())
        );
    }

    @Transactional
    public void confirmPurchaseFromPayment(String attendeeTicketId, String paymentReference) {
        Ticket ticket = ticketRepository.findById(attendeeTicketId)
            .orElseThrow(() -> new ApiException(404, "Ticket not found"));

        if (!ticket.isAttendeeTicket()) {
            throw new ApiException(400, "Not an attendee ticket");
        }
        if (ticket.getPaymentStatus() == PaymentStatus.Paid) {
            return;
        }

        ticket.setPaymentStatus(PaymentStatus.Paid);
        ticket.setPaymentReference(paymentReference != null ? paymentReference : "");
        ticket.setUpdatedAt(Instant.now());
        ticketRepository.save(ticket);

        ticketMailService.sendAttendeeTicket(ticket, buildViewUrl(ticket.getAccessToken()));
        ticketService.refreshStatsBroadcast();
    }

    @Transactional(readOnly = true)
    public PublicTicketDtos.AttendeeTicketView getAttendeeView(String accessToken) {
        Ticket ticket = ticketRepository.findByAccessToken(accessToken.trim())
            .orElseThrow(() -> new ApiException(404, "Ticket not found"));

        if (!ticket.isAttendeeTicket()) {
            throw new ApiException(404, "Ticket not found");
        }

        Map<String, Object> meta = parseMetadata(ticket.getMetadata());
        return new PublicTicketDtos.AttendeeTicketView(
            ticket.getId(),
            ticket.getTicketType(),
            ticket.getEventName(),
            ticket.getEventDate() != null ? ticket.getEventDate().toString() : null,
            ticket.getHolderName(),
            ticket.getHolderEmail(),
            ticket.getPrice(),
            ticket.getCurrency(),
            ticket.getStatus().name(),
            ticket.getPaymentStatus().name(),
            ticket.canBeUsed(),
            stringMeta(meta, "template", "classic"),
            ticket.getMetadata(),
            buildViewUrl(ticket.getAccessToken()),
            ticket.getQrToken()
        );
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
            .map(t -> new PublicTicketDtos.RecentAttendee(
                t.getId(),
                t.getHolderName(),
                t.getHolderEmail(),
                t.getHolderPhone(),
                t.getTicketType(),
                t.getPrice(),
                t.getCurrency(),
                t.getPaymentStatus().name(),
                t.getStatus().name(),
                t.getCreatedAt()
            ))
            .toList();

        return new PublicTicketDtos.EventTrackingMetrics(
            master.getId(),
            master.getEventName(),
            master.getEventDate() != null ? master.getEventDate().toString() : null,
            stringMeta(meta, "host", ""),
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

    private String buildViewUrl(String accessToken) {
        return customerUrl + "/ticket/view/" + accessToken;
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
    private List<PublicTicketDtos.TicketClassOption> parseClasses(Map<String, Object> meta, String fallbackType, int fallbackPrice) {
        Object raw = meta.get("ticketClasses");
        List<PublicTicketDtos.TicketClassOption> classes = new ArrayList<>();
        if (raw instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> map) {
                    String name = String.valueOf(map.get("name"));
                    int price = parsePrice(map.get("fee"), fallbackPrice);
                    if (!name.isBlank() && !"null".equalsIgnoreCase(name)) {
                        classes.add(new PublicTicketDtos.TicketClassOption(name, price));
                    }
                }
            }
        }
        if (classes.isEmpty()) {
            classes.add(new PublicTicketDtos.TicketClassOption(fallbackType, fallbackPrice));
        }
        return classes;
    }

    @SuppressWarnings("unchecked")
    private List<PublicTicketDtos.TicketTableOption> parseTables(Map<String, Object> meta) {
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
                tables.add(new PublicTicketDtos.TicketTableOption(name, seats, price));
            }
        }
        return tables;
    }

    private int resolveSelectionPrice(Map<String, Object> meta, String selection, int fallbackPrice) {
        for (PublicTicketDtos.TicketClassOption option : parseClasses(meta, selection, fallbackPrice)) {
            if (option.name().equalsIgnoreCase(selection)) {
                return option.price();
            }
        }
        for (PublicTicketDtos.TicketTableOption table : parseTables(meta)) {
            if (table.name().equalsIgnoreCase(selection)) {
                return table.price();
            }
        }
        return -1;
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

    private static String requireEmail(String email) {
        String normalized = requireText(email, "Email is required").trim().toLowerCase(Locale.ROOT);
        if (!EMAIL_PATTERN.matcher(normalized).matches()) {
            throw new ApiException(400, "Enter a valid email address");
        }
        return normalized;
    }

    private static String requireText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new ApiException(400, message);
        }
        return value.trim();
    }

    private static String generateTicketId() {
        return "TKT-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
    }

    private static String generateQrToken() {
        return UUID.randomUUID().toString().replace("-", "");
    }

    private static String generateAccessToken() {
        return UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    }
}
