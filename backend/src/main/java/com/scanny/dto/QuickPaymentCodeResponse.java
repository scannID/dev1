package com.scanny.dto;

import com.scanny.entity.QuickPaymentCode;
import com.scanny.model.enums.QuickPaymentCodeStatus;
import java.time.Instant;

public record QuickPaymentCodeResponse(
    String id,
    String qrToken,
    String trackingNumber,
    String codeType,
    String description,
    int amount,
    String currency,
    QuickPaymentCodeStatus status,
    int usageCount,
    String ownerName,
    String ownerPhone,
    String ownerEmail,
    String paymentDestination,
    String paymentDestinationType,
    String merchantId,
    String businessId,
    String metadata,
    Instant createdAt,
    Instant updatedAt,
    Instant lastUsedAt,
    boolean canBeUsed,
    String qrCodeUrl,
    String trackUrl,
    boolean emailSent
) {
    public static QuickPaymentCodeResponse from(QuickPaymentCode code, String baseUrl) {
        return from(code, baseUrl, false);
    }

    public static QuickPaymentCodeResponse from(QuickPaymentCode code, String baseUrl, boolean emailSent) {
        return new QuickPaymentCodeResponse(
            code.getId(),
            code.getQrToken(),
            code.getTrackingNumber(),
            code.getCodeType(),
            code.getDescription(),
            code.getAmount(),
            code.getCurrency(),
            code.getStatus(),
            code.getUsageCount(),
            code.getOwnerName(),
            code.getOwnerPhone(),
            code.getOwnerEmail(),
            code.getPaymentDestination(),
            code.getPaymentDestinationType(),
            code.getMerchantId(),
            code.getBusiness() != null ? code.getBusiness().getId() : null,
            code.getMetadata(),
            code.getCreatedAt(),
            code.getUpdatedAt(),
            code.getLastUsedAt(),
            code.canBeUsed(),
            baseUrl + "/pay/" + code.getQrToken(),
            baseUrl + "/track/" + code.getTrackingNumber(),
            emailSent
        );
    }
}
