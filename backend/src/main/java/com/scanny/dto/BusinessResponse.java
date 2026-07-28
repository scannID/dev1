package com.scanny.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.scanny.entity.Business;
import com.scanny.model.enums.BusinessType;
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
        String logoUrl,
        String customerUrl,
        Instant createdAt,
        List<CatalogItemResponse> items,
        List<String> categories,
        Boolean acceptingOrders,
        Boolean busyMode,
        Integer busyEtaMinutes,
        String pauseMessage,
        String branchLabel
) {
    public static BusinessResponse from(Business business, String scanBaseUrl, boolean includeItems) {
        return from(business, scanBaseUrl, includeItems, null, null);
    }

    public static BusinessResponse from(Business business, String scanBaseUrl, boolean includeItems, String logoUrl) {
        return from(business, scanBaseUrl, includeItems, logoUrl, null);
    }

    public static BusinessResponse from(
        Business business,
        String scanBaseUrl,
        boolean includeItems,
        String logoUrl,
        List<String> categories
    ) {
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
                logoUrl,
                scanBaseUrl + "/b/" + business.getId() + "?qr=" + business.getQrToken(),
                business.getCreatedAt(),
                items,
                categories,
                business.isAcceptingOrders(),
                business.isBusyMode(),
                business.getBusyEtaMinutes(),
                business.getPauseMessage(),
                business.getBranchLabel()
        );
    }
}
