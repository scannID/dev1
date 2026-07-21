package com.scanny.service;

import com.scanny.dto.admin.AdminDashboardDtos;
import com.scanny.entity.Business;
import com.scanny.entity.Order;
import com.scanny.entity.QrScanEvent;
import com.scanny.entity.TicketScan;
import com.scanny.model.enums.OrderStatus;
import com.scanny.repository.BusinessRepository;
import com.scanny.repository.OrderRepository;
import com.scanny.repository.QrScanEventRepository;
import com.scanny.repository.TicketScanRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class AdminDashboardService {

    private final BusinessRepository businessRepository;
    private final OrderRepository orderRepository;
    private final TicketScanRepository ticketScanRepository;
    private final QrScanEventRepository qrScanEventRepository;

    public AdminDashboardService(
        BusinessRepository businessRepository,
        OrderRepository orderRepository,
        TicketScanRepository ticketScanRepository,
        QrScanEventRepository qrScanEventRepository
    ) {
        this.businessRepository = businessRepository;
        this.orderRepository = orderRepository;
        this.ticketScanRepository = ticketScanRepository;
        this.qrScanEventRepository = qrScanEventRepository;
    }

    @Transactional(readOnly = true)
    public AdminDashboardDtos.DashboardMetrics getDashboardMetrics() {
        List<Business> businesses = businessRepository.findAll();
        List<Order> allOrders = orderRepository.findAll();
        List<TicketScan> allScans = ticketScanRepository.findAll();
        List<QrScanEvent> menuScans = qrScanEventRepository.findAllByOrderByScannedAtDesc();

        Instant now = Instant.now();
        Instant startOfToday = now.truncatedTo(ChronoUnit.DAYS);
        Instant oneWeekAgo = now.minus(7, ChronoUnit.DAYS);
        Instant twoWeeksAgo = now.minus(14, ChronoUnit.DAYS);
        Instant last24Hours = now.minus(24, ChronoUnit.HOURS);
        Instant prev24Hours = now.minus(48, ChronoUnit.HOURS);
        Instant startOfMonth = now.truncatedTo(ChronoUnit.DAYS).minus(30, ChronoUnit.DAYS);
        Instant prevMonthStart = startOfMonth.minus(30, ChronoUnit.DAYS);

        int totalMerchants = businesses.size();
        int merchantsThisWeek = (int) businesses.stream()
            .filter(b -> b.getCreatedAt().isAfter(oneWeekAgo))
            .count();
        int merchantsPrevWeek = (int) businesses.stream()
            .filter(b -> b.getCreatedAt().isAfter(twoWeeksAgo) && !b.getCreatedAt().isAfter(oneWeekAgo))
            .count();

        int ordersToday = (int) allOrders.stream()
            .filter(o -> o.getCreatedAt().isAfter(startOfToday))
            .count();
        int ordersYesterday = (int) allOrders.stream()
            .filter(o -> o.getCreatedAt().isAfter(startOfToday.minus(1, ChronoUnit.DAYS))
                && !o.getCreatedAt().isAfter(startOfToday))
            .count();

        int qrScansLast24Hours = (int) (allScans.stream()
            .filter(s -> s.getScannedAt().isAfter(last24Hours))
            .count()
            + menuScans.stream()
            .filter(s -> s.getScannedAt().isAfter(last24Hours))
            .count());
        int qrScansPrev24Hours = (int) (allScans.stream()
            .filter(s -> s.getScannedAt().isAfter(prev24Hours) && !s.getScannedAt().isAfter(last24Hours))
            .count()
            + menuScans.stream()
            .filter(s -> s.getScannedAt().isAfter(prev24Hours) && !s.getScannedAt().isAfter(last24Hours))
            .count());

        long revenueThisMonth = allOrders.stream()
            .filter(o -> o.getCreatedAt().isAfter(startOfMonth))
            .filter(o -> o.getStatus() == OrderStatus.Completed)
            .mapToLong(Order::getTotal)
            .sum();
        long revenuePrevMonth = allOrders.stream()
            .filter(o -> o.getCreatedAt().isAfter(prevMonthStart) && !o.getCreatedAt().isAfter(startOfMonth))
            .filter(o -> o.getStatus() == OrderStatus.Completed)
            .mapToLong(Order::getTotal)
            .sum();

        return new AdminDashboardDtos.DashboardMetrics(
            new AdminDashboardDtos.MerchantMetrics(
                totalMerchants,
                formatChange(merchantsThisWeek, merchantsPrevWeek),
                merchantsThisWeek
            ),
            new AdminDashboardDtos.OrdersMetrics(
                ordersToday,
                formatChange(ordersToday, ordersYesterday)
            ),
            new AdminDashboardDtos.QrScansMetrics(
                qrScansLast24Hours,
                formatChange(qrScansLast24Hours, qrScansPrev24Hours)
            ),
            new AdminDashboardDtos.RevenueMetrics(
                revenueThisMonth,
                "UGX",
                formatChange(revenueThisMonth, revenuePrevMonth)
            ),
            buildSparklines(businesses, allOrders, allScans, menuScans, now)
        );
    }

    private AdminDashboardDtos.SparklineMetrics buildSparklines(
        List<Business> businesses,
        List<Order> orders,
        List<TicketScan> scans,
        List<QrScanEvent> menuScans,
        Instant now
    ) {
        List<Integer> merchants = new ArrayList<>(7);
        List<Integer> ordersToday = new ArrayList<>(7);
        List<Integer> qrScans = new ArrayList<>(7);
        List<Long> revenue = new ArrayList<>(7);

        for (int daysAgo = 6; daysAgo >= 0; daysAgo--) {
            LocalDate day = LocalDate.ofInstant(now, ZoneOffset.UTC).minusDays(daysAgo);
            Instant dayStart = day.atStartOfDay().toInstant(ZoneOffset.UTC);
            Instant dayEnd = day.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);

            merchants.add((int) businesses.stream()
                .filter(b -> !b.getCreatedAt().isAfter(dayEnd))
                .count());

            ordersToday.add((int) orders.stream()
                .filter(o -> !o.getCreatedAt().isBefore(dayStart) && o.getCreatedAt().isBefore(dayEnd))
                .count());

            qrScans.add((int) (scans.stream()
                .filter(s -> !s.getScannedAt().isBefore(dayStart) && s.getScannedAt().isBefore(dayEnd))
                .count()
                + menuScans.stream()
                .filter(s -> !s.getScannedAt().isBefore(dayStart) && s.getScannedAt().isBefore(dayEnd))
                .count()));

            revenue.add(orders.stream()
                .filter(o -> !o.getCreatedAt().isBefore(dayStart) && o.getCreatedAt().isBefore(dayEnd))
                .filter(o -> o.getStatus() == OrderStatus.Completed)
                .mapToLong(Order::getTotal)
                .sum());
        }

        return new AdminDashboardDtos.SparklineMetrics(merchants, ordersToday, qrScans, revenue);
    }

    private static String formatChange(long current, long previous) {
        if (previous <= 0) {
            return current > 0 ? "+100%" : "0%";
        }
        double pct = ((double) (current - previous) / previous) * 100.0;
        String sign = pct >= 0 ? "+" : "";
        return String.format("%s%.1f%%", sign, pct);
    }

    @Transactional(readOnly = true)
    public List<AdminDashboardDtos.ActivityEvent> getActivityFeed() {
        List<AdminDashboardDtos.ActivityEvent> events = new ArrayList<>();

        Instant oneDayAgo = Instant.now().minus(24, ChronoUnit.HOURS);
        List<Business> recentMerchants = businessRepository.findAll().stream()
            .filter(b -> b.getCreatedAt().isAfter(oneDayAgo))
            .sorted(Comparator.comparing(Business::getCreatedAt).reversed())
            .limit(5)
            .toList();

        for (Business business : recentMerchants) {
            events.add(new AdminDashboardDtos.ActivityEvent(
                "evt-" + business.getId(),
                "merchant_registered",
                "New merchant registered",
                business.getName(),
                business.getCreatedAt().toString(),
                "merchant"
            ));
        }

        Instant startOfToday = Instant.now().truncatedTo(ChronoUnit.DAYS);
        List<Order> todayOrders = orderRepository.findAll().stream()
            .filter(o -> o.getCreatedAt().isAfter(startOfToday))
            .toList();

        if (!todayOrders.isEmpty()) {
            long merchantsWithOrders = todayOrders.stream()
                .map(Order::getMerchantId)
                .distinct()
                .count();

            events.add(new AdminDashboardDtos.ActivityEvent(
                "evt-orders-today",
                "orders_milestone",
                todayOrders.size() + " orders placed",
                "across " + merchantsWithOrders + " merchants · today",
                Instant.now().toString(),
                "orders"
            ));
        }

        Instant last24Hours = Instant.now().minus(24, ChronoUnit.HOURS);
        long scans = ticketScanRepository.findAll().stream()
            .filter(s -> s.getScannedAt().isAfter(last24Hours))
            .count()
            + qrScanEventRepository.findAllByOrderByScannedAtDesc().stream()
            .filter(s -> s.getScannedAt().isAfter(last24Hours))
            .count();
        if (scans > 0) {
            events.add(new AdminDashboardDtos.ActivityEvent(
                "evt-scans-24h",
                "qr_scans",
                scans + " QR scans",
                "last 24 hours",
                Instant.now().toString(),
                "qr"
            ));
        }

        return events.stream()
            .sorted(Comparator.comparing(AdminDashboardDtos.ActivityEvent::timestamp).reversed())
            .limit(10)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<AdminDashboardDtos.TopMerchant> getTopMerchants(String period, String sortBy, int limit) {
        Instant cutoffDate = switch (period) {
            case "today" -> Instant.now().truncatedTo(ChronoUnit.DAYS);
            case "week" -> Instant.now().minus(7, ChronoUnit.DAYS);
            default -> Instant.now().minus(30, ChronoUnit.DAYS);
        };

        List<Order> orders = orderRepository.findAll().stream()
            .filter(o -> o.getCreatedAt().isAfter(cutoffDate))
            .filter(o -> o.getStatus() == OrderStatus.Completed)
            .toList();

        Map<String, List<Order>> ordersByMerchant = orders.stream()
            .collect(Collectors.groupingBy(Order::getMerchantId));

        List<AdminDashboardDtos.TopMerchant> topMerchants = new ArrayList<>();
        for (Map.Entry<String, List<Order>> entry : ordersByMerchant.entrySet()) {
            String merchantId = entry.getKey();
            List<Order> merchantOrders = entry.getValue();

            Business business = businessRepository.findByMerchantId(merchantId)
                .or(() -> businessRepository.findById(merchantId))
                .orElse(null);
            if (business == null) {
                Order sample = merchantOrders.get(0);
                int orderCount = merchantOrders.size();
                long revenue = merchantOrders.stream().mapToLong(Order::getTotal).sum();
                topMerchants.add(new AdminDashboardDtos.TopMerchant(
                    merchantId,
                    sample.getBusinessName() != null ? sample.getBusinessName() : merchantId,
                    "Restaurant",
                    orderCount,
                    revenue,
                    "UGX",
                    "active"
                ));
                continue;
            }

            int orderCount = merchantOrders.size();
            long revenue = merchantOrders.stream().mapToLong(Order::getTotal).sum();

            topMerchants.add(new AdminDashboardDtos.TopMerchant(
                business.getId(),
                business.getName(),
                business.getType().name(),
                orderCount,
                revenue,
                "UGX",
                "active"
            ));
        }

        Comparator<AdminDashboardDtos.TopMerchant> comparator = sortBy.equals("revenue")
            ? Comparator.comparingLong(AdminDashboardDtos.TopMerchant::revenue).reversed()
            : Comparator.comparingInt(AdminDashboardDtos.TopMerchant::orders).reversed();

        return topMerchants.stream()
            .sorted(comparator)
            .limit(limit)
            .toList();
    }
}
