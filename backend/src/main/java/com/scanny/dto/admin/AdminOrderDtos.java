package com.scanny.dto.admin;

import com.scanny.entity.Order;
import java.util.List;

public class AdminOrderDtos {

    public record OrderListItem(
        String id,
        String merchantId,
        String merchantName,
        String customerName,
        int items,
        int total,
        String currency,
        String paymentStatus,
        String status,
        String createdAt,
        String completedAt
    ) {
        public static OrderListItem from(Order order) {
            return new OrderListItem(
                order.getId(),
                order.getMerchantId(),
                order.getBusinessName(),
                order.getCustomerName(),
                order.getItems().size(),
                order.getTotal(),
                "UGX",
                order.getPaymentStatus().name(),
                order.getStatus().name(),
                order.getCreatedAt().toString(),
                order.getUpdatedAt() != null ? order.getUpdatedAt().toString() : null
            );
        }
    }

    public record PaginationInfo(
        int page,
        int limit,
        long total,
        int pages
    ) {}

    public record OrderSummary(
        long today,
        long completed,
        long pending,
        long cancelled
    ) {}

    public record OrdersListResponse(
        List<OrderListItem> orders,
        PaginationInfo pagination,
        OrderSummary summary
    ) {}

    public record UpdateOrderRequest(
        String status,
        String reason,
        boolean refund
    ) {}
}
