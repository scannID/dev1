package com.scanny.service;

import com.scanny.dto.admin.AdminOrderDtos;
import com.scanny.entity.Order;
import com.scanny.model.enums.OrderStatus;
import com.scanny.model.enums.PaymentStatus;
import com.scanny.repository.OrderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
public class AdminOrdersService {

    private static final int LOOKBACK_DAYS = 90;

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
        Instant cutoff = Instant.now().minus(LOOKBACK_DAYS, ChronoUnit.DAYS);
        List<Order> recentOrders = orderRepository.findByCreatedAtAfterOrderByCreatedAtDesc(cutoff);

        List<Order> filteredOrders = recentOrders.stream()
            .filter(o -> search == null || search.isEmpty() ||
                o.getId().toLowerCase().contains(search.toLowerCase()) ||
                (o.getBusinessName() != null && o.getBusinessName().toLowerCase().contains(search.toLowerCase())) ||
                (o.getCustomerName() != null && o.getCustomerName().toLowerCase().contains(search.toLowerCase())))
            .filter(o -> status == null || status.isEmpty() ||
                o.getStatus().name().equalsIgnoreCase(status))
            .filter(o -> paymentStatus == null || paymentStatus.isEmpty() ||
                o.getPaymentStatus().name().equalsIgnoreCase(paymentStatus))
            .filter(o -> merchantId == null || merchantId.isEmpty() ||
                o.getMerchantId().equals(merchantId))
            .toList();

        int total = filteredOrders.size();
        int totalPages = (int) Math.ceil((double) total / limit);
        int start = (page - 1) * limit;
        int end = Math.min(start + limit, total);

        List<Order> paginatedOrders = filteredOrders.subList(
            Math.min(start, total),
            Math.min(end, total)
        );

        List<AdminOrderDtos.OrderListItem> orderItems = paginatedOrders.stream()
            .map(AdminOrderDtos.OrderListItem::from)
            .toList();

        Instant startOfToday = Instant.now().truncatedTo(ChronoUnit.DAYS);
        long ordersToday = orderRepository.countByCreatedAtAfter(startOfToday);
        long completed = orderRepository.countByStatus(OrderStatus.Completed);
        long pending = orderRepository.countByStatusIn(List.of(OrderStatus.Pending, OrderStatus.Preparing));
        long cancelled = orderRepository.countByStatus(OrderStatus.Cancelled);

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
