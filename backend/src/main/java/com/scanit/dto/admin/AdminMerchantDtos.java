package com.scanit.dto.admin;

import com.scanit.entity.Business;
import java.time.Instant;
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
        public static MerchantListItem from(Business business, int orders, long revenue) {
            return new MerchantListItem(
                business.getId(),
                business.getName(),
                business.getOwnerName(),
                business.getType().name(),
                "Basic", // Default plan
                orders,
                revenue,
                "UGX",
                "active", // Default status
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
        public static MerchantDetails from(Business business, int totalOrders, long totalRevenue) {
            long avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
            return new MerchantDetails(
                business.getId(),
                business.getName(),
                new MerchantOwner(business.getOwnerName(), "", business.getPhone()),
                business.getType().name(),
                "Basic",
                "active",
                business.getQrToken(),
                new MerchantStatistics(totalOrders, totalRevenue, avgOrderValue, "UGX"),
                business.getCreatedAt().toString(),
                Instant.now().toString() // For now, use current time
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
}
