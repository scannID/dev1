package com.scanny.accounting;

import com.scanny.accounting.entity.AccountingPeriod;
import com.scanny.accounting.entity.JournalEntry;
import com.scanny.accounting.entity.PostingFailure;
import com.scanny.accounting.repository.AccountingPeriodRepository;
import com.scanny.accounting.repository.JournalEntryRepository;
import com.scanny.accounting.repository.JournalLineRepository;
import com.scanny.accounting.repository.PostingFailureRepository;
import jakarta.transaction.Transactional;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin REST API for the double-entry accounting ledger.
 *
 * <p>Base path: {@code /api/admin/accounting}
 *
 * <p>Endpoints:
 * <ul>
 *   <li>{@code GET  /periods}                   — list all accounting periods</li>
 *   <li>{@code POST /periods/{label}/close}      — close a period (irreversible)</li>
 *   <li>{@code GET  /periods/{label}/trial-balance} — trial balance for a period</li>
 *   <li>{@code GET  /entries}                   — paginated ledger entries</li>
 *   <li>{@code GET  /entries/{id}/lines}         — journal lines for one entry</li>
 *   <li>{@code GET  /dashboard}                  — revenue by module + open period</li>
 *   <li>{@code GET  /failures}                   — dead-letter queue</li>
 *   <li>{@code POST /failures/{id}/resolve}      — mark a failure resolved</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/admin/accounting")
public class AdminAccountingController {

    private final AccountingPeriodRepository periodRepo;
    private final JournalEntryRepository     entryRepo;
    private final JournalLineRepository      lineRepo;
    private final PostingFailureRepository   failureRepo;

    public AdminAccountingController(
            AccountingPeriodRepository periodRepo,
            JournalEntryRepository entryRepo,
            JournalLineRepository lineRepo,
            PostingFailureRepository failureRepo) {
        this.periodRepo  = periodRepo;
        this.entryRepo   = entryRepo;
        this.lineRepo    = lineRepo;
        this.failureRepo = failureRepo;
    }

    // ── Periods ───────────────────────────────────────────────────────────────

    @GetMapping("/periods")
    public List<PeriodDto> listPeriods() {
        return periodRepo.findAll(Sort.by(Sort.Direction.DESC, "periodLabel"))
                .stream()
                .map(p -> new PeriodDto(
                        p.getId(), p.getPeriodLabel(), p.getStatus(),
                        p.getOpensAt().toString(), p.getClosesAt().toString(),
                        p.getClosedBy(), p.getClosedAt()))
                .toList();
    }

    @PostMapping("/periods/{label}/close")
    @Transactional
    public PeriodDto closePeriod(
            @PathVariable String label,
            @AuthenticationPrincipal Jwt jwt) {
        AccountingPeriod period = periodRepo.findByPeriodLabel(label)
                .orElseThrow(() -> new com.scanny.exception.ApiException(404, "Period not found: " + label));
        if ("CLOSED".equals(period.getStatus())) {
            throw new com.scanny.exception.ApiException(409, "Period " + label + " is already closed.");
        }
        String actor = jwt != null
                ? (jwt.getClaimAsString("email") != null ? jwt.getClaimAsString("email") : jwt.getSubject())
                : "admin";
        period.setStatus("CLOSED");
        period.setClosedBy(actor);
        period.setClosedAt(Instant.now());
        periodRepo.save(period);

        // Ensure next period exists
        String nextLabel = YearMonth.parse(label, DateTimeFormatter.ofPattern("yyyy-MM"))
                .plusMonths(1).format(DateTimeFormatter.ofPattern("yyyy-MM"));
        if (periodRepo.findByPeriodLabel(nextLabel).isEmpty()) {
            LocalDate nextOpen  = LocalDate.parse(nextLabel + "-01");
            LocalDate nextClose = nextOpen.withDayOfMonth(nextOpen.lengthOfMonth());
            AccountingPeriod next = new AccountingPeriod();
            next.setPeriodLabel(nextLabel);
            next.setOpensAt(nextOpen);
            next.setClosesAt(nextClose);
            periodRepo.save(next);
        }
        return new PeriodDto(period.getId(), period.getPeriodLabel(), period.getStatus(),
                period.getOpensAt().toString(), period.getClosesAt().toString(),
                period.getClosedBy(), period.getClosedAt());
    }

    // ── Trial balance ─────────────────────────────────────────────────────────

    @GetMapping("/periods/{label}/trial-balance")
    public TrialBalanceResponse trialBalance(@PathVariable String label) {
        List<Object[]> rows = entryRepo.trialBalance(label);
        List<TrialBalanceLine> lines = rows.stream().map(r -> new TrialBalanceLine(
                (String)  r[0],   // code
                (String)  r[1],   // name
                (String)  r[2],   // accountType
                (String)  r[3],   // normalBalance
                toLong(r[4]),     // totalDebits
                toLong(r[5])      // totalCredits
        )).toList();
        long totalDebits  = lines.stream().mapToLong(TrialBalanceLine::totalDebits).sum();
        long totalCredits = lines.stream().mapToLong(TrialBalanceLine::totalCredits).sum();
        return new TrialBalanceResponse(label, lines, totalDebits, totalCredits,
                totalDebits == totalCredits ? "BALANCED" : "UNBALANCED");
    }

    // ── Journal entries ───────────────────────────────────────────────────────

    @GetMapping("/entries")
    public EntryPageResponse listEntries(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false)    String module,
            @RequestParam(required = false)    String from,
            @RequestParam(required = false)    String to) {

        int safePage = Math.max(0, page);
        int safeSize = Math.min(200, Math.max(1, size));
        PageRequest pr = PageRequest.of(safePage, safeSize,
                Sort.by(Sort.Direction.DESC, "entryDate", "id"));

        LocalDate fromDate = from != null ? LocalDate.parse(from) : LocalDate.now().withDayOfMonth(1);
        LocalDate toDate   = to   != null ? LocalDate.parse(to)   : LocalDate.now();

        Page<JournalEntry> result = module != null
                ? entryRepo.findBySourceModuleAndEntryDateBetweenOrderByEntryDateAscIdAsc(module, fromDate, toDate, pr)
                : entryRepo.findByEntryDateBetweenOrderByEntryDateAscIdAsc(fromDate, toDate, pr);

        List<EntryDto> dtos = result.getContent().stream().map(e -> new EntryDto(
                e.getId(), e.getEntryDate().toString(), e.getPeriodLabel(),
                e.getSourceModule(), e.getSourceEventType(), e.getSourceRecordId(),
                e.getDescription(), e.getStatus(),
                e.getDimMerchantId(), e.getDimPropertyId(),
                e.getDimTenantId(), e.getDimEventId(), e.getDimPaymentMethod(),
                e.getPostedAt())).toList();

        return new EntryPageResponse(dtos, result.getTotalElements(),
                result.getTotalPages(), safePage, safeSize);
    }

    @GetMapping("/entries/{id}/lines")
    public List<LineDto> getLines(@PathVariable Long id) {
        return lineRepo.findByEntryIdOrderById(id).stream().map(l -> new LineDto(
                l.getId(), l.getAccount().getCode(), l.getAccount().getName(),
                l.getSide(), l.getAmount(), l.getMemo())).toList();
    }

    // ── Dashboard ─────────────────────────────────────────────────────────────

    @GetMapping("/dashboard")
    public DashboardDto dashboard() {
        String currentPeriod = YearMonth.now().format(DateTimeFormatter.ofPattern("yyyy-MM"));
        long pendingFailures = failureRepo.countByStatus("PENDING");

        // Revenue by module for the current month
        LocalDate from = LocalDate.now().withDayOfMonth(1);
        LocalDate to   = LocalDate.now();
        List<Object[]> revenueRows = entryRepo.revenueByModule(from, to);
        List<Map<String, Object>> revenueByModule = revenueRows.stream().map(r ->
            Map.<String, Object>of("module", r[0], "revenue", toLong(r[1]))
        ).toList();

        // Period status
        List<AccountingPeriod> openPeriods = periodRepo.findOpenPeriods();
        String periodStatus = openPeriods.isEmpty() ? "NO_OPEN_PERIOD" : "OPEN";

        return new DashboardDto(currentPeriod, periodStatus, pendingFailures, revenueByModule);
    }

    // ── Dead-letter queue ─────────────────────────────────────────────────────

    @GetMapping("/failures")
    public FailurePageResponse listFailures(
            @RequestParam(defaultValue = "PENDING") String status,
            @RequestParam(defaultValue = "0")       int page,
            @RequestParam(defaultValue = "50")      int size) {
        PageRequest pr = PageRequest.of(page, Math.min(200, size),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<PostingFailure> result = failureRepo.findByStatusOrderByCreatedAtDesc(status, pr);
        List<FailureDto> dtos = result.getContent().stream().map(f -> new FailureDto(
                f.getId(), f.getSourceModule(), f.getSourceEventType(),
                f.getSourceEventId(), f.getLastError(), f.getRetryCount(),
                f.getStatus(), f.getCreatedAt())).toList();
        return new FailurePageResponse(dtos, result.getTotalElements(),
                failureRepo.countByStatus("PENDING"));
    }

    @PostMapping("/failures/{id}/resolve")
    @Transactional
    public FailureDto resolveFailure(@PathVariable Long id,
            @RequestBody(required = false) Map<String, String> body) {
        PostingFailure f = failureRepo.findById(id)
                .orElseThrow(() -> new com.scanny.exception.ApiException(404, "Failure not found: " + id));
        f.setStatus("RESOLVED");
        f.setUpdatedAt(Instant.now());
        failureRepo.save(f);
        return new FailureDto(f.getId(), f.getSourceModule(), f.getSourceEventType(),
                f.getSourceEventId(), f.getLastError(), f.getRetryCount(),
                f.getStatus(), f.getCreatedAt());
    }

    // ── DTOs ─────────────────────────────────────────────────────────────────

    record PeriodDto(Long id, String periodLabel, String status,
                     String opensAt, String closesAt,
                     String closedBy, Instant closedAt) {}

    record TrialBalanceLine(String code, String name, String accountType,
                            String normalBalance, long totalDebits, long totalCredits) {}

    record TrialBalanceResponse(String periodLabel, List<TrialBalanceLine> lines,
                                long totalDebits, long totalCredits, String balanceStatus) {}

    record EntryDto(Long id, String entryDate, String periodLabel,
                    String sourceModule, String sourceEventType, String sourceRecordId,
                    String description, String status,
                    String dimMerchantId, String dimPropertyId,
                    String dimTenantId, String dimEventId, String dimPaymentMethod,
                    Instant postedAt) {}

    record EntryPageResponse(List<EntryDto> entries, long total,
                             int totalPages, int page, int size) {}

    record LineDto(Long id, String accountCode, String accountName,
                   String side, long amount, String memo) {}

    record DashboardDto(String currentPeriod, String periodStatus,
                        long pendingFailures,
                        List<Map<String, Object>> revenueByModule) {}

    record FailureDto(Long id, String sourceModule, String sourceEventType,
                      String sourceEventId, String lastError, int retryCount,
                      String status, Instant createdAt) {}

    record FailurePageResponse(List<FailureDto> failures, long total, long pendingCount) {}

    // ── Util ──────────────────────────────────────────────────────────────────

    private static long toLong(Object v) {
        if (v == null) return 0L;
        if (v instanceof Number n) return n.longValue();
        try { return Long.parseLong(v.toString()); } catch (Exception e) { return 0L; }
    }
}
