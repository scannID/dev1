package com.scanit.dto;

import com.scanit.model.enums.BusinessType;
import com.scanit.model.enums.OrderStatus;
import com.scanit.model.enums.PaymentStatus;
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
            @NotNull Integer quantity
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
