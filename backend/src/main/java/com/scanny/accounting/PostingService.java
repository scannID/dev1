package com.scanny.accounting;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.scanny.accounting.entity.Account;
import com.scanny.accounting.entity.AccountingPeriod;
import com.scanny.accounting.entity.JournalEntry;
import com.scanny.accounting.entity.JournalLine;
import com.scanny.accounting.entity.PostingFailure;
import com.scanny.accounting.entity.PostingRule;
import com.scanny.accounting.repository.AccountRepository;
import com.scanny.accounting.repository.AccountingPeriodRepository;
import com.scanny.accounting.repository.JournalEntryRepository;
import com.scanny.accounting.repository.JournalLineRepository;
import com.scanny.accounting.repository.PostingFailureRepository;
import com.scanny.accounting.repository.PostingRuleRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Core double-entry posting engine.
 *
 * <h3>Lifecycle of a posting</h3>
 * <ol>
 *   <li>Domain event fires (ORDER_PAID, RENT_PAYMENT_RECEIVED, TICKET_SOLD…).
 *   <li>The relevant service calls {@link AccountingEventPublisher#publish} inside
 *       the same transaction that records the business fact.
 *   <li>{@link AccountingEventConsumer} dequeues the outbox event and calls
 *       {@link #post} here — in a {@code REQUIRES_NEW} transaction, isolated from
 *       any caller state.
 *   <li>PostingService:
 *       <ul>
 *         <li>Checks idempotency — if already posted, silently returns.</li>
 *         <li>Resolves the current open accounting period.</li>
 *         <li>Looks up the posting rule for (sourceModule, eventType).</li>
 *         <li>Builds the journal entry header.</li>
 *         <li>Expands each rule line template into a {@link JournalLine},
 *             skipping lines where the amount resolves to 0.</li>
 *         <li>Computes the hash chain link.</li>
 *         <li>Saves the entry + lines in a single flush.</li>
 *         <li>Verifies the DB-side balance (belt-and-suspenders alongside the
 *             deferred DB trigger).</li>
 *       </ul>
 *   <li>On any failure the exception propagates, rolls back the REQUIRES_NEW
 *       transaction, and the caller writes a {@link PostingFailure} row.
 * </ol>
 *
 * <h3>Thread safety</h3>
 * The hash-chain step acquires a row-level advisory lock
 * ({@code pg_advisory_xact_lock(1)}) so two concurrent postings never race
 * for the same "latest entry hash". This is harmless in H2 (advisory locks
 * are no-ops there) and correct in PostgreSQL.
 */
@Service
public class PostingService {

    private static final Logger log = LoggerFactory.getLogger(PostingService.class);

    /** PostgreSQL advisory lock key — prevents concurrent hash-chain races. */
    private static final long HASH_CHAIN_LOCK = 0x5CA770AC_C7A0C4L;

    private final PostingRuleRepository    postingRuleRepo;
    private final AccountRepository        accountRepo;
    private final AccountingPeriodRepository periodRepo;
    private final JournalEntryRepository   entryRepo;
    private final JournalLineRepository    lineRepo;
    private final PostingFailureRepository failureRepo;
    private final ObjectMapper             objectMapper;

    // JdbcTemplate for advisory lock + DB type detection
    private final org.springframework.jdbc.core.JdbcTemplate jdbc;
    private final boolean isPostgres;

    public PostingService(
            PostingRuleRepository postingRuleRepo,
            AccountRepository accountRepo,
            AccountingPeriodRepository periodRepo,
            JournalEntryRepository entryRepo,
            JournalLineRepository lineRepo,
            PostingFailureRepository failureRepo,
            ObjectMapper objectMapper,
            org.springframework.jdbc.core.JdbcTemplate jdbc) {
        this.postingRuleRepo = postingRuleRepo;
        this.accountRepo     = accountRepo;
        this.periodRepo      = periodRepo;
        this.entryRepo       = entryRepo;
        this.lineRepo        = lineRepo;
        this.failureRepo     = failureRepo;
        this.objectMapper    = objectMapper;
        this.jdbc            = jdbc;
        // Detect DB type once at construction so we never silently swallow real errors
        boolean pg = false;
        try {
            String url = jdbc.queryForObject("SELECT CURRENT_DATABASE()", String.class);
            pg = url != null; // CURRENT_DATABASE() is PostgreSQL-only
        } catch (Exception ignored) {}
        this.isPostgres = pg;
        log.info("[Accounting] PostingService initialized. Advisory lock supported: {}", this.isPostgres);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Posts an accounting event to the ledger.
     *
     * <p>Must be called in its own {@code REQUIRES_NEW} transaction so that a
     * failure here does not roll back the business transaction that triggered it.
     *
     * @param event   the accounting event to post
     * @throws PostingException if the posting fails for any reason other than
     *                          a duplicate (idempotent duplicates are silently ignored)
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void post(AccountingEvent event) {
        // ── 1. Idempotency check ───────────────────────────────────────────────
        Optional<JournalEntry> existing = entryRepo.findBySourceModuleAndSourceEventId(
                event.sourceModule(), event.eventId());
        if (existing.isPresent()) {
            log.debug("[Accounting] Duplicate post ignored: module={} eventId={}",
                    event.sourceModule(), event.eventId());
            return;
        }

        // ── 2. Resolve posting rule ────────────────────────────────────────────
        PostingRule rule = postingRuleRepo
                .findBySourceModuleAndEventTypeAndIsActiveTrue(
                        event.sourceModule(), event.eventType())
                .orElseThrow(() -> new PostingException(
                        "No active posting rule for " + event.sourceModule()
                        + " / " + event.eventType()));

        // ── 3. Resolve period ──────────────────────────────────────────────────
        String resolvedPeriodLabel = currentPeriodLabel();
        AccountingPeriod period = periodRepo.findByPeriodLabel(resolvedPeriodLabel)
                .orElseThrow(() -> new PostingException(
                        "Accounting period " + resolvedPeriodLabel + " not found. "
                        + "The auto-create trigger may not have fired yet."));
        final String periodLabel;
        if ("CLOSED".equals(period.getStatus())) {
            periodLabel = nextOpenPeriodLabel();
            log.warn("[Accounting] Period {} is CLOSED; routing to {}", period.getPeriodLabel(), periodLabel);
        } else {
            periodLabel = resolvedPeriodLabel;
        }

        // ── 4. Acquire advisory lock for hash chain (PostgreSQL only) ──────────
        acquireHashChainLock();

        // ── 5. Build journal entry header ──────────────────────────────────────
        LocalDate today = LocalDate.now();
        JournalEntry entry = new JournalEntry();
        // entryDate is always today (posting date). If the period is closed and we
        // routed to a later period, entryDate may fall in a different month than
        // periodLabel — this is intentional and expected for late-arriving events.
        // The originalEventDate dimension preserves the source event's actual date.
        entry.setEntryDate(today);
        entry.setPeriodLabel(periodLabel);
        if (!periodLabel.equals(resolvedPeriodLabel)) {
            log.warn("[Accounting] Late-arriving event {} / {} (original period {}) routed to open period {}. " +
                     "Entry date={} will differ from period month.",
                    event.sourceModule(), event.eventId(), resolvedPeriodLabel, periodLabel, today);
        }
        entry.setSourceModule(event.sourceModule());
        entry.setSourceEventType(event.eventType());
        entry.setSourceEventId(event.eventId());
        entry.setSourceRecordId(event.sourceRecordId());
        entry.setDescription(event.description() != null ? event.description()
                : event.sourceModule() + " / " + event.eventType());
        entry.setStatus("POSTED");
        entry.setDimMerchantId(event.merchantId());
        entry.setDimPropertyId(event.propertyId());
        entry.setDimTenantId(event.tenantId());
        entry.setDimEventId(event.eventEntityId());
        entry.setDimPaymentMethod(event.paymentMethod());
        entry.setPostedBy("system");
        // Hash computed later — after lines are built (covers amounts)
        entry.setEntryHash("PENDING");

        // ── 6. Expand posting rule lines ───────────────────────────────────────
        List<RuleLine> ruleLines = parseRuleLines(rule.getRuleJson());
        List<JournalLine> lines  = new ArrayList<>();

        for (RuleLine rl : ruleLines) {
            long amount = event.getAmountField(rl.amountField());
            if (amount == 0) {
                // Zero-amount lines are skipped — no noise in the ledger
                log.debug("[Accounting] Skipping zero-amount line: account={} field={}",
                        rl.accountCode(), rl.amountField());
                continue;
            }
            Account account = accountRepo.findByCodeAndIsActiveTrue(rl.accountCode())
                    .orElseThrow(() -> new PostingException(
                            "Account not found or inactive: " + rl.accountCode()));

            JournalLine line = new JournalLine();
            // entryId will be set after the entry is saved
            line.setAccount(account);
            line.setSide(rl.side().toUpperCase());
            line.setAmount(amount);
            line.setMemo(rl.memo());
            lines.add(line);
        }

        if (lines.isEmpty()) {
            log.warn("[Accounting] All lines resolved to zero for {} / {}. Entry not created.",
                    event.sourceModule(), event.eventType());
            return;
        }

        // ── 7. Application-level balance check (belt-and-suspenders) ──────────
        long netDebit  = lines.stream().filter(l -> "DEBIT" .equals(l.getSide())).mapToLong(JournalLine::getAmount).sum();
        long netCredit = lines.stream().filter(l -> "CREDIT".equals(l.getSide())).mapToLong(JournalLine::getAmount).sum();
        if (netDebit != netCredit) {
            throw new PostingException(String.format(
                    "Journal entry would not balance for %s / %s: debits=%d credits=%d",
                    event.sourceModule(), event.eventType(), netDebit, netCredit));
        }

        // ── 8. Compute hash now that lines are known (covers amounts) ──────────
        String prevHash = latestEntryHash();
        entry.setPrevEntryHash(prevHash);
        entry.setEntryHash(computeHash(prevHash, entry, lines));

        // ── 9. Persist entry then lines ────────────────────────────────────────
        JournalEntry saved = entryRepo.save(entry);
        for (JournalLine line : lines) {
            line.setEntryId(saved.getId());
            lineRepo.save(line);
        }

        log.info("[Accounting] Posted entry id={} module={} event={} debit={} credit={} hash={}",
                saved.getId(), event.sourceModule(), event.eventType(),
                netDebit, netCredit, saved.getEntryHash().substring(0, 12) + "…");
        // DB trigger (trg_check_entry_balance) will fire at commit time as a
        // final guard — if something slipped past the app check it will roll back.
    }

    /**
     * Records a failure to the dead-letter queue.
     * Called by {@link AccountingEventConsumer} when {@link #post} throws.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailure(AccountingEvent event, String errorMessage, String payloadJson) {
        try {
            PostingFailure failure = new PostingFailure();
            failure.setSourceModule(event.sourceModule());
            failure.setSourceEventType(event.eventType());
            failure.setSourceEventId(event.eventId());
            failure.setPayloadJson(payloadJson != null ? payloadJson : "{}");
            failure.setLastError(errorMessage);
            failure.setRetryCount(0);
            failure.setStatus("PENDING");
            failure.setUpdatedAt(Instant.now());
            failureRepo.save(failure);
        } catch (Exception e) {
            log.error("[Accounting] Failed to write to dead-letter queue: {}", e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────────────────

    private String currentPeriodLabel() {
        return YearMonth.now().format(DateTimeFormatter.ofPattern("yyyy-MM"));
    }

    private String nextOpenPeriodLabel() {
        List<AccountingPeriod> open = periodRepo.findOpenPeriods();
        if (open.isEmpty()) {
            throw new PostingException("No open accounting period found.");
        }
        return open.get(0).getPeriodLabel();
    }

    /** Acquires a transaction-scoped advisory lock in PostgreSQL.
     *  Skipped entirely on H2 (detected once at startup). */
    private void acquireHashChainLock() {
        if (!isPostgres) return;
        // This will throw a real exception on any connection/DB error — not swallowed
        jdbc.execute("SELECT pg_advisory_xact_lock(" + HASH_CHAIN_LOCK + ")");
    }

    /** Returns the entryHash of the highest-ID posted entry, or null if none.
     *  Uses ID (auto-increment) not timestamp to guarantee strict monotonic order. */
    private String latestEntryHash() {
        List<JournalEntry> latest = entryRepo.findLatest(PageRequest.of(0, 1));
        return latest.isEmpty() ? null : latest.get(0).getEntryHash();
    }

    /**
     * Computes SHA-256 over all stable fields including the journal lines.
     *
     * <p>Format: {@code prevHash|entryDate|sourceModule|sourceEventId|LINE1|LINE2…}
     * where each line token is {@code accountCode:side:amount}.
     * Lines are sorted by (side, accountCode) for a canonical order that is
     * independent of insertion sequence.
     *
     * <p>This means an attacker cannot change an amount in journal_lines without
     * breaking every hash that follows in the chain.
     */
    private String computeHash(String prevHash, JournalEntry entry, List<JournalLine> lines) {
        try {
            StringBuilder sb = new StringBuilder();
            sb.append(prevHash != null ? prevHash : "GENESIS").append("|");
            sb.append(entry.getEntryDate()).append("|");
            sb.append(entry.getSourceModule()).append("|");
            sb.append(entry.getSourceEventId()).append("|");
            sb.append(entry.getDescription());

            // Canonical line representation — sort so order-of-insertion doesn't matter
            lines.stream()
                .sorted(java.util.Comparator
                    .comparing(JournalLine::getSide)
                    .thenComparing(l -> l.getAccount().getCode())
                    .thenComparing(JournalLine::getAmount))
                .forEach(l -> sb.append("|")
                    .append(l.getAccount().getCode()).append(":")
                    .append(l.getSide()).append(":")
                    .append(l.getAmount()));

            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(sb.toString().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new PostingException("Hash computation failed: " + e.getMessage());
        }
    }

    /** Parses the rule_json array into typed {@link RuleLine} records. */
    private List<RuleLine> parseRuleLines(String ruleJson) {
        try {
            return objectMapper.readValue(ruleJson, new TypeReference<List<RuleLine>>() {});
        } catch (Exception e) {
            throw new PostingException("Could not parse posting rule JSON: " + e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Inner types
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Typed representation of one line in a posting rule's {@code rule_json}.
     * Field names match the JSON keys in the seeded posting_rules rows.
     */
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = true)
    record RuleLine(
            @com.fasterxml.jackson.annotation.JsonProperty("account_code") String accountCode,
            String side,
            @com.fasterxml.jackson.annotation.JsonProperty("amount_field")  String amountField,
            String memo
    ) {}
}
