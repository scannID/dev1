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
        String deviceInfo
    ) {}

    public record UpdateTicketStatusRequest(
        TicketStatus status
    ) {}

    public record UpdatePaymentStatusRequest(
        PaymentStatus paymentStatus,
        String paymentReference
    ) {}

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

    public record TicketStatsUpdate(
        String type,
        List<TicketEventStats> stats
    ) {}
}
