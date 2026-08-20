package com.scanny.dto;

import com.scanny.model.enums.PaymentStatus;
import com.scanny.model.enums.ScanResult;
import com.scanny.model.enums.TicketStatus;
import java.time.Instant;
import java.util.List;

public class TicketDtos {

    private TicketDtos() {
        throw new UnsupportedOperationException("Utility class");
    }

    // Request DTOs

    public record CreateTicketRequest(
        String ticketType,
        String eventName,
        Instant eventDate,
        String holderName,
        String holderPhone,
        String holderEmail,
        int price,
        String currency,
        int usageLimit,
        Instant expiresAt,
        String issuedBy,
        String metadata
    ) {}

    public record ScanTicketRequest(
        String scannedBy,
        String scanLocation,
        String deviceInfo
    ) {}

    public record ScanPayloadRequest(
        String payload,
        String scannedBy,
        String scanLocation,
        String deviceInfo,
        /** Optional gate session event ref (master ticket id). Must match ticket when set. */
        String eventId
    ) {}

    public record UpdateTicketStatusRequest(
        TicketStatus status
    ) {}

    public record UpdatePaymentStatusRequest(
        PaymentStatus paymentStatus,
        String paymentReference
    ) {}

    public record EventClassInput(
        String name,
        Integer fee,
        Integer capacity,
        String saleEndsAt,
        String presaleCode
    ) {
        public EventClassInput(String name, Integer fee, Integer capacity) {
            this(name, fee, capacity, null, null);
        }
    }

    public record EventTableInput(
        String name,
        Integer seats,
        Integer price,
        Integer capacity,
        String saleEndsAt
    ) {
        public EventTableInput(String name, Integer seats, Integer price, Integer capacity) {
            this(name, seats, price, capacity, null);
        }
    }

    public record UpdateCreatedEventRequest(
        String eventName,
        Instant eventDate,
        String ticketType,
        Integer price,
        String currency,
        String template,
        String payTo,
        String location,
        String time,
        String host,
        String hostContact,
        String eventImageUrl,
        Instant saleStartsAt,
        Instant saleEndsAt,
        List<EventClassInput> ticketClasses,
        List<EventTableInput> tables
    ) {
        public UpdateCreatedEventRequest(
            String eventName,
            Instant eventDate,
            String ticketType,
            Integer price,
            String currency,
            String template,
            String payTo,
            String location,
            String time,
            String host,
            String hostContact,
            String eventImageUrl,
            List<EventClassInput> ticketClasses,
            List<EventTableInput> tables
        ) {
            this(eventName, eventDate, ticketType, price, currency, template, payTo, location, time, host, hostContact, eventImageUrl, null, null, ticketClasses, tables);
        }
    }

    // Response DTOs

    public record TicketScanResponse(
        Long id,
        String ticketId,
        Instant scannedAt,
        String scannedBy,
        String scanLocation,
        String deviceInfo,
        ScanResult scanResult
    ) {}

    public record ScanValidationResponse(
        boolean valid,
        ScanResult result,
        String message,
        TicketResponse ticket
    ) {}

    public record TicketEventStats(
        String eventName,
        long totalTickets,
        long purchasedTickets
    ) {}

    /** Master event templates created by managers, with live ticket counts. */
    public record CreatedEventSummary(
        String eventId,
        String eventName,
        Instant eventDate,
        Instant createdAt,
        Instant autoDeleteAt,
        String status,
        String host,
        String location,
        String purchaseUrl,
        long attendeeTickets,
        long paidTickets,
        long redeemedTickets
    ) {}

    public record TicketStatsUpdate(
        String type,
        List<TicketEventStats> stats
    ) {}
}
