package com.scanny.service;

import com.scanny.dto.admin.AdminDashboardDtos;
import com.scanny.entity.Business;
import com.scanny.model.enums.OrderStatus;
import com.scanny.repository.BusinessRepository;
import com.scanny.repository.OrderRepository;
import com.scanny.repository.QrScanEventRepository;
import com.scanny.repository.TicketScanRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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
        Instant now = Instant.now();
        Instant startOfToday = now.truncatedTo(ChronoUnit.DAYS);
        Instant oneWeekAgo = now.minus(7, ChronoUnit.DAYS);
        Instant twoWeeksAgo = now.minus(14, ChronoUnit.DAYS);
        Instant last24Hours = now.minus(24, ChronoUnit.HOURS);
        Instant prev24Hours = now.minus(48, ChronoUnit.HOURS);
        Instant startOfMonth = now.truncatedTo(ChronoUnit.DAYS).minus(30, ChronoUnit.DAYS);
        Instant prevMonthStart = startOfMonth.minus(30, ChronoUnit.DAYS);

        int totalMerchants = (int) businessRepository.count();
        int merchantsThisWeek = (int) businessRepository.countByCreatedAtAfter(oneWeekAgo);
        int merchantsPrevWeek = (int) businessRepository.countByCreatedAtGreaterThanEqualAndCreatedAtBefore(
                twoWeeksAgo, oneWeekAgo);

        int ordersToday = (int) orderRepository.countByCreatedAtAfter(startOfToday);
        int ordersYesterday = (int) orderRepository.countByCreatedAtGreaterThanEqualAndCreatedAtBefore(
                startOfToday.minus(1, ChronoUnit.DAYS), startOfToday);

        int qrScansLast24Hours = (int) (
                ticketScanRepository.countByScannedAtAfter(last24Hours)
                        + qrScanEventRepository.countByScannedAtAfter(last24Hours));
        int qrScansPrev24Hours = (int) (
                ticketScanRepository.countByScannedAtGreaterThanEqualAndScannedAtBefore(prev24Hours, last24Hours)
                        + qrScanEventRepository.countByScannedAtGreaterThanEqualAndScannedAtBefore(prev24Hours, last24Hours));

        long revenueThisMonth = orderRepository.sumTotalByCreatedAtAfterAndStatus(startOfMonth, OrderStatus.Completed);
        long revenuePrevMonth = orderRepository.sumTotalByCreatedAtBetweenAndStatus(
                prevMonthStart, startOfMonth, OrderStatus.Completed);

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
            buildSparklines(now)
        );
    }

    /**
     * One window load per series (4 queries) instead of 7×4 count round-trips.
     */
    private AdminDashboardDtos.SparklineMetrics buildSparklines(Instant now) {
        LocalDate today = LocalDate.ofInstant(now, ZoneOffset.UTC);
        Instant windowStart = today.minusDays(6).atStartOfDay().toInstant(ZoneOffset.UTC);

        long merchantsBeforeWindow = businessRepository.countByCreatedAtLessThanEqual(windowStart.minusNanos(1));
        List<Instant> merchantCreatedAts = businessRepository.findByCreatedAtGreaterThanEqual(windowStart).stream()
                .map(Business::getCreatedAt)
                .toList();
        List<Object[]> orderRows = orderRepository.findCreatedAtTotalStatusAfter(windowStart);
        List<Instant> ticketScanAts = ticketScanRepository.findScannedAtsAfter(windowStart);
        List<Instant> qrScanAts = qrScanEventRepository.findScannedAtsAfter(windowStart);

        List<Integer> merchants = new ArrayList<>(7);
        List<Integer> ordersToday = new ArrayList<>(7);
        List<Integer> qrScans = new ArrayList<>(7);
        List<Long> revenue = new ArrayList<>(7);

        for (int daysAgo = 6; daysAgo >= 0; daysAgo--) {
            LocalDate day = today.minusDays(daysAgo);
            Instant dayStart = day.atStartOfDay().toInstant(ZoneOffset.UTC);
            Instant dayEnd = day.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);

            long newMerchantsThroughDay = merchantCreatedAts.stream()
                    .filter(at -> !at.isAfter(dayEnd))
                    .count();
            merchants.add((int) (merchantsBeforeWindow + newMerchantsThroughDay));

            int dayOrders = 0;
            long dayRevenue = 0L;
            for (Object[] row : orderRows) {
                Instant createdAt = (Instant) row[0];
                if (createdAt.isBefore(dayStart) || !createdAt.isBefore(dayEnd)) continue;
                dayOrders++;
                if (row[2] == OrderStatus.Completed) {
                    dayRevenue += ((Number) row[1]).longValue();
                }
            }
            ordersToday.add(dayOrders);
            revenue.add(dayRevenue);

            int dayScans = 0;
            for (Instant at : ticketScanAts) {
                if (!at.isBefore(dayStart) && at.isBefore(dayEnd)) dayScans++;
            }
            for (Instant at : qrScanAts) {
                if (!at.isBefore(dayStart) && at.isBefore(dayEnd)) dayScans++;
            }
            qrScans.add(dayScans);
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
        List<Business> recentMerchants = businessRepository.findByCreatedAtAfterOrderByCreatedAtDesc(
                oneDayAgo, PageRequest.of(0, 5));

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
        long ordersToday = orderRepository.countByCreatedAtAfter(startOfToday);
        if (ordersToday > 0) {
            long merchantsWithOrders = orderRepository.countDistinctMerchantsWithOrdersSince(startOfToday);
            events.add(new AdminDashboardDtos.ActivityEvent(
                "evt-orders-today",
                "orders_milestone",
                ordersToday + " orders placed",
                "across " + merchantsWithOrders + " merchants · today",
                startOfToday.toString(),
                "orders"
            ));
        }

        Instant last24Hours = Instant.now().minus(24, ChronoUnit.HOURS);
        long scans = ticketScanRepository.countByScannedAtAfter(last24Hours)
                + qrScanEventRepository.countByScannedAtAfter(last24Hours);
        if (scans > 0) {
            events.add(new AdminDashboardDtos.ActivityEvent(
                "evt-scans-24h",
                "qr_scans",
                scans + " QR scans",
                "last 24 hours",
                last24Hours.toString(),
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

        List<Object[]> rows = orderRepository.aggregateMerchantStatsSince(
                cutoffDate, OrderStatus.Cancelled, OrderStatus.Completed);
        if (rows.isEmpty()) {
            return List.of();
        }

        List<String> merchantIds = rows.stream()
                .map(row -> (String) row[0])
                .filter(id -> id != null && !id.isBlank())
                .toList();

        Map<String, Business> byMerchantOrId = new HashMap<>();
        if (!merchantIds.isEmpty()) {
            for (Business business : businessRepository.findByMerchantIdInOrIdIn(merchantIds)) {
                if (business.getMerchantId() != null) {
                    byMerchantOrId.put(business.getMerchantId(), business);
                }
                byMerchantOrId.put(business.getId(), business);
            }
        }

        List<AdminDashboardDtos.TopMerchant> topMerchants = new ArrayList<>(rows.size());
        for (Object[] row : rows) {
            String merchantId = (String) row[0];
            int orderCount = ((Number) row[1]).intValue();
            long revenue = ((Number) row[2]).longValue();
            String fallbackName = row[3] != null ? String.valueOf(row[3]) : merchantId;

            Business business = byMerchantOrId.get(merchantId);
            if (business != null) {
                topMerchants.add(new AdminDashboardDtos.TopMerchant(
                    business.getId(),
                    business.getName(),
                    business.getType().name(),
                    orderCount,
                    revenue,
                    "UGX",
                    "active"
                ));
            } else {
                topMerchants.add(new AdminDashboardDtos.TopMerchant(
                    merchantId,
                    fallbackName != null && !fallbackName.isBlank() ? fallbackName : merchantId,
                    "Restaurant",
                    orderCount,
                    revenue,
                    "UGX",
                    "active"
                ));
            }
        }

        Comparator<AdminDashboardDtos.TopMerchant> comparator = "revenue".equals(sortBy)
            ? Comparator.comparingLong(AdminDashboardDtos.TopMerchant::revenue).reversed()
            : Comparator.comparingInt(AdminDashboardDtos.TopMerchant::orders).reversed();

        return topMerchants.stream()
            .sorted(comparator)
            .limit(limit)
            .toList();
    }
}
