package com.scanny.dto;

import com.scanny.model.enums.QuickPaymentCodeStatus;
import com.scanny.model.enums.TransactionStatus;
import java.time.Instant;
import java.util.List;

public class QuickPaymentDtos {

    private QuickPaymentDtos() {
        throw new UnsupportedOperationException("Utility class");
    }

    // Request DTOs

    public record CreateQuickPaymentCodeRequest(
        String description,
        int amount,
        String currency,
        String ownerName,
        String ownerPhone,
        String ownerEmail,
        String paymentDestination,
        String paymentDestinationType,
        String merchantId,
        String businessId,
        String metadata
    ) {}

    /** Landing-page public create — no merchant account required. */
    public record PublicCreateQuickPaymentRequest(
        String description,
        int amount,
        String currency,
        String ownerName,
        String ownerPhone,
        String ownerEmail,
        String paymentDestination,
        String paymentDestinationType
    ) {}

    public record InitiatePaymentRequest(
        String customerPhone,
        String customerName,
        String paymentMethod,
        String deviceInfo,
        String location
    ) {}

    public record UpdateCodeStatusRequest(
        QuickPaymentCodeStatus status
    ) {}

    public record CompleteTransactionRequest(
        String transactionRef,
        TransactionStatus status,
        String failureReason
    ) {}

    // Response DTOs

    public record TransactionResponse(
        Long id,
        String codeId,
        String transactionRef,
        int amount,
        String currency,
        String customerPhone,
        String customerName,
        String paymentMethod,
        String paymentProvider,
        TransactionStatus status,
        String deviceInfo,
        String location,
        Instant createdAt,
        Instant completedAt,
        Instant failedAt,
        String failureReason
    ) {}

    public record PaymentValidationResponse(
        boolean valid,
        String message,
        QuickPaymentCodeResponse code,
        String transactionRef
    ) {}

    public record TrackingMetricsResponse(
        String trackingNumber,
        String id,
        String description,
        int amount,
        String currency,
        QuickPaymentCodeStatus status,
        int usageCount,
        long completedPayments,
        long pendingPayments,
        long failedPayments,
        long totalCollected,
        String ownerName,
        String ownerEmail,
        String paymentDestination,
        String paymentDestinationType,
        String qrCodeUrl,
        String trackUrl,
        Instant createdAt,
        Instant lastUsedAt,
        List<TransactionResponse> recentTransactions
    ) {}
}
