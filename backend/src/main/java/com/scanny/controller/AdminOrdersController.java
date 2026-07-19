package com.scanny.controller;

import com.scanny.dto.admin.AdminOrderDtos;
import com.scanny.service.AdminOrdersService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/orders")
public class AdminOrdersController {

    private final AdminOrdersService adminOrdersService;

    public AdminOrdersController(AdminOrdersService adminOrdersService) {
        this.adminOrdersService = adminOrdersService;
    }

    @GetMapping
    public AdminOrderDtos.OrdersListResponse listOrders(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int limit,
        @RequestParam(required = false) String search,
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String paymentStatus,
        @RequestParam(required = false) String merchantId
    ) {
        return adminOrdersService.listOrders(page, limit, search, status, paymentStatus, merchantId);
    }

    @GetMapping("/{orderId}")
    public AdminOrderDtos.OrderListItem getOrderDetails(@PathVariable String orderId) {
        return adminOrdersService.getOrderDetails(orderId);
    }

    @PatchMapping("/{orderId}")
    public AdminOrderDtos.OrderListItem updateOrder(
        @PathVariable String orderId,
        @RequestBody AdminOrderDtos.UpdateOrderRequest request
    ) {
        return adminOrdersService.updateOrder(orderId, request);
    }
}
