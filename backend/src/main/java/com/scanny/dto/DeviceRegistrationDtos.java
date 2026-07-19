package com.scanny.dto;

import com.scanny.model.enums.DeviceStatus;
import com.scanny.model.enums.TransactionStatus;
import java.time.Instant;
import java.util.List;

public class DeviceRegistrationDtos {

    private DeviceRegistrationDtos() {
        throw new UnsupportedOperationException("Utility class");
    }

    // Request DTOs

    public record RegisterDeviceRequest(
        String deviceId,
        String deviceName,
        String deviceModel,
        String deviceOs,
        String deviceFingerprint,
        String primaryPhone,
        String customerName,
        String customerEmail
    ) {}

    public record AddPaymentMethodRequest(
        String phoneNumber,
        String paymentProvider,
        String accountName,
        boolean isDefault
    ) {}

    public record VerifyPaymentMethodRequest(
        Long paymentMethodId,
        String verificationCode
    ) {}

    public record EnableAutoPaymentRequest(
        boolean enabled,
        String pin
    ) {}

    public record DevicePaymentRequest(
        String deviceId,
        String referenceId,
        String referenceType,
        int amount,
        String currency,
        Long paymentMethodId,
        boolean useAutoPayment,
        String pin
    ) {}

    // Response DTOs

    public record RegisteredDeviceResponse(
        String id,
        String deviceId,
        String deviceName,
        String deviceModel,
        String deviceOs,
        DeviceStatus status,
        String primaryPhone,
        String secondaryPhone,
        String customerName,
        String customerEmail,
        boolean autoPaymentEnabled,
        Instant lastUsedAt,
        Instant createdAt,
        Instant updatedAt,
        List<PaymentMethodResponse> paymentMethods,
        int totalTransactions,
        int completedTransactions
    ) {}

    public record PaymentMethodResponse(
        Long id,
        String phoneNumber,
        String paymentProvider,
        String accountName,
        boolean isDefault,
        boolean isVerified,
        Instant verifiedAt,
        Instant addedAt,
        Instant lastUsedAt
    ) {}

    public record DeviceTransactionResponse(
        Long id,
        String deviceId,
        String transactionType,
        String referenceId,
        String referenceType,
        int amount,
        String currency,
        String phoneNumber,
        TransactionStatus status,
        boolean autoPayment,
        Instant createdAt,
        Instant completedAt
    ) {}

    public record DevicePaymentResponse(
        boolean success,
        String message,
        String transactionId,
        DeviceTransactionResponse transaction
    ) {}
}
