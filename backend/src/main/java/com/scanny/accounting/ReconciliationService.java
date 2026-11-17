package com.scanny.accounting;

import com.scanny.accounting.repository.JournalEntryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

/**
 * Daily reconciliation job between the double-entry ledger and the operational 
 * financial_ledger_entries table.
 *
 * <h3>Purpose</h3>
 * Koddly maintains two parallel ledgers:
 * <ul>
 *   <li><b>journal_entries</b> — double-entry accounting ledger (IFRS-compliant)
 *   <li><b>financial_ledger_entries</b> — operational ledger (written by LedgerWriterService)
 * </ul>
 *
 * <p>These are written <b>independently</b> by different services in separate transactions.
 * When one fails (network timeout, DB lock, etc.) the other may succeed → <b>drift</b>.
 *
 * <h3>Reconciliation Process</h3>
 * <ol>
 *   <li>Query both ledgers for yesterday's entries (posting date)
 *   <li>Match on (sourceModule, sourceRecordId, amount)
 *   <li>Report mismatches:
 *       <ul>
 *         <li>Orphaned financial_ledger_entries (no corresponding journal_entry)
 *         <li>Orphaned journal_entries (no corresponding financial_ledger)
 *         <li>Amount discrepancies (same record ID but different amounts)
 *       </ul>
 *   <li>If drift detected: log ERROR + send alert (future: Slack/email)
 *   <li>Admin can review via {@code /api/admin/accounting/failures} and retry
 * </ol>
 *
 * <h3>Schedule</h3>
 * Runs daily at 2:00 AM UTC (cron: {@code 0 0 2 * * *}).
 * Reconciles T-1 (yesterday) to allow for late-arriving events.
 *
 * <h3>Future Enhancements</h3>
 * <ul>
 *   <li>Automated retry of orphaned entries (if PostingFailure exists)
 *   <li>Slack/email alerts for drift exceeding threshold
 *   <li>Dashboard widget showing reconciliation health score
 *   <li>Reconciliation history table (audit trail)
 * </ul>
 */
@Service
public class ReconciliationService {

    private static final Logger log = LoggerFactory.getLogger(ReconciliationService.class);

    private final JdbcTemplate           jdbc;
    private final JournalEntryRepository journalRepo;

    public ReconciliationService(JdbcTemplate jdbc, JournalEntryRepository journalRepo) {
        this.jdbc        = jdbc;
        this.journalRepo = journalRepo;
    }

    /**
     * Scheduled reconciliation job: runs daily at 2:00 AM UTC.
     * Reconciles T-1 (yesterday) between journal_entries and financial_ledger_entries.
     */
    @Scheduled(cron = "0 0 2 * * *", zone = "UTC")
    public void reconcileDailyLedgers() {
        LocalDate yesterday = LocalDate.now(ZoneOffset.UTC).minusDays(1);
        log.info("[Reconciliation] Starting daily reconciliation for {}", yesterday);
        
        try {
            ReconciliationResult result = reconcile(yesterday);
            
            if (result.isBalanced()) {
                log.info("[Reconciliation] ✓ PASSED for {} — no drift detected. " +
                         "journal_entries={}, financial_ledger_entries={}, matched={}",
                         yesterday, result.journalCount, result.financialCount, result.matchedCount);
            } else {
                log.error("[Reconciliation] ✗ FAILED for {} — DRIFT DETECTED!\n" +
                          "  journal_entries: {}\n" +
                          "  financial_ledger_entries: {}\n" +
                          "  matched: {}\n" +
                          "  orphaned_journal: {}\n" +
                          "  orphaned_financial: {}\n" +
                          "  amount_mismatches: {}\n" +
                          "→ Review /api/admin/accounting/failures and retry failed postings.",
                          yesterday, result.journalCount, result.financialCount, result.matchedCount,
                          result.orphanedJournal.size(), result.orphanedFinancial.size(),
                          result.amountMismatches.size());
                
                // Log details of orphaned entries
                if (!result.orphanedJournal.isEmpty()) {
                    log.warn("[Reconciliation] Orphaned journal_entries (no match in financial_ledger): {}",
                             result.orphanedJournal);
                }
                if (!result.orphanedFinancial.isEmpty()) {
                    log.warn("[Reconciliation] Orphaned financial_ledger_entries (no match in journal): {}",
                             result.orphanedFinancial);
                }
                if (!result.amountMismatches.isEmpty()) {
                    log.warn("[Reconciliation] Amount mismatches: {}", result.amountMismatches);
                }
                
                // TODO: Send alert to Slack/email/PagerDuty
            }
        } catch (Exception e) {
            log.error("[Reconciliation] Job failed for {}: {}", yesterday, e.getMessage(), e);
        }
    }

    /**
     * Reconciles a specific date between both ledgers.
     * Exposed as public method for manual/on-demand reconciliation.
     *
     * @param date the posting date to reconcile
     * @return reconciliation result with match/drift details
     */
    public ReconciliationResult reconcile(LocalDate date) {
        // ── 1. Query journal_entries for the date ───────────────────────────────
        String journalSql = """
            SELECT source_module, source_record_id, 
                   SUM(CASE WHEN jl.side = 'DEBIT' THEN jl.amount ELSE 0 END) as total_debit,
                   SUM(CASE WHEN jl.side = 'CREDIT' THEN jl.amount ELSE 0 END) as total_credit
              FROM accounting.journal_entries je
              JOIN accounting.journal_lines jl ON jl.entry_id = je.id
             WHERE je.entry_date = ?
               AND je.status = 'POSTED'
          GROUP BY source_module, source_record_id
        """;
        List<Map<String, Object>> journalEntries = jdbc.queryForList(journalSql, date);

        // ── 2. Query financial_ledger_entries for the date ──────────────────────
        // Note: financial_ledger_entries has different schema; adjust field names as needed
        String financialSql = """
            SELECT module, record_id, 
                   SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_ugx ELSE 0 END) as total_debit,
                   SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_ugx ELSE 0 END) as total_credit
              FROM financial_ledger_entries
             WHERE DATE(created_at) = ?
          GROUP BY module, record_id
        """;
        List<Map<String, Object>> financialEntries = jdbc.queryForList(financialSql, date);

        // ── 3. Match entries and detect drift ───────────────────────────────────
        ReconciliationResult result = new ReconciliationResult(date);
        result.journalCount = journalEntries.size();
        result.financialCount = financialEntries.size();

        // Use Set for O(1) removal to avoid ConcurrentModificationException
        java.util.Set<Map<String, Object>> financialSet = new java.util.HashSet<>(financialEntries);

        for (Map<String, Object> je : journalEntries) {
            String module = (String) je.get("source_module");
            String recordId = (String) je.get("source_record_id");
            long debit = toLong(je.get("total_debit"));
            long credit = toLong(je.get("total_credit"));

            // Find matching financial entry
            Map<String, Object> match = financialSet.stream()
                .filter(fe -> module.equals(fe.get("module")) && recordId.equals(fe.get("record_id")))
                .findFirst()
                .orElse(null);

            if (match == null) {
                result.orphanedJournal.add(String.format("%s/%s (D:%d C:%d)", 
                                                         module, recordId, debit, credit));
            } else {
                long fDebit = toLong(match.get("total_debit"));
                long fCredit = toLong(match.get("total_credit"));
                if (debit == fDebit && credit == fCredit) {
                    result.matchedCount++;
                } else {
                    result.amountMismatches.add(String.format(
                        "%s/%s — journal(D:%d C:%d) vs financial(D:%d C:%d)",
                        module, recordId, debit, credit, fDebit, fCredit));
                }
                financialSet.remove(match); // Safe removal from Set
            }
        }

        // Remaining financial entries are orphaned (no match in journal)
        for (Map<String, Object> fe : financialSet) {
            String module = (String) fe.get("module");
            String recordId = (String) fe.get("record_id");
            long debit = toLong(fe.get("total_debit"));
            long credit = toLong(fe.get("total_credit"));
            result.orphanedFinancial.add(String.format("%s/%s (D:%d C:%d)", 
                                                       module, recordId, debit, credit));
        }

        return result;
    }

    /**
     * Manual reconciliation endpoint (can be exposed via REST controller if needed).
     * Useful for testing or on-demand reconciliation from admin console.
     */
    public ReconciliationResult reconcileRange(LocalDate from, LocalDate to) {
        ReconciliationResult aggregate = new ReconciliationResult(from);
        for (LocalDate date = from; !date.isAfter(to); date = date.plusDays(1)) {
            ReconciliationResult daily = reconcile(date);
            aggregate.journalCount += daily.journalCount;
            aggregate.financialCount += daily.financialCount;
            aggregate.matchedCount += daily.matchedCount;
            aggregate.orphanedJournal.addAll(daily.orphanedJournal);
            aggregate.orphanedFinancial.addAll(daily.orphanedFinancial);
            aggregate.amountMismatches.addAll(daily.amountMismatches);
        }
        return aggregate;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helper
    // ─────────────────────────────────────────────────────────────────────────

    private long toLong(Object v) {
        if (v == null) return 0L;
        if (v instanceof Number n) return n.longValue();
        try { return Long.parseLong(v.toString()); } catch (Exception e) { return 0L; }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Result DTO
    // ─────────────────────────────────────────────────────────────────────────

    public static class ReconciliationResult {
        public final LocalDate date;
        public int journalCount = 0;
        public int financialCount = 0;
        public int matchedCount = 0;
        public final List<String> orphanedJournal = new java.util.ArrayList<>();
        public final List<String> orphanedFinancial = new java.util.ArrayList<>();
        public final List<String> amountMismatches = new java.util.ArrayList<>();

        public ReconciliationResult(LocalDate date) {
            this.date = date;
        }

        public boolean isBalanced() {
            return orphanedJournal.isEmpty() 
                && orphanedFinancial.isEmpty() 
                && amountMismatches.isEmpty();
        }
    }
}
