package com.scanny.service;

import com.scanny.dto.admin.AdminAnalyticsDtos;
import com.scanny.entity.*;
import com.scanny.model.enums.OrderStatus;
import com.scanny.model.enums.PaymentStatus;
import com.scanny.model.enums.TicketStatus;
import com.scanny.model.enums.TransactionStatus;
import com.scanny.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AdminAnalyticsService {
    private static final Logger logger = LoggerFactory.getLogger(AdminAnalyticsService.class);

    private final TicketRepository ticketRepository;
    private final TicketScanRepository ticketScanRepository;
    private final QuickPaymentCodeRepository quickPaymentCodeRepository;
    private final QuickPaymentTransactionRepository quickPaymentTransactionRepository;
    private final RegisteredDeviceRepository registeredDeviceRepository;
    private final DeviceTransactionRepository deviceTransactionRepository;
    private final OrderRepository orderRepository;
    private final QrScanEventRepository qrScanEventRepository;
    private final BusinessRepository businessRepository;

    public AdminAnalyticsService(
        TicketRepository ticketRepository,
        TicketScanRepository ticketScanRepository,
        QuickPaymentCodeRepository quickPaymentCodeRepository,
        QuickPaymentTransactionRepository quickPaymentTransactionRepository,
        RegisteredDeviceRepository registeredDeviceRepository,
        DeviceTransactionRepository deviceTransactionRepository,
        OrderRepository orderRepository,
        QrScanEventRepository qrScanEventRepository,
        BusinessRepository businessRepository
    ) {
        this.ticketRepository = ticketRepository;
        this.ticketScanRepository = ticketScanRepository;
        this.quickPaymentCodeRepository = quickPaymentCodeRepository;
        this.quickPaymentTransactionRepository = quickPaymentTransactionRepository;
        this.registeredDeviceRepository = registeredDeviceRepository;
        this.deviceTransactionRepository = deviceTransactionRepository;
        this.orderRepository = orderRepository;
        this.qrScanEventRepository = qrScanEventRepository;
        this.businessRepository = businessRepository;
    }

    @Transactional(readOnly = true)
    public AdminAnalyticsDtos.TicketAnalytics getTicketAnalytics() {
        List<Ticket> allTickets = ticketRepository.findAll();

        // Summary
        int total = allTickets.size();
        int active = (int) allTickets.stream()
            .filter(t -> t.getStatus() == TicketStatus.Active)
            .count();
        int redeemed = (int) allTickets.stream()
            .filter(t -> t.getStatus() == TicketStatus.Redeemed)
            .count();
        int expired = (int) allTickets.stream()
            .filter(t -> t.getStatus() == TicketStatus.Expired)
            .count();

        AdminAnalyticsDtos.TicketSummary summary = new AdminAnalyticsDtos.TicketSummary(
            total, active, redeemed, expired
        );

        // By type
        Map<String, List<Ticket>> byType = allTickets.stream()
            .collect(Collectors.groupingBy(Ticket::getTicketType));

        List<AdminAnalyticsDtos.TicketTypeStats> typeStats = byType.entrySet().stream()
            .map(entry -> new AdminAnalyticsDtos.TicketTypeStats(
                entry.getKey(),
                entry.getValue().size(),
                entry.getValue().stream().mapToLong(Ticket::getPrice).sum()
            ))
            .toList();

        // Scan activity (last 7 days)
        List<AdminAnalyticsDtos.ScanActivityDay> scanActivity = new ArrayList<>();
        // Simplified - in production, group by actual dates
        
        return new AdminAnalyticsDtos.TicketAnalytics(summary, typeStats, scanActivity);
    }

    @Transactional(readOnly = true)
    public AdminAnalyticsDtos.QuickPaymentAnalytics getQuickPaymentAnalytics() {
        List<QuickPaymentCode> allCodes = quickPaymentCodeRepository.findAll();
        List<QuickPaymentTransaction> allTransactions = quickPaymentTransactionRepository.findAll();

        // Summary
        int totalCodes = allCodes.size();
        int activeCodes = (int) allCodes.stream()
            .filter(c -> c.getStatus().name().equals("Active"))
            .count();
        int totalTransactions = allTransactions.size();
        long totalRevenue = allTransactions.stream()
            .filter(t -> t.getStatus() == TransactionStatus.Completed)
            .mapToLong(QuickPaymentTransaction::getAmount)
            .sum();

        AdminAnalyticsDtos.QuickPaymentSummary summary = new AdminAnalyticsDtos.QuickPaymentSummary(
            totalCodes, activeCodes, totalTransactions, totalRevenue
        );

        // Top codes
        Map<String, List<QuickPaymentTransaction>> transactionsByCode = allTransactions.stream()
            .filter(t -> t.getStatus() == TransactionStatus.Completed)
            .collect(Collectors.groupingBy(t -> t.getCode().getId()));

        List<AdminAnalyticsDtos.TopQuickPaymentCode> topCodes = transactionsByCode.entrySet().stream()
            .map(entry -> {
                String codeId = entry.getKey();
                List<QuickPaymentTransaction> transactions = entry.getValue();
                QuickPaymentCode code = quickPaymentCodeRepository.findById(codeId).orElse(null);
                if (code == null) return null;
                
                return new AdminAnalyticsDtos.TopQuickPaymentCode(
                    codeId,
                    code.getDescription(),
                    transactions.size(),
                    transactions.stream().mapToLong(QuickPaymentTransaction::getAmount).sum()
                );
            })
            .filter(x -> x != null)
            .sorted(Comparator.comparingInt(AdminAnalyticsDtos.TopQuickPaymentCode::transactions).reversed())
            .limit(10)
            .toList();

        // By category - simplified
        List<AdminAnalyticsDtos.QuickPaymentCategory> byCategory = List.of();

        return new AdminAnalyticsDtos.QuickPaymentAnalytics(summary, topCodes, byCategory);
    }

    @Transactional(readOnly = true)
    public AdminAnalyticsDtos.DeviceAnalytics getDeviceAnalytics() {
        List<RegisteredDevice> allDevices = registeredDeviceRepository.findAll();
        List<DeviceTransaction> allTransactions = deviceTransactionRepository.findAll();

        // Summary
        int totalDevices = allDevices.size();
        int activeDevices = (int) allDevices.stream()
            .filter(d -> d.getStatus().name().equals("Active"))
            .count();
        int autoPaymentEnabled = (int) allDevices.stream()
            .filter(RegisteredDevice::isAutoPaymentEnabled)
            .count();
        double avgTransactionsPerDevice = totalDevices > 0 
            ? (double) allTransactions.size() / totalDevices 
            : 0.0;

        AdminAnalyticsDtos.DeviceSummary summary = new AdminAnalyticsDtos.DeviceSummary(
            totalDevices, activeDevices, autoPaymentEnabled, avgTransactionsPerDevice
        );

        // Adoption - last 7 days
        List<AdminAnalyticsDtos.DeviceAdoptionDay> adoption = new ArrayList<>();

        // Top devices
        Map<String, List<DeviceTransaction>> transactionsByDevice = allTransactions.stream()
            .filter(t -> t.getStatus() == TransactionStatus.Completed)
            .collect(Collectors.groupingBy(t -> t.getDevice().getId()));

        List<AdminAnalyticsDtos.TopDevice> topDevices = transactionsByDevice.entrySet().stream()
            .map(entry -> {
                String deviceId = entry.getKey();
                List<DeviceTransaction> transactions = entry.getValue();
                RegisteredDevice device = registeredDeviceRepository.findById(deviceId).orElse(null);
                if (device == null) return null;

                return new AdminAnalyticsDtos.TopDevice(
                    deviceId,
                    device.getCustomerName(),
                    transactions.size(),
                    transactions.stream().mapToLong(DeviceTransaction::getAmount).sum()
                );
            })
            .filter(x -> x != null)
            .sorted(Comparator.comparingInt(AdminAnalyticsDtos.TopDevice::transactions).reversed())
            .limit(10)
            .toList();

        return new AdminAnalyticsDtos.DeviceAnalytics(summary, adoption, topDevices);
    }

    @Transactional(readOnly = true)
    public AdminAnalyticsDtos.RevenueOverview getRevenueOverview() {
        List<QuickPaymentTransaction> qpTransactions = quickPaymentTransactionRepository.findAll();
        List<DeviceTransaction> deviceTransactions = deviceTransactionRepository.findAll();
        List<Order> orders = orderRepository.findAll();

        Instant now = Instant.now();
        Instant periodStart = now.truncatedTo(ChronoUnit.DAYS).minus(30, ChronoUnit.DAYS);
        Instant prevStart = periodStart.minus(30, ChronoUnit.DAYS);

        PeriodTotals current = totalsInRange(qpTransactions, deviceTransactions, orders, periodStart, now);
        PeriodTotals previous = totalsInRange(qpTransactions, deviceTransactions, orders, prevStart, periodStart);

        AdminAnalyticsDtos.RevenueGrowth growth = new AdminAnalyticsDtos.RevenueGrowth(
            percentChange(current.revenue, previous.revenue),
            percentChange(current.transactions, previous.transactions),
            percentChange(current.failed, previous.failed),
            percentChange(current.avgOrderValue(), previous.avgOrderValue())
        );

        AdminAnalyticsDtos.CurrentMonthRevenue currentMonth = new AdminAnalyticsDtos.CurrentMonthRevenue(
            current.revenue,
            current.transactions,
            current.failed,
            current.avgOrderValue(),
            "UGX",
            growth,
            current.merchantGmv,
            current.platformFees,
            current.psoFees
        );

        List<AdminAnalyticsDtos.MonthlyRevenue> monthly = buildMonthlyRevenue(
            qpTransactions, deviceTransactions, orders, now
        );

        List<AdminAnalyticsDtos.PaymentMethodBreakdown> paymentMethods = buildPaymentMethods(
            qpTransactions, deviceTransactions, orders, periodStart, now
        );

        return new AdminAnalyticsDtos.RevenueOverview(currentMonth, monthly, paymentMethods);
    }

    private record PeriodTotals(
            long revenue,
            int transactions,
            int failed,
            long merchantGmv,
            long platformFees,
            long psoFees
    ) {
        long avgOrderValue() {
            return transactions > 0 ? revenue / transactions : 0;
        }
    }

    private PeriodTotals totalsInRange(
        List<QuickPaymentTransaction> qpTransactions,
        List<DeviceTransaction> deviceTransactions,
        List<Order> orders,
        Instant start,
        Instant end
    ) {
        long qpRevenue = qpTransactions.stream()
            .filter(t -> inRange(t.getCreatedAt(), start, end))
            .filter(t -> t.getStatus() == TransactionStatus.Completed)
            .mapToLong(QuickPaymentTransaction::getAmount)
            .sum();
        int qpCount = (int) qpTransactions.stream()
            .filter(t -> inRange(t.getCreatedAt(), start, end))
            .filter(t -> t.getStatus() == TransactionStatus.Completed)
            .count();
        int qpFailed = (int) qpTransactions.stream()
            .filter(t -> inRange(t.getCreatedAt(), start, end))
            .filter(t -> t.getStatus() == TransactionStatus.Failed)
            .count();

        long deviceRevenue = deviceTransactions.stream()
            .filter(t -> inRange(t.getCreatedAt(), start, end))
            .filter(t -> t.getStatus() == TransactionStatus.Completed)
            .mapToLong(DeviceTransaction::getAmount)
            .sum();
        int deviceCount = (int) deviceTransactions.stream()
            .filter(t -> inRange(t.getCreatedAt(), start, end))
            .filter(t -> t.getStatus() == TransactionStatus.Completed)
            .count();
        int deviceFailed = (int) deviceTransactions.stream()
            .filter(t -> inRange(t.getCreatedAt(), start, end))
            .filter(t -> t.getStatus() == TransactionStatus.Failed)
            .count();

        List<Order> paidOrders = orders.stream()
            .filter(o -> inRange(o.getCreatedAt(), start, end))
            .filter(this::isPaidOrder)
            .toList();

        long orderRevenue = paidOrders.stream().mapToLong(Order::getTotal).sum();
        long merchantGmv = paidOrders.stream()
            .mapToLong(o -> o.getMerchantPayout() > 0 ? o.getMerchantPayout() : Math.max(o.getTotal() - o.getServiceFee(), 0))
            .sum();
        long platformFees = paidOrders.stream().mapToLong(Order::getPlatformFee).sum();
        long psoFees = paidOrders.stream().mapToLong(Order::getPsoFee).sum();
        int orderCount = paidOrders.size();
        int orderFailed = (int) orders.stream()
            .filter(o -> inRange(o.getCreatedAt(), start, end))
            .filter(o -> o.getPaymentStatus() == PaymentStatus.Unpaid
                && o.getStatus() == OrderStatus.Cancelled)
            .count();

        return new PeriodTotals(
            qpRevenue + deviceRevenue + orderRevenue,
            qpCount + deviceCount + orderCount,
            qpFailed + deviceFailed + orderFailed,
            merchantGmv + qpRevenue + deviceRevenue,
            platformFees,
            psoFees
        );
    }

    private boolean isPaidOrder(Order order) {
        return order.getPaymentStatus() == PaymentStatus.Paid
            || order.getStatus() == OrderStatus.Completed;
    }

    private static boolean inRange(Instant ts, Instant start, Instant end) {
        return ts != null && !ts.isBefore(start) && ts.isBefore(end);
    }

    private static double percentChange(long current, long previous) {
        if (previous == 0) {
            return current == 0 ? 0.0 : 100.0;
        }
        return ((double) (current - previous) / previous) * 100.0;
    }

    private List<AdminAnalyticsDtos.MonthlyRevenue> buildMonthlyRevenue(
        List<QuickPaymentTransaction> qpTransactions,
        List<DeviceTransaction> deviceTransactions,
        List<Order> orders,
        Instant now
    ) {
        YearMonth current = YearMonth.from(LocalDate.ofInstant(now, ZoneOffset.UTC));
        DateTimeFormatter monthFmt = DateTimeFormatter.ofPattern("MMM", Locale.ENGLISH);
        List<AdminAnalyticsDtos.MonthlyRevenue> monthly = new ArrayList<>(6);

        for (int i = 5; i >= 0; i--) {
            YearMonth month = current.minusMonths(i);
            Instant start = month.atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC);
            Instant end = month.plusMonths(1).atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC);
            PeriodTotals totals = totalsInRange(qpTransactions, deviceTransactions, orders, start, end);
            monthly.add(new AdminAnalyticsDtos.MonthlyRevenue(
                monthFmt.format(month.atDay(1)),
                totals.revenue,
                totals.transactions
            ));
        }
        return monthly;
    }

    private List<AdminAnalyticsDtos.PaymentMethodBreakdown> buildPaymentMethods(
        List<QuickPaymentTransaction> qpTransactions,
        List<DeviceTransaction> deviceTransactions,
        List<Order> orders,
        Instant start,
        Instant end
    ) {
        Map<String, Long> byMethod = new java.util.LinkedHashMap<>();

        for (QuickPaymentTransaction t : qpTransactions) {
            if (!inRange(t.getCreatedAt(), start, end) || t.getStatus() != TransactionStatus.Completed) {
                continue;
            }
            String method = t.getPaymentMethod() != null && !t.getPaymentMethod().isBlank()
                ? t.getPaymentMethod()
                : (t.getPaymentProvider() != null ? t.getPaymentProvider() : "Quick Pay");
            byMethod.merge(method, (long) t.getAmount(), Long::sum);
        }

        long deviceAmount = deviceTransactions.stream()
            .filter(t -> inRange(t.getCreatedAt(), start, end))
            .filter(t -> t.getStatus() == TransactionStatus.Completed)
            .mapToLong(DeviceTransaction::getAmount)
            .sum();
        if (deviceAmount > 0) {
            byMethod.merge("Device Pay", deviceAmount, Long::sum);
        }

        long orderAmount = orders.stream()
            .filter(o -> inRange(o.getCreatedAt(), start, end))
            .filter(this::isPaidOrder)
            .mapToLong(Order::getTotal)
            .sum();
        if (orderAmount > 0) {
            byMethod.merge("Orders", orderAmount, Long::sum);
        }

        long total = byMethod.values().stream().mapToLong(Long::longValue).sum();
        if (total <= 0) {
            return List.of();
        }

        return byMethod.entrySet().stream()
            .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
            .map(e -> new AdminAnalyticsDtos.PaymentMethodBreakdown(
                e.getKey(),
                Math.round((e.getValue() * 1000.0) / total) / 10.0,
                e.getValue()
            ))
            .toList();
    }

    @Transactional(readOnly = true)
    public AdminAnalyticsDtos.ScansOrdersSeries getScansOrders(String range) {
        String normalized = range == null ? "daily" : range.toLowerCase(Locale.ROOT);
        Instant now = Instant.now();
        Instant lookback = switch (normalized) {
            case "hourly" -> now.minus(24, ChronoUnit.HOURS);
            // Instant does not support ChronoUnit.WEEKS — use days (16 week buckets).
            case "weekly" -> now.minus(16 * 7L, ChronoUnit.DAYS);
            case "monthly" -> now.minus(12 * 30L, ChronoUnit.DAYS);
            case "yearly" -> now.minus(5 * 365L, ChronoUnit.DAYS);
            default -> now.minus(30, ChronoUnit.DAYS);
        };

        List<Instant> scanAts = new ArrayList<>();
        scanAts.addAll(ticketScanRepository.findScannedAtsAfter(lookback));
        scanAts.addAll(qrScanEventRepository.findScannedAtsAfter(lookback));
        List<Instant> orderAts = orderRepository.findCreatedAtsAfter(lookback);

        return switch (normalized) {
            case "hourly" -> buildHourlySeries(scanAts, orderAts, now);
            case "weekly" -> buildWeeklySeries(scanAts, orderAts, now);
            case "monthly" -> buildMonthlySeries(scanAts, orderAts, now);
            case "yearly" -> buildYearlySeries(scanAts, orderAts, now);
            default -> buildDailySeries(scanAts, orderAts, now);
        };
    }

    @Transactional(readOnly = true)
    public AdminAnalyticsDtos.TrafficAnalytics getTrafficAnalytics(String range) {
        String normalized = normalizeTrafficRange(range);
        try {
            Instant now = Instant.now();
            Instant start = switch (normalized) {
                case "daily" -> now.minus(1, ChronoUnit.DAYS);
                case "weekly" -> now.minus(7, ChronoUnit.DAYS);
                case "monthly" -> now.minus(30, ChronoUnit.DAYS);
                case "yearly" -> now.minus(365, ChronoUnit.DAYS);
                default -> now.minus(30, ChronoUnit.DAYS);
            };

            List<Order> orders = orderRepository.findByCreatedAtAfterOrderByCreatedAtDesc(start);
            List<QrScanEvent> scans = qrScanEventRepository.findByScannedAtAfterOrderByScannedAtDesc(start);
            Map<String, Business> businessesById = new HashMap<>();
            for (Business business : businessRepository.findAll()) {
                if (business == null || business.getId() == null || business.getId().isBlank()) {
                    continue;
                }
                businessesById.putIfAbsent(business.getId(), business);
            }

            Map<String, Long> merchantRevenue = new HashMap<>();
            Map<String, Integer> merchantOrders = new HashMap<>();
            Map<String, Integer> merchantScans = new HashMap<>();
            Map<String, String> merchantNames = new HashMap<>();
            Set<String> activeMerchants = new HashSet<>();

            List<List<Integer>> heat = new ArrayList<>(7);
            for (int day = 0; day < 7; day++) {
                List<Integer> hours = new ArrayList<>(24);
                for (int hour = 0; hour < 24; hour++) {
                    hours.add(0);
                }
                heat.add(hours);
            }

            int totalOrders = 0;
            long totalRevenue = 0L;

            for (Order order : orders) {
                if (order == null) {
                    continue;
                }
                Instant at = order.getCreatedAt();
                if (!inRange(at, start, now)) {
                    continue;
                }

                bumpHeat(heat, at);
                if (order.getStatus() != OrderStatus.Cancelled) {
                    totalOrders++;
                    String merchantId = order.getMerchantId();
                    if (merchantId != null && !merchantId.isBlank()) {
                        merchantOrders.merge(merchantId, 1, Integer::sum);
                        activeMerchants.add(merchantId);
                        if (order.getBusinessName() != null && !order.getBusinessName().isBlank()) {
                            merchantNames.putIfAbsent(merchantId, order.getBusinessName());
                        }
                    }
                }

                if (isPaidOrder(order)) {
                    totalRevenue += order.getTotal();
                    String merchantId = order.getMerchantId();
                    if (merchantId != null && !merchantId.isBlank()) {
                        merchantRevenue.merge(merchantId, (long) order.getTotal(), Long::sum);
                        activeMerchants.add(merchantId);
                        if (order.getBusinessName() != null && !order.getBusinessName().isBlank()) {
                            merchantNames.putIfAbsent(merchantId, order.getBusinessName());
                        }
                    }
                }
            }

            int totalScans = 0;
            for (QrScanEvent scan : scans) {
                if (scan == null) {
                    continue;
                }
                Instant at = scan.getScannedAt();
                if (!inRange(at, start, now)) {
                    continue;
                }
                totalScans++;
                bumpHeat(heat, at);

                String businessId = scan.getBusinessId();
                if (businessId == null || businessId.isBlank()) {
                    continue;
                }
                Business business = businessesById.get(businessId);
                if (business == null) {
                    continue;
                }
                String merchantId = business.getMerchantId();
                if (merchantId == null || merchantId.isBlank()) {
                    continue;
                }
                merchantScans.merge(merchantId, 1, Integer::sum);
                activeMerchants.add(merchantId);
                if (business.getName() != null && !business.getName().isBlank()) {
                    merchantNames.putIfAbsent(merchantId, business.getName());
                }
            }

            int heatMax = 1;
            for (List<Integer> row : heat) {
                for (Integer value : row) {
                    if (value > heatMax) {
                        heatMax = value;
                    }
                }
            }

            Set<String> merchantIds = new HashSet<>();
            merchantIds.addAll(merchantOrders.keySet());
            merchantIds.addAll(merchantScans.keySet());
            merchantIds.addAll(merchantRevenue.keySet());

            List<AdminAnalyticsDtos.MerchantTrafficStat> merchantStats = merchantIds.stream()
                .map(merchantId -> new AdminAnalyticsDtos.MerchantTrafficStat(
                    merchantId,
                    merchantNames.getOrDefault(merchantId, merchantId),
                    merchantScans.getOrDefault(merchantId, 0),
                    merchantOrders.getOrDefault(merchantId, 0),
                    merchantRevenue.getOrDefault(merchantId, 0L)
                ))
                .toList();

            List<AdminAnalyticsDtos.MerchantTrafficStat> topRevenue = merchantStats.stream()
                .sorted(Comparator.comparingLong(AdminAnalyticsDtos.MerchantTrafficStat::revenue).reversed())
                .limit(10)
                .toList();
            List<AdminAnalyticsDtos.MerchantTrafficStat> topScans = merchantStats.stream()
                .sorted(Comparator.comparingInt(AdminAnalyticsDtos.MerchantTrafficStat::scans).reversed())
                .limit(10)
                .toList();
            List<AdminAnalyticsDtos.MerchantTrafficStat> topOrders = merchantStats.stream()
                .sorted(Comparator.comparingInt(AdminAnalyticsDtos.MerchantTrafficStat::orders).reversed())
                .limit(10)
                .toList();

            List<String> dayLabels = List.of("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun");
            List<Integer> hourLabels = new ArrayList<>(24);
            for (int hour = 0; hour < 24; hour++) {
                hourLabels.add(hour);
            }

            return new AdminAnalyticsDtos.TrafficAnalytics(
                normalized,
                new AdminAnalyticsDtos.TrafficSummary(totalScans, totalOrders, totalRevenue, activeMerchants.size()),
                new AdminAnalyticsDtos.TrafficHeatmap(dayLabels, hourLabels, heat, heatMax),
                topRevenue,
                topScans,
                topOrders
            );
        } catch (Exception ex) {
            logger.warn("Traffic analytics fallback due to error", ex);
            return emptyTrafficAnalytics(normalized);
        }
    }

    private static String normalizeTrafficRange(String range) {
        if (range == null) {
            return "daily";
        }
        String normalized = range.toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "daily", "weekly", "monthly", "yearly" -> normalized;
            default -> "daily";
        };
    }

    private static void bumpHeat(List<List<Integer>> heat, Instant instant) {
        var zoned = instant.atZone(ZoneOffset.UTC);
        int dayIndex = zoned.getDayOfWeek().getValue() - 1; // Monday = 0
        int hour = zoned.getHour();
        int current = heat.get(dayIndex).get(hour);
        heat.get(dayIndex).set(hour, current + 1);
    }

    private static AdminAnalyticsDtos.TrafficAnalytics emptyTrafficAnalytics(String range) {
        List<List<Integer>> heat = new ArrayList<>(7);
        for (int day = 0; day < 7; day++) {
            List<Integer> row = new ArrayList<>(24);
            for (int hour = 0; hour < 24; hour++) {
                row.add(0);
            }
            heat.add(row);
        }
        List<Integer> hourLabels = new ArrayList<>(24);
        for (int hour = 0; hour < 24; hour++) {
            hourLabels.add(hour);
        }
        return new AdminAnalyticsDtos.TrafficAnalytics(
            range,
            new AdminAnalyticsDtos.TrafficSummary(0, 0, 0L, 0),
            new AdminAnalyticsDtos.TrafficHeatmap(
                List.of("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"),
                hourLabels,
                heat,
                1
            ),
            List.of(),
            List.of(),
            List.of()
        );
    }

    private AdminAnalyticsDtos.ScansOrdersSeries buildHourlySeries(
        List<Instant> scans, List<Instant> orders, Instant now
    ) {
        List<Integer> scanBuckets = new ArrayList<>(24);
        List<Integer> orderBuckets = new ArrayList<>(24);
        List<String> labels = new ArrayList<>(24);
        Instant start = now.truncatedTo(ChronoUnit.HOURS).minus(23, ChronoUnit.HOURS);

        for (int i = 0; i < 24; i++) {
            Instant bucketStart = start.plus(i, ChronoUnit.HOURS);
            Instant bucketEnd = bucketStart.plus(1, ChronoUnit.HOURS);
            scanBuckets.add(countInRange(scans, bucketStart, bucketEnd));
            orderBuckets.add(countInRange(orders, bucketStart, bucketEnd));
            int hour = bucketStart.atZone(ZoneOffset.UTC).getHour();
            labels.add(String.format("%d%s", hour % 12 == 0 ? 12 : hour % 12, hour < 12 ? "a" : "p"));
        }
        return series("hourly", scanBuckets, orderBuckets, labels);
    }

    private AdminAnalyticsDtos.ScansOrdersSeries buildDailySeries(
        List<Instant> scans, List<Instant> orders, Instant now
    ) {
        List<Integer> scanBuckets = new ArrayList<>(28);
        List<Integer> orderBuckets = new ArrayList<>(28);
        List<String> labels = new ArrayList<>(28);
        LocalDate today = LocalDate.ofInstant(now, ZoneOffset.UTC);
        DateTimeFormatter dayFmt = DateTimeFormatter.ofPattern("EEE", Locale.ENGLISH);

        for (int i = 27; i >= 0; i--) {
            LocalDate day = today.minusDays(i);
            Instant bucketStart = day.atStartOfDay().toInstant(ZoneOffset.UTC);
            Instant bucketEnd = day.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);
            scanBuckets.add(countInRange(scans, bucketStart, bucketEnd));
            orderBuckets.add(countInRange(orders, bucketStart, bucketEnd));
            labels.add(dayFmt.format(day));
        }
        return series("daily", scanBuckets, orderBuckets, labels);
    }

    private AdminAnalyticsDtos.ScansOrdersSeries buildWeeklySeries(
        List<Instant> scans, List<Instant> orders, Instant now
    ) {
        List<Integer> scanBuckets = new ArrayList<>(16);
        List<Integer> orderBuckets = new ArrayList<>(16);
        List<String> labels = new ArrayList<>(16);
        LocalDate today = LocalDate.ofInstant(now, ZoneOffset.UTC);
        LocalDate weekStart = today.minusDays(today.getDayOfWeek().getValue() - 1L);

        for (int i = 15; i >= 0; i--) {
            LocalDate start = weekStart.minusWeeks(i);
            Instant bucketStart = start.atStartOfDay().toInstant(ZoneOffset.UTC);
            Instant bucketEnd = start.plusWeeks(1).atStartOfDay().toInstant(ZoneOffset.UTC);
            scanBuckets.add(countInRange(scans, bucketStart, bucketEnd));
            orderBuckets.add(countInRange(orders, bucketStart, bucketEnd));
            labels.add("W" + (16 - i));
        }
        return series("weekly", scanBuckets, orderBuckets, labels);
    }

    private AdminAnalyticsDtos.ScansOrdersSeries buildMonthlySeries(
        List<Instant> scans, List<Instant> orders, Instant now
    ) {
        List<Integer> scanBuckets = new ArrayList<>(12);
        List<Integer> orderBuckets = new ArrayList<>(12);
        List<String> labels = new ArrayList<>(12);
        YearMonth current = YearMonth.from(LocalDate.ofInstant(now, ZoneOffset.UTC));
        DateTimeFormatter monthFmt = DateTimeFormatter.ofPattern("MMM", Locale.ENGLISH);

        for (int i = 11; i >= 0; i--) {
            YearMonth month = current.minusMonths(i);
            Instant bucketStart = month.atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC);
            Instant bucketEnd = month.plusMonths(1).atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC);
            scanBuckets.add(countInRange(scans, bucketStart, bucketEnd));
            orderBuckets.add(countInRange(orders, bucketStart, bucketEnd));
            labels.add(monthFmt.format(month.atDay(1)));
        }
        return series("monthly", scanBuckets, orderBuckets, labels);
    }

    private AdminAnalyticsDtos.ScansOrdersSeries buildYearlySeries(
        List<Instant> scans, List<Instant> orders, Instant now
    ) {
        List<Integer> scanBuckets = new ArrayList<>(5);
        List<Integer> orderBuckets = new ArrayList<>(5);
        List<String> labels = new ArrayList<>(5);
        int currentYear = LocalDate.ofInstant(now, ZoneOffset.UTC).getYear();

        for (int i = 4; i >= 0; i--) {
            int year = currentYear - i;
            Instant bucketStart = LocalDate.of(year, 1, 1).atStartOfDay().toInstant(ZoneOffset.UTC);
            Instant bucketEnd = LocalDate.of(year + 1, 1, 1).atStartOfDay().toInstant(ZoneOffset.UTC);
            scanBuckets.add(countInRange(scans, bucketStart, bucketEnd));
            orderBuckets.add(countInRange(orders, bucketStart, bucketEnd));
            labels.add(String.valueOf(year));
        }
        return series("yearly", scanBuckets, orderBuckets, labels);
    }

    private static int countInRange(List<Instant> timestamps, Instant start, Instant end) {
        int count = 0;
        for (Instant at : timestamps) {
            if (!at.isBefore(start) && at.isBefore(end)) count++;
        }
        return count;
    }

    private static AdminAnalyticsDtos.ScansOrdersSeries series(
        String range, List<Integer> scans, List<Integer> orders, List<String> labels
    ) {
        int maxScan = scans.stream().mapToInt(Integer::intValue).max().orElse(0);
        int maxOrder = orders.stream().mapToInt(Integer::intValue).max().orElse(0);
        int yMax = Math.max(10, (int) Math.ceil(Math.max(maxScan, maxOrder) * 1.15));
        if (yMax < 1) yMax = 1;
        return new AdminAnalyticsDtos.ScansOrdersSeries(range, scans, orders, yMax, labels);
    }
}
