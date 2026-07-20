package com.scanny.dto.admin;

import java.util.List;

public class AdminPlatformDtos {

    public record CatalogItemRow(
        String id,
        String name,
        String merchant,
        String merchantId,
        String category,
        int price,
        String currency,
        boolean available,
        int orders
    ) {}

    public record CatalogSummary(
        long total,
        long available,
        long hidden,
        long categories
    ) {}

    public record CatalogListResponse(
        List<CatalogItemRow> items,
        CatalogSummary summary
    ) {}

    public record UserRow(
        String id,
        String name,
        String email,
        String role,
        int orders,
        String status,
        String joinedAt
    ) {}

    public record UsersSummary(
        long total,
        long customers,
        long merchants,
        long admins
    ) {}

    public record UsersListResponse(
        List<UserRow> users,
        UsersSummary summary
    ) {}

    public record QrCodeActivity(
        String merchant,
        String merchantId,
        String token,
        int scans,
        int orders,
        String conversion
    ) {}

    public record QrActivitySummary(
        long totalScansToday,
        long uniqueDevices,
        double conversionRate,
        long activeQrCodes
    ) {}

    public record HourlyScanPoint(
        int hour,
        int scans
    ) {}

    public record QrActivityResponse(
        QrActivitySummary summary,
        List<HourlyScanPoint> hourly,
        List<QrCodeActivity> topCodes
    ) {}

    public record AuditEvent(
        String id,
        String actor,
        String action,
        String target,
        String ip,
        String timestamp
    ) {}

    public record AuditSummary(
        long eventsToday,
        long adminActions,
        long systemEvents
    ) {}

    public record AuditListResponse(
        List<AuditEvent> events,
        AuditSummary summary
    ) {}

    public record RevenueTransaction(
        String id,
        String merchant,
        int amount,
        String currency,
        String method,
        String status,
        String date
    ) {}

    public record RevenueTransactionsResponse(
        List<RevenueTransaction> transactions
    ) {}

    public record ReportsOverview(
        long ordersThisMonth,
        long revenueThisMonth,
        long newMerchantsThisMonth,
        String currency
    ) {}

    public record NotificationItem(
        String id,
        String icon,
        String title,
        String sub,
        String timestamp,
        String type,
        boolean unread
    ) {}

    public record NotificationsResponse(
        List<NotificationItem> notifications,
        int unread
    ) {}
}
