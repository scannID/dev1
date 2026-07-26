package com.scanny.service;

import com.scanny.dto.OrderResponse;
import com.scanny.dto.OrdersPageResponse;
import com.scanny.dto.PageDtos;
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
import com.scanny.entity.Merchant;
import com.scanny.payment.model.FeeSplit;
import com.scanny.repository.CatalogItemRepository;
import com.scanny.repository.MerchantRepository;
import com.scanny.repository.OrderRepository;
import com.scanny.security.MerchantAccessService;
import com.scanny.util.CatalogPricing;
import com.scanny.util.JsonLists;
import com.scanny.util.WaitEstimate;
import com.scanny.dto.CustomerOrderDtos;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderService {

    private static final Logger logger = LoggerFactory.getLogger(OrderService.class);

    private final BusinessService businessService;
    private final OrderRepository orderRepository;
    private final CatalogItemRepository catalogItemRepository;
    private final ReceiptService receiptService;
    private final MerchantAccessService merchantAccessService;
    private final OutboxService outboxService;
    private final FeeService feeService;
    private final MerchantRepository merchantRepository;

    public OrderService(
            BusinessService businessService,
            OrderRepository orderRepository,
            CatalogItemRepository catalogItemRepository,
            ReceiptService receiptService,
            MerchantAccessService merchantAccessService,
            OutboxService outboxService,
            FeeService feeService,
            MerchantRepository merchantRepository
    ) {
        this.businessService = businessService;
        this.orderRepository = orderRepository;
        this.catalogItemRepository = catalogItemRepository;
        this.receiptService = receiptService;
        this.merchantAccessService = merchantAccessService;
        this.outboxService = outboxService;
        this.feeService = feeService;
        this.merchantRepository = merchantRepository;
    }

    @Transactional(readOnly = true)
    public CustomerOrderDtos.TrackingResponse getCustomerOrderTracking(UUID publicId, String phone) {
        Order order = orderRepository.findWithItemsByPublicId(publicId)
                .orElseThrow(() -> new ApiException(404, "Order was not found."));
        if (!phonesMatch(order.getCustomerPhone(), phone)) {
            throw new ApiException(404, "Order was not found.");
        }
        Integer waitMinutes = null;
        if (order.getStatus() == OrderStatus.Pending || order.getStatus() == OrderStatus.Preparing) {
            long open = orderRepository.countByBusinessIdAndStatusIn(
                    order.getBusiness().getId(),
                    List.of(OrderStatus.Pending, OrderStatus.Preparing)
            );
            waitMinutes = WaitEstimate.estimateMinutes(open);
        }
        return CustomerOrderDtos.TrackingResponse.from(order, waitMinutes);
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> listOrders(String businessId) {
        merchantAccessService.assertOwnsBusinessId(businessId);
        return orderRepository.findByBusinessIdOrderByCreatedAtDesc(businessId).stream()
                .map(OrderResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public OrdersPageResponse listOrdersPaged(
            String businessId,
            int page,
            int size,
            String search,
            String status,
            String paymentStatus
    ) {
        merchantAccessService.assertOwnsBusinessId(businessId);
        int safePage = Math.max(page, 1);
        int safeSize = Math.min(Math.max(size, 1), 100);
        String normalizedSearch = blankToNull(search);
        OrderStatus statusFilter = parseOrderStatus(status);
        PaymentStatus paymentFilter = parsePaymentStatus(paymentStatus);

        Pageable pageable = PageRequest.of(safePage - 1, safeSize, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Order> result = orderRepository.searchByBusiness(
                businessId,
                normalizedSearch,
                statusFilter,
                paymentFilter,
                pageable
        );

        return new OrdersPageResponse(
                result.getContent().stream().map(OrderResponse::from).toList(),
                PageDtos.PaginationMeta.from(result)
        );
    }

    private static String blankToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static OrderStatus parseOrderStatus(String status) {
        String normalized = blankToNull(status);
        if (normalized == null) return null;
        try {
            return OrderStatus.valueOf(normalized);
        } catch (IllegalArgumentException ex) {
            throw new ApiException(400, "Invalid order status: " + status);
        }
    }

    private static PaymentStatus parsePaymentStatus(String paymentStatus) {
        String normalized = blankToNull(paymentStatus);
        if (normalized == null) return null;
        try {
            return PaymentStatus.valueOf(normalized);
        } catch (IllegalArgumentException ex) {
            throw new ApiException(400, "Invalid payment status: " + paymentStatus);
        }
    }

    @Transactional
    public OrderResponse createOrder(String businessId, CreateOrderRequest request) {
        Business business = businessService.requireBusinessLight(businessId);

        String customerName = request.customer().name() != null ? request.customer().name().trim() : "";
        if (customerName.isBlank()) {
            throw new ApiException(400, "Customer name is required.");
        }
        if (request.items() == null || request.items().isEmpty()) {
            throw new ApiException(400, "At least one order item is required.");
        }

        Set<String> requestedIds = request.items().stream()
                .map(OrderItemRequest::resolvedItemId)
                .filter(id -> id != null && !id.isBlank())
                .collect(Collectors.toSet());
        if (requestedIds.isEmpty()) {
            throw new ApiException(400, "No available items were found for this order.");
        }

        Map<String, CatalogItem> itemsById = catalogItemRepository
                .findByBusinessIdAndIdIn(businessId, requestedIds)
                .stream()
                .collect(Collectors.toMap(CatalogItem::getId, item -> item, (a, b) -> a));

        List<OrderLineItem> lines = new ArrayList<>();
        for (OrderItemRequest lineRequest : request.items()) {
            String itemId = lineRequest.resolvedItemId();
            if (itemId == null || itemId.isBlank()) {
                continue;
            }

            CatalogItem item = itemsById.get(itemId);
            int quantity = lineRequest.quantity() != null ? lineRequest.quantity() : 1;
            if (item == null || !item.isAvailable() || quantity <= 0) {
                continue;
            }

            OrderLineItem line = new OrderLineItem();
            line.setItemId(item.getId());
            line.setName(item.getName());
            int unitPrice = CatalogPricing.effectivePrice(item.getPrice(), item.getDiscountPercent());
            line.setPrice(unitPrice);
            line.setQuantity(quantity);

            if (item.isLodging()) {
                java.time.LocalDate checkIn = parseRequiredDate(lineRequest.checkInDate(), "Check-in date");
                java.time.LocalDate checkOut = parseRequiredDate(lineRequest.checkOutDate(), "Check-out date");
                if (!checkOut.isAfter(checkIn)) {
                    throw new ApiException(400, "Check-out must be after check-in for " + item.getName() + ".");
                }
                int nights = (int) java.time.temporal.ChronoUnit.DAYS.between(checkIn, checkOut);
                if (nights < 1) {
                    throw new ApiException(400, "Stay must be at least 1 night for " + item.getName() + ".");
                }

                long booked = orderRepository.sumOverlappingLodgingUnits(
                        item.getId(),
                        checkIn,
                        checkOut,
                        OrderStatus.Cancelled,
                        PaymentStatus.Refunded
                );
                int units = Math.max(item.getUnitsAvailable(), 1);
                if (booked + quantity > units) {
                    throw new ApiException(
                            409,
                            item.getName() + " is not available for those dates ("
                                    + (units - booked) + " of " + units + " left)."
                    );
                }

                line.setCheckInDate(checkIn);
                line.setCheckOutDate(checkOut);
                line.setNights(nights);
                line.setLineTotal(unitPrice * nights * quantity);
                line.setRemovedIngredientsJson("[]");
            } else {
                List<String> allowedNames = JsonLists.readIngredients(item.getIngredientsJson()).stream()
                        .map(ingredient -> ingredient.name())
                        .toList();
                List<String> removed = JsonLists.normalizeStringList(lineRequest.removedIngredients()).stream()
                        .filter(allowedNames::contains)
                        .toList();
                line.setLineTotal(unitPrice * quantity);
                line.setRemovedIngredientsJson(JsonLists.writeStringList(removed));
            }
            lines.add(line);
        }

        if (lines.isEmpty()) {
            throw new ApiException(400, "No available items were found for this order.");
        }

        int subtotal = lines.stream().mapToInt(OrderLineItem::getLineTotal).sum();
        FeeSplit fees = feeService.split(subtotal);
        String merchantMomo = resolveMerchantMomo(business.getMerchantId());

        Order order = new Order();
        order.setId("ORD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
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
        order.setSubtotal(fees.subtotal());
        order.setServiceFee(fees.serviceFee());
        order.setPsoFee(fees.psoFee());
        order.setPlatformFee(fees.platformFee());
        order.setMerchantPayout(fees.merchantPayout());
        order.setMerchantMomoDestination(merchantMomo);
        order.setTotal(fees.grossCharged());
        order.setStatus(OrderStatus.Pending);
        order.setPaymentStatus(PaymentStatus.Unpaid);
        order.setCreatedAt(Instant.now());
        lines.forEach(order::addItem);

        OrderResponse response = OrderResponse.from(orderRepository.save(order));
        outboxService.enqueueRealtime("orders:" + businessId, "ORDER_CREATED", businessId, response);
        outboxService.enqueueRealtime(
                "admin:metrics",
                "ORDER_CREATED",
                businessId,
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
        outboxService.enqueueRealtime("orders:" + order.getBusiness().getId(), "ORDER_UPDATED", order.getBusiness().getId(), response);
        outboxService.enqueueAudit("ORDER_UPDATE", "order", order.getId(), Map.of(
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
        outboxService.enqueueRealtime(
                "orders:" + order.getBusiness().getId(),
                "ORDER_STATUS_UPDATED",
                order.getBusiness().getId(),
                response
        );
        outboxService.enqueueAudit("ORDER_STATUS_UPDATE", "order", order.getId(), Map.of("status", status.name()));
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
            outboxService.enqueueReceipt(savedOrder.getId());
        }

        OrderResponse response = OrderResponse.from(savedOrder);
        outboxService.enqueueRealtime(
                "orders:" + savedOrder.getBusiness().getId(),
                "ORDER_PAYMENT_UPDATED",
                savedOrder.getBusiness().getId(),
                response
        );
        outboxService.enqueueAudit(
                "ORDER_PAYMENT_UPDATE",
                "order",
                savedOrder.getId(),
                Map.of("paymentStatus", paymentStatus.name())
        );
        return response;
    }

    @Transactional
    public void generateReceiptForOrderId(String orderId) {
        Order order = orderRepository.findWithItemsById(orderId)
                .orElseThrow(() -> new ApiException(404, "Order was not found."));
        autoGenerateReceipt(order);
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
            outboxService.enqueueRealtime(
                    "orders:" + businessId,
                    "ORDERS_CLEARED",
                    businessId,
                    Map.of("deleted", toDelete.size())
            );
            outboxService.enqueueAudit("ORDERS_CLEARED", "business", businessId, Map.of("deleted", toDelete.size()));
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

    @Transactional(readOnly = true)
    public Order requireOrderForPayment(String orderId) {
        return orderRepository.findWithItemsById(orderId)
                .or(() -> {
                    try {
                        return orderRepository.findWithItemsByPublicId(UUID.fromString(orderId));
                    } catch (IllegalArgumentException ex) {
                        return java.util.Optional.empty();
                    }
                })
                .orElseThrow(() -> new ApiException(404, "Order was not found."));
    }

    private String resolveMerchantMomo(String merchantId) {
        if (merchantId == null || merchantId.isBlank()) {
            return "";
        }
        try {
            return merchantRepository.findById(UUID.fromString(merchantId))
                    .map(Merchant::getPaymentNumber)
                    .filter(n -> n != null && !n.isBlank())
                    .orElse("");
        } catch (IllegalArgumentException ex) {
            return "";
        }
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
            BigDecimal.valueOf(order.getSubtotal() > 0
                    ? order.getSubtotal()
                    : Math.max(order.getTotal() - order.getServiceFee(), 0)), // subtotal
            BigDecimal.ZERO,                                // taxAmount
            BigDecimal.valueOf(order.getServiceFee() > 0
                    ? order.getServiceFee()
                    : feeService.serviceFeeUgx()),            // serviceFee
            order.getCustomerNote(),                        // notes
            false,                                          // sendEmail (no email available)
            false                                           // generatePdf
        );

        receiptService.generateReceipt(receiptRequest);
        logger.info("Auto-generated receipt for order {}", order.getId());
    }

    private static java.time.LocalDate parseRequiredDate(String raw, String label) {
        if (raw == null || raw.isBlank()) {
            throw new ApiException(400, label + " is required for room and suite bookings.");
        }
        try {
            return java.time.LocalDate.parse(raw.trim());
        } catch (java.time.format.DateTimeParseException ex) {
            throw new ApiException(400, label + " must be YYYY-MM-DD.");
        }
    }
}
