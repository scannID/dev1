package com.scanny.dto;

import com.scanny.payment.PaymentIntentStatus;
import java.util.List;

public class PublicTicketDtos {

    private PublicTicketDtos() {
        throw new UnsupportedOperationException("Utility class");
    }

    public record TicketClassOption(
        String name,
        int price
    ) {}

    public record TicketTableOption(
        String name,
        int seats,
        int price
    ) {}

    public record EventInfoResponse(
        String masterTicketId,
        String eventName,
        String eventDate,
        String currency,
        String template,
        List<TicketClassOption> ticketClasses,
        List<TicketTableOption> tables,
        String paymentDestination,
        String purchaseUrl,
        String eventImageUrl,
        String host
    ) {}

    public record PurchaseRequest(
        String masterQrToken,
        String ticketClass,
        String holderName,
        String holderEmail,
        String holderPhone,
        String provider
    ) {}

    public record PurchaseResponse(
        String attendeeTicketId,
        String paymentId,
        PaymentIntentStatus paymentStatus,
        String message,
        String viewUrl
    ) {}

    public record AttendeeTicketView(
        String id,
        String ticketType,
        String eventName,
        String eventDate,
        String holderName,
        String holderEmail,
        int price,
        String currency,
        String status,
        String paymentStatus,
        boolean canBeUsed,
        String template,
        String metadata,
        String viewUrl,
        String qrToken
    ) {}

    /** Public progress for an event creator, keyed by master ticket id (e.g. TKT-FA255B03). */
    public record EventTrackingMetrics(
        String ticketId,
        String eventName,
        String eventDate,
        String host,
        String status,
        long orderedTickets,
        long purchasedTickets,
        long pendingTickets,
        long redeemedTickets,
        long totalCollected,
        String currency,
        String purchaseUrl,
        java.time.Instant createdAt,
        java.util.List<RecentAttendee> recentAttendees
    ) {}

    public record RecentAttendee(
        String ticketId,
        String holderName,
        String holderEmail,
        String holderPhone,
        String ticketType,
        int price,
        String currency,
        String paymentStatus,
        String status,
        java.time.Instant createdAt
    ) {}
}
