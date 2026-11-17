# Scanny Accounting System Audit Report
**Date:** 2026-07-25  
**Auditor:** Technical Review  
**Scope:** Complete accounting system including financial_ledger_entries, accounting schema, posting rules, UI, and operational controls

---

## EXECUTIVE SUMMARY

**Overall Maturity Score: 6.5/10**

The system demonstrates sophisticated double-entry accounting design with hash chains, period locking, and idempotency—but **critical gaps in implementation, reconciliation, and operational controls** create substantial audit and money-tracking risks.

### TOP 5 CRITICAL RISKS

1. **TWO INDEPENDENT LEDGERS WITH NO RECONCILIATION** 
   - `financial_ledger_entries` (quick notebook) and `accounting.journal_entries` (double-entry) are written separately
   - Ledger failures are caught and logged but silently ignored (`OrderService.java:385, 519`)
   - Creates permanent drift with no automated reconciliation
   
2. **NO ROLE-BASED PERMISSIONS OR MAKER-CHECKER**
   - `AdminAccountingController.java` has zero access control annotations
   - Any authenticated admin can close periods, resolve failures, view all entries
   - No maker-checker workflow for manual journals, reversals, or period close
   - `manual_journal_requests` table exists but unused (no controller endpoints)

3. **AGENT VS PRINCIPAL TREATMENT INCORRECT FOR RESTAURANTS**
   - Posting rules record only Koddly's commission (`ORDER_PAID` rule lines 529-533)
   - Merchant's share (gross - commission) **not recorded at all** in double-entry
   - Violates IFRS 15 agent treatment
   - Creates reconciliation mismatch with `financial_ledger_entries` which tracks full amounts

4. **NO REVERSAL OR HASH VERIFICATION ENDPOINTS**
   - Schema supports `status=REVERSED/REVERSAL` and `reference_entry_id`
   - No `/entries/{id}/reverse` endpoint exists
   - Hash chain computed (`PostingService.java:273-293`) but never verified
   - No scheduled job or `/verify-chain` endpoint

5. **MISSING POSTING RULES FOR KEY EVENTS**
   - No rules for: cash settlement, merchant payouts, ticket event completion, organizer payouts
   - Event cancellation rule truncated in migration (incomplete)
   - Deposit application to arrears missing
   - Late fee corrections missing

---

## DETAILED SCORECARD

| # | Item | Status | Severity | Evidence | Gap | Fix |
|---|------|--------|----------|----------|-----|-----|
| **A. ACCOUNTING DESIGN** |
| 1 | Agent vs principal treatment | INCORRECT | CRITICAL | V67__accounting_schema.sql:529-533 (ORDER_PAID rule)<br>Only commission recorded:<br>`1300 DR / 3000 CR` | Merchant's share (gross-commission) **not recorded**. Should be `1000 DR / 2400 CR` for merchant payable, then `2400 DR / 1000 CR` on direct-to-merchant payout | Add `ORDER_PAID` rule lines for merchant share:<br>`{"account":"1000","side":"DEBIT","amount_field":"gross_ugx"}`<br>`{"account":"2400","side":"CREDIT","amount_field":"payee_amount_ugx"}` |
| 2 | IFRS reference in code | MISSING | MEDIUM | Searched V67, PostingService, all comments | Only mentions "double-entry" not IFRS specifically | Add IFRS 15 reference in V67 header comment and posting rule docs |
| 3 | Single source of truth | INCORRECT | CRITICAL | OrderService.java:383, 514 (ledgerWriterService)<br>OrderService.java:534, 549 (accountingEventPublisher)<br>Both in try/catch, ledger failure logged only | **Two independent writers**. Ledger fails → logged, accounting continues. Accounting fails → dead-letter queue, ledger already committed | Move both to outbox pattern OR make PostingService write both atomically. Current: permanent drift guaranteed |
| 4 | Missing posting rules | PARTIAL | HIGH | V67:529-610 (seeded rules)<br>Missing: COMMISSION_SETTLED (cash), MERCHANT_PAYOUT, EVENT_COMPLETED, ORGANISER_PAYOUT, EVENT_CANCELLED (truncated at line 610), DEPOSIT_APPLIED, LATE_FEE_CORRECTION, RENT_INVOICE_PARTIAL_REVERSAL | Critical revenue recognition and liability settlement events missing | Add rules for: cash settlement clearing (1010 → 1000), event completion (2100 → revenue or payable), organizer payout (2500 → 1000), deposit application (2200 → 1100) |
| **B. INTEGRITY & TAMPER-PROOFING** |
| 5 | Maker-checker for manual journals | MISSING | CRITICAL | manual_journal_requests table exists (V67:365-382)<br>AdminAccountingController: NO /manual-journals endpoints | Table defined but no workflow implemented. Anyone with admin JWT can POST directly to journal_entries via curl (DB trigger would block but no app-level guard) | Add endpoints: POST /manual-journals (submit), POST /manual-journals/{id}/approve, GET /manual-journals (pending list). Enforce submitter ≠ approver |
| 6 | Role-based permissions | MISSING | CRITICAL | AdminAccountingController.java: NO @PreAuthorize or @Secured annotations<br>Checked SecurityMatrixTest.java — no accounting role tests | Any admin can close periods, resolve failures, view entries. No viewer/accountant/approver roles | Add @PreAuthorize("hasRole('ACCOUNTING_ADMIN')") to closePeriod, resolveFailure. Add VIEWER role for read-only |
| 7 | DB privileges | INCORRECT | CRITICAL | V67: No GRANT/REVOKE statements<br>App uses default flyway user with full privileges | App DB user has UPDATE/DELETE on all accounting tables despite triggers. Superuser or direct psql can bypass triggers | Add migration V68:<br>`REVOKE UPDATE, DELETE ON accounting.journal_entries, accounting.journal_lines FROM scanny_app;`<br>`GRANT SELECT, INSERT ON accounting.* TO scanny_app;` |
| 8 | Hash chain verification | PARTIAL | HIGH | PostingService.java:273-293 computes hash correctly<br>AdminAccountingController: NO /verify-chain endpoint<br>No scheduled job in codebase | Hash computed and stored but **never verified**. A manual DB UPDATE would not be detected | Add GET /entries/{id}/verify-chain endpoint. Add scheduled job to verify last 100 entries nightly. Alert on mismatch |
| 9 | Audit log of admin actions | PARTIAL | MEDIUM | audit_log table exists (V67:402-421)<br>closePeriod writes to period.closed_by (AdminAccountingController:91)<br>resolveFailure does NOT write to audit_log | Period close logged in period row. Failure resolution, config changes, exports NOT logged | Inject audit write in resolveFailure, future reverse/manual entry endpoints. Log actor, IP, before/after state |
| 10 | Reversal workflow | MISSING | CRITICAL | Schema supports status=REVERSED/REVERSAL (V67:118)<br>No /entries/{id}/reverse endpoint<br>UI has placeholder (AccountingLedgerPage.tsx:276-287) | Cannot reverse entries. Only way is manual DB writes (violates immutability) or manual journal | Add POST /entries/{id}/reverse with reason required. Create REVERSAL entry with reference_entry_id. Set original status=REVERSED |
| 11 | Manual journal entry | PARTIAL | HIGH | manual_journal_requests table exists<br>NO controller endpoints<br>UI has no form | Schema ready but no way to create manual entries | Add POST /manual-journals (submit draft), GET /manual-journals (list pending), POST /manual-journals/{id}/approve (creates journal_entry) |
| **C. RECONCILIATION** |
| 12 | Ledger vs journal reconciliation | MISSING | CRITICAL | No reconciliation code found<br>OrderService.java writes both independently<br>Ledger failure caught/logged → accounting continues | If ledgerWriterService fails (DB down, constraint violation), financial_ledger_entries missing but journal_entries exists. **Permanent drift** | Add daily job: SUM(financial_ledger_entries.platform_fee) vs SUM(journal_lines amount WHERE account=3000). Alert on mismatch > 0.1% |
| 13 | Cash-MoMo vs provider settlement | MISSING | HIGH | No settlement reconciliation code<br>No provider statement import | Cannot verify PSP (MTN/Airtel) statements match system records | Add POST /admin/accounting/import-settlement (CSV upload). Match by transaction_ref, flag unmatched |
| 14 | Bank statement reconciliation | MISSING | MEDIUM | No bank recon code | Cannot reconcile 1000 (MoMo Clearing) against actual bank balance | Lower priority (MoMo settlements are API-driven). Add if bank account used |
| 15 | Control vs subledger | PARTIAL | MEDIUM | subledger_entries table exists (V67:319-340)<br>No population code found in RentPaymentService, TicketPurchaseService | Table defined but not written to. Tenant balances exist in rent schema separately | Populate subledger_entries in PostingService when posting to 1100 (rent receivable). Add recon report: control account 1100 vs SUM(subledger WHERE entity_type=TENANT) |
| 16 | Suspense accounts | PARTIAL | MEDIUM | Account 9000 defined (V67:475-477)<br>RENT_INVOICE_ISSUED rule uses 9000 (V67:563-569)<br>No clearing/aging workflow | Suspense account exists but no workflow to clear unmatched items or age them | Add GET /admin/accounting/suspense-aging. Alert if any 9000 balance > 30 days |
| 17 | Pending/failed/duplicate payment handling | PARTIAL | MEDIUM | Payment idempotency exists (V19 migration)<br>PostingFailure table (V67:384-398)<br>resolveFailure marks RESOLVED but does NOT create entry | Duplicate webhooks blocked. Failed posts go to dead-letter. resolveFailure just marks row — **books stay wrong** | Add retryFailure endpoint: re-runs PostingService.post() with same event. If succeeds, marks RESOLVED |
| **D. MODULE-SPECIFIC** |
| 18 | Restaurants: payouts, refunds, disputes | PARTIAL | HIGH | ORDER_PAID records commission only (V67:529-533)<br>ORDER_REFUNDED reverses commission (V67:540-545)<br>COMMISSION_SETTLED has PSP fee (V67:547-554)<br>NO merchant payout rule, NO chargeback/dispute rules | Commission flow correct. **Merchant payable not recorded**. No dispute handling | Add MERCHANT_PAYOUT rule: `2400 DR / 1000 CR`. Add CHARGEBACK rule: reverse original entry, post dispute expense |
| 19 | Rent: deposits, arrears, write-offs | PARTIAL | MEDIUM | SECURITY_DEPOSIT_RECEIVED/RETURNED exist (V67:583-592)<br>LATE_FEE_APPLIED exists (V67:576-580)<br>NO deposit-to-arrears application, NO write-off rule | Deposit liability correct. Late fee correct. **Cannot apply deposit to arrears**. Cannot write off bad debt | Add DEPOSIT_APPLIED_TO_ARREARS: `2200 DR / 1100 CR`. Add RECEIVABLE_WRITEOFF: `4xxx DR (bad debt expense) / 1100 CR` |
| 20 | Ticketing: deferred revenue, cancellations | INCORRECT | HIGH | TICKET_SOLD posts to 2100 deferred (V67:595-602)<br>EVENT_COMPLETED rule exists (V67:604-609)<br>EVENT_CANCELLED rule **truncated in migration** (V67:610 cuts off) | Deferred revenue created correctly. Event completion moves to organizer payable. **Cancellation rule incomplete** — missing refund flow | Complete V67:610+ EVENT_CANCELLED rule. Should: `2100 DR / 1000 CR` (refund customer), reverse commission |
| 21 | Tax: VAT, withholding, excise | MISSING | HIGH | Account 2000 "VAT Payable" defined (V67:434-436)<br>NO posting rules include VAT lines<br>No tax calculation in OrderService, RentPaymentService | VAT account exists but never used. Tax not recorded | Add VAT line to ORDER_PAID: `1000 DR / 2000 CR` for VAT component. Add VAT remittance rule: `2000 DR / 1000 CR` |
| 22 | Customer funds segregation | MISSING | MEDIUM | No separate accounts for merchant/organizer funds vs Koddly funds<br>All use 1000 (MoMo Clearing) | Cannot distinguish customer money from platform money | Add accounts 1020 (Customer Funds — Tickets), 1030 (Customer Funds — Rent). Re-map deferred revenue deposits |
| 23 | Month-end accruals | MISSING | MEDIUM | No accrual rules for unbilled items | Revenue recognition may lag cash | Add manual journal workflow for: unbilled commission, accrued MoMo fees, prepaid platform costs |
| 24 | Multi-currency | MISSING | LOW | journal_entries.currency defaults 'UGX' (V67:115)<br>No forex gain/loss handling | Works for UGX only | Defer until multi-currency needed. Add forex gain/loss accounts 5000/5100 |
| **E. PERIOD CLOSE** |
| 25 | Soft vs hard close | HARD ONLY | MEDIUM | Period status: OPEN/CLOSED (V67:52)<br>trg_check_period_open prevents posting to CLOSED (V67:228-244)<br>No SOFT_CLOSE state | Hard close only. No trial close → review → finalize workflow | Add SOFT_CLOSED state. Soft close: warn on unbalanced trial balance but allow reopen. Hard close: irreversible |
| 26 | Pre-close checklist | MISSING | HIGH | closePeriod just sets status=CLOSED (AdminAccountingController:80-92)<br>No checks before closing | Can close period with: unbalanced trial balance, pending failures, unmatched suspense | Add checks in closePeriod: (1) trial balance must equal (2) posting_failures.status=PENDING count = 0 (3) account 9000 balance = 0. Reject if failed |
| 27 | Reopen approval | MISSING | MEDIUM | No reopen endpoint exists | Once closed, cannot reopen even for correction | Add POST /periods/{label}/reopen. Require maker-checker approval. Log reason |
| 28 | Period-end snapshots | MISSING | MEDIUM | No balance snapshot table | Cannot query "balance as of 2025-12-31" without re-summing | Add period_balances table. Populate on period close: INSERT snapshot of every account balance |
| 29 | Year-end closing | MISSING | MEDIUM | No P&L → retained earnings rule | Revenue/expense accounts not zeroed at year-end | Add YEAR_END_CLOSE manual journal: DR all revenue accounts, CR 3900 (Retained Earnings), DR 3900, CR all expense accounts |
| 30 | DB-level period lock | CORRECT | — | trg_check_period_open (V67:228-244) fires BEFORE INSERT on journal_entries<br>Checks period status, rejects if CLOSED | ✅ Enforced at DB level. Even direct INSERT bypasses would be blocked | Working correctly |
| **F. REPORTING** |
| 31 | General ledger with running balance | MISSING | HIGH | GET /entries returns entries (AdminAccountingController:130-152)<br>No running balance computed | Cannot see account 1100 balance over time | Add GET /accounts/{code}/ledger?from=&to= with running balance per entry |
| 32 | Financial statements | MISSING | HIGH | Trial balance exists (AdminAccountingController:116-127)<br>NO income statement, balance sheet, cash flow | Cannot generate P&L or balance sheet | Add GET /reports/income-statement?period=, /reports/balance-sheet?asOf=. Group accounts by type, sum lines |
| 33 | Merchant/tenant statements | MISSING | MEDIUM | No merchant/tenant statement endpoint | Merchants cannot see their ledger | Add GET /merchants/{id}/statement?from=&to=. Filter journal_lines WHERE dim_merchant_id |
| 34 | Aging reports | MISSING | MEDIUM | No aging calculation | Cannot see overdue receivables by 30/60/90 days | Add GET /reports/aging-receivables. Bucket by (today - entry_date) |
| 35 | Drill-down to source | PARTIAL | MEDIUM | source_record_id stored (V67:108)<br>UI shows it (AccountingLedgerPage.tsx:669)<br>No hyperlink to order/ticket | Field exists but not linked | In UI, make source_record_id a link: if module=RESTAURANTS → /orders/{id} |
| 36 | Export with logging | PARTIAL | LOW | No export endpoint exists<br>audit_log table ready (V67:402-421) | Cannot export ledger | Add GET /entries/export?format=csv. Log to audit_log with actor, timestamp |
| **G. RELIABILITY** |
| 37 | Retry with backoff | PARTIAL | HIGH | PostingFailure.retry_count exists (V67:391)<br>NO retry endpoint (AdminAccountingController has only /resolve)<br>AccountingEventConsumer: no retry loop found | Dead-letter queue exists. resolveFailure marks RESOLVED **without creating entry** → books stay wrong | Add POST /failures/{id}/retry. Re-invoke PostingService.post(). Implement exponential backoff (retry_count * 5 minutes) |
| 38 | Idempotency | CORRECT | — | journal_entries: UNIQUE(source_module, source_event_id) (V67:127)<br>PostingService.java:124-129 checks existing entry before posting<br>financial_ledger_entries: existsByOrderIdAndEntryType check (LedgerWriterService.java:59) | ✅ Both systems idempotent | Working correctly |
| 39 | Alerts for failures | MISSING | HIGH | No alerting found. Failures just accumulate in DB | posting_failures rows grow, no one notified | Add scheduled job: if PENDING count > 10 → email admins. If trial balance unbalanced > 24h → page on-call |
| 40 | Test coverage | MISSING | CRITICAL | src/test: NO accounting tests found<br>Searched for *Account*.java, *Posting*.java — zero results | **No unit tests for posting rules, balance checks, hash computation, idempotency** | Add PostingServiceTest: test every posting rule, verify debits=credits, test idempotency, test hash chain |
| 41 | Backups & retention | UNKNOWN | MEDIUM | No backup config in repo | Cannot verify backup schedule or retention | Ask: What is RDS backup schedule? Are accounting tables in PITR scope? Test restore |
| 42 | Replay tool | MISSING | MEDIUM | No sandbox or replay tool | Cannot test posting rule changes safely | Add /admin/accounting/replay-event endpoint (dev/staging only). Re-post historical event with rule changes |
| **H. ADMIN UI** |
| 43 | UI features | PARTIAL | MEDIUM | AccountingLedgerPage.tsx (new version from this session)<br>✅ Entry status, source ID, filters, entry totals shown<br>❌ Hash/prev_hash not in API response (AdminAccountingController.java:159-166 EntryDto omits them)<br>❌ closed_by/closed_at not in PeriodDto (line 227)<br>❌ Retry button calls placeholder (line 244)<br>❌ Reverse button calls placeholder (line 276)<br>❌ No reconciliation view, no chart of accounts view | Filters work. Status badges work. Hash chain and reversal **not implemented in backend** | (1) Add hash fields to EntryDto (2) Add closed_by/at to PeriodDto (3) Implement /entries/{id}/reverse endpoint (4) Implement /failures/{id}/retry |
| 44 | Known UI bugs | FIXED | — | Issues from original audit:<br>(a) Trial balance error → ✅ Fixed (separate state)<br>(b) Period close refresh → ✅ Fixed (loadDashboard called)<br>(c) Pagination reload → ✅ Fixed (separate load functions)<br>(d) Unused currentPeriod → ✅ Fixed (removed)<br>(e) Failed line fetch → ✅ Fixed (lineErrors state)<br>(f) line.side → ✅ Correct (V67:143, PostingService:210-211 uses "side")<br>(g) Accessibility → ✅ Fixed (buttons, roles, Escape key) | All bugs from prior review fixed in new implementation | None needed |

---

## CRITICAL FINDINGS

### 1. TWO INDEPENDENT LEDGERS — NO RECONCILIATION (CRITICAL)

**What:** `financial_ledger_entries` and `accounting.journal_entries` are written by separate service calls in the same method. If one fails, the other proceeds.

**Evidence:**
```java
// OrderService.java:511-556
try {
    if (paymentStatus == PaymentStatus.Paid && oldStatus != PaymentStatus.Paid) {
        ledgerWriterService.recordPayment(savedOrder);  // ← REQUIRES_NEW txn
    } else if (paymentStatus == PaymentStatus.Refunded && oldStatus == PaymentStatus.Paid) {
        ledgerWriterService.recordRefund(savedOrder);
    }
} catch (Exception ex) {
    logger.error("LedgerWriterService failed for order {} — accounting row was NOT written: {}",
            savedOrder.getId(), ex.getMessage(), ex);
    // ← SWALLOWED! Order continues, accounting missing
}

// Then later (line 534):
accountingEventPublisher.publish(new AccountingEvent(...));  // ← outbox, async
```

**Impact:** 
- Ledger write fails (DB lock, constraint) → **logged only**, accounting event still published → drift
- Accounting post fails → dead-letter queue, but ledger already committed → drift
- No automated reconciliation → **drift accumulates silently**

**Harm:** 
- Monthly revenue report from `financial_ledger_entries` shows 100M UGX
- Trial balance from `accounting.journal_entries` shows 98M UGX
- 2M UGX unaccounted → where is the money?
- CFO cannot sign financials

**Fix:**
1. **Short-term:** Add daily reconciliation job
   ```sql
   SELECT 
     SUM(platform_fee) as ledger_total 
   FROM financial_ledger_entries 
   WHERE entry_type='PAYMENT' AND settled_at >= '2026-01-01';
   
   SELECT 
     SUM(amount) as journal_total 
   FROM accounting.journal_lines 
   WHERE account_id = (SELECT id FROM accounting.accounts WHERE code='3000')
     AND created_at >= '2026-01-01';
   
   -- Alert if ABS(ledger_total - journal_total) > 100000  (0.1% tolerance)
   ```

2. **Long-term:** Move `LedgerWriterService` into `PostingService`. Posting writes both atomically:
   ```java
   @Transactional(propagation = REQUIRES_NEW)
   public void post(AccountingEvent event) {
       // ... existing journal_entries logic ...
       
       // If module=RESTAURANTS, also write financial_ledger_entry
       if ("RESTAURANTS".equals(event.sourceModule())) {
           FinancialLedgerEntry ledger = FinancialLedgerEntry.payment(...);
           ledgerRepository.save(ledger);
       }
   }
   ```

---

### 2. AGENT VS PRINCIPAL TREATMENT INCORRECT (CRITICAL)

**What:** Restaurant posting rule records only Koddly commission as revenue. Merchant's share is not recorded at all.

**Evidence:**
```sql
-- V67__accounting_schema.sql:529-533
('RESTAURANTS', 'ORDER_PAID',
 'Customer pays for a restaurant order via MoMo. Koddly records its commission portion only.',
 '[
   {"account_code":"1300","side":"DEBIT",  "amount_field":"platform_commission_ugx","memo":"Commission receivable"},
   {"account_code":"3000","side":"CREDIT", "amount_field":"platform_commission_ugx","memo":"Platform commission earned"}
 ]'::jsonb),
```

For a 100,000 UGX order (5,000 UGX commission):
- Recorded: `1300 DR 5,000 / 3000 CR 5,000` ✅
- Missing: `1000 DR 100,000 / 2400 CR 95,000` ❌ (merchant payable)

**Impact:**
- Balance sheet liability (merchant payable) understated by 95,000 UGX per order
- Asset (MoMo clearing) understated by 100,000 UGX
- Reconciliation with `financial_ledger_entries` (which records full 100,000) impossible
- **Violates IFRS 15 (agent treatment):** must show gross consideration collected even if not Koddly's revenue

**Harm:**
- Auditor asks: "Where is the 100,000 UGX you collected from the customer?"
- Answer: "In account 1000 (MoMo Clearing)"
- Auditor: "But your journal only shows 5,000 received. Where is the other 95,000?"
- Result: **Qualified audit opinion** → cannot raise funding

**Fix:**
```sql
-- Correct ORDER_PAID rule (agent treatment):
INSERT INTO accounting.posting_rules (source_module, event_type, description, rule_json)
VALUES ('RESTAURANTS', 'ORDER_PAID',
 'Customer pays. Koddly collects full amount, owes merchant their share.',
 '[
   {"account_code":"1000","side":"DEBIT",  "amount_field":"gross_ugx",              "memo":"MoMo collection"},
   {"account_code":"2400","side":"CREDIT", "amount_field":"merchant_net_ugx",       "memo":"Owed to merchant"},
   {"account_code":"1300","side":"DEBIT",  "amount_field":"platform_commission_ugx","memo":"Commission receivable"},
   {"account_code":"3000","side":"CREDIT", "amount_field":"platform_commission_ugx","memo":"Commission revenue"}
 ]'::jsonb);

-- Then add MERCHANT_PAYOUT rule:
INSERT INTO accounting.posting_rules (source_module, event_type, description, rule_json)
VALUES ('RESTAURANTS', 'MERCHANT_PAYOUT',
 'Koddly pays merchant their net share (weekly batch).',
 '[
   {"account_code":"2400","side":"DEBIT",  "amount_field":"payout_amount_ugx","memo":"Clear merchant payable"},
   {"account_code":"1000","side":"CREDIT", "amount_field":"payout_amount_ugx","memo":"MoMo transfer to merchant"}
 ]'::jsonb);
```

---

### 3. NO ROLE-BASED PERMISSIONS (CRITICAL)

**What:** `AdminAccountingController` has zero access control. Any JWT with admin scope can close periods, resolve failures, see all ledger data.

**Evidence:**
```java
// AdminAccountingController.java — no annotations
@RestController
@RequestMapping("/api/admin/accounting")
public class AdminAccountingController {
    // ...
    @PostMapping("/periods/{label}/close")
    @Transactional
    public PeriodDto closePeriod(@PathVariable String label, ...) {
        // No @PreAuthorize, no role check
```

**Impact:**
- Junior admin (viewer role) can close periods → corrupts accounting
- Customer support agent (should only view orders) can mark posting failures "resolved" without fixing → books wrong
- No maker-checker: same person can submit manual journal AND approve it → fraud risk

**Harm:**
- Disgruntled employee scenario:
  1. Employee with admin JWT calls `POST /periods/2026-01/close`
  2. Period locks — no one can post corrections
  3. Then calls `POST /failures/123/resolve` for all pending failures
  4. Failures disappear but entries never created
  5. Books 500,000 UGX short
  6. Discovery: 3 months later during audit
  7. Employee already left

**Fix:**
```java
// 1. Define roles in Keycloak:
//    - accounting_viewer    (read-only)
//    - accounting_accountant (write entries, not close)
//    - accounting_admin     (close periods, approve)

// 2. Add annotations:
@PreAuthorize("hasAuthority('SCOPE_accounting_admin')")
@PostMapping("/periods/{label}/close")
public PeriodDto closePeriod(...) { ... }

@PreAuthorize("hasAnyAuthority('SCOPE_accounting_accountant', 'SCOPE_accounting_admin')")
@PostMapping("/failures/{id}/resolve")
public FailureDto resolveFailure(...) { ... }

@PreAuthorize("hasAuthority('SCOPE_accounting_viewer')")
@GetMapping("/entries")
public EntryPageResponse listEntries(...) { ... }

// 3. Maker-checker for manual journals:
//    - Submitter cannot be approver (check JWT sub)
//    - Manual journal request must have status=PENDING → 24h → then approved
```

---

### 4. NO HASH CHAIN VERIFICATION (HIGH)

**What:** Hash chain computed correctly on insert but **never validated**. A manual DB UPDATE would go undetected.

**Evidence:**
```java
// PostingService.java:273-293 — computes hash correctly
private String computeHash(String prevHash, JournalEntry entry, List<JournalLine> lines) {
    StringBuilder sb = new StringBuilder();
    sb.append(prevHash != null ? prevHash : "GENESIS").append("|");
    sb.append(entry.getEntryDate()).append("|");
    // ... includes all stable fields ...
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    byte[] hash = digest.digest(sb.toString().getBytes(StandardCharsets.UTF_8));
    return HexFormat.of().formatHex(hash);
}
```
But: NO verification code exists anywhere.

**Impact:**
- Malicious DBA runs: 
  ```sql
  UPDATE accounting.journal_entries 
  SET description = 'Fraudulent entry' 
  WHERE id = 12345;
  ```
- Trigger blocks this (trg_journal_entries_immutable) ✅
- But if DBA disables trigger:
  ```sql
  ALTER TABLE accounting.journal_entries DISABLE TRIGGER trg_journal_entries_immutable;
  UPDATE ... ;
  ALTER TABLE accounting.journal_entries ENABLE TRIGGER trg_journal_entries_immutable;
  ```
- Hash chain broken but **no one notices**

**Harm:**
- External auditor: "How do you prove ledger integrity?"
- You: "We have a hash chain"
- Auditor: "Show me verification"
- You: "..."
- Result: **Audit qualification**

**Fix:**
```java
// 1. Add endpoint:
@GetMapping("/entries/{id}/verify-chain")
public VerificationResponse verifyChain(@PathVariable Long id) {
    JournalEntry entry = entryRepo.findById(id).orElseThrow();
    List<JournalLine> lines = lineRepo.findByEntryIdOrderById(id);
    
    String computedHash = computeHash(entry.getPrevEntryHash(), entry, lines);
    boolean valid = computedHash.equals(entry.getEntryHash());
    
    return new VerificationResponse(id, valid, 
        valid ? null : "Hash mismatch: expected " + entry.getEntryHash() + " got " + computedHash);
}

// 2. Add scheduled job:
@Scheduled(cron = "0 0 2 * * *")  // 2 AM daily
public void verifyHashChainNightly() {
    List<JournalEntry> recent = entryRepo.findTop100ByOrderByIdDesc();
    for (JournalEntry e : recent) {
        VerificationResponse r = verifyChain(e.getId());
        if (!r.valid()) {
            alertService.page("Hash chain broken at entry " + e.getId());
        }
    }
}
```

---

### 5. MISSING POSTING RULES (HIGH)

**Critical revenue/liability events have no posting rules:**

1. **EVENT_COMPLETED** — Rule exists but only moves deferred → organizer payable. **Never recognizes revenue**.
   ```sql
   -- V67:604-609
   ('TICKETING', 'EVENT_COMPLETED',
    'Event has taken place. Deferred revenue recognized; organiser payout recorded.',
    '[
      {"account_code":"2100","side":"DEBIT",  "amount_field":"total_organiser_amount_ugx","memo":"Recognise deferred revenue"},
      {"account_code":"2500","side":"CREDIT", "amount_field":"total_organiser_amount_ugx","memo":"Organiser payout payable"}
    ]'::jsonb),
   ```
   This only moves liability 2100 → 2500. **Koddly's commission (3020) never recognized**. Should be:
   ```json
   [
     {"account":"2100","side":"DEBIT","amount":"total_deferred_ugx","memo":"Clear deferred"},
     {"account":"2500","side":"CREDIT","amount":"organiser_net_ugx","memo":"Organiser payable"},
     {"account":"3020","side":"CREDIT","amount":"koddly_commission_ugx","memo":"Commission now earned"}
   ]
   ```

2. **EVENT_CANCELLED** — Rule **truncated** at V67:610. Migration file cuts off mid-rule.
   Must refund customers, reverse commission. Rule missing entirely.

3. **ORGANISER_PAYOUT_ISSUED** — Rule exists (V67:611-616) ✅

4. **MERCHANT_PAYOUT** — Missing. Cannot settle `account 2400` (Merchant Payable).

5. **COMMISSION_SETTLED (cash)** — Only covers MoMo. Cash orders (1010) never cleared.

**Impact:** Revenue under-recognized, liabilities never cleared, account balances grow unbounded.

**Fix:** Add missing rules in new migration V68.

---

## MONEY-FLOW TRACE

### RESTAURANT ORDER (MoMo Payment)

**User action:** Customer scans QR, pays 100,000 UGX (95,000 merchant, 5,000 Koddly commission).

**Table writes:**
1. `orders` — INSERT (status=Pending)
2. `payment_intents` — INSERT
3. MoMo callback hits `/api/momo/callback`
4. `OrderService.confirmPaymentFromGateway()`:
   - UPDATEs `orders.payment_status = 'Paid'`
   - **Tries** `ledgerWriterService.recordPayment()` → REQUIRES_NEW txn
     - Writes `financial_ledger_entries` (gross=100k, net=95k, platform_fee=5k)
     - **If fails:** exception caught, logged, **order continues**
   - Publishes `AccountingEvent` to outbox
5. `OutboxDispatcher` picks up event → `AccountingEventConsumer`
6. `PostingService.post()` in REQUIRES_NEW txn:
   - Checks idempotency (source_module + source_event_id)
   - Looks up posting rule
   - **Writes** `journal_entries` (1 row)
   - **Writes** `journal_lines` (2 rows: 1300 DR 5k, 3000 CR 5k) ← **WRONG, should be 4 lines**
   - Computes hash, saves
   - **If fails:** exception → `PostingFailure` row created

**Silent failure points:**
- Line 514: Ledger write fails → logged only, accounting proceeds
- Outbox dispatch fails → retried later (good)
- Posting fails → dead-letter queue (good)
- **But:** Ledger succeeds, posting fails → **drift** (no retry creates accounting entry)

**Report trace:**
- `GET /admin/revenue/overview` → queries `financial_ledger_entries` → 100k gross, 5k Koddly
- `GET /admin/accounting/dashboard` → queries `journal_entries` → only 5k recorded
- **Mismatch:** 95k missing from double-entry (merchant payable not recorded)

---

### RENT PAYMENT

**User action:** Tenant pays 500,000 UGX rent (480,000 landlord, 20,000 Koddly fee).

**Table writes:**
1. `rent_charges` — already exists (generated monthly)
2. `rent_payments` — INSERT
3. `RentPaymentService.recordPayment()`:
   - UPDATEs `rent_charges.status = 'PAID'`
   - Publishes `AccountingEvent('RENT_PAYMENT_RECEIVED', ...)`
4. Outbox → `PostingService.post()`:
   - Rule: RENT_PAYMENT_RECEIVED (V67:571-578)
   - Writes:
     ```
     9000 DR 500k (clear suspense)
     1100 CR 500k (clear receivable)
     1300 DR 20k (commission)
     3010 CR 20k (revenue)
     ```
   - **Problem:** Where did the 500k originally come from? From RENT_INVOICE_ISSUED rule:
     ```
     1100 DR 500k (receivable)
     9000 CR 500k (suspense — not Koddly's income)
     ```
   - **Issue:** Suspense account used as pass-through because **landlord income is not Koddly's**. Correct, but confusing. Better: use control account structure.

**Silent failure:** If posting fails, payment recorded in `rent_payments` but no accounting entry → receivable never cleared.

**Report:** 
- `GET /admin/rent/accounting` → queries `rent_charges`, `rent_payments` → correct
- Trial balance → 1100 (receivable) balance wrong if posting failed

---

### TICKET PURCHASE

**User action:** Customer buys ticket for 50,000 UGX (45,000 organizer, 5,000 Koddly).

**Table writes:**
1. `tickets` — INSERT (status=PURCHASED)
2. `payment_intents` — INSERT
3. MoMo callback → `TicketPurchaseService.confirmPurchase()`:
   - UPDATEs `tickets.payment_status = 'PAID'`
   - Publishes `AccountingEvent('TICKET_SOLD', ...)`
4. Posting:
   ```
   1000 DR 50k (MoMo received)
   2100 CR 45k (deferred — owed to organizer)
   1300 DR 5k (commission)
   3020 CR 5k (revenue)
   ```
   **Correct:** Commission recognized immediately (ticket non-refundable after 24h).

5. **Event day:** Admin marks event complete → publishes `AccountingEvent('EVENT_COMPLETED', ...)`
6. Posting (V67:604-609):
   ```
   2100 DR 45k (clear deferred)
   2500 CR 45k (organizer payout payable)
   ```
   **Issue:** Commission 5k already recognized in step 4. This just moves liability. Correct if commission taken at sale.

7. **Payout:** Admin triggers payout → `ORGANISER_PAYOUT_ISSUED`:
   ```
   2500 DR 45k
   1000 CR 45k
   ```
   ✅ Correct

**Silent failure:** If EVENT_COMPLETED posting fails, tickets sold but deferred revenue never moved → P&L wrong (revenue under-recognized).

---

## PRIORITIZED ROADMAP

### Phase 1: Critical Fixes (2-3 weeks)

**1. Reconciliation job** (3 days, HIGH)
- [ ] Add scheduled job: compare `financial_ledger_entries.platform_fee` vs `journal_lines account=3000`
- [ ] Alert if delta > 0.1%
- [ ] Weekly manual review of mismatches
- **Why first:** Detects existing drift immediately

**2. Fix restaurant posting rules** (2 days, CRITICAL)
- [ ] Rewrite ORDER_PAID rule to record merchant payable (2400)
- [ ] Add MERCHANT_PAYOUT rule
- [ ] Add ORDER_PAID_CASH settlement rule
- [ ] Backfill historical entries with correction journal (manual)
- **Dependency:** Must fix before closing any period

**3. Add role-based permissions** (3 days, CRITICAL)
- [ ] Define 3 roles in Keycloak: viewer, accountant, admin
- [ ] Add @PreAuthorize to all AdminAccountingController methods
- [ ] Test: viewer cannot close period
- **Dependency:** None

**4. Implement retry endpoint** (2 days, HIGH)
- [ ] POST /failures/{id}/retry
- [ ] Re-invoke PostingService.post() with exponential backoff
- [ ] Update UI "Retry" button (already has placeholder)
- **Dependency:** None

**5. Add unit tests** (5 days, CRITICAL)
- [ ] PostingServiceTest: test every posting rule, verify balance
- [ ] Test idempotency (duplicate events)
- [ ] Test hash computation correctness
- [ ] Test period lock enforcement
- **Dependency:** Should have been first, but backfilling now

### Phase 2: Medium Priority (3-4 weeks)

**6. Complete missing posting rules** (3 days, HIGH)
- [ ] Fix EVENT_CANCELLED (truncated in V67)
- [ ] Add DEPOSIT_APPLIED_TO_ARREARS
- [ ] Add RECEIVABLE_WRITEOFF
- [ ] Add VAT to all rules
- **Dependency:** Phase 1 must be stable

**7. Hash chain verification** (2 days, HIGH)
- [ ] Add GET /entries/{id}/verify-chain endpoint
- [ ] Add nightly scheduled job (verify last 100 entries)
- [ ] Add alert on mismatch
- **Dependency:** None

**8. Maker-checker for manual journals** (5 days, HIGH)
- [ ] Implement POST /manual-journals (submit draft)
- [ ] Implement POST /manual-journals/{id}/approve (requires different user)
- [ ] Build UI form for manual entry
- [ ] Test: submitter cannot approve own entry
- **Dependency:** Roles (Phase 1.3)

**9. Pre-close checklist** (2 days, MEDIUM)
- [ ] Add checks in closePeriod: trial balance, no failures, no suspense
- [ ] Return validation errors instead of closing
- [ ] Log failed close attempts
- **Dependency:** None

**10. Reversal workflow** (3 days, HIGH)
- [ ] Implement POST /entries/{id}/reverse (reason required)
- [ ] Create REVERSAL entry with reference_entry_id
- [ ] Set original status=REVERSED
- [ ] Update UI "Reverse" button (placeholder exists)
- **Dependency:** Maker-checker (Phase 2.8) — reversal should require approval

### Phase 3: Reporting & Operations (4-5 weeks)

**11. Financial statements** (5 days, HIGH)
- [ ] Implement GET /reports/income-statement?period=
- [ ] Implement GET /reports/balance-sheet?asOf=
- [ ] Group accounts by type, compute totals
- [ ] Export to PDF
- **Dependency:** Rules fixed (Phase 1.2)

**12. General ledger with running balance** (3 days, MEDIUM)
- [ ] Implement GET /accounts/{code}/ledger?from=&to=
- [ ] Compute running balance per entry
- [ ] Add drill-down links to source records
- **Dependency:** None

**13. Subledger population** (3 days, MEDIUM)
- [ ] Modify PostingService to write subledger_entries for control accounts
- [ ] Add recon report: control vs subledger
- [ ] Alert on mismatch
- **Dependency:** None

**14. Suspense aging report** (2 days, MEDIUM)
- [ ] Implement GET /admin/accounting/suspense-aging
- [ ] Alert if any 9000 balance > 30 days
- **Dependency:** None

**15. Aging reports** (2 days, MEDIUM)
- [ ] Implement GET /reports/aging-receivables
- [ ] Bucket by 30/60/90/120+ days
- **Dependency:** None

**16. Period reopen with approval** (2 days, LOW)
- [ ] Implement POST /periods/{label}/reopen (reason required)
- [ ] Require maker-checker approval
- [ ] Log to audit_log
- **Dependency:** Maker-checker (Phase 2.8)

**17. Merchant/tenant statements** (3 days, LOW)
- [ ] Implement GET /merchants/{id}/statement
- [ ] Implement GET /tenants/{id}/statement
- [ ] Filter by dim_merchant_id / dim_tenant_id
- **Dependency:** None

**18. Export with logging** (1 day, LOW)
- [ ] Implement GET /entries/export?format=csv
- [ ] Log to audit_log with actor, timestamp
- **Dependency:** None

### Phase 4: Advanced (Later)

**19. Bank statement reconciliation** (5 days)
**20. Multi-currency support** (10 days)
**21. Year-end close automation** (3 days)
**22. Customer funds segregation** (5 days)
**23. Replay tool for testing** (3 days)

---

## QUESTIONS FOR YOU

1. **MoMo settlement files:** What format does MTN/Airtel provide? CSV? API? How do we match their transaction_ref to ours?

2. **Tax registration:** Is Koddly registered for VAT in Uganda? If yes, what is the rate (18%)? Do we issue tax invoices?

3. **Backup verification:** What is the RDS backup schedule? When was the last restore test? Are accounting tables in PITR scope?

4. **Merchant payout schedule:** Weekly? Bi-weekly? How do we trigger MERCHANT_PAYOUT events? Manual or automated?

5. **Period close authority:** Who has authority to close an accounting period? CFO only? Finance team lead?

6. **Audit firm:** Do you have an external auditor engaged? Have they reviewed the accounting schema design?

7. **Disaster recovery:** If the accounting DB is corrupted, can we rebuild journal_entries from outbox events + source tables? Has this been tested?

8. **Historical data:** How many journal_entries exist currently? When did V67 deploy? Do we need to backfill pre-V67 transactions?

9. **Cash handling:** For cash orders (account 1010), how is physical cash deposited to bank? Is there a cash-to-bank reconciliation process?

10. **Keycloak roles:** Do accounting-specific roles exist in Keycloak, or do we need to create them?

---

## APPENDIX: RULES COMPARISON

### Restaurant Rules (Agent Treatment)

**Current (WRONG):**
```
ORDER_PAID:
  1300 DR commission
  3000 CR commission
```

**Correct (IFRS 15 Agent):**
```
ORDER_PAID:
  1000 DR gross              (collect full customer payment)
  2400 CR merchant_net       (owe merchant their share)
  1300 DR commission         (receivable — ours to keep)
  3000 CR commission         (revenue recognized)

MERCHANT_PAYOUT:
  2400 DR merchant_net       (clear liability)
  1000 CR merchant_net       (send MoMo transfer)
```

**Why:** IFRS 15 requires agent to show gross consideration received even though principal income. Distinguishes:
- **Principal:** Books gross as revenue, COGS as expense → net = profit
- **Agent:** Books only commission as revenue, merchant share as liability → net = commission

Koddly is **agent** for restaurants (merchant owns inventory, Koddly just facilitates payment).

---

### Ticketing Rules (Principal Treatment)

**Current (CORRECT for commission model):**
```
TICKET_SOLD:
  1000 DR ticket_price       (collect from customer)
  2100 CR organiser_share    (defer until event occurs)
  1300 DR commission         (our fee)
  3020 CR commission         (revenue now — non-refundable)

EVENT_COMPLETED:
  2100 DR organiser_share    (recognize deferred)
  2500 CR organiser_share    (payable to organizer)

ORGANISER_PAYOUT:
  2500 DR payout             (pay organizer)
  1000 CR payout             (MoMo transfer)
```

**Why correct:** Commission recognized at sale (tickets non-refundable after 24h). Organizer share deferred until event occurs (refund risk). Koddly is **agent** (organizer owns event, Koddly sells tickets).

**Issue:** EVENT_COMPLETED rule in V67:604-609 doesn't explicitly recognize revenue — but commission already recognized in TICKET_SOLD, so just moving liability 2100 → 2500 is correct. **No fix needed** unless business model changes to "recognize all revenue at event completion" (then TICKET_SOLD would defer everything, EVENT_COMPLETED would recognize).

---

### Rent Rules (Mixed Treatment)

**Current (CORRECT for platform fee model):**
```
RENT_INVOICE_ISSUED:
  1100 DR charge             (tenant owes)
  9000 CR charge             (suspense — not our income)

RENT_PAYMENT_RECEIVED:
  9000 DR charge             (clear suspense)
  1100 CR charge             (clear receivable)
  1300 DR platform_fee       (our fee)
  3010 CR platform_fee       (revenue)
```

**Why correct:** Koddly is **pure agent** for rent (landlord owns property, Koddly just collects). Suspense account (9000) used because rent is not Koddly income — just pass-through. Only platform fee is ours.

**Issue:** Suspense account usage is confusing. Better approach: **control vs subledger**:
```
RENT_INVOICE_ISSUED:
  1100 DR charge (Accounts Receivable — Rent, control account)
  1150 CR charge (Rent Collected for Landlords, contra-asset)
  -- OR --
  Don't post until payment received (cash-basis for landlord income)

RENT_PAYMENT_RECEIVED:
  1000 DR charge             (MoMo received)
  1100 CR charge             (clear receivable)
  1300 DR platform_fee       (our commission)
  3010 CR platform_fee       (revenue)
  1150 DR charge             (clear contra-asset)
  2XXX CR charge             (Landlord Payable — owe landlord their share)
```

But current model works if reconciled properly. **No urgent fix** but consider refactoring in Phase 4.

---

END OF REPORT
