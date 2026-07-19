package com.scanny.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.scanny.entity.Order;
import com.scanny.entity.OrderLineItem;
import com.scanny.model.enums.OrderStatus;
import com.scanny.model.enums.PaymentStatus;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

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
