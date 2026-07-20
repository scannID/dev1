package com.scanny.dto;

import com.scanny.payment.PaymentContext;
import com.scanny.payment.PaymentIntentStatus;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;

public class PaymentDtos {

    private PaymentDtos() {
        throw new UnsupportedOperationException("Utility class");
    }

    public record InitiateRequest(
        @NotNull PaymentContext context,
        @NotBlank String referenceId,
        String provider,
        @Min(1) int amount,
        String currency,
        @NotBlank String customerPhone,
        String customerName,
        String businessId,
        String description
    ) {}

    public record InitiateResponse(
        String paymentId,
        String providerId,
        String providerReference,
        PaymentIntentStatus status,
        String message
    ) {}

    public record StatusResponse(
        String paymentId,
        String providerId,
        PaymentIntentStatus status,
        String message,
        String failureReason,
        Instant updatedAt
    ) {}

    public record ProviderInfo(
        String id,
        String displayName,
        boolean available
    ) {}

    public record ProvidersResponse(
        List<ProviderInfo> providers,
        String defaultProvider
    ) {}
}
