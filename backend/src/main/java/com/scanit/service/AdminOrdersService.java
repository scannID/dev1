package com.scanit.service;

import com.scanit.dto.admin.AdminOrderDtos;
import com.scanit.entity.Order;
import com.scanit.model.enums.OrderStatus;
import com.scanit.model.enums.PaymentStatus;
import com.scanit.repository.OrderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
public class AdminOrdersService {

    private final OrderRepository orderRepository;

    public AdminOrdersService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    @Transactional(readOnly = true)
    public AdminOrderDtos.OrdersListResponse listOrders(
        int page,
        int limit,
        String search,
        String status,
        String paymentStatus,
        String merchantId
    ) {
        List<Order> allOrders = orderRepository.findAll();

        // Apply filters
        List<Order> filteredOrders = allOrders.stream()
            .filter(o -> search == null || search.isEmpty() ||
                o.getId().toLowerCase().contains(search.toLowerCase()) ||
                o.getBusinessName().toLowerCase().contains(search.toLowerCase()) ||
                o.getCustomerName().toLowerCase().contains(search.toLowerCase()))
            .filter(o -> status == null || status.isEmpty() ||
                o.getStatus().name().equalsIgnoreCase(status))
            .filter(o -> paymentStatus == null || paymentStatus.isEmpty() ||
                o.getPaymentStatus().name().equalsIgnoreCase(paymentStatus))
            .filter(o -> merchantId == null || merchantId.isEmpty() ||
                o.getMerchantId().equals(merchantId))
            .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
            .toList();

        // Calculate pagination
        int total = filteredOrders.size();
        int totalPages = (int) Math.ceil((double) total / limit);
        int start = (page - 1) * limit;
        int end = Math.min(start + limit, total);

        List<Order> paginatedOrders = filteredOrders.subList(
            Math.min(start, total),
            Math.min(end, total)
        );

        // Build order list items
        List<AdminOrderDtos.OrderListItem> orderItems = paginatedOrders.stream()
            .map(AdminOrderDtos.OrderListItem::from)
            .toList();

        // Calculate summary
        Instant startOfToday = Instant.now().truncatedTo(ChronoUnit.DAYS);
        long ordersToday = allOrders.stream()
            .filter(o -> o.getCreatedAt().isAfter(startOfToday))
            .count();
        long completed = allOrders.stream()
            .filter(o -> o.getStatus() == OrderStatus.Completed)
            .count();
        long pending = allOrders.stream()
            .filter(o -> o.getStatus() == OrderStatus.Pending || o.getStatus() == OrderStatus.Preparing)
            .count();
        long cancelled = allOrders.stream()
            .filter(o -> o.getStatus() == OrderStatus.Cancelled)
            .count();

        AdminOrderDtos.PaginationInfo pagination = new AdminOrderDtos.PaginationInfo(
            page,
            limit,
            total,
            totalPages
        );

        AdminOrderDtos.OrderSummary summary = new AdminOrderDtos.OrderSummary(
            ordersToday,
            completed,
            pending,
            cancelled
        );

        return new AdminOrderDtos.OrdersListResponse(orderItems, pagination, summary);
    }

    @Transactional(readOnly = true)
    public AdminOrderDtos.OrderListItem getOrderDetails(String orderId) {
        Order order = orderRepository.findById(orderId)
            .orElseThrow(() -> new RuntimeException("Order not found: " + orderId));
        return AdminOrderDtos.OrderListItem.from(order);
    }

    @Transactional
    public AdminOrderDtos.OrderListItem updateOrder(
        String orderId,
        AdminOrderDtos.UpdateOrderRequest request
    ) {
        Order order = orderRepository.findById(orderId)
            .orElseThrow(() -> new RuntimeException("Order not found: " + orderId));

        if (request.status() != null && !request.status().isEmpty()) {
            order.setStatus(OrderStatus.valueOf(request.status()));
            order.setUpdatedAt(Instant.now());
        }

        if (request.refund()) {
            order.setPaymentStatus(PaymentStatus.Refunded);
        }

        order = orderRepository.save(order);
        return AdminOrderDtos.OrderListItem.from(order);
    }
}
