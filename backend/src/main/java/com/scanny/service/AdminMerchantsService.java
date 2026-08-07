package com.scanny.service;

import com.scanny.dto.admin.AdminMerchantDtos;
import com.scanny.entity.Business;
import com.scanny.entity.Merchant;
import com.scanny.entity.Order;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.BusinessType;
import com.scanny.model.enums.OrderStatus;
import com.scanny.repository.BusinessRepository;
import com.scanny.repository.MerchantRepository;
import com.scanny.repository.OrderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    private final AuditService auditService;

    public AdminMerchantsService(
            BusinessRepository businessRepository,
            OrderRepository orderRepository,
            MerchantRepository merchantRepository,
            AuditService auditService) {
        this.businessRepository = businessRepository;
        this.orderRepository = orderRepository;
        this.merchantRepository = merchantRepository;
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

        // Apply filters
        List<Business> filteredBusinesses = allBusinesses.stream()
            .filter(b -> search == null || search.isEmpty() ||
                b.getName().toLowerCase().contains(search.toLowerCase()) ||
                b.getOwnerName().toLowerCase().contains(search.toLowerCase()) ||
                b.getId().toLowerCase().contains(search.toLowerCase()))
            .filter(b -> type == null || type.isEmpty() ||
                b.getType().name().equalsIgnoreCase(type))
            .toList();

        // Load merchant statuses keyed by merchant UUID string
        Map<String, Merchant.MerchantStatus> statusByMerchantId = merchantRepository.findAll().stream()
            .collect(Collectors.toMap(m -> m.getId().toString(), Merchant::getStatus, (a, b2) -> a));

        // Apply status filter after resolving real status
        if (status != null && !status.isEmpty()) {
            filteredBusinesses = filteredBusinesses.stream()
                .filter(b -> {
                    String s = resolveStatusString(b, statusByMerchantId);
                    return s.equalsIgnoreCase(status);
                })
                .toList();
        }

        // Calculate pagination
        int total = filteredBusinesses.size();
        int totalPages = (int) Math.ceil((double) total / limit);
        int start = (page - 1) * limit;
        int end = Math.min(start + limit, total);

        List<Business> paginatedBusinesses = filteredBusinesses.subList(
            Math.min(start, total),
            Math.min(end, total)
        );

        // Aggregate completed-order stats
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

        AdminMerchantDtos.PaginationInfo pagination = new AdminMerchantDtos.PaginationInfo(page, limit, total, totalPages);

        long activeCount   = merchantItems.stream().filter(m -> "active".equals(m.status())).count();
        long pendingCount  = merchantItems.stream().filter(m -> "pending".equals(m.status())).count();
        long suspendedCount = merchantItems.stream().filter(m -> "suspended".equals(m.status())).count();

        AdminMerchantDtos.MerchantSummary summary = new AdminMerchantDtos.MerchantSummary(
            total, activeCount, pendingCount, suspendedCount);

        return new AdminMerchantDtos.MerchantsListResponse(merchantItems, pagination, summary);
    }

    @Transactional(readOnly = true)
    public AdminMerchantDtos.MerchantDetails getMerchantDetails(String merchantId) {
        Business business = businessRepository.findById(merchantId)
            .orElseThrow(() -> new ApiException(404, "Merchant not found: " + merchantId));

        String statusStr = resolveMerchantStatus(business);

        List<Order> completedOrders = orderRepository.findByBusinessIdOrderByCreatedAtDesc(merchantId).stream()
            .filter(o -> o.getStatus() == OrderStatus.Completed)
            .toList();

        int totalOrders = completedOrders.size();
        long totalRevenue = completedOrders.stream().mapToLong(Order::getTotal).sum();

        return AdminMerchantDtos.MerchantDetails.from(business, totalOrders, totalRevenue, statusStr);
    }

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
            .filter(o -> o.getStatus() == OrderStatus.Completed)
            .toList();

        return AdminMerchantDtos.MerchantDetails.from(business, completedOrders.size(),
            completedOrders.stream().mapToLong(Order::getTotal).sum(), statusStr);
    }

    /**
     * Suspend, activate, or close a merchant account.
     * Works by looking up the Merchant row via merchantId (UUID stored as String on Business).
     */
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

        // Update the Merchant row if one exists (linked by merchantId UUID)
        Optional<Merchant> merchantOpt = tryFindMerchant(business.getMerchantId());
        if (merchantOpt.isPresent()) {
            Merchant merchant = merchantOpt.get();
            merchant.setStatus(newStatus);
            merchantRepository.save(merchant);
        }

        // Also pause the business so no new orders come in while suspended/closed
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

        auditService.success(
            "MERCHANT_STATUS_CHANGE",
            "merchant",
            businessId,
            Map.of("newStatus", newStatus.name(),
                   "reason", request.reason() != null ? request.reason() : "")
        );

        String statusStr = newStatus.name().toLowerCase();
        if (newStatus == Merchant.MerchantStatus.PENDING_VERIFICATION) statusStr = "pending";

        List<Order> completedOrders = orderRepository.findByBusinessIdOrderByCreatedAtDesc(businessId).stream()
            .filter(o -> o.getStatus() == OrderStatus.Completed)
            .toList();
        return AdminMerchantDtos.MerchantDetails.from(business, completedOrders.size(),
            completedOrders.stream().mapToLong(Order::getTotal).sum(), statusStr);
    }

    @Transactional
    public void deleteMerchant(String merchantId) {
        Business business = businessRepository.findById(merchantId)
            .orElseThrow(() -> new ApiException(404, "Merchant not found: " + merchantId));
        businessRepository.delete(business);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

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
