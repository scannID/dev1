package com.scanny.dto;

import com.scanny.payment.PaymentIntentStatus;
import java.util.List;

public class PublicTicketDtos {

    private PublicTicketDtos() {
        throw new UnsupportedOperationException("Utility class");
    }

    /**
     * @param capacity null means unlimited stock
     * @param remaining null when unlimited; otherwise units left after sold + held
     * @param saleEndsAt ISO-8601 string — when this specific class stops selling (null = no per-class cutoff)
     * @param presaleRequired true when this class requires a presale code at checkout
     */
    public record TicketClassOption(
        String name,
        int price,
        Integer capacity,
        int sold,
        int held,
        Integer remaining,
        boolean soldOut,
        String saleEndsAt,
        boolean presaleRequired
    ) {}

    /**
     * @param seats party size for the table package (display)
     * @param capacity how many of this package can be sold; null = unlimited
     * @param saleEndsAt ISO-8601 string — per-table cutoff (null = uses event-level saleEndsAt)
     */
    public record TicketTableOption(
        String name,
        int seats,
        int price,
        Integer capacity,
        int sold,
        int held,
        Integer remaining,
        boolean soldOut,
        String saleEndsAt
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
        String host,
        String saleStartsAt,
        String saleEndsAt,
        boolean saleOpen,
        boolean queueEnabled
    ) {
        public EventInfoResponse(
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
            String host,
            String saleStartsAt,
            String saleEndsAt,
            boolean saleOpen
        ) {
            this(masterTicketId, eventName, eventDate, currency, template, ticketClasses, tables, paymentDestination, purchaseUrl, eventImageUrl, host, saleStartsAt, saleEndsAt, saleOpen, false);
        }
    }

    public record PurchaseRequest(
        String masterQrToken,
        String ticketClass,
        String holderName,
        String holderEmail,
        String holderPhone,
        String paymentPhone,
        String provider,
        String presaleCode
    ) {
        public PurchaseRequest(
            String masterQrToken,
            String ticketClass,
            String holderName,
            String holderEmail,
            String holderPhone,
            String provider,
            String presaleCode
        ) {
            this(masterQrToken, ticketClass, holderName, holderEmail, holderPhone, null, provider, presaleCode);
        }

        public PurchaseRequest(
            String masterQrToken,
            String ticketClass,
            String holderName,
            String holderEmail,
            String holderPhone,
            String provider
        ) {
            this(masterQrToken, ticketClass, holderName, holderEmail, holderPhone, null, provider, null);
        }
    }

    public record QueueStatusResponse(
        String queueToken,
        String status,
        Integer position,
        Long totalInQueue,
        Integer estimatedWaitSeconds,
        String attendeeTicketId,
        String viewUrl,
        String errorMessage
    ) {}

    public record PurchaseResponse(
        String attendeeTicketId,
        String ticketCode,
        String paymentId,
        PaymentIntentStatus paymentStatus,
        String message,
        String viewUrl
    ) {}

    public record TransferInitiateResponse(
        String transferToken,
        String transferUrl,
        String expiresAt
    ) {}

    public record TransferInfoResponse(
        String eventName,
        String eventDate,
        String ticketType,
        String originalHolderName,
        String expiresAt,
        boolean valid,
        String message
    ) {}

    public record TransferAcceptRequest(
        String transferToken,
        String newHolderName,
        String newHolderPhone,
        String newHolderEmail
    ) {}

    public record TransferAcceptResponse(
        String attendeeTicketId,
        String viewUrl,
        String message
    ) {}

    public record AttendeeTicketView(
        String id,
        String ticketType,
        String eventName,
        String eventDate,
        String holderName,
        String holderEmail,
        String holderPhone,
        int price,
        String currency,
        String status,
        String paymentStatus,
        boolean canBeUsed,
        String template,
        String metadata,
        String viewUrl,
        String qrToken,
        String ticketCode,
        String qrPayload,
        String gateUrl,
        String purchaseUrl
    ) {}

    /** Public progress for an event creator, keyed by master event id (e.g. ERI-FA255B03). */
    public record EventTrackingMetrics(
        String ticketId,
        String eventName,
        String eventDate,
        String host,
        String eventImageUrl,
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
        java.time.Instant createdAt,
        String viewUrl,
        String qrPayload,
        String gateUrl
    ) {}

    public record RedeemedAttendee(
        String ticketId,
        String ticketCode,
        String holderName,
        String holderPhone,
        String ticketType,
        String paymentStatus,
        String status,
        java.time.Instant redeemedAt
    ) {}
}
