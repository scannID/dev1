package com.scanny.service;

import com.scanny.dto.admin.AdminPlatformDtos;
import com.scanny.entity.Business;
import com.scanny.entity.CatalogItem;
import com.scanny.entity.Merchant;
import com.scanny.entity.Order;
import com.scanny.entity.OrderLineItem;
import com.scanny.entity.TicketScan;
import com.scanny.model.enums.OrderStatus;
import com.scanny.model.enums.PaymentStatus;
import com.scanny.repository.BusinessRepository;
import com.scanny.repository.MerchantRepository;
import com.scanny.repository.OrderRepository;
import com.scanny.repository.TicketScanRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AdminPlatformService {

    private final BusinessRepository businessRepository;
    private final OrderRepository orderRepository;
    private final MerchantRepository merchantRepository;
    private final TicketScanRepository ticketScanRepository;
    private final AuditService auditService;

    public AdminPlatformService(
        BusinessRepository businessRepository,
        OrderRepository orderRepository,
        MerchantRepository merchantRepository,
        TicketScanRepository ticketScanRepository,
        AuditService auditService
    ) {
        this.businessRepository = businessRepository;
        this.orderRepository = orderRepository;
        this.merchantRepository = merchantRepository;
        this.ticketScanRepository = ticketScanRepository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public AdminPlatformDtos.CatalogListResponse listCatalog() {
        List<Business> businesses = businessRepository.findAll();
        List<Order> orders = orderRepository.findAll();

        Map<String, Integer> itemOrderCounts = new HashMap<>();
        for (Order order : orders) {
            if (order.getStatus() == OrderStatus.Cancelled) {
                continue;
            }
            for (OrderLineItem line : order.getItems()) {
                String key = line.getName().toLowerCase();
                itemOrderCounts.merge(key, line.getQuantity(), Integer::sum);
            }
        }

        List<AdminPlatformDtos.CatalogItemRow> rows = new ArrayList<>();
        Set<String> categories = new HashSet<>();
        long available = 0;
        long hidden = 0;

        for (Business business : businesses) {
            for (CatalogItem item : business.getItems()) {
                categories.add(item.getCategory());
                if (item.isAvailable()) {
                    available++;
                } else {
                    hidden++;
                }
                rows.add(new AdminPlatformDtos.CatalogItemRow(
                    item.getId(),
                    item.getName(),
                    business.getName(),
                    business.getId(),
                    item.getCategory(),
                    item.getPrice(),
                    "UGX",
                    item.isAvailable(),
                    itemOrderCounts.getOrDefault(item.getName().toLowerCase(), 0)
                ));
            }
        }

        rows.sort(Comparator.comparingInt(AdminPlatformDtos.CatalogItemRow::orders).reversed());

        return new AdminPlatformDtos.CatalogListResponse(
            rows,
            new AdminPlatformDtos.CatalogSummary(rows.size(), available, hidden, categories.size())
        );
    }

    @Transactional(readOnly = true)
    public AdminPlatformDtos.UsersListResponse listUsers() {
        List<AdminPlatformDtos.UserRow> users = new ArrayList<>();
        List<Merchant> merchants = merchantRepository.findAll();
        List<Order> orders = orderRepository.findAll();

        for (Merchant merchant : merchants) {
            users.add(new AdminPlatformDtos.UserRow(
                merchant.getId().toString(),
                merchant.getBusinessName(),
                merchant.getEmail(),
                "Merchant",
                0,
                merchant.getStatus() != null ? merchant.getStatus().name().toLowerCase() : "active",
                merchant.getCreatedAt() != null ? merchant.getCreatedAt().toString() : Instant.now().toString()
            ));
        }

        Map<String, List<Order>> byCustomer = orders.stream()
            .filter(o -> o.getCustomerName() != null && !o.getCustomerName().isBlank())
            .collect(Collectors.groupingBy(o -> o.getCustomerName().trim().toLowerCase()));

        for (Map.Entry<String, List<Order>> entry : byCustomer.entrySet()) {
            List<Order> customerOrders = entry.getValue();
            Order latest = customerOrders.stream()
                .max(Comparator.comparing(Order::getCreatedAt))
                .orElse(customerOrders.get(0));
            String phone = latest.getCustomerPhone() != null ? latest.getCustomerPhone() : "";
            users.add(new AdminPlatformDtos.UserRow(
                "cust-" + entry.getKey().replaceAll("[^a-z0-9]", "-"),
                latest.getCustomerName(),
                phone.isBlank() ? "customer@" + entry.getKey().replace(' ', '-') + ".local" : phone,
                "Customer",
                customerOrders.size(),
                "active",
                latest.getCreatedAt().toString()
            ));
        }

        // Platform admin placeholder from Keycloak realm operators is not stored locally;
        // surface a single admin row so the Users page has the role present.
        users.add(new AdminPlatformDtos.UserRow(
            "admin-platform",
            "Platform Admin",
            "admin@scanny.app",
            "Admin",
            0,
            "active",
            Instant.now().toString()
        ));

        long merchantCount = users.stream().filter(u -> "Merchant".equals(u.role())).count();
        long customerCount = users.stream().filter(u -> "Customer".equals(u.role())).count();
        long adminCount = users.stream().filter(u -> "Admin".equals(u.role())).count();

        users.sort(Comparator.comparing(AdminPlatformDtos.UserRow::joinedAt).reversed());

        return new AdminPlatformDtos.UsersListResponse(
            users,
            new AdminPlatformDtos.UsersSummary(users.size(), customerCount, merchantCount, adminCount)
        );
    }

    @Transactional(readOnly = true)
    public AdminPlatformDtos.QrActivityResponse getQrActivity() {
        Instant startOfToday = Instant.now().truncatedTo(ChronoUnit.DAYS);
        List<TicketScan> scans = ticketScanRepository.findAll();
        List<Order> orders = orderRepository.findAll();
        List<Business> businesses = businessRepository.findAll();

        long scansToday = scans.stream().filter(s -> s.getScannedAt().isAfter(startOfToday)).count();
        // Without a dedicated scan log for merchant QR, use today's orders as a scan proxy floor.
        long orderProxyScans = orders.stream().filter(o -> o.getCreatedAt().isAfter(startOfToday)).count();
        long totalScansToday = Math.max(scansToday, orderProxyScans);

        long ordersToday = orderProxyScans;
        double conversion = totalScansToday > 0 ? (ordersToday * 100.0) / totalScansToday : 0.0;

        List<AdminPlatformDtos.HourlyScanPoint> hourly = new ArrayList<>();
        for (int hour = 0; hour < 24; hour++) {
            final int h = hour;
            int count = (int) orders.stream()
                .filter(o -> o.getCreatedAt().isAfter(startOfToday))
                .filter(o -> o.getCreatedAt().atZone(ZoneOffset.UTC).getHour() == h)
                .count();
            // Blend in ticket scans for the same hour
            count += (int) scans.stream()
                .filter(s -> s.getScannedAt().isAfter(startOfToday))
                .filter(s -> s.getScannedAt().atZone(ZoneOffset.UTC).getHour() == h)
                .count();
            hourly.add(new AdminPlatformDtos.HourlyScanPoint(hour, count));
        }

        Map<String, Long> ordersByBusiness = orders.stream()
            .filter(o -> o.getBusiness() != null)
            .collect(Collectors.groupingBy(o -> o.getBusiness().getId(), Collectors.counting()));

        List<AdminPlatformDtos.QrCodeActivity> topCodes = businesses.stream()
            .map(business -> {
                int orderCount = ordersByBusiness.getOrDefault(business.getId(), 0L).intValue();
                int estimatedScans = Math.max(orderCount, orderCount * 5);
                double conv = estimatedScans > 0 ? (orderCount * 100.0) / estimatedScans : 0.0;
                return new AdminPlatformDtos.QrCodeActivity(
                    business.getName(),
                    business.getId(),
                    business.getQrToken(),
                    estimatedScans,
                    orderCount,
                    String.format("%.1f%%", conv)
                );
            })
            .sorted(Comparator.comparingInt(AdminPlatformDtos.QrCodeActivity::scans).reversed())
            .limit(20)
            .toList();

        return new AdminPlatformDtos.QrActivityResponse(
            new AdminPlatformDtos.QrActivitySummary(
                totalScansToday,
                totalScansToday,
                Math.round(conversion * 10.0) / 10.0,
                businesses.size()
            ),
            hourly,
            topCodes
        );
    }

    @Transactional(readOnly = true)
    public AdminPlatformDtos.AuditListResponse getAuditLog() {
        Instant startOfToday = Instant.now().truncatedTo(ChronoUnit.DAYS);
        var page = auditService.list(0, 100);
        List<AdminPlatformDtos.AuditEvent> events = page.getContent().stream()
            .map(event -> new AdminPlatformDtos.AuditEvent(
                event.getId().toString(),
                event.getActorEmail() != null ? event.getActorEmail() : event.getActorId(),
                event.getAction(),
                (event.getResourceType() != null ? event.getResourceType() + " · " : "")
                    + (event.getResourceId() != null ? event.getResourceId() : ""),
                event.getClientIp() != null ? event.getClientIp() : "",
                event.getOccurredAt().toString()
            ))
            .toList();

        long todayCount = events.stream()
            .filter(e -> {
                try {
                    return Instant.parse(e.timestamp()).isAfter(startOfToday);
                } catch (Exception ex) {
                    return false;
                }
            })
            .count();
        long adminActions = events.stream()
            .filter(e -> e.action() != null && e.action().startsWith("ADMIN"))
            .count();
        long systemEvents = events.stream()
            .filter(e -> "system".equalsIgnoreCase(e.actor()) || "anonymous".equalsIgnoreCase(e.actor()))
            .count();

        return new AdminPlatformDtos.AuditListResponse(
            events,
            new AdminPlatformDtos.AuditSummary(todayCount, adminActions, systemEvents)
        );
    }

    @Transactional(readOnly = true)
    public AdminPlatformDtos.RevenueTransactionsResponse listRevenueTransactions() {
        List<AdminPlatformDtos.RevenueTransaction> transactions = orderRepository.findAll().stream()
            .sorted(Comparator.comparing(Order::getCreatedAt).reversed())
            .limit(50)
            .map(order -> new AdminPlatformDtos.RevenueTransaction(
                order.getId(),
                order.getBusinessName(),
                order.getTotal(),
                "UGX",
                "Order Payment",
                order.getPaymentStatus() == PaymentStatus.Paid
                    ? "Settled"
                    : order.getPaymentStatus() == PaymentStatus.Refunded ? "Failed" : "Pending",
                order.getCreatedAt().toString()
            ))
            .toList();

        return new AdminPlatformDtos.RevenueTransactionsResponse(transactions);
    }

    @Transactional(readOnly = true)
    public AdminPlatformDtos.ReportsOverview getReportsOverview() {
        Instant startOfMonth = LocalDate.now(ZoneOffset.UTC).withDayOfMonth(1)
            .atStartOfDay().toInstant(ZoneOffset.UTC);

        List<Order> monthOrders = orderRepository.findAll().stream()
            .filter(o -> o.getCreatedAt().isAfter(startOfMonth))
            .toList();

        long revenue = monthOrders.stream()
            .filter(o -> o.getPaymentStatus() == PaymentStatus.Paid)
            .mapToLong(Order::getTotal)
            .sum();

        long newMerchants = businessRepository.findAll().stream()
            .filter(b -> b.getCreatedAt().isAfter(startOfMonth))
            .count();

        return new AdminPlatformDtos.ReportsOverview(
            monthOrders.size(),
            revenue,
            newMerchants,
            "UGX"
        );
    }

    private static String normalizeInstant(String value) {
        if (value == null) {
            return Instant.EPOCH.toString();
        }
        // LocalDateTime strings from merchant entity need a Z suffix for Instant.parse
        if (!value.endsWith("Z") && !value.contains("+") && value.contains("T")) {
            return value + "Z";
        }
        if (!value.contains("T")) {
            return value.replace(' ', 'T') + "Z";
        }
        return value;
    }
}
