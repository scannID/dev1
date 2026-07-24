package com.scanny.dto;

import com.scanny.entity.Order;
import com.scanny.entity.OrderLineItem;
import com.scanny.model.enums.OrderStatus;
import com.scanny.model.enums.PaymentStatus;
import com.scanny.util.JsonLists;
import java.time.Instant;
import java.util.List;

public final class CustomerOrderDtos {

    private CustomerOrderDtos() {
    }

    public record TrackingLineItem(String name, int quantity, List<String> removedIngredients) {
        static TrackingLineItem from(OrderLineItem line) {
            return new TrackingLineItem(
                    line.getName(),
                    line.getQuantity(),
                    JsonLists.readStringList(line.getRemovedIngredientsJson())
            );
        }
    }

    public record TrackingResponse(
            String id,
            String businessName,
            List<TrackingLineItem> items,
            int total,
            OrderStatus status,
            PaymentStatus paymentStatus,
            Instant createdAt,
            Instant updatedAt,
            Integer estimatedWaitMinutes
    ) {
        public static TrackingResponse from(Order order) {
            return from(order, null);
        }

        public static TrackingResponse from(Order order, Integer estimatedWaitMinutes) {
            return new TrackingResponse(
                    order.getId(),
                    order.getBusinessName(),
                    order.getItems().stream().map(TrackingLineItem::from).toList(),
                    order.getTotal(),
                    order.getStatus(),
                    order.getPaymentStatus(),
                    order.getCreatedAt(),
                    order.getUpdatedAt(),
                    estimatedWaitMinutes
            );
        }
    }
}
