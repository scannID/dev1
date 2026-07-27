package com.scanny.service;

import com.scanny.dto.admin.AdminAnalyticsDtos;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CookieConsentAnalyticsService {

    private record ConsentEvent(String choice, Instant consentedAt) {
    }

    private final JdbcTemplate jdbcTemplate;

    public CookieConsentAnalyticsService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional(readOnly = true)
    public AdminAnalyticsDtos.CookieConsentAnalytics getAnalytics(String range) {
        String normalized = range == null ? "daily" : range.toLowerCase(Locale.ROOT);
        Instant now = Instant.now();
        Instant lookback = switch (normalized) {
            case "hourly" -> now.minus(24, ChronoUnit.HOURS);
            case "weekly" -> now.minus(12, ChronoUnit.WEEKS);
            case "monthly" -> now.minus(12 * 30L, ChronoUnit.DAYS);
            case "yearly" -> now.minus(5 * 365L, ChronoUnit.DAYS);
            default -> now.minus(30, ChronoUnit.DAYS);
        };

        List<ConsentEvent> events = loadEventsSince(lookback);
        AdminAnalyticsDtos.CookieConsentSeries series = switch (normalized) {
            case "hourly" -> buildHourlySeries(events, now);
            case "weekly" -> buildWeeklySeries(events, now);
            case "monthly" -> buildMonthlySeries(events, now);
            case "yearly" -> buildYearlySeries(events, now);
            default -> buildDailySeries(events, now);
        };

        return new AdminAnalyticsDtos.CookieConsentAnalytics(
                buildSummary(now),
                series,
                loadRecent(50)
        );
    }

    private AdminAnalyticsDtos.CookieConsentSummary buildSummary(Instant now) {
        Integer total = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM cookie_consents",
                Integer.class
        );
        Integer accepted = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM cookie_consents WHERE choice = 'accepted'",
                Integer.class
        );
        Integer essential = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM cookie_consents WHERE choice = 'essential'",
                Integer.class
        );
        Integer uniqueClients = jdbcTemplate.queryForObject(
                "SELECT COUNT(DISTINCT client_id) FROM cookie_consents WHERE client_id IS NOT NULL",
                Integer.class
        );
        Integer last24Hours = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM cookie_consents WHERE consented_at >= ?",
                Integer.class,
                Timestamp.from(now.minus(24, ChronoUnit.HOURS))
        );

        return new AdminAnalyticsDtos.CookieConsentSummary(
                total != null ? total : 0,
                accepted != null ? accepted : 0,
                essential != null ? essential : 0,
                uniqueClients != null ? uniqueClients : 0,
                last24Hours != null ? last24Hours : 0
        );
    }

    private List<ConsentEvent> loadEventsSince(Instant since) {
        return jdbcTemplate.query(
                "SELECT choice, consented_at FROM cookie_consents WHERE consented_at >= ? ORDER BY consented_at",
                (rs, rowNum) -> new ConsentEvent(
                        rs.getString("choice"),
                        rs.getTimestamp("consented_at").toInstant()
                ),
                Timestamp.from(since)
        );
    }

    private List<AdminAnalyticsDtos.CookieConsentRecent> loadRecent(int limit) {
        return jdbcTemplate.query(
                """
                SELECT choice, source, path, client_id, actor_email, consented_at
                FROM cookie_consents
                ORDER BY consented_at DESC
                LIMIT ?
                """,
                (rs, rowNum) -> new AdminAnalyticsDtos.CookieConsentRecent(
                        rs.getString("choice"),
                        rs.getString("source"),
                        rs.getString("path"),
                        rs.getString("client_id"),
                        rs.getString("actor_email"),
                        rs.getTimestamp("consented_at").toInstant().toString()
                ),
                limit
        );
    }

    private AdminAnalyticsDtos.CookieConsentSeries buildHourlySeries(List<ConsentEvent> events, Instant now) {
        List<Integer> acceptedBuckets = new ArrayList<>(24);
        List<Integer> essentialBuckets = new ArrayList<>(24);
        List<String> labels = new ArrayList<>(24);
        Instant start = now.truncatedTo(ChronoUnit.HOURS).minus(23, ChronoUnit.HOURS);

        for (int i = 0; i < 24; i++) {
            Instant bucketStart = start.plus(i, ChronoUnit.HOURS);
            Instant bucketEnd = bucketStart.plus(1, ChronoUnit.HOURS);
            acceptedBuckets.add(countChoiceInRange(events, "accepted", bucketStart, bucketEnd));
            essentialBuckets.add(countChoiceInRange(events, "essential", bucketStart, bucketEnd));
            int hour = bucketStart.atZone(ZoneOffset.UTC).getHour();
            labels.add(String.format("%d%s", hour % 12 == 0 ? 12 : hour % 12, hour < 12 ? "a" : "p"));
        }
        return series("hourly", acceptedBuckets, essentialBuckets, labels);
    }

    private AdminAnalyticsDtos.CookieConsentSeries buildDailySeries(List<ConsentEvent> events, Instant now) {
        List<Integer> acceptedBuckets = new ArrayList<>(28);
        List<Integer> essentialBuckets = new ArrayList<>(28);
        List<String> labels = new ArrayList<>(28);
        LocalDate today = LocalDate.ofInstant(now, ZoneOffset.UTC);
        DateTimeFormatter dayFmt = DateTimeFormatter.ofPattern("EEE", Locale.ENGLISH);

        for (int i = 27; i >= 0; i--) {
            LocalDate day = today.minusDays(i);
            Instant bucketStart = day.atStartOfDay().toInstant(ZoneOffset.UTC);
            Instant bucketEnd = day.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);
            acceptedBuckets.add(countChoiceInRange(events, "accepted", bucketStart, bucketEnd));
            essentialBuckets.add(countChoiceInRange(events, "essential", bucketStart, bucketEnd));
            labels.add(dayFmt.format(day));
        }
        return series("daily", acceptedBuckets, essentialBuckets, labels);
    }

    private AdminAnalyticsDtos.CookieConsentSeries buildWeeklySeries(List<ConsentEvent> events, Instant now) {
        List<Integer> acceptedBuckets = new ArrayList<>(16);
        List<Integer> essentialBuckets = new ArrayList<>(16);
        List<String> labels = new ArrayList<>(16);
        LocalDate today = LocalDate.ofInstant(now, ZoneOffset.UTC);
        LocalDate weekStart = today.minusDays(today.getDayOfWeek().getValue() - 1L);

        for (int i = 15; i >= 0; i--) {
            LocalDate start = weekStart.minusWeeks(i);
            Instant bucketStart = start.atStartOfDay().toInstant(ZoneOffset.UTC);
            Instant bucketEnd = start.plusWeeks(1).atStartOfDay().toInstant(ZoneOffset.UTC);
            acceptedBuckets.add(countChoiceInRange(events, "accepted", bucketStart, bucketEnd));
            essentialBuckets.add(countChoiceInRange(events, "essential", bucketStart, bucketEnd));
            labels.add("W" + (16 - i));
        }
        return series("weekly", acceptedBuckets, essentialBuckets, labels);
    }

    private AdminAnalyticsDtos.CookieConsentSeries buildMonthlySeries(List<ConsentEvent> events, Instant now) {
        List<Integer> acceptedBuckets = new ArrayList<>(12);
        List<Integer> essentialBuckets = new ArrayList<>(12);
        List<String> labels = new ArrayList<>(12);
        YearMonth current = YearMonth.from(LocalDate.ofInstant(now, ZoneOffset.UTC));
        DateTimeFormatter monthFmt = DateTimeFormatter.ofPattern("MMM", Locale.ENGLISH);

        for (int i = 11; i >= 0; i--) {
            YearMonth month = current.minusMonths(i);
            Instant bucketStart = month.atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC);
            Instant bucketEnd = month.plusMonths(1).atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC);
            acceptedBuckets.add(countChoiceInRange(events, "accepted", bucketStart, bucketEnd));
            essentialBuckets.add(countChoiceInRange(events, "essential", bucketStart, bucketEnd));
            labels.add(monthFmt.format(month.atDay(1)));
        }
        return series("monthly", acceptedBuckets, essentialBuckets, labels);
    }

    private AdminAnalyticsDtos.CookieConsentSeries buildYearlySeries(List<ConsentEvent> events, Instant now) {
        List<Integer> acceptedBuckets = new ArrayList<>(5);
        List<Integer> essentialBuckets = new ArrayList<>(5);
        List<String> labels = new ArrayList<>(5);
        int currentYear = LocalDate.ofInstant(now, ZoneOffset.UTC).getYear();

        for (int i = 4; i >= 0; i--) {
            int year = currentYear - i;
            Instant bucketStart = LocalDate.of(year, 1, 1).atStartOfDay().toInstant(ZoneOffset.UTC);
            Instant bucketEnd = LocalDate.of(year + 1, 1, 1).atStartOfDay().toInstant(ZoneOffset.UTC);
            acceptedBuckets.add(countChoiceInRange(events, "accepted", bucketStart, bucketEnd));
            essentialBuckets.add(countChoiceInRange(events, "essential", bucketStart, bucketEnd));
            labels.add(String.valueOf(year));
        }
        return series("yearly", acceptedBuckets, essentialBuckets, labels);
    }

    private static int countChoiceInRange(
            List<ConsentEvent> events,
            String choice,
            Instant start,
            Instant end
    ) {
        int count = 0;
        for (ConsentEvent event : events) {
            if (!choice.equals(event.choice())) continue;
            Instant at = event.consentedAt();
            if (!at.isBefore(start) && at.isBefore(end)) count++;
        }
        return count;
    }

    private static AdminAnalyticsDtos.CookieConsentSeries series(
            String range,
            List<Integer> accepted,
            List<Integer> essential,
            List<String> labels
    ) {
        int maxAccepted = accepted.stream().mapToInt(Integer::intValue).max().orElse(0);
        int maxEssential = essential.stream().mapToInt(Integer::intValue).max().orElse(0);
        int yMax = Math.max(10, (int) Math.ceil(Math.max(maxAccepted, maxEssential) * 1.15));
        if (yMax < 1) yMax = 1;
        return new AdminAnalyticsDtos.CookieConsentSeries(range, accepted, essential, yMax, labels);
    }
}
