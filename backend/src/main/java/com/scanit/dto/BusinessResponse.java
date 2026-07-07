package com.scanit.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.scanit.entity.Business;
import com.scanit.model.enums.BusinessType;
import java.time.Instant;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record BusinessResponse(
        String id,
        String merchantId,
        String qrToken,
        String name,
        String ownerName,
        String phone,
        BusinessType type,
        String tableLabel,
        String paymentReference,
        String accent,
        String customerUrl,
        Instant createdAt,
        List<CatalogItemResponse> items
) {
    public static BusinessResponse from(Business business, String scanBaseUrl, boolean includeItems) {
        List<CatalogItemResponse> items = includeItems
                ? business.getItems().stream().map(CatalogItemResponse::from).toList()
                : null;

        return new BusinessResponse(
                business.getId(),
                business.getMerchantId(),
                business.getQrToken(),
                business.getName(),
                business.getOwnerName(),
                business.getPhone(),
                business.getType(),
                business.getTableLabel(),
                business.getPaymentReference(),
                business.getAccent(),
                scanBaseUrl + "/b/" + business.getId() + "?qr=" + business.getQrToken(),
                business.getCreatedAt(),
                items
        );
    }
}
