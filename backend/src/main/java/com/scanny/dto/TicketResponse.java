package com.scanny.dto;

import com.scanny.entity.Ticket;
import com.scanny.model.enums.PaymentStatus;
import com.scanny.model.enums.TicketStatus;
import java.time.Instant;

public record TicketResponse(
    String id,
    String qrToken,
    String ticketType,
    String eventName,
    Instant eventDate,
    String holderName,
    String holderPhone,
    String holderEmail,
    int price,
    String currency,
    TicketStatus status,
    int usageLimit,
    int usageCount,
    Instant expiresAt,
    String paymentReference,
    PaymentStatus paymentStatus,
    String issuedBy,
    String metadata,
    Instant createdAt,
    Instant updatedAt,
    Instant redeemedAt,
    boolean canBeUsed,
    String qrCodeUrl
) {
    public static TicketResponse from(Ticket ticket, String baseUrl) {
        return new TicketResponse(
            ticket.getId(),
            ticket.getQrToken(),
            ticket.getTicketType(),
            ticket.getEventName(),
            ticket.getEventDate(),
            ticket.getHolderName(),
            ticket.getHolderPhone(),
            ticket.getHolderEmail(),
            ticket.getPrice(),
            ticket.getCurrency(),
            ticket.getStatus(),
            ticket.getUsageLimit(),
            ticket.getUsageCount(),
            ticket.getExpiresAt(),
            ticket.getPaymentReference(),
            ticket.getPaymentStatus(),
            ticket.getIssuedBy(),
            ticket.getMetadata(),
            ticket.getCreatedAt(),
            ticket.getUpdatedAt(),
            ticket.getRedeemedAt(),
            ticket.canBeUsed(),
            baseUrl + "/ticket/" + ticket.getQrToken()
        );
    }
}
