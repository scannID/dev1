# Accounting vs Ledger — Implementation Explained

## Executive Summary

Scanny has **two separate financial tracking systems** serving different purposes:

| System | Purpose | Use Case | Complexity |
|--------|---------|----------|------------|
| **Financial Ledger** | Operational revenue tracking | "How much did we make today?" | Simple |
| **Double-Entry Accounting** | Compliance & financial statements | "Show me the balance sheet for audit" | Complex |

**Why both?** The Financial Ledger is fast, simple, and purpose-built for business dashboards. The Accounting system is correct, auditable, and compliant with GAAP principles for legal/regulatory requirements.

---

## System 1: Financial Ledger (Simple)

### What It Does
Tracks **settled revenue** for business operations:
- Merchant dashboards: "How much I earned this week?"
- Platform metrics: "Total MoMo commissions today?"
- COGS tracking: "Ingredient costs this month?"

### Schema
```sql
CREATE TABLE financial_ledger_entries (
    id              UUID PRIMARY KEY,
    order_id        VARCHAR(36) NOT NULL,
    business_id     VARCHAR(36) NOT NULL,
    entry_type      VARCHAR(10) NOT NULL,  -- PAYMENT | REFUND
    
    -- Money (all BIGINT, UGX minor units)
    gross_amount    BIGINT NOT NULL,       -- Customer paid
    net_amount      BIGINT NOT NULL,       -- Merchant gets
    service_fee     BIGINT NOT NULL,       -- Platform fee
    pso_fee         BIGINT NOT NULL,       -- MoMo provider fee
    platform_fee    BIGINT NOT NULL,       -- Scanny's cut
    cogs_amount     BIGINT NOT NULL,       -- Ingredient cost
    
    payment_method  VARCHAR(16) NOT NULL,  -- MOMO | CASH
    settled_at      TIMESTAMPTZ NOT NULL,  -- When money moved
    created_at      TIMESTAMPTZ NOT NULL
);

-- Covering index for fast queries
CREATE INDEX idx_fle_business_settled 
ON financial_ledger_entries (business_id, settled_at);
```

### Example Entry
```
Order #12345 paid via MoMo:
┌─────────────────┬─────────┐
│ gross_amount    │ 15,000  │  Customer paid 15k
│ net_amount      │ 13,650  │  Merchant gets 13,650
│ service_fee     │  1,350  │  Platform fee (9%)
│ pso_fee         │    600  │  MoMo fee
│ platform_fee    │    750  │  Scanny's cut
│ cogs_amount     │  4,200  │  Ingredient cost
│ entry_type      │ PAYMENT │
└─────────────────┴─────────┘
```

### How It Works
1. **Order paid** → `OrderService.applyPaidSideEffects()`
2. **Write ledger** → `LedgerWriterService.recordPayment(order)`
3. **Create row** → `FinancialLedgerEntry.payment(...)`
4. **Idempotency** → Check `existsByOrderIdAndEntryType()` before writing
5. **Refunds** → Create new REFUND row with **negated amounts** (never update PAYMENT row)

**File:** `com.scanny.entity.FinancialLedgerEntry`  
**Service:** `com.scanny.service.LedgerWriterService`

---

### Why Refunds Are Negative Rows

**Instead of:**
```sql
-- ❌ Mutating the original (breaks audit trail)
UPDATE financial_ledger_entries 
SET gross_amount = 0, net_amount = 0 
WHERE order_id = '12345';
```

**We do:**
```sql
-- ✅ Append a negative row (preserves history)
INSERT INTO financial_ledger_entries (
    order_id, entry_type, gross_amount, net_amount, ...
) VALUES (
    '12345', 'REFUND', -15000, -13650, ...
);
```

**Benefit:** `SUM(net_amount)` automatically gives correct settled revenue:
```sql
-- One query, no special cases
SELECT SUM(net_amount) as net_revenue
FROM financial_ledger_entries
WHERE business_id = 'abc123'
  AND settled_at BETWEEN '2026-11-01' AND '2026-11-30';
```

Result:
- PAYMENT row: +13,650
- REFUND row: -13,650
- **Total: 0** (correct!)

---

### Query Examples

#### Daily Revenue Dashboard
```sql
SELECT 
    DATE(settled_at) as day,
    SUM(gross_amount) as gross_revenue,
    SUM(net_amount) as net_revenue,
    SUM(platform_fee) as platform_earnings,
    SUM(cogs_amount) as cogs
FROM financial_ledger_entries
WHERE business_id = 'abc123'
  AND settled_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(settled_at)
ORDER BY day DESC;
```

#### COGS Margin Analysis
```sql
SELECT 
    net_amount - cogs_amount as profit,
    (net_amount - cogs_amount) * 100.0 / net_amount as profit_margin
FROM financial_ledger_entries
WHERE business_id = 'abc123'
  AND entry_type = 'PAYMENT'
  AND settled_at BETWEEN '2026-11-01' AND '2026-11-30';
```

---

## System 2: Double-Entry Accounting (Complex)

### What It Does
Provides **GAAP-compliant financial statements**:
- Balance sheets for investors
- Income statements for tax filing
- Audit trails for regulators
- Multi-entity consolidation (restaurants, rent, ticketing)

### Schema

#### Chart of Accounts
```sql
CREATE TABLE accounting.accounts (
    id              SERIAL PRIMARY KEY,
    code            VARCHAR(20) UNIQUE,     -- '1100', '3010'
    name            VARCHAR(120),           -- 'Cash', 'Revenue'
    account_type    VARCHAR(12),            -- ASSET | LIABILITY | EQUITY | REVENUE | EXPENSE
    normal_balance  VARCHAR(6),             -- DEBIT | CREDIT
    module_tag      VARCHAR(16),            -- RESTAURANTS | RENT | TICKETING
    is_control      BOOLEAN,                -- Aggregate account
    is_system       BOOLEAN,                -- System-managed
    is_active       BOOLEAN
);
```

Example accounts:
```
Code  │ Name                         │ Type      │ Normal Balance
──────┼──────────────────────────────┼───────────┼────────────────
1100  │ Cash — MoMo                  │ ASSET     │ DEBIT
1200  │ Accounts Receivable — Rent   │ ASSET     │ DEBIT
2100  │ Merchant Payables            │ LIABILITY │ CREDIT
3000  │ Retained Earnings            │ EQUITY    │ CREDIT
4100  │ Restaurant Revenue           │ REVENUE   │ CREDIT
5100  │ MoMo PSO Fees                │ EXPENSE   │ DEBIT
```

#### Journal Entries
```sql
CREATE TABLE accounting.journal_entries (
    id                  BIGSERIAL PRIMARY KEY,
    entry_date          DATE NOT NULL,
    period_label        VARCHAR(7),             -- '2026-11'
    source_module       VARCHAR(16),            -- RESTAURANTS | RENT | TICKETING
    source_event_type   VARCHAR(80),            -- ORDER_PAID
    source_event_id     VARCHAR(120) UNIQUE,    -- order-12345 (idempotency key)
    description         TEXT,
    entry_hash          VARCHAR(64),            -- SHA-256 hash chain
    prev_entry_hash     VARCHAR(64),            -- Links to previous entry
    status              VARCHAR(12),            -- POSTED | REVERSED | REVERSAL
    posted_at           TIMESTAMPTZ
);

CREATE TABLE accounting.journal_lines (
    id                  BIGSERIAL PRIMARY KEY,
    entry_id            BIGINT REFERENCES accounting.journal_entries(id),
    line_number         INTEGER,
    account_id          INTEGER REFERENCES accounting.accounts(id),
    amount_ugx          BIGINT NOT NULL,        -- Always positive
    entry_type          VARCHAR(6),             -- DEBIT | CREDIT
    description         TEXT
);

-- CONSTRAINT: Every entry must balance
-- SUM(debits) = SUM(credits) per entry_id
```

---

### Example Entry: Order Paid

**Business Event:**
```
Order #12345 paid: 15,000 UGX
- Merchant gets: 13,650
- Platform fee: 750
- PSO fee: 600
```

**Journal Entry (Double-Entry):**
```
Date: 2026-11-16
Entry ID: 123
Source: RESTAURANTS / ORDER_PAID / order-12345
Description: "Restaurant order #12345 — Samantha's Kitchen"

┌──────┬────────────────────────────────┬────────┬────────┬──────────┐
│ Line │ Account                        │ Debit  │ Credit │ Balance  │
├──────┼────────────────────────────────┼────────┼────────┼──────────┤
│  1   │ 1100 Cash — MoMo               │ 15,000 │        │ +15,000  │ Asset ↑
│  2   │ 4100 Restaurant Revenue        │        │ 15,000 │ +15,000  │ Revenue ↑
│  3   │ 5100 MoMo PSO Fees             │    600 │        │     +600 │ Expense ↑
│  4   │ 1100 Cash — MoMo               │        │    600 │  +14,400 │ Asset ↓
│  5   │ 5200 Platform Commission       │    750 │        │     +750 │ Expense ↑
│  6   │ 2100 Merchant Payables         │        │  13650 │ +13,650  │ Liability ↑
├──────┼────────────────────────────────┼────────┼────────┼──────────┤
│      │ **TOTAL**                      │ 16,350 │ 16,350 │ BALANCED │
└──────┴────────────────────────────────┴────────┴────────┴──────────┘
```

**Verification:**
- Total Debits: 15,000 + 600 + 750 = **16,350**
- Total Credits: 15,000 + 600 + 13,650 = **16,350**
- ✅ **Balanced** (enforced by database constraint)

---

### How It Works

#### 1. Event Published
```java
// In OrderService.applyPaidSideEffects()
accountingEventPublisher.publish(new AccountingEvent(
    eventId:                "order-" + orderId,
    eventType:              "ORDER_PAID",
    sourceModule:           "RESTAURANTS",
    sourceRecordId:         orderId,
    grossAmountUgx:         15000,
    platformCommissionUgx:  750,
    payeeAmountUgx:         13650,
    pspFeeUgx:              600,
    merchantId:             "abc123",
    description:            "Restaurant order #12345"
));
```

#### 2. Outbox Queue
Event inserted into `outbox_events` table in **same transaction** as order update:
```sql
INSERT INTO outbox_events (event_type, channel, payload_json)
VALUES ('accounting.posting', 'accounting', '{"eventId":"order-12345",...}');
```

#### 3. Async Processing
```java
// OutboxDispatcher polls every 500ms
OutboxDispatcher.dispatchPending() 
    → AccountingEventConsumer.consume()
    → PostingService.post(accountingEvent)
```

#### 4. Posting Rules Lookup
```sql
SELECT * FROM accounting.posting_rules
WHERE source_module = 'RESTAURANTS'
  AND event_type = 'ORDER_PAID';
```

Returns rule template:
```json
{
  "rule_id": 5,
  "lines": [
    {
      "account_code": "1100",
      "entry_type": "DEBIT",
      "amount_field": "gross_amount_ugx",
      "description": "Cash received via MoMo"
    },
    {
      "account_code": "4100",
      "entry_type": "CREDIT",
      "amount_field": "gross_amount_ugx",
      "description": "Restaurant revenue"
    },
    {
      "account_code": "5100",
      "entry_type": "DEBIT",
      "amount_field": "psp_fee_ugx",
      "description": "MoMo PSO fee"
    },
    {
      "account_code": "1100",
      "entry_type": "CREDIT",
      "amount_field": "psp_fee_ugx",
      "description": "Cash reduced by PSO fee"
    },
    {
      "account_code": "5200",
      "entry_type": "DEBIT",
      "amount_field": "platform_commission_ugx",
      "description": "Platform commission expense"
    },
    {
      "account_code": "2100",
      "entry_type": "CREDIT",
      "amount_field": "payee_amount_ugx",
      "description": "Merchant payable"
    }
  ]
}
```

#### 5. Journal Entry Creation
```java
// PostingService.post()
JournalEntry entry = new JournalEntry(
    entryDate:        LocalDate.now(),
    periodLabel:      "2026-11",
    sourceModule:     "RESTAURANTS",
    sourceEventType:  "ORDER_PAID",
    sourceEventId:    "order-12345",
    description:      "Restaurant order #12345"
);

// Expand each rule line
for (RuleLine ruleLine : postingRule.getLines()) {
    long amount = accountingEvent.getAmountField(ruleLine.getAmountField());
    if (amount == 0) continue; // Skip zero-amount lines
    
    JournalLine line = new JournalLine(
        entry:       entry,
        accountId:   resolveAccount(ruleLine.getAccountCode()),
        amountUgx:   amount,
        entryType:   ruleLine.getEntryType(), // DEBIT | CREDIT
        description: ruleLine.getDescription()
    );
    entry.addLine(line);
}
```

#### 6. Hash Chain Computation
```java
// Prevent tampering with blockchain-style hash chain
String prevHash = getLatestEntryHash(); // From previous entry
String entryData = entry.getEntryDate() + "|" + 
                   entry.getSourceModule() + "|" + 
                   entry.getSourceEventId() + "|" + 
                   entry.getTotalAmount();

String hash = SHA256(prevHash + entryData);
entry.setEntryHash(hash);
entry.setPrevEntryHash(prevHash);
```

#### 7. Balance Verification
```java
// Belt-and-suspenders check before commit
long totalDebits = entry.getLines().stream()
    .filter(l -> l.getEntryType().equals("DEBIT"))
    .mapToLong(JournalLine::getAmountUgx)
    .sum();

long totalCredits = entry.getLines().stream()
    .filter(l -> l.getEntryType().equals("CREDIT"))
    .mapToLong(JournalLine::getAmountUgx)
    .sum();

if (totalDebits != totalCredits) {
    throw new PostingException("Entry does not balance: debits=" + 
        totalDebits + ", credits=" + totalCredits);
}
```

#### 8. Database Commit
```sql
-- Insert entry
INSERT INTO accounting.journal_entries (...) VALUES (...);

-- Insert lines
INSERT INTO accounting.journal_lines (...) VALUES (...);

-- DEFERRED CONSTRAINT trigger checks balance at commit time
-- If SUM(debits) != SUM(credits), transaction rolls back
```

---

### Immutability & Audit Trail

**Never UPDATE or DELETE journal entries.** Enforced by database trigger:

```sql
CREATE OR REPLACE FUNCTION accounting.prevent_journal_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Journal entries are immutable. Use REVERSAL entries to correct errors.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_journal_updates
BEFORE UPDATE OR DELETE ON accounting.journal_entries
FOR EACH ROW EXECUTE FUNCTION accounting.prevent_journal_mutation();
```

**To correct an error:**

1. **Create REVERSAL entry** (swaps debits ↔ credits)
```
Original Entry #123:
  DR Cash         15,000
  CR Revenue      15,000

Reversal Entry #456:
  DR Revenue      15,000  ← Was credit, now debit
  CR Cash         15,000  ← Was debit, now credit
```

2. **Create correcting entry** (the right transaction)
```
Corrected Entry #457:
  DR Cash         14,000  ← Correct amount
  CR Revenue      14,000
```

**Audit trail preserved:**
- Entry #123: Original (wrong)
- Entry #456: Reversal of #123
- Entry #457: Correction
- **Net effect:** 14,000 revenue (correct)

---

### Accounting Periods

```sql
CREATE TABLE accounting.periods (
    period_label  VARCHAR(7) UNIQUE,   -- '2026-11'
    status        VARCHAR(8),          -- OPEN | CLOSED
    opens_at      DATE,
    closes_at     DATE,
    closed_by     VARCHAR(255),
    closed_at     TIMESTAMPTZ
);
```

**Period Locking:**
- ✅ Can post to OPEN periods
- ❌ Cannot post to CLOSED periods (enforced by trigger)

**Why?** Prevents backdating entries after month-end close for regulatory compliance.

Example:
```sql
-- November closed on Dec 1st
UPDATE accounting.periods 
SET status = 'CLOSED', closed_by = 'admin@scanny.com', closed_at = NOW()
WHERE period_label = '2026-11';

-- Attempting to post to November now fails
INSERT INTO accounting.journal_entries (period_label, ...) 
VALUES ('2026-11', ...);
-- ERROR: Cannot post to CLOSED period 2026-11
```

---

## Key Differences Summary

| Aspect | Financial Ledger | Double-Entry Accounting |
|--------|------------------|------------------------|
| **Purpose** | Operational dashboards | Financial statements |
| **Schema** | Single table | Multi-table (accounts, entries, lines, periods) |
| **Records** | One row per payment/refund | Multiple lines per entry (debits + credits) |
| **Balance** | Not required | Must balance (SUM(DR) = SUM(CR)) |
| **Immutability** | Write-once (negative refunds) | Write-once (reversal entries) |
| **Complexity** | Simple aggregation | Rule-based posting logic |
| **Query Speed** | Fast (indexed by business+date) | Slower (join 3+ tables) |
| **Use Case** | "Revenue this week?" | "Balance sheet as of Dec 31?" |
| **Compliance** | Internal reporting | GAAP, tax audits |
| **Transaction Model** | REQUIRES_NEW (independent) | REQUIRES_NEW (independent) |
| **Idempotency** | Check `existsByOrderId` | Check `source_event_id` unique |

---

## When Each System Updates

| Event | Financial Ledger | Double-Entry Accounting |
|-------|------------------|------------------------|
| **Order Paid** | ✅ Immediate | ✅ Via outbox (500ms delay) |
| **Order Refunded** | ✅ Negative row | ✅ Reversal entry |
| **Rent Payment** | ❌ No ledger entry | ✅ Journal entry |
| **Ticket Sold** | ❌ No ledger entry | ✅ Journal entry |
| **Manual Adjustment** | ❌ Cannot do | ✅ Manual journal entry |

**Why the difference?**
- Financial Ledger only tracks **restaurant orders** (original use case)
- Accounting system tracks **all financial events** (restaurants, rent, ticketing, adjustments)

---

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Order Paid Event                                  │
│                  (OrderService Transaction)                          │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                ┌────────────┴─────────────┐
                │                          │
                ▼                          ▼
┌───────────────────────────┐  ┌──────────────────────────────────────┐
│  FinancialLedgerEntry     │  │  AccountingEvent → Outbox            │
│                           │  │                                      │
│  • Simple INSERT          │  │  • INSERT into outbox_events         │
│  • REQUIRES_NEW tx        │  │  • Same transaction as order         │
│  • Idempotent check       │  │  • Queued for async processing       │
│  • Fast (1 table)         │  │                                      │
└───────────────────────────┘  └──────────────┬───────────────────────┘
        │                                     │
        │                                     │ (500ms later)
        │                                     ▼
        │                      ┌──────────────────────────────────────┐
        │                      │  OutboxDispatcher.dispatchPending()  │
        │                      └──────────────┬───────────────────────┘
        │                                     │
        │                                     ▼
        │                      ┌──────────────────────────────────────┐
        │                      │  AccountingEventConsumer.consume()   │
        │                      └──────────────┬───────────────────────┘
        │                                     │
        │                                     ▼
        │                      ┌──────────────────────────────────────┐
        │                      │  PostingService.post()               │
        │                      │                                      │
        │                      │  1. Lookup posting rule              │
        │                      │  2. Resolve accounts                 │
        │                      │  3. Create journal entry             │
        │                      │  4. Expand rule lines                │
        │                      │  5. Compute hash chain               │
        │                      │  6. Verify balance                   │
        │                      │  7. INSERT journal_entries + lines   │
        │                      │  8. Commit REQUIRES_NEW tx           │
        │                      └──────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────────┐
│                          Both Systems Updated                         │
│                                                                       │
│  Financial Ledger:        Accounting:                                 │
│  • SELECT SUM(net_amount) • SELECT account, SUM(debit-credit)        │
│    FROM ledger              FROM journal_entries                     │
│    WHERE business = X       JOIN journal_lines                       │
│    → Dashboard KPIs         WHERE period = '2026-11'                 │
│                             → Balance Sheet, Income Statement        │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Why Two Systems?

### Historical Context
1. **Phase 1 (2024):** Built `financial_ledger_entries` for merchant dashboards
   - Fast queries
   - Simple aggregation
   - Restaurant-focused

2. **Phase 2 (2025):** Added rent & ticketing modules
   - Needed proper accounting for multi-entity business
   - Regulators require GAAP-compliant books
   - Tax filing needs double-entry records

3. **Decision:** Keep both
   - Financial Ledger: Optimized for operational queries
   - Accounting: Correct, auditable, multi-module

**Alternative considered:** Delete financial ledger, query accounting only
- ❌ **Rejected:** Accounting queries are 5-10x slower (join 3 tables, aggregate debits/credits)
- ✅ **Chosen:** Maintain both, let each system excel at its purpose

---

## Files Reference

### Financial Ledger
```
backend/src/main/java/com/scanny/
├── entity/
│   └── FinancialLedgerEntry.java          # Entity
├── repository/
│   └── FinancialLedgerRepository.java     # JPA repo
└── service/
    └── LedgerWriterService.java           # Write service
```

### Double-Entry Accounting
```
backend/src/main/java/com/scanny/accounting/
├── entity/
│   ├── Account.java                       # Chart of accounts
│   ├── AccountingPeriod.java              # Month/year periods
│   ├── JournalEntry.java                  # Entry header
│   ├── JournalLine.java                   # Entry lines (DR/CR)
│   ├── PostingRule.java                   # Event → Entry mapping
│   └── PostingFailure.java                # Error log
├── repository/
│   ├── AccountRepository.java
│   ├── AccountingPeriodRepository.java
│   ├── JournalEntryRepository.java
│   ├── JournalLineRepository.java
│   └── PostingRuleRepository.java
├── AccountingEvent.java                   # Event value object
├── AccountingEventPublisher.java          # Outbox publisher
├── AccountingEventConsumer.java           # Outbox consumer
├── PostingService.java                    # Core posting engine
└── AdminAccountingController.java         # Admin API
```

### Database Migrations
```
backend/src/main/resources/db/migration/
├── V67__accounting_schema.sql             # Full accounting setup
│   ├── CREATE SCHEMA accounting
│   ├── CREATE TABLE accounts
│   ├── CREATE TABLE periods
│   ├── CREATE TABLE journal_entries
│   ├── CREATE TABLE journal_lines
│   ├── CREATE TABLE posting_rules
│   ├── CREATE FUNCTION prevent_journal_mutation()
│   ├── CREATE FUNCTION enforce_balance()
│   └── INSERT default posting rules
└── V{old}__financial_ledger.sql           # Ledger table (earlier migration)
```

---

## Admin Console Views

### Accounting Ledger Page
**URL:** `/admin/accounting/ledger`

**Queries:**
```sql
-- Journal entries with lines
SELECT 
    e.id,
    e.entry_date,
    e.source_module,
    e.source_event_type,
    e.description,
    l.account_id,
    a.code,
    a.name,
    l.amount_ugx,
    l.entry_type  -- DEBIT | CREDIT
FROM accounting.journal_entries e
JOIN accounting.journal_lines l ON l.entry_id = e.id
JOIN accounting.accounts a ON a.id = l.account_id
WHERE e.period_label = '2026-11'
ORDER BY e.id, l.line_number;
```

**Displays:**
- Date, Description
- Account Code, Account Name
- Debit Amount, Credit Amount
- Running Balance

---

### Financial Ledger Page
**URL:** `/admin/accounting/restaurants` (legacy)

**Queries:**
```sql
-- Merchant revenue summary
SELECT 
    business_id,
    SUM(gross_amount) as gross_revenue,
    SUM(net_amount) as net_revenue,
    SUM(platform_fee) as platform_earnings,
    COUNT(*) as transaction_count
FROM financial_ledger_entries
WHERE settled_at BETWEEN :start AND :end
  AND entry_type = 'PAYMENT'
GROUP BY business_id;
```

**Displays:**
- Business Name
- Gross Revenue
- Net Revenue (after fees)
- Platform Earnings
- Transaction Count

---

## Common Questions

### Q: Why not just use accounting for everything?
**A:** Performance. Merchant dashboards query revenue hundreds of times per day. Accounting requires joining 3 tables and aggregating debits/credits. Financial ledger is a single table with covering index → 10x faster.

### Q: Can the two systems get out of sync?
**A:** Yes, but rare. Both writes use `REQUIRES_NEW` transactions. If accounting post fails, it's logged in `posting_failures` table and can be retried. Financial ledger is idempotent (checks `existsByOrderId`).

### Q: Why not delete financial ledger and optimize accounting queries?
**A:** Considered, but:
- Accounting correctness > speed (can't compromise for performance)
- Financial ledger is already built, tested, and fast
- Cost of maintaining both < cost of rewriting all dashboard queries

### Q: How do you verify they match?
**A:** Reconciliation script (run monthly):
```sql
-- Compare totals
SELECT 
    'Ledger' as source,
    SUM(gross_amount) as total_revenue
FROM financial_ledger_entries
WHERE settled_at BETWEEN :start AND :end

UNION ALL

SELECT 
    'Accounting' as source,
    SUM(CASE WHEN l.entry_type = 'CREDIT' THEN l.amount_ugx ELSE 0 END) as total_revenue
FROM accounting.journal_entries e
JOIN accounting.journal_lines l ON l.entry_id = e.id
JOIN accounting.accounts a ON a.id = l.account_id
WHERE a.code = '4100'  -- Restaurant Revenue account
  AND e.entry_date BETWEEN :start AND :end;
```

If totals don't match → investigate `posting_failures` table.

---

## Summary

| When to Use | Financial Ledger | Double-Entry Accounting |
|-------------|------------------|------------------------|
| Merchant dashboard | ✅ Fast, simple | ❌ Too slow |
| Platform revenue report | ✅ Good enough | ✅ More accurate |
| Tax filing | ❌ Not compliant | ✅ Required |
| Balance sheet | ❌ Can't produce | ✅ Only source |
| Investor reports | ❌ Incomplete | ✅ Full picture |
| Daily ops monitoring | ✅ Perfect | ❌ Overkill |

**In one sentence:**  
Financial Ledger = operational speed, Double-Entry Accounting = financial correctness.

Both systems coexist because they optimize for different goals: **dashboard performance** vs **accounting compliance**.
