package com.scanit.dto;

import com.scanit.model.enums.PaymentStatus;
import com.scanit.model.enums.ScanResult;
import com.scanit.model.enums.TicketStatus;
import java.time.Instant;

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
}
