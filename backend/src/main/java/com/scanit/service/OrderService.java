package com.scanit.service;

import com.scanit.dto.OrderResponse;
import com.scanit.dto.RequestDtos.CreateOrderRequest;
import com.scanit.dto.RequestDtos.OrderItemRequest;
import com.scanit.dto.RequestDtos.UpdateOrderRequest;
import com.scanit.entity.Business;
import com.scanit.entity.CatalogItem;
import com.scanit.entity.Order;
import com.scanit.entity.OrderLineItem;
import com.scanit.exception.ApiException;
import com.scanit.model.enums.OrderStatus;
import com.scanit.model.enums.PaymentStatus;
import com.scanit.repository.OrderRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderService {

    private final BusinessService businessService;
    private final OrderRepository orderRepository;

    public OrderService(BusinessService businessService, OrderRepository orderRepository) {
        this.businessService = businessService;
        this.orderRepository = orderRepository;
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> listOrders(String businessId) {
        businessService.requireBusiness(businessId);
        return orderRepository.findByBusinessIdOrderByCreatedAtDesc(businessId).stream()
                .map(OrderResponse::from)
                .toList();
    }

    @Transactional
    public OrderResponse createOrder(String businessId, CreateOrderRequest request) {
        Business business = businessService.requireBusiness(businessId);

        String customerName = request.customer().name() != null ? request.customer().name().trim() : "";
        if (customerName.isBlank()) {
            throw new ApiException(400, "Customer name is required.");
        }
        if (request.items() == null || request.items().isEmpty()) {
            throw new ApiException(400, "At least one order item is required.");
        }

        List<OrderLineItem> lines = new ArrayList<>();
        for (OrderItemRequest lineRequest : request.items()) {
            String itemId = lineRequest.resolvedItemId();
            if (itemId == null || itemId.isBlank()) {
                continue;
            }

            CatalogItem item = business.getItems().stream()
                    .filter(entry -> entry.getId().equals(itemId))
                    .findFirst()
                    .orElse(null);

            int quantity = lineRequest.quantity() != null ? lineRequest.quantity() : 1;
            if (item == null || !item.isAvailable() || quantity <= 0) {
                continue;
            }

            OrderLineItem line = new OrderLineItem();
            line.setItemId(item.getId());
            line.setName(item.getName());
            line.setPrice(item.getPrice());
            line.setQuantity(quantity);
            line.setLineTotal(item.getPrice() * quantity);
            lines.add(line);
        }

        if (lines.isEmpty()) {
            throw new ApiException(400, "No available items were found for this order.");
        }

        int total = lines.stream().mapToInt(OrderLineItem::getLineTotal).sum();

        Order order = new Order();
        order.setId("ORD-" + String.valueOf(System.currentTimeMillis()).substring(7));
        order.setPublicId(UUID.randomUUID());
        order.setBusiness(business);
        order.setMerchantId(business.getMerchantId());
        order.setQrToken(business.getQrToken());
        order.setPaymentReference(business.getPaymentReference());
        order.setBusinessName(business.getName());
        order.setCustomerName(customerName);
        order.setCustomerPhone(trimToEmpty(request.customer().phone()));
        order.setCustomerLocation(trimToEmpty(request.customer().location()));
        order.setCustomerNote(trimToEmpty(request.customer().note()));
        order.setTotal(total);
        order.setStatus(OrderStatus.Pending);
        order.setPaymentStatus(PaymentStatus.Unpaid);
        order.setCreatedAt(Instant.now());
        lines.forEach(order::addItem);

        return OrderResponse.from(orderRepository.save(order));
    }

    @Transactional
    public OrderResponse updateOrder(String orderId, UpdateOrderRequest request) {
        Order order = orderRepository.findWithItemsById(orderId)
                .or(() -> {
                    try {
                        return orderRepository.findWithItemsByPublicId(UUID.fromString(orderId));
                    } catch (IllegalArgumentException ex) {
                        return java.util.Optional.empty();
                    }
                })
                .orElseThrow(() -> new ApiException(404, "Order was not found."));

        if (request.status() != null) {
            order.setStatus(request.status());
        }
        if (request.paymentStatus() != null) {
            order.setPaymentStatus(request.paymentStatus());
        }
        order.setUpdatedAt(Instant.now());

        return OrderResponse.from(orderRepository.save(order));
    }

    @Transactional
    public OrderResponse updateOrderStatus(String orderId, OrderStatus status) {
        Order order = orderRepository.findWithItemsById(orderId)
                .orElseThrow(() -> new ApiException(404, "Order was not found."));

        order.setStatus(status);
        order.setUpdatedAt(Instant.now());

        return OrderResponse.from(orderRepository.save(order));
    }

    @Transactional
    public OrderResponse updatePaymentStatus(String orderId, PaymentStatus paymentStatus) {
        Order order = orderRepository.findWithItemsById(orderId)
                .orElseThrow(() -> new ApiException(404, "Order was not found."));

        order.setPaymentStatus(paymentStatus);
        order.setUpdatedAt(Instant.now());

        return OrderResponse.from(orderRepository.save(order));
    }

    @Transactional
    public int clearCompletedOrders(String businessId) {
        businessService.requireBusiness(businessId);
        
        List<Order> orders = orderRepository.findByBusinessIdOrderByCreatedAtDesc(businessId);
        List<Order> toDelete = orders.stream()
            .filter(order -> order.getStatus() == OrderStatus.Completed || order.getStatus() == OrderStatus.Cancelled)
            .toList();

        if (!toDelete.isEmpty()) {
            orderRepository.deleteAll(toDelete);
        }

        return toDelete.size();
    }

    private String trimToEmpty(String value) {
        return value != null ? value.trim() : "";
    }
}
