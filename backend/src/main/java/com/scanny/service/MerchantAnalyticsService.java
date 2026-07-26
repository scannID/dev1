package com.scanny.service;

import com.scanny.dto.admin.AdminAnalyticsDtos;
import com.scanny.repository.OrderRepository;
import com.scanny.repository.QrScanEventRepository;
import com.scanny.security.MerchantAccessService;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MerchantAnalyticsService {

    private final MerchantAccessService merchantAccessService;
    private final QrScanEventRepository qrScanEventRepository;
    private final OrderRepository orderRepository;

    public MerchantAnalyticsService(
            MerchantAccessService merchantAccessService,
            QrScanEventRepository qrScanEventRepository,
            OrderRepository orderRepository
    ) {
        this.merchantAccessService = merchantAccessService;
        this.qrScanEventRepository = qrScanEventRepository;
        this.orderRepository = orderRepository;
    }

    @Transactional(readOnly = true)
    public AdminAnalyticsDtos.ScansOrdersSeries getScansOrders(String businessId, String range) {
        merchantAccessService.assertOwnsBusinessId(businessId);

        String normalized = range == null ? "week" : range.toLowerCase(Locale.ROOT);
        ZoneId zone = ZoneId.systemDefault();
        ZonedDateTime now = ZonedDateTime.now(zone);
        Instant cutoff = switch (normalized) {
            case "day" -> now.truncatedTo(ChronoUnit.HOURS).minus(23, ChronoUnit.HOURS).toInstant();
            case "month" -> now.toLocalDate().minusDays(34).atStartOfDay(zone).toInstant();
            case "year" -> now.toLocalDate().withDayOfMonth(1).minusMonths(11).atStartOfDay(zone).toInstant();
            default -> now.toLocalDate().minusDays(6).atStartOfDay(zone).toInstant();
        };

        List<Instant> scans = qrScanEventRepository.findScannedAtsByBusinessIdAfter(businessId, cutoff);
        List<Instant> orders = orderRepository.findCreatedAtsByBusinessIdAfter(businessId, cutoff);

        return switch (normalized) {
            case "day" -> buildHourlySeries(scans, orders, now);
            case "month" -> buildWeeklySeries(scans, orders, now);
            case "year" -> buildMonthlySeries(scans, orders, now);
            default -> buildDailySeries(scans, orders, now);
        };
    }

    private AdminAnalyticsDtos.ScansOrdersSeries buildHourlySeries(
            List<Instant> scans, List<Instant> orders, ZonedDateTime now
    ) {
        List<Integer> scanBuckets = new ArrayList<>(24);
        List<Integer> orderBuckets = new ArrayList<>(24);
        List<String> labels = new ArrayList<>(24);
        ZonedDateTime start = now.truncatedTo(ChronoUnit.HOURS).minus(23, ChronoUnit.HOURS);

        for (int i = 0; i < 24; i++) {
            ZonedDateTime bucketStart = start.plusHours(i);
            ZonedDateTime bucketEnd = bucketStart.plusHours(1);
            scanBuckets.add(countInRange(scans, bucketStart.toInstant(), bucketEnd.toInstant()));
            orderBuckets.add(countInRange(orders, bucketStart.toInstant(), bucketEnd.toInstant()));
            int hour = bucketStart.getHour();
            labels.add(String.format("%d%s", hour % 12 == 0 ? 12 : hour % 12, hour < 12 ? "a" : "p"));
        }
        return series("day", scanBuckets, orderBuckets, labels);
    }

    private AdminAnalyticsDtos.ScansOrdersSeries buildDailySeries(
            List<Instant> scans, List<Instant> orders, ZonedDateTime now
    ) {
        List<Integer> scanBuckets = new ArrayList<>(7);
        List<Integer> orderBuckets = new ArrayList<>(7);
        List<String> labels = new ArrayList<>(7);
        LocalDate today = now.toLocalDate();
        DateTimeFormatter dayFmt = DateTimeFormatter.ofPattern("MMM d", Locale.ENGLISH);

        for (int i = 6; i >= 0; i--) {
            LocalDate day = today.minusDays(i);
            Instant bucketStart = day.atStartOfDay(now.getZone()).toInstant();
            Instant bucketEnd = day.plusDays(1).atStartOfDay(now.getZone()).toInstant();
            scanBuckets.add(countInRange(scans, bucketStart, bucketEnd));
            orderBuckets.add(countInRange(orders, bucketStart, bucketEnd));
            labels.add(dayFmt.format(day));
        }
        return series("week", scanBuckets, orderBuckets, labels);
    }

    private AdminAnalyticsDtos.ScansOrdersSeries buildWeeklySeries(
            List<Instant> scans, List<Instant> orders, ZonedDateTime now
    ) {
        List<Integer> scanBuckets = new ArrayList<>(5);
        List<Integer> orderBuckets = new ArrayList<>(5);
        List<String> labels = new ArrayList<>(5);
        LocalDate today = now.toLocalDate();

        for (int i = 4; i >= 0; i--) {
            LocalDate start = today.minusDays(i * 7L);
            Instant bucketStart = start.atStartOfDay(now.getZone()).toInstant();
            Instant bucketEnd = start.plusDays(7).atStartOfDay(now.getZone()).toInstant();
            scanBuckets.add(countInRange(scans, bucketStart, bucketEnd));
            orderBuckets.add(countInRange(orders, bucketStart, bucketEnd));
            labels.add("W" + (5 - i));
        }
        return series("month", scanBuckets, orderBuckets, labels);
    }

    private AdminAnalyticsDtos.ScansOrdersSeries buildMonthlySeries(
            List<Instant> scans, List<Instant> orders, ZonedDateTime now
    ) {
        List<Integer> scanBuckets = new ArrayList<>(12);
        List<Integer> orderBuckets = new ArrayList<>(12);
        List<String> labels = new ArrayList<>(12);
        LocalDate today = now.toLocalDate();
        DateTimeFormatter monthFmt = DateTimeFormatter.ofPattern("MMM", Locale.ENGLISH);

        for (int i = 11; i >= 0; i--) {
            LocalDate monthStart = today.withDayOfMonth(1).minusMonths(i);
            Instant bucketStart = monthStart.atStartOfDay(now.getZone()).toInstant();
            Instant bucketEnd = monthStart.plusMonths(1).atStartOfDay(now.getZone()).toInstant();
            scanBuckets.add(countInRange(scans, bucketStart, bucketEnd));
            orderBuckets.add(countInRange(orders, bucketStart, bucketEnd));
            labels.add(monthFmt.format(monthStart));
        }
        return series("year", scanBuckets, orderBuckets, labels);
    }

    private static int countInRange(List<Instant> timestamps, Instant start, Instant end) {
        int count = 0;
        for (Instant at : timestamps) {
            if (!at.isBefore(start) && at.isBefore(end)) {
                count++;
            }
        }
        return count;
    }

    private static AdminAnalyticsDtos.ScansOrdersSeries series(
            String range, List<Integer> scans, List<Integer> orders, List<String> labels
    ) {
        int maxScan = scans.stream().mapToInt(Integer::intValue).max().orElse(0);
        int maxOrder = orders.stream().mapToInt(Integer::intValue).max().orElse(0);
        int yMax = Math.max(10, (int) Math.ceil(Math.max(maxScan, maxOrder) * 1.15));
        return new AdminAnalyticsDtos.ScansOrdersSeries(range, scans, orders, yMax, labels);
    }
}
