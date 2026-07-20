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

    public record EventInfoResponse(
        String masterTicketId,
        String eventName,
        String eventDate,
        String currency,
        String template,
        List<TicketClassOption> ticketClasses,
        String paymentDestination,
        String purchaseUrl
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

    public record GateScanRequest(String qrToken) {}

    public record GateScanResponse(
        boolean valid,
        String result,
        String message,
        String holderName,
        String ticketType,
        String eventName
    ) {}

    public record GateEventResponse(
        String eventName,
        String eventDate
    ) {}
}
