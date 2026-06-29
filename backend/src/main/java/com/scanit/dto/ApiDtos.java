package com.scanit.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.scanit.entity.Business;
import com.scanit.entity.CatalogItem;
import com.scanit.entity.Order;
import com.scanit.entity.OrderLineItem;
import com.scanit.model.enums.BusinessType;
import com.scanit.model.enums.OrderStatus;
import com.scanit.model.enums.PaymentStatus;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

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

@JsonInclude(JsonInclude.Include.NON_NULL)
record CatalogItemResponse(
        String id,
        String name,
        String category,
        int price,
        String description,
        boolean available
) {
    static CatalogItemResponse from(CatalogItem item) {
        return new CatalogItemResponse(
                item.getId(),
                item.getName(),
                item.getCategory(),
                item.getPrice(),
                item.getDescription(),
                item.isAvailable()
        );
    }
}

@JsonInclude(JsonInclude.Include.NON_NULL)
public record OrderResponse(
        String id,
        UUID publicId,
        String businessId,
        String merchantId,
        String qrToken,
        String paymentReference,
        String businessName,
        CustomerResponse customer,
        List<OrderLineResponse> items,
        int total,
        OrderStatus status,
        PaymentStatus paymentStatus,
        Instant createdAt,
        Instant updatedAt
) {
    public static OrderResponse from(Order order) {
        return new OrderResponse(
                order.getId(),
                order.getPublicId(),
                order.getBusiness().getId(),
                order.getMerchantId(),
                order.getQrToken(),
                order.getPaymentReference(),
                order.getBusinessName(),
                new CustomerResponse(
                        order.getCustomerName(),
                        order.getCustomerPhone(),
                        order.getCustomerLocation(),
                        order.getCustomerNote()
                ),
                order.getItems().stream().map(OrderLineResponse::from).toList(),
                order.getTotal(),
                order.getStatus(),
                order.getPaymentStatus(),
                order.getCreatedAt(),
                order.getUpdatedAt()
        );
    }
}

record CustomerResponse(String name, String phone, String location, String note) {
}

record OrderLineResponse(String id, String name, int price, int quantity, int lineTotal) {
    static OrderLineResponse from(OrderLineItem line) {
        return new OrderLineResponse(
                line.getItemId(),
                line.getName(),
                line.getPrice(),
                line.getQuantity(),
                line.getLineTotal()
        );
    }
}
