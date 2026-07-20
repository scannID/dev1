package com.scanny.dto.admin;

import java.util.List;

public class AdminDashboardDtos {

    public record MetricChange(String value) {}

    public record MerchantMetrics(
        int total,
        String change,
        int thisWeek
    ) {}

    public record OrdersMetrics(
        int total,
        String change
    ) {}

    public record QrScansMetrics(
        int last24Hours,
        String change
    ) {}

    public record RevenueMetrics(
        long thisMonth,
        String currency,
        String change
    ) {}

    public record SparklineMetrics(
        List<Integer> merchants,
        List<Integer> ordersToday,
        List<Integer> qrScans,
        List<Long> revenue
    ) {}

    public record DashboardMetrics(
        MerchantMetrics merchants,
        OrdersMetrics ordersToday,
        QrScansMetrics qrScans,
        RevenueMetrics revenue,
        SparklineMetrics sparklines
    ) {}

    public record ActivityEvent(
        String id,
        String type,
        String title,
        String description,
        String timestamp,
        String icon
    ) {}

    public record TopMerchant(
        String id,
        String name,
        String type,
        int orders,
        long revenue,
        String currency,
        String status
    ) {}
}
