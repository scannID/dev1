package com.scanny.service;

import com.scanny.dto.admin.AdminMerchantDtos;
import com.scanny.entity.Business;
import com.scanny.entity.Merchant;
import com.scanny.entity.Order;
import com.scanny.entity.PaymentIntent;
import com.scanny.entity.QrScanEvent;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.OrderStatus;
import com.scanny.model.enums.PaymentStatus;
import com.scanny.payment.PaymentIntentStatus;
import com.scanny.repository.BusinessRepository;
import com.scanny.repository.MerchantRepository;
import com.scanny.repository.OrderRepository;
import com.scanny.repository.PaymentIntentRepository;
import com.scanny.repository.QrScanEventRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AdminMerchantsService {

    private final BusinessRepository businessRepository;
    private final OrderRepository orderRepository;
    private final MerchantRepository merchantRepository;
    private final PaymentIntentRepository paymentIntentRepository;
    private final QrScanEventRepository qrScanEventRepository;
    private final AuditService auditService;

    public AdminMerchantsService(
            BusinessRepository businessRepository,
            OrderRepository orderRepository,
            MerchantRepository merchantRepository,
            PaymentIntentRepository paymentIntentRepository,
            QrScanEventRepository qrScanEventRepository,
            AuditService auditService) {
        this.businessRepository = businessRepository;
        this.orderRepository = orderRepository;
        this.merchantRepository = merchantRepository;
        this.paymentIntentRepository = paymentIntentRepository;
        this.qrScanEventRepository = qrScanEventRepository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public AdminMerchantDtos.MerchantsListResponse listMerchants(
        int page,
        int limit,
        String search,
        String status,
        String type
    ) {
        List<Business> allBusinesses = businessRepository.findAll();

        List<Business> filteredBusinesses = allBusinesses.stream()
            .filter(b -> search == null || search.isEmpty() ||
                b.getName().toLowerCase().contains(search.toLowerCase()) ||
                b.getOwnerName().toLowerCase().contains(search.toLowerCase()) ||
                b.getId().toLowerCase().contains(search.toLowerCase()))
            .filter(b -> type == null || type.isEmpty() ||
                b.getType().name().equalsIgnoreCase(type))
            .toList();

        Map<String, Merchant.MerchantStatus> statusByMerchantId = merchantRepository.findAll().stream()
            .collect(Collectors.toMap(m -> m.getId().toString(), Merchant::getStatus, (a, b2) -> a));

        if (status != null && !status.isEmpty()) {
            filteredBusinesses = filteredBusinesses.stream()
                .filter(b -> resolveStatusString(b, statusByMerchantId).equalsIgnoreCase(status))
                .toList();
        }

        int total = filteredBusinesses.size();
        int totalPages = (int) Math.ceil((double) total / limit);
        int start = (page - 1) * limit;
        int end = Math.min(start + limit, total);

        List<Business> paginatedBusinesses = filteredBusinesses.subList(
            Math.min(start, total), Math.min(end, total));

        Map<String, long[]> statsByMerchant = orderRepository.aggregateCompletedByMerchant(OrderStatus.Completed)
            .stream()
            .collect(Collectors.toMap(
                row -> (String) row[0],
                row -> new long[]{((Number) row[1]).longValue(), ((Number) row[2]).longValue()}
            ));

        List<AdminMerchantDtos.MerchantListItem> merchantItems = paginatedBusinesses.stream()
            .map(business -> {
                long[] stats = statsByMerchant.getOrDefault(
                    business.getMerchantId(),
                    statsByMerchant.getOrDefault(business.getId(), new long[]{0, 0}));
                String statusStr = resolveStatusString(business, statusByMerchantId);
                return AdminMerchantDtos.MerchantListItem.from(business, (int) stats[0], stats[1], statusStr);
            })
            .toList();

        AdminMerchantDtos.PaginationInfo pagination =
            new AdminMerchantDtos.PaginationInfo(page, limit, total, totalPages);

        long activeCount    = merchantItems.stream().filter(m -> "active".equals(m.status())).count();
        long pendingCount   = merchantItems.stream().filter(m -> "pending".equals(m.status())).count();
        long suspendedCount = merchantItems.stream().filter(m -> "suspended".equals(m.status())).count();

        AdminMerchantDtos.MerchantSummary summary =
            new AdminMerchantDtos.MerchantSummary(total, activeCount, pendingCount, suspendedCount);

        return new AdminMerchantDtos.MerchantsListResponse(merchantItems, pagination, summary);
    }

    @Transactional(readOnly = true)
    public AdminMerchantDtos.MerchantDetails getMerchantDetails(String merchantId) {
        Business business = businessRepository.findById(merchantId)
            .orElseThrow(() -> new ApiException(404, "Merchant not found: " + merchantId));

        String statusStr = resolveMerchantStatus(business);
        List<Order> completedOrders = orderRepository.findByBusinessIdOrderByCreatedAtDesc(merchantId).stream()
            .filter(o -> o.getStatus() == OrderStatus.Completed).toList();

        return AdminMerchantDtos.MerchantDetails.from(business, completedOrders.size(),
            completedOrders.stream().mapToLong(Order::getTotal).sum(), statusStr);
    }

    // ── Activity feed ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public AdminMerchantDtos.MerchantActivityResponse getMerchantActivity(
            String businessId, int page, int limit) {

        Business business = businessRepository.findById(businessId)
            .orElseThrow(() -> new ApiException(404, "Merchant not found: " + businessId));

        // ── Summary stats ────────────────────────────────────────────────────
        List<Order> allOrders = orderRepository.findByBusinessIdOrderByCreatedAtDesc(businessId);

        long totalOrders  = allOrders.size();
        long paidOrders   = allOrders.stream().filter(o -> o.getPaymentStatus() == PaymentStatus.Paid).count();
        long totalRevenue = allOrders.stream()
            .filter(o -> o.getPaymentStatus() == PaymentStatus.Paid)
            .mapToLong(Order::getTotal).sum();

        // Commission = sum of merchantPayout - subtotal across paid orders
        // (merchantPayout = subtotal + merchant's fee share)
        long totalCommission = allOrders.stream()
            .filter(o -> o.getPaymentStatus() == PaymentStatus.Paid)
            .mapToLong(o -> Math.max(0L, (long) o.getMerchantPayout() - (long) o.getSubtotal()))
            .sum();

        long totalScans    = qrScanEventRepository.countByBusinessId(businessId);
        long totalPayments = paymentIntentRepository.countByBusinessId(businessId);
        long failedPayments = paymentIntentRepository.countByBusinessIdAndStatus(
            businessId, PaymentIntentStatus.Failed);

        AdminMerchantDtos.MerchantActivitySummary summary = new AdminMerchantDtos.MerchantActivitySummary(
            totalOrders, paidOrders, totalRevenue, totalCommission,
            totalScans, totalPayments, failedPayments, null, "UGX");

        // ── Unified timeline ─────────────────────────────────────────────────
        // Merge orders + payments + scans into one chronological list, then page it.
        List<AdminMerchantDtos.ActivityEntry> all = new ArrayList<>();

        // Orders
        for (Order o : allOrders) {
            String detail = o.getCustomerName()
                + " · " + o.getStatus().name()
                + " · " + o.getPaymentStatus().name();
            all.add(new AdminMerchantDtos.ActivityEntry(
                o.getId(), "ORDER",
                "Order " + o.getId(),
                detail,
                o.getPaymentStatus().name(),
                o.getTotal(),
                o.getCreatedAt().toString()
            ));
        }

        // Payments (most recent 200 to keep query light)
        Page<PaymentIntent> payments = paymentIntentRepository.findByBusinessIdOrderByCreatedAtDesc(
            businessId, PageRequest.of(0, 200));
        for (PaymentIntent p : payments) {
            String detail = p.getCustomerName()
                + " · " + p.getProviderId()
                + " · " + p.getCustomerPhone();
            all.add(new AdminMerchantDtos.ActivityEntry(
                p.getId(), "PAYMENT",
                "Payment " + p.getId().substring(0, Math.min(8, p.getId().length())),
                detail,
                p.getStatus().name(),
                p.getAmount(),
                p.getCreatedAt().toString()
            ));
        }

        // Scans (most recent 200)
        Page<QrScanEvent> scans = qrScanEventRepository.findByBusinessId(
            businessId, PageRequest.of(0, 200, Sort.by(Sort.Direction.DESC, "scannedAt")));
        for (QrScanEvent s : scans) {
            all.add(new AdminMerchantDtos.ActivityEntry(
                String.valueOf(s.getId()), "SCAN",
                "QR Scan",
                "Business: " + s.getBusinessId(),
                "SCANNED",
                0,
                s.getScannedAt().toString()
            ));
        }

        // Sort newest first
        all.sort(Comparator.comparing(AdminMerchantDtos.ActivityEntry::occurredAt).reversed());

        // Manual pagination
        int total  = all.size();
        int pages  = (int) Math.ceil((double) total / limit);
        int start  = (page - 1) * limit;
        int end    = Math.min(start + limit, total);
        List<AdminMerchantDtos.ActivityEntry> paged =
            start >= total ? List.of() : all.subList(start, end);

        AdminMerchantDtos.PaginationInfo pageInfo =
            new AdminMerchantDtos.PaginationInfo(page, limit, total, pages);

        return new AdminMerchantDtos.MerchantActivityResponse(summary, paged, pageInfo);
    }

    @Transactional(readOnly = true)
    public AdminMerchantDtos.MerchantOrdersResponse getMerchantOrders(
            String businessId, int page, int limit) {

        businessRepository.findById(businessId)
            .orElseThrow(() -> new ApiException(404, "Merchant not found: " + businessId));

        List<Order> all = orderRepository.findByBusinessIdOrderByCreatedAtDesc(businessId);
        int total  = all.size();
        int pages  = (int) Math.ceil((double) total / limit);
        int start  = (page - 1) * limit;
        int end    = Math.min(start + limit, total);
        List<Order> paged = start >= total ? List.of() : all.subList(start, end);

        List<AdminMerchantDtos.OrderRow> rows = paged.stream()
            .map(o -> new AdminMerchantDtos.OrderRow(
                o.getId(),
                o.getCustomerName(),
                o.getStatus().name(),
                o.getPaymentStatus().name(),
                o.getTotal(),
                o.getMerchantPayout(),
                o.getServiceFee(),
                o.getPlatformFee(),
                o.getCreatedAt().toString()
            ))
            .toList();

        return new AdminMerchantDtos.MerchantOrdersResponse(rows,
            new AdminMerchantDtos.PaginationInfo(page, limit, total, pages));
    }

    @Transactional(readOnly = true)
    public AdminMerchantDtos.MerchantPaymentsResponse getMerchantPayments(
            String businessId, int page, int limit) {

        businessRepository.findById(businessId)
            .orElseThrow(() -> new ApiException(404, "Merchant not found: " + businessId));

        Page<PaymentIntent> result = paymentIntentRepository.findByBusinessIdOrderByCreatedAtDesc(
            businessId, PageRequest.of(page - 1, limit));

        List<AdminMerchantDtos.PaymentRow> rows = result.getContent().stream()
            .map(p -> new AdminMerchantDtos.PaymentRow(
                p.getId(),
                p.getReferenceId(),
                p.getProviderId(),
                p.getStatus().name(),
                p.getAmount(),
                p.getMerchantPayout(),
                p.getPlatformFee(),
                p.getCustomerPhone(),
                p.getCreatedAt().toString()
            ))
            .toList();

        return new AdminMerchantDtos.MerchantPaymentsResponse(rows,
            new AdminMerchantDtos.PaginationInfo(page, limit, result.getTotalElements(),
                result.getTotalPages()));
    }

    @Transactional(readOnly = true)
    public AdminMerchantDtos.MerchantScansResponse getMerchantScans(
            String businessId, int page, int limit) {

        businessRepository.findById(businessId)
            .orElseThrow(() -> new ApiException(404, "Merchant not found: " + businessId));

        Page<QrScanEvent> result = qrScanEventRepository.findByBusinessId(
            businessId, PageRequest.of(page - 1, limit, Sort.by(Sort.Direction.DESC, "scannedAt")));

        List<AdminMerchantDtos.ScanRow> rows = result.getContent().stream()
            .map(s -> new AdminMerchantDtos.ScanRow(s.getBusinessId(), s.getScannedAt().toString()))
            .toList();

        return new AdminMerchantDtos.MerchantScansResponse(rows,
            qrScanEventRepository.countByBusinessId(businessId),
            new AdminMerchantDtos.PaginationInfo(page, limit, result.getTotalElements(),
                result.getTotalPages()));
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    @Transactional
    public AdminMerchantDtos.MerchantDetails updateMerchant(
        String merchantId,
        AdminMerchantDtos.UpdateMerchantRequest request
    ) {
        Business business = businessRepository.findById(merchantId)
            .orElseThrow(() -> new ApiException(404, "Merchant not found: " + merchantId));

        if (request.name() != null && !request.name().isEmpty()) {
            business.setName(request.name());
        }
        business = businessRepository.save(business);

        String statusStr = resolveMerchantStatus(business);
        List<Order> completedOrders = orderRepository.findByBusinessIdOrderByCreatedAtDesc(merchantId).stream()
            .filter(o -> o.getStatus() == OrderStatus.Completed).toList();

        return AdminMerchantDtos.MerchantDetails.from(business, completedOrders.size(),
            completedOrders.stream().mapToLong(Order::getTotal).sum(), statusStr);
    }

    @Transactional
    public AdminMerchantDtos.MerchantDetails updateMerchantStatus(
        String businessId,
        AdminMerchantDtos.UpdateMerchantStatusRequest request
    ) {
        Business business = businessRepository.findById(businessId)
            .orElseThrow(() -> new ApiException(404, "Merchant not found: " + businessId));

        Merchant.MerchantStatus newStatus;
        try {
            newStatus = Merchant.MerchantStatus.valueOf(request.status().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new ApiException(400, "Invalid status. Use: ACTIVE, SUSPENDED, CLOSED, PENDING_VERIFICATION");
        }

        // Only propagate status to the shared Merchant record when the targeted
        // business is the primary (or only) branch.  Changing a non-primary branch
        // must never bleed through to sibling branches via the shared Merchant row.
        boolean isPrimaryBranch = business.isPrimary()
                || businessRepository.countByMerchantId(business.getMerchantId()) == 1;

        if (isPrimaryBranch) {
            Optional<Merchant> merchantOpt = tryFindMerchant(business.getMerchantId());
            if (merchantOpt.isPresent()) {
                Merchant merchant = merchantOpt.get();
                merchant.setStatus(newStatus);
                merchantRepository.save(merchant);
            }
        }

        if (newStatus == Merchant.MerchantStatus.SUSPENDED || newStatus == Merchant.MerchantStatus.CLOSED) {
            business.setAcceptingOrders(false);
            if (business.getPauseMessage() == null || business.getPauseMessage().isBlank()) {
                String reason = request.reason() != null && !request.reason().isBlank()
                    ? request.reason()
                    : (newStatus == Merchant.MerchantStatus.SUSPENDED
                        ? "This account has been suspended."
                        : "This location is no longer accepting orders.");
                business.setPauseMessage(reason);
            }
        } else if (newStatus == Merchant.MerchantStatus.ACTIVE) {
            business.setAcceptingOrders(true);
            business.setPauseMessage("");
        }
        businessRepository.save(business);

        auditService.success("MERCHANT_STATUS_CHANGE", "merchant", businessId,
            Map.of("newStatus", newStatus.name(),
                   "reason", request.reason() != null ? request.reason() : ""));

        String statusStr = newStatus.name().toLowerCase();
        if (newStatus == Merchant.MerchantStatus.PENDING_VERIFICATION) statusStr = "pending";

        List<Order> completedOrders = orderRepository.findByBusinessIdOrderByCreatedAtDesc(businessId).stream()
            .filter(o -> o.getStatus() == OrderStatus.Completed).toList();
        return AdminMerchantDtos.MerchantDetails.from(business, completedOrders.size(),
            completedOrders.stream().mapToLong(Order::getTotal).sum(), statusStr);
    }

    @Transactional
    public void deleteMerchant(String merchantId) {
        Business business = businessRepository.findById(merchantId)
            .orElseThrow(() -> new ApiException(404, "Merchant not found: " + merchantId));
        businessRepository.delete(business);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private Optional<Merchant> tryFindMerchant(String merchantIdStr) {
        if (merchantIdStr == null || merchantIdStr.isBlank()) return Optional.empty();
        try {
            return merchantRepository.findById(UUID.fromString(merchantIdStr));
        } catch (IllegalArgumentException ex) {
            return Optional.empty();
        }
    }

    private String resolveMerchantStatus(Business business) {
        return tryFindMerchant(business.getMerchantId())
            .map(m -> statusToString(m.getStatus()))
            .orElse(business.isAcceptingOrders() ? "active" : "suspended");
    }

    private String resolveStatusString(Business business, Map<String, Merchant.MerchantStatus> statusMap) {
        String mid = business.getMerchantId();
        if (mid != null && statusMap.containsKey(mid)) {
            return statusToString(statusMap.get(mid));
        }
        return business.isAcceptingOrders() ? "active" : "suspended";
    }

    private static String statusToString(Merchant.MerchantStatus status) {
        if (status == null) return "active";
        return switch (status) {
            case ACTIVE -> "active";
            case SUSPENDED -> "suspended";
            case CLOSED -> "closed";
            case PENDING_VERIFICATION -> "pending";
        };
    }
}
