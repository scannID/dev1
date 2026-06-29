package com.scanit.controller;

import com.scanit.dto.ApiDtos.OrderResponse;
import com.scanit.dto.RequestDtos.UpdateOrderRequest;
import com.scanit.service.OrderService;
import java.util.Map;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PatchMapping("/{orderId}")
    public Map<String, OrderResponse> updateOrder(
            @PathVariable String orderId,
            @RequestBody UpdateOrderRequest request
    ) {
        return Map.of("order", orderService.updateOrder(orderId, request));
    }
}
