package com.scanny.controller;

import com.scanny.dto.AccountingDtos;
import com.scanny.service.MerchantAccountingService;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;

/**
 * Merchant-facing accounting endpoints.
 *
 * <p>All paths are under {@code /api/businesses/{businessId}/accounting/…} and are
 * protected by the existing {@code /api/businesses/**} security rule
 * (MERCHANT, STAFF_MANAGER, or STAFF role). Ownership is enforced in the service
 * via {@link com.scanny.security.MerchantAccessService#assertOwnsBusinessId}.
 *
 * <h3>Endpoints</h3>
 * <ul>
 *   <li>{@code GET /summary}       — aggregate KPI card data</li>
 *   <li>{@code GET /ledger}        — paginated transaction ledger</li>
 *   <li>{@code GET /daily-revenue} — sparkline series</li>
 *   <li>{@code GET /export}        — streaming CSV (O(1) memory)</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/businesses/{businessId}/accounting")
public class MerchantAccountingController {

    private final MerchantAccountingService accountingService;

    public MerchantAccountingController(MerchantAccountingService accountingService) {
        this.accountingService = accountingService;
    }

    // ── Summary ───────────────────────────────────────────────────────────────

    /**
     * GET /api/businesses/{businessId}/accounting/summary
     *
     * <p>Query params (all optional):
     * <ul>
     *   <li>{@code from}     – ISO date ({@code 2025-01-01}) or ISO-8601 instant, inclusive</li>
     *   <li>{@code to}       – ISO date or ISO-8601 instant, exclusive</li>
     *   <li>{@code timezone} – IANA timezone ID (e.g. {@code Africa/Kampala}); defaults to UTC</li>
     * </ul>
     */
    @GetMapping("/summary")
    public ResponseEntity<AccountingDtos.AccountingSummary> getSummary(
            @PathVariable String businessId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false, defaultValue = "UTC") String timezone
    ) {
        ZoneId zone         = parseZone(timezone);
        Instant fromInstant = parseInstant(from, true,  zone);
        Instant toInstant   = parseInstant(to,   false, zone);
        return ResponseEntity.ok(accountingService.getSummary(businessId, fromInstant, toInstant));
    }

    // ── Paginated ledger ──────────────────────────────────────────────────────

    /**
     * GET /api/businesses/{businessId}/accounting/ledger
     *
     * <p>Query params:
     * <ul>
     *   <li>{@code from}      – inclusive start (optional)</li>
     *   <li>{@code to}        – exclusive end (optional)</li>
     *   <li>{@code entryType} – {@code PAYMENT | REFUND} (optional, default all)</li>
     *   <li>{@code page}      – 0-indexed, default 0</li>
     *   <li>{@code size}      – default 50, max 200</li>
     *   <li>{@code timezone}  – IANA zone for date parsing, default UTC</li>
     * </ul>
     */
    @GetMapping("/ledger")
    public ResponseEntity<AccountingDtos.AccountingLedgerResponse> getLedger(
            @PathVariable String businessId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String entryType,
            @RequestParam(defaultValue = "0")   int page,
            @RequestParam(defaultValue = "50")  int size,
            @RequestParam(required = false, defaultValue = "UTC") String timezone
    ) {
        ZoneId zone         = parseZone(timezone);
        Instant fromInstant = parseInstant(from, true,  zone);
        Instant toInstant   = parseInstant(to,   false, zone);
        return ResponseEntity.ok(
                accountingService.getLedger(businessId, fromInstant, toInstant, entryType, page, size)
        );
    }

    // ── Daily revenue series ──────────────────────────────────────────────────

    /**
     * GET /api/businesses/{businessId}/accounting/daily-revenue
     *
     * <p>Query params:
     * <ul>
     *   <li>{@code days}     – trailing calendar days (default 30, range 7–365)</li>
     *   <li>{@code timezone} – IANA zone used to bucket entries into local days
     *       (e.g. {@code Africa/Kampala}); defaults to UTC</li>
     * </ul>
     */
    @GetMapping("/daily-revenue")
    public ResponseEntity<AccountingDtos.DailyRevenueSeries> getDailyRevenue(
            @PathVariable String businessId,
            @RequestParam(defaultValue = "30") int days,
            @RequestParam(required = false, defaultValue = "UTC") String timezone
    ) {
        ZoneId zone = parseZone(timezone);
        return ResponseEntity.ok(accountingService.getDailyRevenueSeries(businessId, days, zone));
    }

    // ── Streaming CSV export ──────────────────────────────────────────────────

    /**
     * GET /api/businesses/{businessId}/accounting/export
     *
     * <p>Streams the full ledger as a CSV file with O(1) heap usage. The HTTP
     * response is written directly from a server-side JDBC cursor — no
     * materialisation in JVM memory.
     *
     * <p>Query params:
     * <ul>
     *   <li>{@code from}     – inclusive start (optional)</li>
     *   <li>{@code to}       – exclusive end (optional)</li>
     *   <li>{@code timezone} – IANA zone for date parsing, default UTC</li>
     * </ul>
     *
     * <p>Returns {@code 200 text/csv} with a
     * {@code Content-Disposition: attachment} header.
     */
    @GetMapping("/export")
    public void exportCsv(
            @PathVariable String businessId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false, defaultValue = "UTC") String timezone,
            HttpServletResponse response
    ) throws IOException {
        ZoneId zone         = parseZone(timezone);
        Instant fromInstant = parseInstant(from, true,  zone);
        Instant toInstant   = parseInstant(to,   false, zone);
        accountingService.streamCsvExport(businessId, fromInstant, toInstant, response);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Parses a query-string date/instant value into an {@link Instant}.
     *
     * <p>Accepts:
     * <ul>
     *   <li>Full ISO-8601:  {@code 2025-01-01T00:00:00Z}</li>
     *   <li>Plain date:     {@code 2025-01-01} — converted to start-of-day or
     *       start-of-next-day in the given zone depending on {@code startOfDay}</li>
     * </ul>
     */
    private static Instant parseInstant(String raw, boolean startOfDay, ZoneId zone) {
        if (raw == null || raw.isBlank()) return null;
        // Try full ISO-8601 instant first
        try {
            return Instant.parse(raw.endsWith("Z") ? raw : raw + "Z");
        } catch (Exception ignored) { /* fall through */ }
        // Try plain date
        try {
            LocalDate date = LocalDate.parse(raw);
            return startOfDay
                    ? date.atStartOfDay(zone).toInstant()
                    : date.plusDays(1).atStartOfDay(zone).toInstant();
        } catch (Exception ignored) {
            return null;
        }
    }

    /**
     * Parses an IANA timezone string, falling back to UTC on invalid input.
     * Prevents a bad {@code timezone} param from causing a 500.
     */
    private static ZoneId parseZone(String raw) {
        if (raw == null || raw.isBlank()) return ZoneOffset.UTC;
        try {
            return ZoneId.of(raw);
        } catch (Exception ignored) {
            return ZoneOffset.UTC;
        }
    }
}
