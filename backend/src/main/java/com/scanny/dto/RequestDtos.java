package com.scanny.dto;

import com.scanny.model.enums.BusinessType;
import com.scanny.model.enums.OrderStatus;
import com.scanny.model.enums.PaymentStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public final class RequestDtos {

    private RequestDtos() {
    }

    public record CreateBusinessRequest(
            @NotBlank String businessName,
            @NotBlank String ownerName,
            String phone,
            BusinessType type
    ) {
    }

    public record CreateOrderRequest(
            @Valid @NotNull CustomerRequest customer,
            @NotEmpty List<@Valid OrderItemRequest> items
    ) {
    }

    public record CustomerRequest(
            @NotBlank String name,
            String phone,
            String location,
            String note
    ) {
    }

    public record OrderItemRequest(
            String itemId,
            String id,
            @NotNull Integer quantity,
            List<String> removedIngredients,
            String checkInDate,
            String checkOutDate
    ) {
        public String resolvedItemId() {
            if (itemId != null && !itemId.isBlank()) {
                return itemId;
            }
            return id;
        }
    }

    public record UpdateOrderRequest(
            OrderStatus status,
            PaymentStatus paymentStatus
    ) {
    }
}
