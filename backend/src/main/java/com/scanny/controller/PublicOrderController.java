package com.scanny.controller;

import com.scanny.dto.CustomerOrderDtos;
import com.scanny.service.OrderService;
import java.util.Map;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/orders/public")
public class PublicOrderController {

    private final OrderService orderService;

    public PublicOrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @GetMapping("/{publicId}")
    public Map<String, CustomerOrderDtos.TrackingResponse> trackOrder(
            @PathVariable UUID publicId,
            @RequestParam String phone
    ) {
        return Map.of("order", orderService.getCustomerOrderTracking(publicId, phone));
    }
}
