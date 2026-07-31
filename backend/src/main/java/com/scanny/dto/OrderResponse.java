package com.scanny.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.scanny.entity.Order;
import com.scanny.entity.OrderLineItem;
import com.scanny.model.enums.OrderStatus;
import com.scanny.model.enums.PaymentStatus;
import com.scanny.util.JsonLists;
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
        int subtotal,
        int serviceFee,
        int psoFee,
        int platformFee,
        int merchantPayout,
        String merchantMomoDestination,
        OrderStatus status,
        PaymentStatus paymentStatus,
        Instant createdAt,
        Instant updatedAt,
        Integer cogsTotal
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
                order.getSubtotal(),
                order.getServiceFee(),
                order.getPsoFee(),
                order.getPlatformFee(),
                order.getMerchantPayout(),
                order.getMerchantMomoDestination(),
                order.getStatus(),
                order.getPaymentStatus(),
                order.getCreatedAt(),
                order.getUpdatedAt(),
                order.getCogsTotal()
        );
    }
}

record CustomerResponse(String name, String phone, String location, String note) {
}

record OrderLineResponse(
        String id,
        String name,
        int price,
        int quantity,
        int lineTotal,
        List<String> removedIngredients,
        String checkInDate,
        String checkOutDate,
        Integer nights,
        Integer costAmount
) {
    static OrderLineResponse from(OrderLineItem line) {
        return new OrderLineResponse(
                line.getItemId(),
                line.getName(),
                line.getPrice(),
                line.getQuantity(),
                line.getLineTotal(),
                JsonLists.readStringList(line.getRemovedIngredientsJson()),
                line.getCheckInDate() != null ? line.getCheckInDate().toString() : null,
                line.getCheckOutDate() != null ? line.getCheckOutDate().toString() : null,
                line.getNights(),
                line.getCostAmount()
        );
    }
}
