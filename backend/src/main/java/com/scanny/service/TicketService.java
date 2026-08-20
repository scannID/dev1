package com.scanny.service;

import com.scanny.dto.TicketDtos;
import com.scanny.dto.TicketResponse;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.scanny.entity.Ticket;
import com.scanny.entity.TicketScan;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.PaymentStatus;
import com.scanny.model.enums.ScanResult;
import com.scanny.model.enums.TicketStatus;
import com.scanny.repository.TicketRepository;
import com.scanny.repository.TicketScanRepository;
import com.scanny.websocket.RealtimeEventPublisher;
import com.scanny.websocket.TicketStatsWebSocketHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class TicketService {

    private final TicketRepository ticketRepository;
    private final TicketScanRepository ticketScanRepository;
    private final TicketStatsWebSocketHandler ticketStatsWebSocketHandler;
    private final RealtimeEventPublisher realtimeEventPublisher;
    private final AuditService auditService;
    private final ObjectMapper objectMapper;

    @Value("${scanny.scan-base-url:https://scanny.app}")
    private String customerUrl;

    @Value("${scanny.tickets.auto-delete-hours-after-event:24}")
    private long autoDeleteHoursAfterEvent;

    public TicketService(
        TicketRepository ticketRepository,
        TicketScanRepository ticketScanRepository,
        TicketStatsWebSocketHandler ticketStatsWebSocketHandler,
        RealtimeEventPublisher realtimeEventPublisher,
        AuditService auditService,
        ObjectMapper objectMapper
    ) {
        this.ticketRepository = ticketRepository;
        this.ticketScanRepository = ticketScanRepository;
        this.ticketStatsWebSocketHandler = ticketStatsWebSocketHandler;
        this.realtimeEventPublisher = realtimeEventPublisher;
        this.auditService = auditService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public TicketResponse createTicket(TicketDtos.CreateTicketRequest request) {
        Ticket ticket = new Ticket();
        boolean eventTemplate = request.usageLimit() > 1_000_000;
        ticket.setId(eventTemplate ? generateEventId() : generateTicketId());
        ticket.setQrToken(generateQrToken());
        ticket.setTicketType(request.ticketType());
        ticket.setEventName(request.eventName());
        ticket.setEventDate(request.eventDate());
        ticket.setHolderName(request.holderName() != null ? request.holderName() : "");
        ticket.setHolderPhone(request.holderPhone() != null ? request.holderPhone() : "");
        ticket.setHolderEmail(request.holderEmail() != null ? request.holderEmail() : "");
        ticket.setPrice(request.price());
        ticket.setCurrency(request.currency() != null ? request.currency() : "UGX");
        ticket.setUsageLimit(request.usageLimit() > 0 ? request.usageLimit() : 1);
        ticket.setExpiresAt(request.expiresAt());
        ticket.setIssuedBy(request.issuedBy() != null ? request.issuedBy() : "");
        ticket.setMetadata(request.metadata());
        ticket.setStatus(TicketStatus.Active);
        ticket.setPaymentStatus(PaymentStatus.Unpaid);

        if (eventTemplate && request.metadata() != null) {
            Map<String, Object> meta = parseMetadata(request.metadata());
            ticket.setSaleStartsAt(parseInstant(meta.get("saleStartsAt")));
            ticket.setSaleEndsAt(parseInstant(meta.get("saleEndsAt")));
        }

        ticket = ticketRepository.save(ticket);
        auditService.success(
            "TICKET_CREATED",
            "ticket",
            ticket.getId(),
            Map.of(
                "eventName", ticket.getEventName() != null ? ticket.getEventName() : "",
                "ticketType", ticket.getTicketType() != null ? ticket.getTicketType() : ""
            )
        );
        broadcastStatsUpdate();
        return TicketResponse.from(ticket, customerUrl);
    }

    @Transactional(readOnly = true)
    public TicketResponse getTicket(String ticketId) {
        Ticket ticket = ticketRepository.findById(ticketId)
            .orElseThrow(() -> new RuntimeException("Ticket not found: " + ticketId));
        return TicketResponse.from(ticket, customerUrl);
    }

    @Transactional(readOnly = true)
    public TicketResponse getTicketByQrToken(String qrToken) {
        Ticket ticket = ticketRepository.findByQrToken(qrToken)
            .orElseThrow(() -> new RuntimeException("Ticket not found with QR token: " + qrToken));
        return TicketResponse.from(ticket, customerUrl);
    }

    @Transactional(readOnly = true)
    public List<TicketResponse> getAllTickets() {
        return ticketRepository.findAll().stream()
            .map(ticket -> TicketResponse.from(ticket, customerUrl))
            .toList();
    }

    @Transactional(readOnly = true)
    public List<TicketResponse> getTicketsByEvent(String eventName) {
        return ticketRepository.findByEventName(eventName).stream()
            .map(ticket -> TicketResponse.from(ticket, customerUrl))
            .toList();
    }

    @Transactional(readOnly = true)
    public List<TicketDtos.TicketEventStats> getTicketStats(String search) {
        String normalizedSearch = search == null ? "" : search.trim().toLowerCase();
        return ticketRepository.aggregateAttendeeEventStats(normalizedSearch).stream()
            .map(row -> new TicketDtos.TicketEventStats(
                row[0] == null ? "Untitled Event" : String.valueOf(row[0]),
                row[1] == null ? 0L : ((Number) row[1]).longValue(),
                row[2] == null ? 0L : ((Number) row[2]).longValue()
            ))
            .sorted(Comparator.comparing(TicketDtos.TicketEventStats::eventName))
            .toList();
    }

    @Transactional(readOnly = true)
    public List<TicketDtos.CreatedEventSummary> getCreatedEvents(String search) {
        String needle = search == null ? "" : search.trim().toLowerCase();
        return ticketRepository.findByMasterTicketIdIsNullAndUsageLimitGreaterThan(1_000_000).stream()
            .filter(Ticket::isEventTemplate)
            .filter(master -> {
                if (needle.isBlank()) return true;
                return master.getEventName().toLowerCase().contains(needle)
                    || master.getId().toLowerCase().contains(needle);
            })
            .sorted(Comparator.comparing(Ticket::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
            .map(this::toCreatedEventSummary)
            .toList();
    }

    private TicketDtos.CreatedEventSummary toCreatedEventSummary(Ticket master) {
        List<Ticket> attendees = ticketRepository.findByMasterTicketIdOrderByCreatedAtDesc(master.getId());
        long paid = attendees.stream().filter(t -> t.getPaymentStatus() == PaymentStatus.Paid).count();
        long redeemed = attendees.stream().filter(t -> t.getStatus() == TicketStatus.Redeemed).count();
        Map<String, Object> meta = parseMetadata(master.getMetadata());
        String host = stringMeta(meta, "host");
        String location = stringMeta(meta, "location");
        Instant eventDate = master.getEventDate();
        long hours = Math.max(1, autoDeleteHoursAfterEvent);
        Instant autoDeleteAt = eventDate != null
            ? eventDate.plus(hours, java.time.temporal.ChronoUnit.HOURS)
            : null;
        return new TicketDtos.CreatedEventSummary(
            master.getId(),
            master.getEventName(),
            eventDate,
            master.getCreatedAt(),
            autoDeleteAt,
            master.getStatus() != null ? master.getStatus().name() : "Active",
            host,
            location,
            customerUrl + "/ticket/" + master.getQrToken(),
            attendees.size(),
            paid,
            redeemed
        );
    }

    private Map<String, Object> parseMetadata(String raw) {
        if (raw == null || raw.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(raw, new TypeReference<>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }

    private static String stringMeta(Map<String, Object> meta, String key) {
        Object value = meta.get(key);
        return value == null ? "" : String.valueOf(value).trim();
    }

    @Transactional
    public TicketDtos.ScanValidationResponse scanTicket(String qrToken, TicketDtos.ScanTicketRequest request) {
        Ticket ticket = ticketRepository.findByQrToken(qrToken)
            .orElseThrow(() -> new RuntimeException("Invalid QR code"));

        return validateAndRecordScan(ticket, request.scannedBy(), request.scanLocation(), request.deviceInfo(), null, null, null);
    }

    @Transactional
    public TicketDtos.ScanValidationResponse scanTicketPayload(TicketDtos.ScanPayloadRequest request) {
        GatePayload payload = parseGatePayload(request.payload());
        String gateEventId = request.eventId() != null ? request.eventId().trim() : "";
        if (gateEventId.isBlank()) {
            throw new ApiException(400, "Scan event QR and start gate session before validating tickets");
        }
        String payloadEventId = nullToEmpty(payload.eventId());
        String expectedEventId = gateEventId;
        Ticket ticket;
        if (!payload.ticketId().isBlank()) {
            ticket = ticketRepository.findById(payload.ticketId())
                .orElseThrow(() -> new ApiException(404, "Ticket not found"));
        } else if (!payload.shortCode().isBlank()) {
            List<Ticket> matched = ticketRepository.findByMasterTicketIdAndIdEndingWithIgnoreCase(
                expectedEventId,
                payload.shortCode()
            ).stream()
                .filter(Ticket::isAttendeeTicket)
                .toList();
            if (matched.isEmpty()) {
                throw new ApiException(404, "Ticket code not found for this event");
            }
            if (matched.size() > 1) {
                throw new ApiException(409, "Ticket code collision. Scan the QR ticket directly.");
            }
            ticket = matched.get(0);
        } else {
            throw new ApiException(400, "Ticket payload or ticket code is required");
        }
        if (!ticket.isAttendeeTicket()) {
            throw new ApiException(400, "Only attendee tickets can be scanned at the gate");
        }
        String masterId = nullToEmpty(ticket.getMasterTicketId());
        if (!payloadEventId.isBlank() && !masterId.isBlank()
                && !payloadEventId.equalsIgnoreCase(masterId)) {
            throw new ApiException(400, "Ticket event does not match payload");
        }
        if (!gateEventId.isBlank() && !payloadEventId.isBlank()
                && !gateEventId.equalsIgnoreCase(payloadEventId)) {
            throw new ApiException(400, "Ticket is for a different event");
        }
        return validateAndRecordScan(
            ticket,
            request.scannedBy(),
            request.scanLocation(),
            request.deviceInfo(),
            expectedEventId,
            payload.paymentId(),
            payload.qrToken()
        );
    }

    private TicketDtos.ScanValidationResponse validateAndRecordScan(
            Ticket ticket,
            String scannedBy,
            String scanLocation,
            String deviceInfo,
            String expectedEventId,
            String expectedPaymentId,
            String expectedQrToken) {
        TicketScan scan = new TicketScan();
        scan.setTicket(ticket);
        scan.setScannedBy(scannedBy != null ? scannedBy : "");
        scan.setScanLocation(scanLocation != null ? scanLocation : "");
        scan.setDeviceInfo(deviceInfo);

        ScanResult result;
        String message;
        boolean valid = false;

        if (expectedEventId != null && !expectedEventId.isBlank()
                && !expectedEventId.equalsIgnoreCase(nullToEmpty(ticket.getMasterTicketId()))) {
            result = ScanResult.Invalid;
            message = "Ticket event does not match this gate";
        } else if (expectedQrToken != null && !expectedQrToken.isBlank()
                && !expectedQrToken.equals(ticket.getQrToken())) {
            result = ScanResult.Invalid;
            message = "Ticket token is invalid";
        } else if (expectedPaymentId != null && !expectedPaymentId.isBlank()
                && !expectedPaymentId.equalsIgnoreCase(nullToEmpty(ticket.getPaymentReference()))) {
            result = ScanResult.Invalid;
            message = "Ticket payment mapping is invalid";
        } else if (ticket.getPaymentStatus() != PaymentStatus.Paid) {
            result = ScanResult.PaymentRequired;
            message = "Payment required for this ticket";
        } else if (ticket.isExpired()) {
            result = ScanResult.Expired;
            message = "Ticket has expired";
            ticket.setStatus(TicketStatus.Expired);
        } else if (ticket.getStatus() == TicketStatus.Cancelled) {
            result = ScanResult.Invalid;
            message = "Ticket has been cancelled";
        } else if (ticket.getUsageCount() >= ticket.getUsageLimit()) {
            result = ScanResult.UsageLimitReached;
            message = "Ticket has already been used";
            if (ticket.getStatus() == TicketStatus.Active) {
                ticket.setStatus(TicketStatus.Redeemed);
            }
        } else if (ticket.canBeUsed()) {
            result = ScanResult.Success;
            message = "Ticket is valid";
            valid = true;
            
            // Increment usage count
            ticket.setUsageCount(ticket.getUsageCount() + 1);
            ticket.setUpdatedAt(Instant.now());
            
            // Mark as redeemed if usage limit reached
            if (ticket.getUsageCount() >= ticket.getUsageLimit()) {
                ticket.setStatus(TicketStatus.Redeemed);
                ticket.setRedeemedAt(Instant.now());
            }
        } else {
            result = ScanResult.Invalid;
            message = "Ticket is not valid";
        }

        scan.setScanResult(result);
        ticketScanRepository.save(scan);
        ticketRepository.save(ticket);
        broadcastStatsUpdate();

        return new TicketDtos.ScanValidationResponse(
            valid,
            result,
            message,
            TicketResponse.from(ticket, customerUrl)
        );
    }

    private GatePayload parseGatePayload(String rawPayload) {
        if (rawPayload == null || rawPayload.isBlank()) {
            throw new ApiException(400, "Scan payload is required");
        }
        String trimmed = extractTicketPayload(rawPayload.trim());
        if (isShortCode(trimmed)) {
            return new GatePayload("", "", "", "", trimmed.toUpperCase(Locale.ROOT));
        }
        if (!trimmed.startsWith("SCANNY:TICKET:")) {
            throw new ApiException(400, "Unsupported ticket payload");
        }
        String encoded = trimmed.substring("SCANNY:TICKET:".length());
        try {
            String json = new String(Base64.getUrlDecoder().decode(encoded), StandardCharsets.UTF_8);
            Map<String, String> values = objectMapper.readValue(json, new TypeReference<>() {});
            String ticketId = values.getOrDefault("ticketId", "").trim();
            String eventId = values.getOrDefault("eventId", "").trim();
            String paymentId = values.getOrDefault("paymentId", "").trim();
            String qrToken = values.getOrDefault("qrToken", "").trim();
            String shortCode = values.getOrDefault("code", "").trim().toUpperCase(Locale.ROOT);
            if (ticketId.isBlank() && shortCode.isBlank()) {
                throw new ApiException(400, "Invalid payload: missing ticket id/code");
            }
            if (shortCode.isBlank() && !ticketId.isBlank()) {
                shortCode = shortCodeForTicketId(ticketId);
            }
            return new GatePayload(ticketId, eventId, paymentId, qrToken, shortCode);
        } catch (ApiException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ApiException(400, "Invalid payload encoding");
        }
    }

    private static String extractTicketPayload(String raw) {
        if (raw.startsWith("SCANNY:TICKET:")) {
            return raw;
        }
        try {
            java.net.URI uri = java.net.URI.create(raw);
            String query = uri.getRawQuery();
            if (query != null) {
                for (String part : query.split("&")) {
                    int eq = part.indexOf('=');
                    if (eq <= 0) continue;
                    String key = part.substring(0, eq);
                    if (!"p".equals(key) && !"payload".equals(key)) continue;
                    String value = java.net.URLDecoder.decode(part.substring(eq + 1), StandardCharsets.UTF_8);
                    if (value.startsWith("SCANNY:TICKET:")) {
                        return value;
                    }
                }
            }
        } catch (Exception ignored) {
            // fall through
        }
        int marker = raw.indexOf("SCANNY:TICKET:");
        if (marker >= 0) {
            return raw.substring(marker);
        }
        return raw;
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    private static boolean isShortCode(String value) {
        if (value == null) return false;
        String normalized = value.trim();
        return normalized.matches("(?i)^[A-Z0-9]{4}$");
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

    private record GatePayload(String ticketId, String eventId, String paymentId, String qrToken, String shortCode) {}

    @Transactional
    public TicketResponse updateTicketStatus(String ticketId, TicketStatus status) {
        Ticket ticket = ticketRepository.findById(ticketId)
            .orElseThrow(() -> new RuntimeException("Ticket not found: " + ticketId));
        
        ticket.setStatus(status);
        ticket.setUpdatedAt(Instant.now());
        
        if (status == TicketStatus.Cancelled) {
            ticket.setRedeemedAt(Instant.now());
        }
        
        ticket = ticketRepository.save(ticket);
        broadcastStatsUpdate();
        return TicketResponse.from(ticket, customerUrl);
    }

    @Transactional
    public TicketResponse updatePaymentStatus(String ticketId, PaymentStatus paymentStatus, String paymentReference) {
        Ticket ticket = ticketRepository.findById(ticketId)
            .orElseThrow(() -> new RuntimeException("Ticket not found: " + ticketId));
        
        ticket.setPaymentStatus(paymentStatus);
        if (paymentReference != null) {
            ticket.setPaymentReference(paymentReference);
        }
        ticket.setUpdatedAt(Instant.now());
        
        ticket = ticketRepository.save(ticket);
        broadcastStatsUpdate();
        return TicketResponse.from(ticket, customerUrl);
    }

    @Transactional
    public TicketResponse updateCreatedEvent(String eventId, TicketDtos.UpdateCreatedEventRequest request) {
        if (request == null) {
            throw new ApiException(400, "Update payload is required");
        }
        Ticket master = ticketRepository.findByIdForUpdate(eventId)
            .orElseThrow(() -> new ApiException(404, "Event not found"));
        if (!master.isEventTemplate()) {
            throw new ApiException(400, "Only created event templates can be edited");
        }

        String eventName = normalizeRequiredText(request.eventName());
        if (eventName.isBlank()) {
            throw new ApiException(400, "Event name is required");
        }
        master.setEventName(eventName);
        if (request.eventDate() != null) {
            master.setEventDate(request.eventDate());
        }

        String nextTicketType = normalizeRequiredText(request.ticketType());
        if (nextTicketType.isBlank()) {
            throw new ApiException(400, "Ticket type is required");
        }
        master.setTicketType(nextTicketType);
        if (request.price() != null && request.price() >= 0) {
            master.setPrice(request.price());
        }
        String currency = normalizeRequiredText(request.currency());
        if (!currency.isBlank()) {
            master.setCurrency(currency);
        }

        Map<String, Object> meta = new LinkedHashMap<>(parseMetadata(master.getMetadata()));
        putMeta(meta, "template", request.template());
        putMeta(meta, "payTo", request.payTo());
        putMeta(meta, "location", request.location());
        putMeta(meta, "time", request.time());
        putMeta(meta, "host", request.host());
        putMeta(meta, "hostContact", request.hostContact());
        putMeta(meta, "eventImageUrl", request.eventImageUrl());

        if (request.saleStartsAt() != null) {
            master.setSaleStartsAt(request.saleStartsAt());
        }
        if (request.saleEndsAt() != null) {
            master.setSaleEndsAt(request.saleEndsAt());
        }

        if (request.ticketClasses() != null) {
            List<Map<String, Object>> classes = new ArrayList<>();
            for (TicketDtos.EventClassInput item : request.ticketClasses()) {
                if (item == null) continue;
                String name = normalizeRequiredText(item.name());
                if (name.isBlank()) {
                    throw new ApiException(400, "Ticket class name is required");
                }
                int fee = item.fee() == null ? 0 : Math.max(0, item.fee());
                Integer capacity = sanitizeCapacity(item.capacity());
                assertCapacityNotBelowSold(master.getId(), name, capacity);
                Map<String, Object> cls = new LinkedHashMap<>();
                cls.put("name", name);
                cls.put("fee", fee);
                if (capacity != null) {
                    cls.put("capacity", capacity);
                }
                if (item.saleEndsAt() != null && !item.saleEndsAt().isBlank()) {
                    cls.put("saleEndsAt", item.saleEndsAt().trim());
                }
                if (item.presaleCode() != null && !item.presaleCode().isBlank()) {
                    cls.put("presaleCode", item.presaleCode().trim());
                    cls.put("presaleRequired", true);
                }
                classes.add(cls);
            }
            meta.put("ticketClasses", classes);
        }

        if (request.tables() != null) {
            List<Map<String, Object>> tables = new ArrayList<>();
            for (TicketDtos.EventTableInput item : request.tables()) {
                if (item == null) continue;
                String name = normalizeRequiredText(item.name());
                if (name.isBlank()) {
                    throw new ApiException(400, "Table name is required");
                }
                int seats = item.seats() == null ? 0 : Math.max(0, item.seats());
                int price = item.price() == null ? 0 : Math.max(0, item.price());
                Integer capacity = sanitizeCapacity(item.capacity());
                assertCapacityNotBelowSold(master.getId(), name, capacity);
                Map<String, Object> table = new LinkedHashMap<>();
                table.put("name", name);
                table.put("seats", seats);
                table.put("price", price);
                if (capacity != null) {
                    table.put("capacity", capacity);
                }
                if (item.saleEndsAt() != null && !item.saleEndsAt().isBlank()) {
                    table.put("saleEndsAt", item.saleEndsAt().trim());
                }
                tables.add(table);
            }
            meta.put("tables", tables);
        }

        master.setMetadata(writeMetadata(meta));
        master.setUpdatedAt(Instant.now());
        Ticket saved = ticketRepository.save(master);
        broadcastStatsUpdate();
        return TicketResponse.from(saved, customerUrl);
    }

    private static Instant parseInstant(Object val) {
        if (val == null) return null;
        if (val instanceof Instant inst) return inst;
        String str = String.valueOf(val).trim();
        if (str.isBlank() || "null".equalsIgnoreCase(str)) return null;
        try {
            return Instant.parse(str);
        } catch (Exception e) {
            return null;
        }
    }

    private static String normalizeRequiredText(String value) {
        if (value == null) {
            return "";
        }
        String out = value.trim();
        return out;
    }

    private static Integer sanitizeCapacity(Integer value) {
        if (value == null) return null;
        return value > 0 ? value : null;
    }

    private void assertCapacityNotBelowSold(String masterId, String selection, Integer capacity) {
        if (capacity == null) {
            return;
        }
        long sold = ticketRepository.countSoldByMasterAndType(masterId, selection);
        long held = ticketRepository.countActiveHoldsByMasterAndType(masterId, selection, Instant.now());
        if (capacity < sold + held) {
            throw new ApiException(400, "Capacity for " + selection + " cannot be below already sold/held tickets");
        }
    }

    private static void putMeta(Map<String, Object> meta, String key, String value) {
        if (value == null) {
            return;
        }
        String trimmed = value.trim();
        if (trimmed.isBlank()) {
            meta.remove(key);
        } else {
            meta.put(key, trimmed);
        }
    }

    private String writeMetadata(Map<String, Object> meta) {
        try {
            return objectMapper.writeValueAsString(meta);
        } catch (Exception e) {
            throw new ApiException(400, "Invalid event metadata");
        }
    }

    private void broadcastStatsUpdate() {
        try {
            List<TicketDtos.TicketEventStats> stats = getTicketStats(null);
            ticketStatsWebSocketHandler.broadcastTicketStats(stats);
            realtimeEventPublisher.publishTicketStats(stats);
        } catch (Exception ex) {
            // Never fail a gate knock-off because stats fan-out broke.
            org.slf4j.LoggerFactory.getLogger(TicketService.class)
                .warn("Ticket stats broadcast failed: {}", ex.toString());
        }
    }

    public void refreshStatsBroadcast() {
        broadcastStatsUpdate();
    }

    /** Purchased / attendee tickets only. Event shells use {@link #generateEventId()}. */
    private String generateTicketId() {
        return "TKT-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    /** Event (master) IDs shown at creation / gate entry — not sold tickets. */
    private String generateEventId() {
        return "ERI-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    private String generateQrToken() {
        return UUID.randomUUID().toString().replace("-", "");
    }
}
