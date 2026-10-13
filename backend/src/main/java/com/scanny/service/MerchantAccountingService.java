package com.scanny.service;

import com.scanny.dto.AccountingDtos;
import com.scanny.entity.FinancialLedgerEntry;
import com.scanny.model.enums.LedgerEntryType;
import com.scanny.repository.FinancialLedgerRepository;
import com.scanny.repository.OrderRepository;
import com.scanny.security.MerchantAccessService;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.PrintWriter;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.stream.Stream;

/**
 * Merchant-facing accounting service — reads exclusively from the immutable
 * {@code financial_ledger_entries} table via {@link FinancialLedgerRepository}.
 *
 * <h3>Outstanding / unpaid amounts</h3>
 * <p>These are still read from the live {@code orders} table because unpaid orders
 * have no ledger row yet — a ledger row is only written on Paid or Refunded
 * transitions. The outstanding query on {@code OrderRepository} is intentionally
 * kept for this purpose.
 */
@Service
public class MerchantAccountingService {

    private final MerchantAccessService   merchantAccessService;
    private final FinancialLedgerRepository ledgerRepository;
    private final OrderRepository          orderRepository;

    public MerchantAccountingService(
            MerchantAccessService merchantAccessService,
            FinancialLedgerRepository ledgerRepository,
            OrderRepository orderRepository
    ) {
        this.merchantAccessService = merchantAccessService;
        this.ledgerRepository      = ledgerRepository;
        this.orderRepository       = orderRepository;
    }

    // ── Summary ───────────────────────────────────────────────────────────────

    /**
     * Aggregate financial summary sourced from the immutable ledger.
     *
     * @param businessId target business (caller must own it)
     * @param from       inclusive start instant (null = all time)
     * @param to         exclusive end instant   (null = all time)
     */
    @Transactional(readOnly = true)
    public AccountingDtos.AccountingSummary getSummary(
            String businessId,
            Instant from,
            Instant to
    ) {
        merchantAccessService.assertOwnsBusinessId(businessId);

        // ── Core aggregate from the ledger ────────────────────────────────────
        // REFUND rows carry negative values so SUM() automatically nets out.
        List<Object[]> aggList = ledgerRepository.aggregateSummary(businessId, from, to);
        Object[] agg = aggList.isEmpty() ? new Object[9] : aggList.get(0);

        long grossRevenue  = toLong(agg[0]);
        long netRevenue    = toLong(agg[1]);
        long serviceFees   = toLong(agg[2]);
        long psoFees       = toLong(agg[3]);
        long platformFees  = toLong(agg[4]);
        long totalCogs     = toLong(agg[5]);
        long paymentCount  = toLong(agg[6]);   // PAYMENT rows
        long refundCount   = toLong(agg[7]);   // REFUND rows
        long totalCount    = toLong(agg[8]);   // all rows

        long grossProfit   = netRevenue - totalCogs;
        double margin      = netRevenue > 0 ? (grossProfit * 100.0) / netRevenue : 0.0;

        // ── Payment-method breakdown ──────────────────────────────────────────
        List<Object[]> methodRows = ledgerRepository.paymentMethodBreakdown(businessId, from, to);
        long cashNet = 0, cashCount = 0, momoNet = 0, momoCount = 0;
        for (Object[] row : methodRows) {
            String method = (String) row[0];
            long   count  = toLong(row[1]);
            long   net    = toLong(row[2]);
            if ("CASH".equalsIgnoreCase(method)) {
                cashNet   = net;
                cashCount = count;
            } else {
                momoNet   += net;
                momoCount += count;
            }
        }

        // ── Outstanding from live orders (no ledger row for unpaid orders) ────
        long outstanding = orderRepository.accountingOutstandingRevenue(businessId, from, to);

        return new AccountingDtos.AccountingSummary(
                grossRevenue,
                netRevenue,
                serviceFees,
                psoFees,
                platformFees,
                totalCogs,
                grossProfit,
                Math.round(margin * 10.0) / 10.0,
                paymentCount,
                orderRepository.countUnpaidNonCancelledForBusiness(businessId, from, to),
                refundCount,
                totalCount,
                cashNet,
                cashCount,
                momoNet,
                momoCount,
                outstanding,
                from != null ? from.toString() : null,
                to   != null ? to.toString()   : null
        );
    }

    // ── Paginated ledger ──────────────────────────────────────────────────────

    /**
     * Paginated transaction ledger from the immutable ledger table.
     *
     * @param entryType optional filter: "PAYMENT" | "REFUND" | null (all)
     */
    @Transactional(readOnly = true)
    public AccountingDtos.AccountingLedgerResponse getLedger(
            String businessId,
            Instant from,
            Instant to,
            String entryType,
            int page,
            int size
    ) {
        merchantAccessService.assertOwnsBusinessId(businessId);

        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), 200);

        LedgerEntryType typeFilter = parseLedgerEntryType(entryType);

        Page<FinancialLedgerEntry> ledgerPage = ledgerRepository.ledgerPage(
                businessId, from, to, typeFilter,
                PageRequest.of(safePage, safeSize)
        );

        List<AccountingDtos.LedgerEntry> entries = ledgerPage.getContent().stream()
                .map(MerchantAccountingService::toLedgerEntry)
                .toList();

        return new AccountingDtos.AccountingLedgerResponse(
                entries,
                ledgerPage.getTotalElements(),
                safePage,
                safeSize,
                ledgerPage.getTotalPages()
        );
    }

    // ── Streaming CSV export ──────────────────────────────────────────────────

    /**
     * Streams ledger entries as CSV directly into the HTTP response, achieving
     * O(1) heap usage regardless of result-set size.
     *
     * <p><b>Mechanism:</b> Spring Data JPA's {@link Stream} return type, combined
     * with the {@code HINT_FETCH_SIZE=1000} hint on the repository query, causes
     * Hibernate to open a server-side JDBC cursor and fetch 1 000 rows at a time.
     * Each row is serialised to CSV and flushed to the client immediately —
     * the entire result set is never materialised in JVM heap.
     *
     * <p><b>Transaction:</b> read-only, kept open for the duration of streaming
     * (required — the JDBC cursor must stay open). The {@code PrintWriter} is
     * flushed every 1 000 rows to avoid buffering in the servlet container.
     *
     * @param response the raw {@link HttpServletResponse} — caller must NOT have
     *                 written to it yet
     */
    @Transactional(readOnly = true)
    public void streamCsvExport(
            String businessId,
            Instant from,
            Instant to,
            HttpServletResponse response
    ) throws IOException {
        merchantAccessService.assertOwnsBusinessId(businessId);

        response.setContentType("text/csv; charset=UTF-8");
        response.setHeader("Content-Disposition",
                "attachment; filename=\"accounting-export-" + businessId + ".csv\"");

        PrintWriter writer = response.getWriter();

        // Header row
        writer.println("Entry Type,Order ID,Settled At,Payment Method," +
                "Gross Amount,Net Amount,Service Fee,PSO Fee,Platform Fee,COGS,Profit");

        int[] rowCount = {0};

        try (Stream<FinancialLedgerEntry> stream =
                     ledgerRepository.streamForExport(businessId, from, to)) {

            stream.forEach(e -> {
                long profit = e.getNetAmount() - e.getCogsAmount();
                writer.printf("%s,%s,%s,%s,%d,%d,%d,%d,%d,%d,%d%n",
                        escapeCsv(e.getEntryType().name()),
                        escapeCsv(e.getOrderId()),
                        e.getSettledAt().toString(),
                        escapeCsv(e.getPaymentMethod()),
                        e.getGrossAmount(),
                        e.getNetAmount(),
                        e.getServiceFee(),
                        e.getPsoFee(),
                        e.getPlatformFee(),
                        e.getCogsAmount(),
                        profit
                );
                rowCount[0]++;
                // Flush to network every 1 000 rows — avoids servlet container buffering
                if (rowCount[0] % 1_000 == 0) {
                    writer.flush();
                }
            });
        }

        writer.flush();
    }

    // ── Daily revenue series ──────────────────────────────────────────────────

    /**
     * Builds a daily net-revenue sparkline series, bucketing entries into the
     * merchant's <em>local</em> calendar day using the supplied {@link ZoneId}.
     *
     * <p>Using the merchant's timezone ensures that, e.g., a sale at 23:30 EAT
     * (East Africa Time, UTC+3) is attributed to the correct business day rather
     * than falling into the previous UTC day.
     *
     * <p>Both PAYMENT and REFUND rows are included — REFUND rows carry negative
     * {@code netAmount} so the daily total automatically nets out.
     *
     * @param businessId target business (caller must own it)
     * @param days       trailing calendar days (clamped to [7, 365])
     * @param zone       the merchant's local timezone (e.g. {@code Africa/Kampala})
     */
    @Transactional(readOnly = true)
    public AccountingDtos.DailyRevenueSeries getDailyRevenueSeries(
            String businessId,
            int days,
            ZoneId zone
    ) {
        merchantAccessService.assertOwnsBusinessId(businessId);

        int safeDays = Math.min(Math.max(7, days), 365);
        LocalDate today = LocalDate.now(zone);
        Instant since   = today.minusDays(safeDays - 1L).atStartOfDay(zone).toInstant();

        List<Object[]> rows = ledgerRepository.rawPairsForDailySeries(businessId, since);

        // Bucket by merchant-local date — LinkedHashMap preserves insertion order
        LinkedHashMap<LocalDate, long[]> dateMap = new LinkedHashMap<>();
        for (Object[] row : rows) {
            Instant ts     = (Instant) row[0];
            long    payout = toLong(row[1]);
            // Map the UTC instant to the merchant's local calendar day
            LocalDate day  = ts.atZone(zone).toLocalDate();
            long[] bucket  = dateMap.computeIfAbsent(day, k -> new long[]{0L, 0L});
            bucket[0] += payout;  // net revenue (can be negative for REFUND rows)
            bucket[1] += 1;       // count
        }

        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("MMM d", Locale.ENGLISH);
        List<String>  labels = new ArrayList<>(safeDays);
        List<Long>    netRev = new ArrayList<>(safeDays);
        List<Integer> counts = new ArrayList<>(safeDays);

        for (int offset = safeDays - 1; offset >= 0; offset--) {
            LocalDate day  = today.minusDays(offset);
            labels.add(fmt.format(day));
            long[] bucket  = dateMap.getOrDefault(day, new long[]{0L, 0L});
            netRev.add(bucket[0]);
            counts.add((int) bucket[1]);
        }

        return new AccountingDtos.DailyRevenueSeries(labels, netRev, counts);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static AccountingDtos.LedgerEntry toLedgerEntry(FinancialLedgerEntry e) {
        long profit = e.getNetAmount() - e.getCogsAmount();
        return new AccountingDtos.LedgerEntry(
                e.getOrderId(),
                e.getOrderId(),           // publicId — same as orderId on ledger rows
                e.getSettledAt().toString(),
                "",                       // customerName not stored in ledger (join Order if needed)
                "",
                "",
                e.getPaymentMethod(),
                e.getEntryType().name(),  // "PAYMENT" or "REFUND"
                "",
                (int) e.getGrossAmount(),
                (int) e.getServiceFee(),
                (int) e.getNetAmount(),
                (int) e.getCogsAmount(),
                (int) profit,
                "",
                ""
        );
    }

    private static long toLong(Object value) {
        if (value == null)             return 0L;
        if (value instanceof Long l)   return l;
        if (value instanceof Number n) return n.longValue();
        return 0L;
    }

    private static LedgerEntryType parseLedgerEntryType(String raw) {
        if (raw == null || raw.isBlank()) return null;
        return switch (raw.trim().toUpperCase(Locale.ROOT)) {
            case "PAYMENT" -> LedgerEntryType.PAYMENT;
            case "REFUND"  -> LedgerEntryType.REFUND;
            default        -> null;
        };
    }

    /** Wraps a CSV field value in double-quotes and escapes embedded quotes. */
    private static String escapeCsv(String value) {
        if (value == null) return "";
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }
}
