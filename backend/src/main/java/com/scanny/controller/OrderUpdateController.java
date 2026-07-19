package com.scanny.controller;

import com.scanny.dto.OrderResponse;
import com.scanny.dto.OrderUpdateDtos;
import com.scanny.service.OrderService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class OrderUpdateController {

    private final OrderService orderService;

    public OrderUpdateController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PatchMapping("/orders/{orderId}/status")
    public Map<String, OrderResponse> updateOrderStatus(
        @PathVariable String orderId,
        @Valid @RequestBody OrderUpdateDtos.UpdateOrderStatusRequest request
    ) {
        return Map.of("order", orderService.updateOrderStatus(orderId, request.status()));
    }

    @PatchMapping("/orders/{orderId}/payment")
    public Map<String, OrderResponse> updatePaymentStatus(
        @PathVariable String orderId,
        @Valid @RequestBody OrderUpdateDtos.UpdatePaymentStatusRequest request
    ) {
        return Map.of("order", orderService.updatePaymentStatus(orderId, request.paymentStatus()));
    }

    @DeleteMapping("/businesses/{businessId}/orders/completed")
    @ResponseStatus(HttpStatus.OK)
    public OrderUpdateDtos.ClearCompletedResponse clearCompletedOrders(@PathVariable String businessId) {
        int deleted = orderService.clearCompletedOrders(businessId);
        return new OrderUpdateDtos.ClearCompletedResponse(
            deleted,
            "Cleared " + deleted + " completed/cancelled order" + (deleted != 1 ? "s" : "")
        );
    }
}
