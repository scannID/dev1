package com.scanny.dto.admin;

import com.scanny.entity.Business;
import java.util.List;

public class AdminMerchantDtos {

    public record MerchantListItem(
        String id,
        String name,
        String owner,
        String type,
        String plan,
        int orders,
        long revenue,
        String currency,
        String status,
        String joinedAt
    ) {
        public static MerchantListItem from(Business business, int orders, long revenue, String status) {
            return new MerchantListItem(
                business.getId(),
                business.getName(),
                business.getOwnerName(),
                business.getType().name(),
                "Basic",
                orders,
                revenue,
                "UGX",
                status,
                business.getCreatedAt().toString()
            );
        }
    }

    public record PaginationInfo(
        int page,
        int limit,
        long total,
        int pages
    ) {}

    public record MerchantSummary(
        long total,
        long active,
        long pending,
        long suspended
    ) {}

    public record MerchantsListResponse(
        List<MerchantListItem> merchants,
        PaginationInfo pagination,
        MerchantSummary summary
    ) {}

    public record MerchantOwner(
        String name,
        String email,
        String phone
    ) {}

    public record MerchantStatistics(
        int totalOrders,
        long totalRevenue,
        long avgOrderValue,
        String currency
    ) {}

    public record MerchantDetails(
        String id,
        String name,
        MerchantOwner owner,
        String type,
        String plan,
        String status,
        String qrToken,
        MerchantStatistics statistics,
        String joinedAt,
        String lastActiveAt
    ) {
        public static MerchantDetails from(Business business, int totalOrders, long totalRevenue, String status) {
            long avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
            return new MerchantDetails(
                business.getId(),
                business.getName(),
                new MerchantOwner(business.getOwnerName(), "", business.getPhone()),
                business.getType().name(),
                "Basic",
                status,
                business.getQrToken(),
                new MerchantStatistics(totalOrders, totalRevenue, avgOrderValue, "UGX"),
                business.getCreatedAt().toString(),
                java.time.Instant.now().toString()
            );
        }
    }

    public record CreateMerchantRequest(
        String name,
        String ownerName,
        String ownerEmail,
        String ownerPhone,
        String type,
        String plan
    ) {}

    public record UpdateMerchantRequest(
        String name,
        String plan,
        String status
    ) {}

    public record UpdateMerchantStatusRequest(
        String status,
        String reason
    ) {}

    // ── Merchant Activity Feed ────────────────────────────────────────────────

    /**
     * One entry in the unified merchant activity timeline.
     * {@code kind} is one of: ORDER | PAYMENT | SCAN | LOGIN | COMMISSION | AUDIT
     */
    public record ActivityEntry(
        String id,
        String kind,
        String title,
        String detail,
        String status,
        long amountUgx,       // 0 when not applicable
        String occurredAt
    ) {}

    /** Aggregate stats shown at the top of the activity panel. */
    public record MerchantActivitySummary(
        long totalOrders,
        long paidOrders,
        long totalRevenue,        // UGX — sum of paid order totals
        long totalCommission,     // UGX — merchant's cut of service fees across paid orders
        long totalScans,
        long totalPayments,
        long failedPayments,
        String lastLoginAt,       // ISO string or null
        String currency
    ) {}

    /** Complete activity response: summary stats + paged timeline entries. */
    public record MerchantActivityResponse(
        MerchantActivitySummary summary,
        List<ActivityEntry> events,
        PaginationInfo pagination
    ) {}

    // ── Per-section list responses ────────────────────────────────────────────

    public record OrderRow(
        String id,
        String customerName,
        String status,
        String paymentStatus,
        long total,
        long merchantPayout,
        long serviceFee,
        long platformFee,
        String createdAt
    ) {}

    public record PaymentRow(
        String id,
        String orderId,
        String provider,
        String status,
        long amount,
        long merchantPayout,
        long platformFee,
        String customerPhone,
        String createdAt
    ) {}

    public record ScanRow(
        String businessId,
        String occurredAt
    ) {}

    public record MerchantOrdersResponse(
        List<OrderRow> orders,
        PaginationInfo pagination
    ) {}

    public record MerchantPaymentsResponse(
        List<PaymentRow> payments,
        PaginationInfo pagination
    ) {}

    public record MerchantScansResponse(
        List<ScanRow> scans,
        long totalScans,
        PaginationInfo pagination
    ) {}
}
