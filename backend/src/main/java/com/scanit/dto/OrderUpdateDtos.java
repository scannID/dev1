package com.scanit.dto;

import com.scanit.model.enums.OrderStatus;
import com.scanit.model.enums.PaymentStatus;

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
