package com.scanit.dto;

import com.scanit.entity.QuickPaymentCode;
import com.scanit.model.enums.QuickPaymentCodeStatus;
import java.time.Instant;

public record QuickPaymentCodeResponse(
    String id,
    String qrToken,
    String codeType,
    String description,
    int amount,
    String currency,
    QuickPaymentCodeStatus status,
    int usageCount,
    String ownerName,
    String ownerPhone,
    String paymentDestination,
    String paymentDestinationType,
    String merchantId,
    String businessId,
    String metadata,
    Instant createdAt,
    Instant updatedAt,
    Instant lastUsedAt,
    boolean canBeUsed,
    String qrCodeUrl
) {
    public static QuickPaymentCodeResponse from(QuickPaymentCode code, String baseUrl) {
        return new QuickPaymentCodeResponse(
            code.getId(),
            code.getQrToken(),
            code.getCodeType(),
            code.getDescription(),
            code.getAmount(),
            code.getCurrency(),
            code.getStatus(),
            code.getUsageCount(),
            code.getOwnerName(),
            code.getOwnerPhone(),
            code.getPaymentDestination(),
            code.getPaymentDestinationType(),
            code.getMerchantId(),
            code.getBusiness() != null ? code.getBusiness().getId() : null,
            code.getMetadata(),
            code.getCreatedAt(),
            code.getUpdatedAt(),
            code.getLastUsedAt(),
            code.canBeUsed(),
            baseUrl + "/pay/" + code.getQrToken()
        );
    }
}
