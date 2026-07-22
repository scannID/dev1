package com.scanny.service;

import com.scanny.dto.OrderResponse;
import com.scanny.dto.ReceiptDtos.GenerateReceiptRequest;
import com.scanny.dto.ReceiptDtos.ReceiptItem;
import com.scanny.dto.RequestDtos.CreateOrderRequest;
import com.scanny.dto.RequestDtos.OrderItemRequest;
import com.scanny.dto.RequestDtos.UpdateOrderRequest;
import com.scanny.entity.Business;
import com.scanny.entity.CatalogItem;
import com.scanny.entity.Order;
import com.scanny.entity.OrderLineItem;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.OrderStatus;
import com.scanny.model.enums.PaymentStatus;
import com.scanny.repository.OrderRepository;
import com.scanny.security.MerchantAccessService;
import com.scanny.websocket.RealtimeEventPublisher;
import com.scanny.dto.CustomerOrderDtos;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderService {

    private static final Logger logger = LoggerFactory.getLogger(OrderService.class);
    
    private final BusinessService businessService;
    private final OrderRepository orderRepository;
    private final ReceiptService receiptService;
    private final MerchantAccessService merchantAccessService;
    private final AuditService auditService;
    private final RealtimeEventPublisher realtimeEventPublisher;

    public OrderService(
            BusinessService businessService,
            OrderRepository orderRepository,
            ReceiptService receiptService,
            MerchantAccessService merchantAccessService,
            AuditService auditService,
            RealtimeEventPublisher realtimeEventPublisher
    ) {
        this.businessService = businessService;
        this.orderRepository = orderRepository;
        this.receiptService = receiptService;
        this.merchantAccessService = merchantAccessService;
        this.auditService = auditService;
        this.realtimeEventPublisher = realtimeEventPublisher;
    }

    @Transactional(readOnly = true)
    public CustomerOrderDtos.TrackingResponse getCustomerOrderTracking(UUID publicId, String phone) {
        Order order = orderRepository.findWithItemsByPublicId(publicId)
                .orElseThrow(() -> new ApiException(404, "Order was not found."));
        if (!phonesMatch(order.getCustomerPhone(), phone)) {
            throw new ApiException(404, "Order was not found.");
        }
        return CustomerOrderDtos.TrackingResponse.from(order);
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> listOrders(String businessId) {
        merchantAccessService.assertOwnsBusinessId(businessId);
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

        OrderResponse response = OrderResponse.from(orderRepository.save(order));
        realtimeEventPublisher.publishOrderEvent(businessId, "ORDER_CREATED", response);
        realtimeEventPublisher.publishAdminMetrics(
                "ORDER_CREATED",
                Map.of("businessId", businessId, "orderId", response.id())
        );
        return response;
    }

    @Transactional
    public OrderResponse updateOrder(String orderId, UpdateOrderRequest request) {
        Order order = requireOwnedOrder(orderId);

        if (request.status() != null) {
            order.setStatus(request.status());
        }
        if (request.paymentStatus() != null) {
            order.setPaymentStatus(request.paymentStatus());
        }
        order.setUpdatedAt(Instant.now());

        OrderResponse response = OrderResponse.from(orderRepository.save(order));
        realtimeEventPublisher.publishOrderEvent(order.getBusiness().getId(), "ORDER_UPDATED", response);
        auditService.success("ORDER_UPDATE", "order", order.getId(), Map.of(
                "status", String.valueOf(order.getStatus()),
                "paymentStatus", String.valueOf(order.getPaymentStatus())
        ));
        return response;
    }

    @Transactional
    public OrderResponse updateOrderStatus(String orderId, OrderStatus status) {
        Order order = requireOwnedOrder(orderId);

        order.setStatus(status);
        order.setUpdatedAt(Instant.now());

        OrderResponse response = OrderResponse.from(orderRepository.save(order));
        realtimeEventPublisher.publishOrderEvent(order.getBusiness().getId(), "ORDER_STATUS_UPDATED", response);
        auditService.success("ORDER_STATUS_UPDATE", "order", order.getId(), Map.of("status", status.name()));
        return response;
    }

    @Transactional
    public OrderResponse updatePaymentStatus(String orderId, PaymentStatus paymentStatus) {
        Order order = requireOwnedOrder(orderId);
        return applyPaymentStatus(order, paymentStatus);
    }

    /** Called by the payment gateway when a provider confirms payment — no merchant auth required. */
    @Transactional
    public void confirmPaymentFromGateway(String orderId, PaymentStatus paymentStatus) {
        Order order = orderRepository.findWithItemsById(orderId)
            .orElseThrow(() -> new ApiException(404, "Order was not found."));
        applyPaymentStatus(order, paymentStatus);
    }

    private OrderResponse applyPaymentStatus(Order order, PaymentStatus paymentStatus) {
        PaymentStatus oldStatus = order.getPaymentStatus();
        order.setPaymentStatus(paymentStatus);
        order.setUpdatedAt(Instant.now());

        Order savedOrder = orderRepository.save(order);

        if (paymentStatus == PaymentStatus.Paid && oldStatus != PaymentStatus.Paid) {
            try {
                autoGenerateReceipt(savedOrder);
            } catch (Exception e) {
                logger.error("Failed to auto-generate receipt for order {}", order.getId(), e);
            }
        }

        OrderResponse response = OrderResponse.from(savedOrder);
        realtimeEventPublisher.publishOrderEvent(savedOrder.getBusiness().getId(), "ORDER_PAYMENT_UPDATED", response);
        auditService.success("ORDER_PAYMENT_UPDATE", "order", savedOrder.getId(), Map.of("paymentStatus", paymentStatus.name()));
        return response;
    }

    @Transactional
    public int clearCompletedOrders(String businessId) {
        merchantAccessService.assertOwnsBusinessId(businessId);
        
        List<Order> orders = orderRepository.findByBusinessIdOrderByCreatedAtDesc(businessId);
        List<Order> toDelete = orders.stream()
            .filter(order -> order.getStatus() == OrderStatus.Completed || order.getStatus() == OrderStatus.Cancelled)
            .toList();

        if (!toDelete.isEmpty()) {
            orderRepository.deleteAll(toDelete);
            realtimeEventPublisher.publishOrderEvent(businessId, "ORDERS_CLEARED", Map.of("deleted", toDelete.size()));
            auditService.success("ORDERS_CLEARED", "business", businessId, Map.of("deleted", toDelete.size()));
        }

        return toDelete.size();
    }

    private Order requireOwnedOrder(String orderId) {
        Order order = orderRepository.findWithItemsById(orderId)
                .or(() -> {
                    try {
                        return orderRepository.findWithItemsByPublicId(UUID.fromString(orderId));
                    } catch (IllegalArgumentException ex) {
                        return java.util.Optional.empty();
                    }
                })
                .orElseThrow(() -> new ApiException(404, "Order was not found."));
        merchantAccessService.assertOwnsBusiness(order.getBusiness());
        return order;
    }

    private String trimToEmpty(String value) {
        return value != null ? value.trim() : "";
    }

    private String normalizePhone(String value) {
        if (value == null) {
            return "";
        }
        return value.replaceAll("\\D", "");
    }

    private boolean phonesMatch(String stored, String provided) {
        String a = normalizePhone(stored);
        String b = normalizePhone(provided);
        if (a.isEmpty() || b.isEmpty()) {
            return false;
        }
        if (a.equals(b)) {
            return true;
        }
        int suffixLen = Math.min(9, Math.min(a.length(), b.length()));
        return a.regionMatches(a.length() - suffixLen, b, b.length() - suffixLen, suffixLen);
    }

    private void autoGenerateReceipt(Order order) {
        // Convert order line items to receipt items
        List<ReceiptItem> receiptItems = new ArrayList<>();
        if (order.getItems() != null) {
            for (OrderLineItem item : order.getItems()) {
                receiptItems.add(new ReceiptItem(
                    item.getName(),
                    item.getQuantity(),
                    BigDecimal.valueOf(item.getPrice()),
                    BigDecimal.valueOf(item.getLineTotal())
                ));
            }
        }

        // Create receipt request
        GenerateReceiptRequest receiptRequest = new GenerateReceiptRequest(
            order.getId(),                                  // orderId
            null,                                           // ticketId
            null,                                           // quickPaymentId
            null,                                           // devicePaymentId
            order.getBusiness().getId(),                    // businessId
            order.getBusinessName(),                        // businessName
            order.getMerchantId(),                          // merchantId
            order.getCustomerName(),                        // customerName
            null,                                           // customerEmail (order doesn't have email)
            order.getCustomerPhone(),                       // customerPhone
            BigDecimal.valueOf(order.getTotal()),           // amount
            "UGX",                                          // currency
            "Mobile Money",                                 // paymentMethod
            order.getPaymentReference(),                    // paymentReference
            receiptItems,                                   // items
            BigDecimal.valueOf(order.getTotal()),           // subtotal
            BigDecimal.ZERO,                                // taxAmount
            BigDecimal.ZERO,                                // serviceFee
            order.getCustomerNote(),                        // notes
            false,                                          // sendEmail (no email available)
            false                                           // generatePdf
        );

        receiptService.generateReceipt(receiptRequest);
        logger.info("Auto-generated receipt for order {}", order.getId());
    }
}
