package com.scanit.service;

import com.scanit.dto.admin.AdminDashboardDtos;
import com.scanit.entity.Business;
import com.scanit.entity.Order;
import com.scanit.entity.TicketScan;
import com.scanit.model.enums.OrderStatus;
import com.scanit.repository.BusinessRepository;
import com.scanit.repository.OrderRepository;
import com.scanit.repository.TicketScanRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
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

    public AdminDashboardService(
        BusinessRepository businessRepository,
        OrderRepository orderRepository,
        TicketScanRepository ticketScanRepository
    ) {
        this.businessRepository = businessRepository;
        this.orderRepository = orderRepository;
        this.ticketScanRepository = ticketScanRepository;
    }

    @Transactional(readOnly = true)
    public AdminDashboardDtos.DashboardMetrics getDashboardMetrics() {
        // Get all merchants
        long totalMerchants = businessRepository.count();
        Instant oneWeekAgo = Instant.now().minus(7, ChronoUnit.DAYS);
        long merchantsThisWeek = businessRepository.findAll().stream()
            .filter(b -> b.getCreatedAt().isAfter(oneWeekAgo))
            .count();

        // Get all orders
        List<Order> allOrders = orderRepository.findAll();
        Instant startOfToday = Instant.now().truncatedTo(ChronoUnit.DAYS);
        long ordersToday = allOrders.stream()
            .filter(o -> o.getCreatedAt().isAfter(startOfToday))
            .count();

        // Get QR scans (from ticket scans)
        Instant last24Hours = Instant.now().minus(24, ChronoUnit.HOURS);
        long qrScansLast24Hours = ticketScanRepository.findAll().stream()
            .filter(s -> s.getScannedAt().isAfter(last24Hours))
            .count();

        // Calculate revenue for this month
        Instant startOfMonth = Instant.now().truncatedTo(ChronoUnit.DAYS).minus(30, ChronoUnit.DAYS);
        long revenueThisMonth = allOrders.stream()
            .filter(o -> o.getCreatedAt().isAfter(startOfMonth))
            .filter(o -> o.getStatus() == OrderStatus.Completed)
            .mapToLong(Order::getTotal)
            .sum();

        return new AdminDashboardDtos.DashboardMetrics(
            new AdminDashboardDtos.MerchantMetrics((int) totalMerchants, "+2.2%", (int) merchantsThisWeek),
            new AdminDashboardDtos.OrdersMetrics((int) ordersToday, "+14.3%"),
            new AdminDashboardDtos.QrScansMetrics((int) qrScansLast24Hours, "+8.1%"),
            new AdminDashboardDtos.RevenueMetrics(revenueThisMonth, "UGX", "+19.4%")
        );
    }

    @Transactional(readOnly = true)
    public List<AdminDashboardDtos.ActivityEvent> getActivityFeed() {
        List<AdminDashboardDtos.ActivityEvent> events = new ArrayList<>();

        // Get recent merchants
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

        // Get recent orders milestone
        Instant startOfToday = Instant.now().truncatedTo(ChronoUnit.DAYS);
        long ordersToday = orderRepository.findAll().stream()
            .filter(o -> o.getCreatedAt().isAfter(startOfToday))
            .count();

        if (ordersToday > 0) {
            long merchantsWithOrders = orderRepository.findAll().stream()
                .filter(o -> o.getCreatedAt().isAfter(startOfToday))
                .map(Order::getMerchantId)
                .distinct()
                .count();

            events.add(new AdminDashboardDtos.ActivityEvent(
                "evt-orders-today",
                "orders_milestone",
                ordersToday + " orders placed",
                "across " + merchantsWithOrders + " merchants · today",
                Instant.now().toString(),
                "orders"
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
            default -> Instant.now().minus(30, ChronoUnit.DAYS); // month
        };

        List<Order> orders = orderRepository.findAll().stream()
            .filter(o -> o.getCreatedAt().isAfter(cutoffDate))
            .filter(o -> o.getStatus() == OrderStatus.Completed)
            .toList();

        // Group by merchant
        Map<String, List<Order>> ordersByMerchant = orders.stream()
            .collect(Collectors.groupingBy(Order::getMerchantId));

        List<AdminDashboardDtos.TopMerchant> topMerchants = new ArrayList<>();
        for (Map.Entry<String, List<Order>> entry : ordersByMerchant.entrySet()) {
            String merchantId = entry.getKey();
            List<Order> merchantOrders = entry.getValue();
            
            Business business = businessRepository.findById(merchantId).orElse(null);
            if (business == null) continue;

            int orderCount = merchantOrders.size();
            long revenue = merchantOrders.stream().mapToLong(Order::getTotal).sum();

            topMerchants.add(new AdminDashboardDtos.TopMerchant(
                merchantId,
                business.getName(),
                business.getType().name(),
                orderCount,
                revenue,
                "UGX",
                "active"
            ));
        }

        // Sort by requested field
        Comparator<AdminDashboardDtos.TopMerchant> comparator = sortBy.equals("revenue")
            ? Comparator.comparingLong(AdminDashboardDtos.TopMerchant::revenue).reversed()
            : Comparator.comparingInt(AdminDashboardDtos.TopMerchant::orders).reversed();

        return topMerchants.stream()
            .sorted(comparator)
            .limit(limit)
            .toList();
    }
}
