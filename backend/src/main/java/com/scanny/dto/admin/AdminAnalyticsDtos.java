package com.scanny.dto.admin;

import java.util.List;

public class AdminAnalyticsDtos {

    // Ticketing Analytics
    public record TicketTypeStats(
        String type,
        int count,
        long revenue
    ) {}

    public record ScanActivityDay(
        String date,
        int scans,
        int successful,
        int failed
    ) {}

    public record TicketAnalytics(
        TicketSummary summary,
        List<TicketTypeStats> byType,
        List<ScanActivityDay> scanActivity
    ) {}

    public record TicketSummary(
        int totalTickets,
        int activeTickets,
        int redeemedTickets,
        int expiredTickets
    ) {}

    // Quick Payments Analytics
    public record TopQuickPaymentCode(
        String id,
        String description,
        int transactions,
        long revenue
    ) {}

    public record QuickPaymentCategory(
        String category,
        int codes,
        int transactions
    ) {}

    public record QuickPaymentAnalytics(
        QuickPaymentSummary summary,
        List<TopQuickPaymentCode> topCodes,
        List<QuickPaymentCategory> byCategory
    ) {}

    public record QuickPaymentSummary(
        int totalCodes,
        int activeCodes,
        int totalTransactions,
        long totalRevenue
    ) {}

    // Device Analytics
    public record TopDevice(
        String deviceId,
        String customerName,
        int transactions,
        long totalSpent
    ) {}

    public record DeviceAdoptionDay(
        String date,
        int newDevices,
        int autoPaymentEnabled
    ) {}

    public record DeviceAnalytics(
        DeviceSummary summary,
        List<DeviceAdoptionDay> adoption,
        List<TopDevice> topDevices
    ) {}

    public record DeviceSummary(
        int totalDevices,
        int activeDevices,
        int autoPaymentEnabled,
        double averageTransactionsPerDevice
    ) {}

    // Revenue Analytics
    public record MonthlyRevenue(
        String month,
        long revenue,
        int transactions
    ) {}

    public record PaymentMethodBreakdown(
        String method,
        double percentage,
        long amount
    ) {}

    public record RevenueGrowth(
        double revenue,
        double transactions,
        double failedPayments,
        double avgOrderValue
    ) {}

    public record CurrentMonthRevenue(
        long revenue,
        int transactions,
        int failedPayments,
        long avgOrderValue,
        String currency,
        RevenueGrowth growth,
        long merchantGmv,
        long platformFees,
        long psoFees
    ) {}

    public record RevenueOverview(
        CurrentMonthRevenue currentMonth,
        List<MonthlyRevenue> monthly,
        List<PaymentMethodBreakdown> paymentMethods
    ) {}

    public record ScansOrdersSeries(
        String range,
        List<Integer> scans,
        List<Integer> orders,
        int yMax,
        List<String> xLabels
    ) {}
}
