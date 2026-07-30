package com.scanny.service;

import com.scanny.dto.OperationsDtos;
import com.scanny.entity.Business;
import com.scanny.entity.BusinessTable;
import com.scanny.entity.Order;
import com.scanny.entity.OrderSplitPayment;
import com.scanny.entity.TableSession;
import com.scanny.entity.TableSessionOrder;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.PaymentStatus;
import com.scanny.model.enums.TableSessionStatus;
import com.scanny.repository.BusinessRepository;
import com.scanny.repository.BusinessTableRepository;
import com.scanny.repository.OrderRepository;
import com.scanny.repository.OrderSplitPaymentRepository;
import com.scanny.repository.TableSessionOrderRepository;
import com.scanny.repository.TableSessionRepository;
import com.scanny.security.OperationsAccessService;
import com.scanny.util.CodeUtils;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TableService {

    private final BusinessRepository businessRepository;
    private final BusinessTableRepository tableRepository;
    private final TableSessionRepository sessionRepository;
    private final OrderRepository orderRepository;
    private final OrderSplitPaymentRepository splitPaymentRepository;
    private final TableSessionOrderRepository sessionOrderRepository;
    private final OperationsAccessService operationsAccessService;
    private final OrderService orderService;
    private final String scanBaseUrl;

    public TableService(
            BusinessRepository businessRepository,
            BusinessTableRepository tableRepository,
            TableSessionRepository sessionRepository,
            OrderRepository orderRepository,
            OrderSplitPaymentRepository splitPaymentRepository,
            TableSessionOrderRepository sessionOrderRepository,
            OperationsAccessService operationsAccessService,
            @Lazy OrderService orderService,
            @Value("${scanny.scan-base-url}") String scanBaseUrl
    ) {
        this.businessRepository = businessRepository;
        this.tableRepository = tableRepository;
        this.sessionRepository = sessionRepository;
        this.orderRepository = orderRepository;
        this.splitPaymentRepository = splitPaymentRepository;
        this.sessionOrderRepository = sessionOrderRepository;
        this.operationsAccessService = operationsAccessService;
        this.orderService = orderService;
        this.scanBaseUrl = scanBaseUrl;
    }

    @Transactional(readOnly = true)
    public List<OperationsDtos.TableResponse> listTables(String businessId, String staffSession) {
        requireFloorAccess(businessId, staffSession);
        return tableRepository.findByBusinessIdOrderByLabelAsc(businessId).stream()
                .map(table -> OperationsDtos.TableResponse.from(table, scanBaseUrl))
                .toList();
    }

    @Transactional
    public OperationsDtos.TableResponse createTable(
            String businessId,
            OperationsDtos.CreateTableRequest request,
            String staffSession
    ) {
        Business business = requireFloorAccess(businessId, staffSession);
        BusinessTable table = new BusinessTable();
        table.setId(CodeUtils.slugify(request.label()) + "-" + CodeUtils.randomToken(4));
        table.setBusiness(business);
        table.setLabel(request.label().trim());
        table.setQrToken(CodeUtils.randomToken(16));
        table.setActive(true);
        return OperationsDtos.TableResponse.from(tableRepository.save(table), scanBaseUrl);
    }

    @Transactional(readOnly = true)
    public BusinessTable resolveTableForScan(String businessId, String tableId, String qrToken) {
        if (tableId != null && !tableId.isBlank()) {
            return tableRepository.findByBusinessIdAndId(businessId, tableId)
                    .filter(BusinessTable::isActive)
                    .orElseThrow(() -> new ApiException(404, "Table was not found."));
        }
        if (qrToken != null && !qrToken.isBlank()) {
            BusinessTable table = tableRepository.findByQrToken(qrToken)
                    .orElseThrow(() -> new ApiException(404, "Table QR was not found."));
            if (!table.getBusiness().getId().equals(businessId) || !table.isActive()) {
                throw new ApiException(404, "Table QR was not found.");
            }
            return table;
        }
        throw new ApiException(400, "Table reference is required.");
    }

    @Transactional
    public TableSession openSession(BusinessTable table) {
        return sessionRepository.findByTableIdAndStatus(table.getId(), TableSessionStatus.Open)
                .orElseGet(() -> {
                    TableSession session = new TableSession();
                    session.setBusiness(table.getBusiness());
                    session.setTable(table);
                    session.setStatus(TableSessionStatus.Open);
                    return sessionRepository.save(session);
                });
    }

    @Transactional(readOnly = true)
    public List<OperationsDtos.TableSessionResponse> openSessions(String businessId, String staffSession) {
        requireFloorAccess(businessId, staffSession);
        List<TableSession> sessions = sessionRepository.findByBusinessIdAndStatusOrderByOpenedAtDesc(
                businessId, TableSessionStatus.Open);
        if (sessions.isEmpty()) {
            return List.of();
        }
        List<UUID> sessionIds = sessions.stream().map(TableSession::getId).toList();
        Map<UUID, List<String>> linkedOrderIds = sessionOrderRepository.findBySessionIdIn(sessionIds).stream()
                .collect(Collectors.groupingBy(
                        TableSessionOrder::getSessionId,
                        Collectors.mapping(TableSessionOrder::getOrderId, Collectors.toList())
                ));
        Map<UUID, List<Order>> ordersBySession = orderRepository.findByTableSessionIdIn(sessionIds).stream()
                .filter(order -> order.getTableSessionId() != null)
                .collect(Collectors.groupingBy(Order::getTableSessionId));

        return sessions.stream()
                .map(session -> {
                    List<Order> orders = ordersBySession.getOrDefault(session.getId(), List.of());
                    List<String> orderIds = linkedOrderIds.getOrDefault(session.getId(), List.of());
                    if (orderIds.isEmpty()) {
                        orderIds = orders.stream().map(Order::getId).toList();
                    }
                    int orderTotal = orders.stream().mapToInt(Order::getTotal).sum();
                    int unpaidTotal = orders.stream()
                            .filter(order -> order.getPaymentStatus() == PaymentStatus.Unpaid)
                            .mapToInt(Order::getTotal)
                            .sum();
                    String paymentStatus = unpaidTotal <= 0 && !orders.isEmpty() ? "Paid" : "Unpaid";
                    return OperationsDtos.TableSessionResponse.from(
                            session, orderIds, orderTotal, unpaidTotal, paymentStatus);
                })
                .toList();
    }

    @Transactional
    public void linkOrderToSession(UUID sessionId, String orderId) {
        if (sessionId == null || orderId == null || orderId.isBlank()) {
            return;
        }
        if (!sessionOrderRepository.existsBySessionIdAndOrderId(sessionId, orderId)) {
            sessionOrderRepository.save(new TableSessionOrder(sessionId, orderId));
        }
    }

    @Transactional
    public OperationsDtos.SplitPaymentResponse createSplitPayment(
            String businessId,
            String orderId,
            OperationsDtos.CreateSplitPaymentRequest request,
            String staffSession
    ) {
        requireFloorAccess(businessId, staffSession);
        Order order = requireBusinessOrder(businessId, orderId);
        ensureSplitCapacity(order, request.amount());
        OrderSplitPayment payment = newSplit(order, request.payerName(), request.payerPhone(), request.amount());
        return OperationsDtos.SplitPaymentResponse.from(splitPaymentRepository.save(payment));
    }

    @Transactional
    public List<OperationsDtos.SplitPaymentResponse> createEqualSplits(
            String businessId,
            String orderId,
            OperationsDtos.CreateEqualSplitsRequest request,
            String staffSession
    ) {
        requireFloorAccess(businessId, staffSession);
        return createEqualSplitsInternal(requireBusinessOrder(businessId, orderId), request);
    }

    /** Guest-facing equal split — no staff session required. */
    @Transactional
    public List<OperationsDtos.SplitPaymentResponse> createPublicEqualSplits(
            UUID publicId,
            OperationsDtos.CreateEqualSplitsRequest request
    ) {
        Order order = orderRepository.findWithItemsByPublicId(publicId)
                .orElseThrow(() -> new ApiException(404, "Order was not found."));
        return createEqualSplitsInternal(order, request);
    }

    /** Guest allocates custom shares before paying the full bill as one payment. */
    @Transactional
    public List<OperationsDtos.SplitPaymentResponse> createPublicCustomSplits(
            UUID publicId,
            OperationsDtos.CreateCustomSplitsRequest request
    ) {
        Order order = orderRepository.findWithItemsByPublicId(publicId)
                .orElseThrow(() -> new ApiException(404, "Order was not found."));
        if (order.getPaymentStatus() == PaymentStatus.Paid) {
            throw new ApiException(400, "Order is already paid.");
        }
        String orderId = order.getId();
        List<OrderSplitPayment> existing = splitPaymentRepository.findByOrderIdOrderByCreatedAtAsc(orderId);
        if (!existing.isEmpty()) {
            boolean anyPaid = existing.stream().anyMatch(s -> s.getPaymentStatus() == PaymentStatus.Paid);
            if (anyPaid) {
                throw new ApiException(400, "Some shares are already paid. Clear unpaid shares first.");
            }
            splitPaymentRepository.deleteAll(existing);
            order.setSplitGroupId(null);
            orderRepository.save(order);
        }

        if (request.shares().size() < 2 || request.shares().size() > 8) {
            throw new ApiException(400, "Split requires between 2 and 8 shares.");
        }
        for (OperationsDtos.CreateSplitPaymentRequest share : request.shares()) {
            if (share.amount() < 1) {
                throw new ApiException(400, "Each share amount must be at least 1 UGX.");
            }
            if (share.payerName() == null || share.payerName().isBlank()) {
                throw new ApiException(400, "Each share needs a payer name.");
            }
        }
        int allocated = request.shares().stream().mapToInt(OperationsDtos.CreateSplitPaymentRequest::amount).sum();
        if (allocated != order.getTotal()) {
            throw new ApiException(400, "Split amounts must add up to the order total (" + order.getTotal() + ").");
        }

        ensureSplitGroup(order);
        List<OperationsDtos.SplitPaymentResponse> created = new ArrayList<>();
        for (OperationsDtos.CreateSplitPaymentRequest share : request.shares()) {
            String name = share.payerName().trim();
            OrderSplitPayment payment = newSplit(order, name, share.payerPhone() == null ? "" : share.payerPhone(), share.amount());
            created.add(OperationsDtos.SplitPaymentResponse.from(splitPaymentRepository.save(payment)));
        }
        return created;
    }

    /** When the full order is paid in one payment, mark every share paid too. */
    @Transactional
    public void markAllSplitsPaidForOrder(String orderId) {
        List<OrderSplitPayment> splits = splitPaymentRepository.findByOrderIdOrderByCreatedAtAsc(orderId);
        for (OrderSplitPayment split : splits) {
            if (split.getPaymentStatus() != PaymentStatus.Paid) {
                split.setPaymentStatus(PaymentStatus.Paid);
                splitPaymentRepository.save(split);
            }
        }
    }

    private List<OperationsDtos.SplitPaymentResponse> createEqualSplitsInternal(
            Order order,
            OperationsDtos.CreateEqualSplitsRequest request
    ) {
        if (order.getPaymentStatus() == PaymentStatus.Paid) {
            throw new ApiException(400, "Order is already paid.");
        }
        String orderId = order.getId();
        if (!splitPaymentRepository.findByOrderIdOrderByCreatedAtAsc(orderId).isEmpty()) {
            throw new ApiException(400, "This order already has split payments. Clear or pay them first.");
        }

        int parts = request.parts();
        int total = order.getTotal();
        int base = total / parts;
        int remainder = total % parts;
        String baseName = request.basePayerName() == null || request.basePayerName().isBlank()
                ? "Guest"
                : request.basePayerName().trim();

        ensureSplitGroup(order);
        List<OperationsDtos.SplitPaymentResponse> created = new ArrayList<>();
        for (int i = 0; i < parts; i++) {
            int amount = base + (i < remainder ? 1 : 0);
            if (amount < 1) {
                continue;
            }
            OrderSplitPayment payment = newSplit(order, baseName + " " + (i + 1), "", amount);
            created.add(OperationsDtos.SplitPaymentResponse.from(splitPaymentRepository.save(payment)));
        }
        return created;
    }

    @Transactional(readOnly = true)
    public OperationsDtos.SplitBillSummary getSplitBill(String businessId, String orderId, String staffSession) {
        requireFloorAccess(businessId, staffSession);
        return toSummary(requireBusinessOrder(businessId, orderId));
    }

    @Transactional(readOnly = true)
    public OperationsDtos.SplitBillSummary getPublicSplitBill(UUID publicId) {
        Order order = orderRepository.findWithItemsByPublicId(publicId)
                .orElseThrow(() -> new ApiException(404, "Order was not found."));
        return toSummary(order);
    }

    @Transactional
    public OperationsDtos.SplitPaymentResponse markSplitPaid(
            String businessId,
            String orderId,
            UUID splitId,
            String staffSession
    ) {
        requireFloorAccess(businessId, staffSession);
        requireBusinessOrder(businessId, orderId);
        return markSplitPaidInternal(orderId, splitId);
    }

    @Transactional
    public int clearUnpaidSplits(String businessId, String orderId, String staffSession) {
        requireFloorAccess(businessId, staffSession);
        Order order = requireBusinessOrder(businessId, orderId);
        List<OrderSplitPayment> unpaid = splitPaymentRepository.findByOrderIdOrderByCreatedAtAsc(orderId).stream()
                .filter(split -> split.getPaymentStatus() != PaymentStatus.Paid)
                .toList();
        splitPaymentRepository.deleteAll(unpaid);
        if (splitPaymentRepository.findByOrderId(orderId).isEmpty()) {
            order.setSplitGroupId(null);
            orderRepository.save(order);
        }
        return unpaid.size();
    }

    @Transactional
    public void deleteSplit(String businessId, String orderId, UUID splitId, String staffSession) {
        requireFloorAccess(businessId, staffSession);
        Order order = requireBusinessOrder(businessId, orderId);
        OrderSplitPayment payment = splitPaymentRepository.findById(splitId)
                .orElseThrow(() -> new ApiException(404, "Split payment was not found."));
        if (!payment.getOrderId().equals(orderId)) {
            throw new ApiException(404, "Split payment was not found.");
        }
        if (payment.getPaymentStatus() == PaymentStatus.Paid) {
            throw new ApiException(400, "Paid shares cannot be deleted.");
        }
        splitPaymentRepository.delete(payment);
        if (splitPaymentRepository.findByOrderId(orderId).isEmpty()) {
            order.setSplitGroupId(null);
            orderRepository.save(order);
        }
    }

    @Transactional
    public void confirmSplitFromGateway(String splitId) {
        UUID id;
        try {
            id = UUID.fromString(splitId);
        } catch (IllegalArgumentException ex) {
            throw new ApiException(400, "Invalid split payment id.");
        }
        OrderSplitPayment payment = splitPaymentRepository.findById(id)
                .orElseThrow(() -> new ApiException(404, "Split payment was not found."));
        markSplitPaidInternal(payment.getOrderId(), payment.getId());
    }

    @Transactional(readOnly = true)
    public OrderSplitPayment requireUnpaidSplit(String splitId) {
        UUID id;
        try {
            id = UUID.fromString(splitId);
        } catch (IllegalArgumentException ex) {
            throw new ApiException(400, "Invalid split payment id.");
        }
        OrderSplitPayment payment = splitPaymentRepository.findById(id)
                .orElseThrow(() -> new ApiException(404, "Split payment was not found."));
        if (payment.getPaymentStatus() == PaymentStatus.Paid) {
            throw new ApiException(400, "This share is already paid.");
        }
        return payment;
    }

    @Transactional
    public void closeSession(String businessId, UUID sessionId, String staffSession) {
        requireFloorAccess(businessId, staffSession);
        TableSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ApiException(404, "Table session was not found."));
        if (!session.getBusiness().getId().equals(businessId)) {
            throw new ApiException(404, "Table session was not found.");
        }
        session.setStatus(TableSessionStatus.Closed);
        session.setClosedAt(Instant.now());
        sessionRepository.save(session);
    }

    private OperationsDtos.SplitPaymentResponse markSplitPaidInternal(String orderId, UUID splitId) {
        // Lock parent order first so concurrent share webhooks cannot race the paid-balance check.
        Order order = orderRepository.findByIdForUpdate(orderId)
                .orElseThrow(() -> new ApiException(404, "Order was not found."));

        OrderSplitPayment payment = splitPaymentRepository.findById(splitId)
                .orElseThrow(() -> new ApiException(404, "Split payment was not found."));
        if (!payment.getOrderId().equals(orderId)) {
            throw new ApiException(404, "Split payment was not found.");
        }
        if (payment.getPaymentStatus() != PaymentStatus.Paid) {
            payment.setPaymentStatus(PaymentStatus.Paid);
            splitPaymentRepository.save(payment);
        }
        maybeMarkOrderPaid(order);
        return OperationsDtos.SplitPaymentResponse.from(payment);
    }

    private void maybeMarkOrderPaid(Order order) {
        String orderId = order.getId();
        List<OrderSplitPayment> splits = splitPaymentRepository.findByOrderIdOrderByCreatedAtAsc(orderId);
        if (splits.isEmpty()) {
            return;
        }
        boolean allPaid = splits.stream().allMatch(split -> split.getPaymentStatus() == PaymentStatus.Paid);
        int paidTotal = splits.stream()
                .filter(split -> split.getPaymentStatus() == PaymentStatus.Paid)
                .mapToInt(OrderSplitPayment::getAmount)
                .sum();
        // Paid shares knock off the balance; order is fully paid when every share is Paid and sums cover total.
        if (allPaid && paidTotal >= order.getTotal() && order.getPaymentStatus() != PaymentStatus.Paid) {
            orderService.confirmPaymentFromGateway(orderId, PaymentStatus.Paid);
        }
    }

    private OperationsDtos.SplitBillSummary toSummary(Order order) {
        List<OperationsDtos.SplitPaymentResponse> splits = splitPaymentRepository
                .findByOrderIdOrderByCreatedAtAsc(order.getId()).stream()
                .map(OperationsDtos.SplitPaymentResponse::from)
                .toList();
        // Knock-off model: paid shares reduce what is still owed (no refunds).
        int paidTotal = splits.stream()
                .filter(s -> "Paid".equalsIgnoreCase(s.paymentStatus()))
                .mapToInt(OperationsDtos.SplitPaymentResponse::amount)
                .sum();
        return new OperationsDtos.SplitBillSummary(
                order.getId(),
                order.getPublicId(),
                order.getBusinessName(),
                order.getTotal(),
                paidTotal,
                Math.max(0, order.getTotal() - paidTotal),
                order.getPaymentStatus().name(),
                splits
        );
    }

    private Business requireFloorAccess(String businessId, String staffSession) {
        operationsAccessService.requireMerchantOrStaff(businessId, staffSession, OperationsAccessService.floorRoles());
        return businessRepository.findById(businessId)
                .orElseThrow(() -> new ApiException(404, "Business was not found."));
    }

    private Order requireBusinessOrder(String businessId, String orderId) {
        Order order = orderRepository.findWithItemsById(orderId)
                .orElseThrow(() -> new ApiException(404, "Order was not found."));
        if (!order.getBusiness().getId().equals(businessId)) {
            throw new ApiException(404, "Order was not found.");
        }
        return order;
    }

    private void ensureSplitCapacity(Order order, int amount) {
        if (order.getPaymentStatus() == PaymentStatus.Paid) {
            throw new ApiException(400, "Order is already paid.");
        }
        if (amount < 1) {
            throw new ApiException(400, "Split amount must be at least 1.");
        }
        int allocated = splitPaymentRepository.findByOrderId(order.getId()).stream()
                .mapToInt(OrderSplitPayment::getAmount)
                .sum();
        if (allocated + amount > order.getTotal()) {
            throw new ApiException(400, "Split amounts exceed the order total. Remaining: "
                    + Math.max(0, order.getTotal() - allocated) + ".");
        }
        ensureSplitGroup(order);
    }

    private void ensureSplitGroup(Order order) {
        if (order.getSplitGroupId() == null) {
            order.setSplitGroupId(UUID.randomUUID());
            orderRepository.save(order);
        }
    }

    private OrderSplitPayment newSplit(Order order, String payerName, String payerPhone, int amount) {
        ensureSplitGroup(order);
        OrderSplitPayment payment = new OrderSplitPayment();
        payment.setSplitGroupId(order.getSplitGroupId());
        payment.setOrderId(order.getId());
        payment.setPayerName(payerName == null || payerName.isBlank() ? "Guest" : payerName.trim());
        payment.setPayerPhone(payerPhone == null ? "" : payerPhone.trim());
        payment.setAmount(amount);
        payment.setPaymentStatus(PaymentStatus.Unpaid);
        return payment;
    }
}
