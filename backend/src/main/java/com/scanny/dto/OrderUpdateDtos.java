package com.scanny.dto;

import com.scanny.model.enums.OrderStatus;
import com.scanny.model.enums.PaymentStatus;

public class OrderUpdateDtos {

    public record UpdateOrderStatusRequest(
        OrderStatus status
    ) {}

    public record UpdatePaymentStatusRequest(
        PaymentStatus paymentStatus
    ) {}

    public record ClearCompletedResponse(
        int deleted,
        String message
    ) {}
}
