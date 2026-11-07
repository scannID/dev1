-- =============================================================================
-- V67 — Accounting schema (double-entry ledger)
--
-- Design principles:
--   • Dedicated schema: accounting.*  — isolated from operational tables.
--   • Money stored as BIGINT (UGX minor units = integer shillings; no decimal).
--   • Journal entries are IMMUTABLE. No UPDATE or DELETE on journal_entries
--     or journal_lines — enforced by trigger.
--   • Every entry must balance: SUM(debits) = SUM(credits) per entry_id,
--     enforced by a DEFERRED constraint trigger that fires at commit time.
--   • Hash-chain tamper evidence: each entry stores SHA-256 of its own
--     content + the previous entry's hash.
--   • Idempotency: source_module + source_event_id must be unique.
--   • Period locking: postings into a CLOSED period are rejected by trigger.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS accounting;

-- ── 1. Chart of accounts ──────────────────────────────────────────────────────
--
-- Standard account types: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE.
-- module_tag: ALL | RESTAURANTS | RENT | TICKETING
-- normal_balance: DEBIT accounts grow with debits (assets, expenses);
--                 CREDIT accounts grow with credits (liabilities, equity, revenue).
-- is_control: TRUE for control accounts (e.g. "Accounts Receivable — Rent");
--             each tenant gets a subledger entry but the control account
--             holds the aggregate.
-- is_system: TRUE means the row was seeded by migration and cannot be
--            deactivated or renamed by the application.
-- =============================================================================

CREATE TABLE accounting.accounts (
    id              SERIAL PRIMARY KEY,
    code            VARCHAR(20)  NOT NULL UNIQUE,          -- e.g. '1100', '3010'
    name            VARCHAR(120) NOT NULL,
    account_type    VARCHAR(12)  NOT NULL
                        CHECK (account_type IN ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE')),
    normal_balance  VARCHAR(6)   NOT NULL
                        CHECK (normal_balance IN ('DEBIT','CREDIT')),
    module_tag      VARCHAR(16)  NOT NULL DEFAULT 'ALL'
                        CHECK (module_tag IN ('ALL','RESTAURANTS','RENT','TICKETING')),
    parent_code     VARCHAR(20)  REFERENCES accounting.accounts(code),
    is_control      BOOLEAN      NOT NULL DEFAULT FALSE,
    is_system       BOOLEAN      NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    description     TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX ON accounting.accounts (account_type);
CREATE INDEX ON accounting.accounts (module_tag);

-- ── 2. Accounting periods ─────────────────────────────────────────────────────
--
-- One row per calendar month. Status: OPEN → CLOSED.
-- Closed periods reject new postings (enforced by trigger on journal_entries).
-- closed_by / closed_at: who closed it and when (audit trail).
-- =============================================================================

CREATE TABLE accounting.periods (
    id            SERIAL PRIMARY KEY,
    period_label  VARCHAR(7)   NOT NULL UNIQUE,   -- 'YYYY-MM', e.g. '2026-11'
    status        VARCHAR(8)   NOT NULL DEFAULT 'OPEN'
                      CHECK (status IN ('OPEN','CLOSED')),
    opens_at      DATE         NOT NULL,           -- first day of month
    closes_at     DATE         NOT NULL,           -- last day of month
    closed_by     VARCHAR(255),                    -- email of admin who closed it
    closed_at     TIMESTAMPTZ,
    notes         TEXT,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT period_dates_valid CHECK (opens_at <= closes_at)
);

-- Auto-open the current month on migration
INSERT INTO accounting.periods (period_label, opens_at, closes_at)
VALUES (TO_CHAR(NOW(), 'YYYY-MM'),
        DATE_TRUNC('month', NOW())::DATE,
        (DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day')::DATE);

-- ── 3. Journal entries ────────────────────────────────────────────────────────
--
-- One row per logical accounting transaction.
-- source_module:   RESTAURANTS | RENT | TICKETING | MANUAL | SYSTEM
-- source_event_id: the domain event's unique ID (idempotency key).
--                  UNIQUE(source_module, source_event_id) prevents double-posting.
-- entry_hash:      SHA-256 of (prev_entry_hash || entry fields).
-- prev_entry_hash: links to the previous entry's hash (hash chain).
-- status:          POSTED = normal; REVERSED = this entry has been reversed;
--                  REVERSAL = this entry reverses another.
-- reference_entry_id: for REVERSAL entries, the ID of the entry being reversed.
-- =============================================================================

CREATE TABLE accounting.journal_entries (
    id                  BIGSERIAL    PRIMARY KEY,
    entry_date          DATE         NOT NULL,
    period_label        VARCHAR(7)   NOT NULL
                            REFERENCES accounting.periods(period_label),
    source_module       VARCHAR(16)  NOT NULL
                            CHECK (source_module IN ('RESTAURANTS','RENT','TICKETING','MANUAL','SYSTEM')),
    source_event_type   VARCHAR(80)  NOT NULL,  -- e.g. 'ORDER_PAID', 'RENT_PAYMENT_RECEIVED'
    source_event_id     VARCHAR(120) NOT NULL,  -- domain event idempotency key
    source_record_id    VARCHAR(120),           -- order ID, charge ID, ticket ID, etc.
    description         TEXT         NOT NULL,
    currency            CHAR(3)      NOT NULL DEFAULT 'UGX',
    status              VARCHAR(10)  NOT NULL DEFAULT 'POSTED'
                            CHECK (status IN ('POSTED','REVERSED','REVERSAL')),
    reference_entry_id  BIGINT       REFERENCES accounting.journal_entries(id),

    -- Dimensions for reporting drill-down
    dim_merchant_id     VARCHAR(120),   -- restaurant merchant
    dim_property_id     VARCHAR(120),   -- rent property
    dim_tenant_id       VARCHAR(120),   -- rent tenant
    dim_event_id        VARCHAR(120),   -- ticketing event
    dim_payment_method  VARCHAR(32),    -- MOMO | CASH | CARD

    -- Tamper evidence
    entry_hash          CHAR(64)     NOT NULL,  -- SHA-256 hex
    prev_entry_hash     CHAR(64),               -- NULL for the very first entry

    -- Audit
    posted_by           VARCHAR(255) NOT NULL DEFAULT 'system',
    posted_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    -- Idempotency: same event can never be posted twice
    CONSTRAINT uq_journal_idempotency UNIQUE (source_module, source_event_id)
);

CREATE INDEX ON accounting.journal_entries (entry_date);
CREATE INDEX ON accounting.journal_entries (period_label);
CREATE INDEX ON accounting.journal_entries (source_module);
CREATE INDEX ON accounting.journal_entries (source_event_type);
CREATE INDEX ON accounting.journal_entries (source_record_id);
CREATE INDEX ON accounting.journal_entries (dim_merchant_id);
CREATE INDEX ON accounting.journal_entries (dim_property_id);
CREATE INDEX ON accounting.journal_entries (dim_event_id);
CREATE INDEX ON accounting.journal_entries (status);
CREATE INDEX ON accounting.journal_entries (posted_at);

-- ── 4. Journal lines ──────────────────────────────────────────────────────────
--
-- Two or more rows per journal_entry (debits + credits must balance).
-- amount: always positive BIGINT in UGX minor units (shillings).
-- side:   DEBIT or CREDIT.
-- =============================================================================

CREATE TABLE accounting.journal_lines (
    id          BIGSERIAL    PRIMARY KEY,
    entry_id    BIGINT       NOT NULL REFERENCES accounting.journal_entries(id),
    account_id  INT          NOT NULL REFERENCES accounting.accounts(id),
    side        VARCHAR(6)   NOT NULL CHECK (side IN ('DEBIT','CREDIT')),
    amount      BIGINT       NOT NULL CHECK (amount > 0),  -- UGX minor units, always positive
    currency    CHAR(3)      NOT NULL DEFAULT 'UGX',
    memo        VARCHAR(255),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX ON accounting.journal_lines (entry_id);
CREATE INDEX ON accounting.journal_lines (account_id);
CREATE INDEX ON accounting.journal_lines (side);

-- ── 5. Posting rules ──────────────────────────────────────────────────────────
--
-- Configurable mapping: event_type → list of account codes and sides.
-- The PostingService reads these rules to build journal lines.
-- rule_json stores the line template as JSON:
--   [{"account_code":"1000","side":"DEBIT","amount_field":"platform_fee_ugx"},
--    {"account_code":"3000","side":"CREDIT","amount_field":"platform_fee_ugx"}]
-- amount_field refers to a named field in the domain event payload.
-- is_active: FALSE rules are skipped (soft-disable without deleting).
-- =============================================================================

CREATE TABLE accounting.posting_rules (
    id              SERIAL       PRIMARY KEY,
    source_module   VARCHAR(16)  NOT NULL,
    event_type      VARCHAR(80)  NOT NULL,
    description     TEXT         NOT NULL,
    rule_json       JSONB        NOT NULL,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ,
    CONSTRAINT uq_posting_rule UNIQUE (source_module, event_type)
);

CREATE INDEX ON accounting.posting_rules (source_module, event_type) WHERE is_active = TRUE;

-- ── 6. Subledger entries ──────────────────────────────────────────────────────
--
-- Tracks individual balances for entities that have their own running account
-- (rent tenants owe specific amounts; merchants have a commission ledger).
-- Links back to the journal_line that created or cleared the balance.
-- subledger_type: TENANT_RECEIVABLE | MERCHANT_COMMISSION | TICKET_DEFERRED
-- =============================================================================

CREATE TABLE accounting.subledger_entries (
    id              BIGSERIAL    PRIMARY KEY,
    subledger_type  VARCHAR(32)  NOT NULL
                        CHECK (subledger_type IN
                            ('TENANT_RECEIVABLE','MERCHANT_COMMISSION',
                             'TICKET_DEFERRED','ORGANISER_PAYABLE')),
    entity_id       VARCHAR(120) NOT NULL,  -- tenant_id, merchant_id, event_id
    entity_name     VARCHAR(255),
    journal_line_id BIGINT       NOT NULL REFERENCES accounting.journal_lines(id),
    side            VARCHAR(6)   NOT NULL CHECK (side IN ('DEBIT','CREDIT')),
    amount          BIGINT       NOT NULL CHECK (amount > 0),
    balance_after   BIGINT       NOT NULL,  -- running balance after this entry
    reference_label VARCHAR(120),           -- period label or order ref for display
    entry_date      DATE         NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX ON accounting.subledger_entries (subledger_type, entity_id);
CREATE INDEX ON accounting.subledger_entries (entry_date);
CREATE INDEX ON accounting.subledger_entries (journal_line_id);

-- ── 7. Manual journal requests ───────────────────────────────────────────────
--
-- Maker-checker workflow for manual entries.
-- A manual entry is drafted here first; once approved it is posted to
-- journal_entries/journal_lines and this row is marked APPROVED.
-- Lines stored as JSONB until approved (same structure as posting_rules).
-- =============================================================================

CREATE TABLE accounting.manual_journal_requests (
    id              BIGSERIAL    PRIMARY KEY,
    entry_date      DATE         NOT NULL,
    description     TEXT         NOT NULL,
    lines_json      JSONB        NOT NULL,  -- [{account_code, side, amount, memo}]
    attachment_url  TEXT,
    status          VARCHAR(12)  NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING','APPROVED','REJECTED')),
    submitted_by    VARCHAR(255) NOT NULL,
    submitted_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    reviewed_by     VARCHAR(255),
    reviewed_at     TIMESTAMPTZ,
    reviewer_notes  TEXT,
    journal_entry_id BIGINT      REFERENCES accounting.journal_entries(id)
);

CREATE INDEX ON accounting.manual_journal_requests (status);
CREATE INDEX ON accounting.manual_journal_requests (submitted_by);

-- ── 8. Dead-letter queue ──────────────────────────────────────────────────────
--
-- If PostingService fails to post an event (e.g. no matching rule,
-- validation error, DB error) the event lands here for manual investigation.
-- retry_count: how many times it has been retried.
-- last_error:  the exception message from the last attempt.
-- =============================================================================

CREATE TABLE accounting.posting_failures (
    id              BIGSERIAL    PRIMARY KEY,
    source_module   VARCHAR(16)  NOT NULL,
    source_event_type VARCHAR(80) NOT NULL,
    source_event_id VARCHAR(120) NOT NULL,
    payload_json    JSONB        NOT NULL,
    last_error      TEXT,
    retry_count     INT          NOT NULL DEFAULT 0,
    status          VARCHAR(10)  NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING','RESOLVED','IGNORED')),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);

CREATE INDEX ON accounting.posting_failures (status);
CREATE INDEX ON accounting.posting_failures (source_module, source_event_type);

-- ── 9. Audit log ─────────────────────────────────────────────────────────────
--
-- Records every action that changes accounting data.
-- actor:        email of the admin/system that performed the action.
-- action_type:  PERIOD_CLOSED | MANUAL_ENTRY_SUBMITTED | MANUAL_ENTRY_APPROVED |
--               MANUAL_ENTRY_REJECTED | ACCOUNT_DEACTIVATED | RULE_UPDATED
-- target_type:  what kind of object was affected.
-- target_id:    the ID of the affected object.
-- diff_json:    before/after snapshot.
-- =============================================================================

CREATE TABLE accounting.audit_log (
    id          BIGSERIAL    PRIMARY KEY,
    actor       VARCHAR(255) NOT NULL,
    actor_ip    VARCHAR(45),
    action_type VARCHAR(60)  NOT NULL,
    target_type VARCHAR(60)  NOT NULL,
    target_id   VARCHAR(120) NOT NULL,
    diff_json   JSONB,
    occurred_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX ON accounting.audit_log (actor);
CREATE INDEX ON accounting.audit_log (action_type);
CREATE INDEX ON accounting.audit_log (occurred_at);

-- =============================================================================
-- INTEGRITY TRIGGERS
-- =============================================================================

-- ── T1. Journal entries are immutable ────────────────────────────────────────
-- Prevents any UPDATE or DELETE on posted journal entries or their lines.

CREATE OR REPLACE FUNCTION accounting.prevent_journal_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION
        'Journal entries and lines are immutable. '
        'Create a reversing entry instead. '
        'Attempted % on %.%',
        TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER trg_journal_entries_immutable
    BEFORE UPDATE OR DELETE ON accounting.journal_entries
    FOR EACH ROW EXECUTE FUNCTION accounting.prevent_journal_mutation();

CREATE TRIGGER trg_journal_lines_immutable
    BEFORE UPDATE OR DELETE ON accounting.journal_lines
    FOR EACH ROW EXECUTE FUNCTION accounting.prevent_journal_mutation();

-- ── T2. Period lock — reject postings into closed periods ────────────────────

CREATE OR REPLACE FUNCTION accounting.check_period_open()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_status VARCHAR(8);
BEGIN
    SELECT status INTO v_status
    FROM accounting.periods
    WHERE period_label = NEW.period_label;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Accounting period % does not exist. Create it first.', NEW.period_label;
    END IF;

    IF v_status = 'CLOSED' THEN
        RAISE EXCEPTION
            'Period % is CLOSED. Backdated postings are not allowed. '
            'Post to the current open period instead.',
            NEW.period_label;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_period_open
    BEFORE INSERT ON accounting.journal_entries
    FOR EACH ROW EXECUTE FUNCTION accounting.check_period_open();

-- ── T3. Balance check — debits must equal credits per entry ──────────────────
-- This is a DEFERRED constraint trigger: it fires at COMMIT time after all
-- lines for an entry have been inserted, not after each individual line.

CREATE OR REPLACE FUNCTION accounting.check_entry_balance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_balance BIGINT;
BEGIN
    SELECT COALESCE(SUM(CASE WHEN side = 'DEBIT' THEN amount ELSE -amount END), 0)
    INTO v_balance
    FROM accounting.journal_lines
    WHERE entry_id = NEW.entry_id;

    IF v_balance <> 0 THEN
        RAISE EXCEPTION
            'Journal entry % does not balance. '
            'Net debit/credit = % UGX. Every entry must balance to zero.',
            NEW.entry_id, v_balance;
    END IF;

    RETURN NEW;
END;
$$;

-- CONSTRAINT trigger fires per-statement, DEFERRED so all lines are present first
CREATE CONSTRAINT TRIGGER trg_check_entry_balance
    AFTER INSERT ON accounting.journal_lines
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION accounting.check_entry_balance();

-- ── T4. Auto-advance period — create next month's period automatically ───────

CREATE OR REPLACE FUNCTION accounting.auto_create_next_period()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_next_label VARCHAR(7);
    v_next_open  DATE;
    v_next_close DATE;
BEGIN
    v_next_label := TO_CHAR(NOW() + INTERVAL '1 month', 'YYYY-MM');
    v_next_open  := DATE_TRUNC('month', NOW() + INTERVAL '1 month')::DATE;
    v_next_close := (DATE_TRUNC('month', NOW() + INTERVAL '2 months') - INTERVAL '1 day')::DATE;

    INSERT INTO accounting.periods (period_label, opens_at, closes_at)
    VALUES (v_next_label, v_next_open, v_next_close)
    ON CONFLICT (period_label) DO NOTHING;

    RETURN NEW;
END;
$$;

-- Fires whenever an entry is posted — ensures next period always exists
CREATE TRIGGER trg_auto_create_next_period
    AFTER INSERT ON accounting.journal_entries
    FOR EACH STATEMENT EXECUTE FUNCTION accounting.auto_create_next_period();

-- =============================================================================
-- DEFAULT CHART OF ACCOUNTS
-- (seeded here, never touched by application UPDATE/DELETE)
-- =============================================================================

INSERT INTO accounting.accounts
    (code, name, account_type, normal_balance, module_tag, is_control, is_system, description)
VALUES
-- ── Assets ───────────────────────────────────────────────────────────────────
('1000', 'MoMo / PSP Clearing',                'ASSET',     'DEBIT',  'ALL',         FALSE, TRUE,
 'Clearing account for mobile money and PSP settlements. Debited when customer pays, credited when PSP settles to Koddly.'),

('1010', 'Cash Collected (Restaurant)',         'ASSET',     'DEBIT',  'RESTAURANTS', FALSE, TRUE,
 'Cash payments collected at restaurant. Settled separately from MoMo.'),

('1100', 'Accounts Receivable — Rent',          'ASSET',     'DEBIT',  'RENT',        TRUE,  TRUE,
 'Control account: total rent owed by all tenants. Debited on invoice, credited on payment.'),

('1200', 'Accounts Receivable — Tickets',       'ASSET',     'DEBIT',  'TICKETING',   TRUE,  TRUE,
 'Control account: ticket payments in transit (MoMo initiated but not yet settled).'),

('1300', 'Koddly Commission Receivable',        'ASSET',     'DEBIT',  'ALL',         TRUE,  TRUE,
 'Platform commission earned but not yet settled from PSP (net settlement lag).'),

-- ── Liabilities ──────────────────────────────────────────────────────────────
('2000', 'VAT Payable',                         'LIABILITY', 'CREDIT', 'ALL',         FALSE, TRUE,
 '18% VAT collected on behalf of URA. Credited on each taxable sale, debited on URA remittance.'),

('2100', 'Deferred Ticket Revenue',             'LIABILITY', 'CREDIT', 'TICKETING',   FALSE, TRUE,
 'Ticket sales proceeds held as liability until the event occurs. Recognized to revenue on event completion.'),

('2200', 'Security Deposits Held',              'LIABILITY', 'CREDIT', 'RENT',        FALSE, TRUE,
 'Refundable security deposits received from tenants. Liability until returned or applied to arrears.'),

('2300', 'Advance Rent (Prepaid Liability)',     'LIABILITY', 'CREDIT', 'RENT',        FALSE, TRUE,
 'Rent paid in advance of the billing period. Recognized to revenue in the correct period.'),

('2400', 'Merchant Payable',                    'LIABILITY', 'CREDIT', 'RESTAURANTS', FALSE, TRUE,
 'Amounts owed to restaurant merchants net of Koddly commission (cash orders). Not used for MoMo direct-to-merchant flows.'),

('2500', 'Organiser Payable',                   'LIABILITY', 'CREDIT', 'TICKETING',   FALSE, TRUE,
 'Ticket proceeds owed to event organisers net of Koddly commission, after event completion.'),

-- ── Revenue ──────────────────────────────────────────────────────────────────
('3000', 'Platform Commission — Restaurants',   'REVENUE',   'CREDIT', 'RESTAURANTS', FALSE, TRUE,
 'Koddly''s percentage or flat fee on each restaurant order.'),

('3010', 'Platform Commission — Rent',          'REVENUE',   'CREDIT', 'RENT',        FALSE, TRUE,
 'Koddly''s platform fee on each rent payment processed.'),

('3020', 'Platform Commission — Ticketing',     'REVENUE',   'CREDIT', 'TICKETING',   FALSE, TRUE,
 'Koddly''s commission on ticket sales (taken at sale, not at event completion).'),

('3100', 'Late Fee Income',                     'REVENUE',   'CREDIT', 'RENT',        FALSE, TRUE,
 'Late fees charged to tenants on overdue rent charges.'),

('3200', 'Event Promotion Revenue',             'REVENUE',   'CREDIT', 'TICKETING',   FALSE, TRUE,
 'Fees paid by organisers to promote events on the platform.'),

-- ── Expenses ─────────────────────────────────────────────────────────────────
('4000', 'PSP Transaction Fees',                'EXPENSE',   'DEBIT',  'ALL',         FALSE, TRUE,
 'Fees charged by MTN MoMo, Airtel Money, or other PSPs per transaction.'),

('4100', 'Refunds Issued — Restaurants',        'EXPENSE',   'DEBIT',  'RESTAURANTS', FALSE, TRUE,
 'Refunds granted on restaurant orders.'),

('4200', 'Refunds Issued — Ticketing',          'EXPENSE',   'DEBIT',  'TICKETING',   FALSE, TRUE,
 'Refunds granted on cancelled or transferred tickets.'),

-- ── Suspense / Control ───────────────────────────────────────────────────────
('9000', 'Suspense Account',                    'LIABILITY', 'CREDIT', 'ALL',         FALSE, TRUE,
 'Temporary holding account for unmatched or unidentified postings. Must be zero-balanced at period close.');

-- =============================================================================
-- DEFAULT POSTING RULES
-- Seeded for all three modules. The PostingService reads these at runtime.
-- amount_field names must match the fields emitted in the domain event payload.
-- =============================================================================

INSERT INTO accounting.posting_rules (source_module, event_type, description, rule_json)
VALUES

-- ── RESTAURANTS ──────────────────────────────────────────────────────────────

('RESTAURANTS', 'ORDER_PAID',
 'Customer pays for a restaurant order via MoMo. Koddly records its commission portion only.',
 '[
   {"account_code":"1300","side":"DEBIT",  "amount_field":"platform_commission_ugx","memo":"Commission receivable"},
   {"account_code":"3000","side":"CREDIT", "amount_field":"platform_commission_ugx","memo":"Platform commission earned"}
 ]'::jsonb),

('RESTAURANTS', 'ORDER_PAID_CASH',
 'Cash order paid. Merchant collects cash; Koddly records its commission as receivable.',
 '[
   {"account_code":"1300","side":"DEBIT",  "amount_field":"platform_commission_ugx","memo":"Commission receivable"},
   {"account_code":"3000","side":"CREDIT", "amount_field":"platform_commission_ugx","memo":"Platform commission earned"}
 ]'::jsonb),

('RESTAURANTS', 'ORDER_REFUNDED',
 'Restaurant order refunded. Reverses commission previously earned.',
 '[
   {"account_code":"4100","side":"DEBIT",  "amount_field":"platform_commission_ugx","memo":"Commission refund issued"},
   {"account_code":"1300","side":"CREDIT", "amount_field":"platform_commission_ugx","memo":"Reduce commission receivable"}
 ]'::jsonb),

('RESTAURANTS', 'COMMISSION_SETTLED',
 'PSP settles Koddly commission batch to Koddly bank/wallet.',
 '[
   {"account_code":"1000","side":"DEBIT",  "amount_field":"settled_amount_ugx","memo":"MoMo settlement received"},
   {"account_code":"1300","side":"CREDIT", "amount_field":"settled_amount_ugx","memo":"Clear commission receivable"},
   {"account_code":"4000","side":"DEBIT",  "amount_field":"psp_fee_ugx",       "memo":"PSP transaction fee"},
   {"account_code":"1000","side":"CREDIT", "amount_field":"psp_fee_ugx",       "memo":"PSP fee deducted from settlement"}
 ]'::jsonb),

-- ── RENT ─────────────────────────────────────────────────────────────────────

('RENT', 'RENT_INVOICE_ISSUED',
 'Rent charge generated for a tenant. Accrual: receivable before cash arrives.',
 '[
   {"account_code":"1100","side":"DEBIT",  "amount_field":"charge_amount_ugx","memo":"Rent receivable"},
   {"account_code":"9000","side":"CREDIT", "amount_field":"charge_amount_ugx","memo":"Suspense: landlord income not Koddly income"}
 ]'::jsonb),

('RENT', 'RENT_PAYMENT_RECEIVED',
 'Tenant pays rent. Clears receivable; records Koddly platform fee portion.',
 '[
   {"account_code":"9000","side":"DEBIT",  "amount_field":"charge_amount_ugx",    "memo":"Clear suspense on payment"},
   {"account_code":"1100","side":"CREDIT", "amount_field":"charge_amount_ugx",    "memo":"Clear rent receivable"},
   {"account_code":"1300","side":"DEBIT",  "amount_field":"platform_fee_ugx",     "memo":"Platform fee receivable"},
   {"account_code":"3010","side":"CREDIT", "amount_field":"platform_fee_ugx",     "memo":"Rent platform fee earned"}
 ]'::jsonb),

('RENT', 'RENT_PAYMENT_PARTIAL',
 'Tenant makes a partial rent payment.',
 '[
   {"account_code":"9000","side":"DEBIT",  "amount_field":"paid_amount_ugx",      "memo":"Clear suspense — partial"},
   {"account_code":"1100","side":"CREDIT", "amount_field":"paid_amount_ugx",      "memo":"Partial clearance of receivable"},
   {"account_code":"1300","side":"DEBIT",  "amount_field":"platform_fee_ugx",     "memo":"Platform fee on partial payment"},
   {"account_code":"3010","side":"CREDIT", "amount_field":"platform_fee_ugx",     "memo":"Rent platform fee earned"}
 ]'::jsonb),

('RENT', 'LATE_FEE_APPLIED',
 'Late fee added to an overdue rent charge.',
 '[
   {"account_code":"1100","side":"DEBIT",  "amount_field":"late_fee_ugx","memo":"Late fee receivable"},
   {"account_code":"3100","side":"CREDIT", "amount_field":"late_fee_ugx","memo":"Late fee income"}
 ]'::jsonb),

('RENT', 'SECURITY_DEPOSIT_RECEIVED',
 'Tenant pays security deposit.',
 '[
   {"account_code":"1000","side":"DEBIT",  "amount_field":"deposit_amount_ugx","memo":"Deposit received via MoMo"},
   {"account_code":"2200","side":"CREDIT", "amount_field":"deposit_amount_ugx","memo":"Security deposit liability"}
 ]'::jsonb),

('RENT', 'SECURITY_DEPOSIT_RETURNED',
 'Security deposit refunded to tenant on move-out.',
 '[
   {"account_code":"2200","side":"DEBIT",  "amount_field":"deposit_amount_ugx","memo":"Return security deposit"},
   {"account_code":"1000","side":"CREDIT", "amount_field":"deposit_amount_ugx","memo":"MoMo transfer to tenant"}
 ]'::jsonb),

-- ── TICKETING ─────────────────────────────────────────────────────────────────

('TICKETING', 'TICKET_SOLD',
 'Ticket purchased by customer. Revenue deferred until event occurs.',
 '[
   {"account_code":"1000","side":"DEBIT",  "amount_field":"ticket_price_ugx",    "memo":"MoMo payment received"},
   {"account_code":"2100","side":"CREDIT", "amount_field":"organiser_amount_ugx","memo":"Deferred: owed to organiser"},
   {"account_code":"1300","side":"DEBIT",  "amount_field":"platform_commission_ugx","memo":"Commission receivable"},
   {"account_code":"3020","side":"CREDIT", "amount_field":"platform_commission_ugx","memo":"Ticketing commission earned"}
 ]'::jsonb),

('TICKETING', 'EVENT_COMPLETED',
 'Event has taken place. Deferred revenue recognized; organiser payout recorded.',
 '[
   {"account_code":"2100","side":"DEBIT",  "amount_field":"total_organiser_amount_ugx","memo":"Recognise deferred revenue"},
   {"account_code":"2500","side":"CREDIT", "amount_field":"total_organiser_amount_ugx","memo":"Organiser payout payable"}
 ]'::jsonb),

('TICKETING', 'ORGANISER_PAYOUT_ISSUED',
 'Koddly pays out the organiser their share after event completion.',
 '[
   {"account_code":"2500","side":"DEBIT",  "amount_field":"payout_amount_ugx","memo":"Clear organiser payable"},
   {"account_code":"1000","side":"CREDIT", "amount_field":"payout_amount_ugx","memo":"MoMo transfer to organiser"}
 ]'::jsonb),

('TICKETING', 'TICKET_REFUNDED',
 'Customer refunded before or after event. Reverses sale entries.',
 '[
   {"account_code":"2100","side":"DEBIT",  "amount_field":"organiser_amount_ugx",   "memo":"Reverse deferred revenue"},
   {"account_code":"1000","side":"CREDIT", "amount_field":"ticket_price_ugx",       "memo":"MoMo refund to customer"},
   {"account_code":"4200","side":"DEBIT",  "amount_field":"platform_commission_ugx","memo":"Commission foregone on refund"},
   {"account_code":"3020","side":"CREDIT", "amount_field":"platform_commission_ugx","memo":"Reverse commission earned"},
   {"account_code":"1300","side":"CREDIT", "amount_field":"platform_commission_ugx","memo":"Reduce commission receivable"}
 ]'::jsonb),

('TICKETING', 'EVENT_CANCELLED',
 'Entire event cancelled. All deferred revenue becomes refund liability.',
 '[
   {"account_code":"2100","side":"DEBIT",  "amount_field":"total_deferred_ugx","memo":"Write off deferred revenue on cancellation"},
   {"account_code":"9000","side":"CREDIT", "amount_field":"total_deferred_ugx","memo":"Suspense pending individual refund processing"}
 ]'::jsonb),

('TICKETING', 'PROMOTION_FEE_PAID',
 'Organiser pays event promotion fee.',
 '[
   {"account_code":"1000","side":"DEBIT",  "amount_field":"promotion_fee_ugx","memo":"Promotion fee received"},
   {"account_code":"3200","side":"CREDIT", "amount_field":"promotion_fee_ugx","memo":"Event promotion revenue"}
 ]'::jsonb);

-- =============================================================================
-- ADDITIONAL POSTING RULES (appended; V67 base seeded the initial set)
-- =============================================================================

-- ── RENT: missing events ──────────────────────────────────────────────────────

INSERT INTO accounting.posting_rules (source_module, event_type, description, rule_json)
VALUES

('RENT', 'RENT_PAYMENT_PARTIAL',
 'Partial rent payment clears portion of receivable.',
 '[
   {"account_code":"9000","side":"DEBIT",  "amount_field":"paid_amount_ugx",  "memo":"Clear suspense — partial"},
   {"account_code":"1100","side":"CREDIT", "amount_field":"paid_amount_ugx",  "memo":"Partial clearance of receivable"},
   {"account_code":"1300","side":"DEBIT",  "amount_field":"platform_fee_ugx", "memo":"Platform fee on partial payment"},
   {"account_code":"3010","side":"CREDIT", "amount_field":"platform_fee_ugx", "memo":"Rent platform fee earned"}
 ]'::jsonb),

('RENT', 'RENT_INVOICE_ISSUED',
 'Rent charge generated — accrual entry before cash arrives.',
 '[
   {"account_code":"1100","side":"DEBIT",  "amount_field":"gross_amount_ugx","memo":"Rent receivable created"},
   {"account_code":"9000","side":"CREDIT", "amount_field":"gross_amount_ugx","memo":"Suspense: awaiting payment"}
 ]'::jsonb),

('RENT', 'LATE_FEE_APPLIED',
 'Late fee added to overdue rent charge.',
 '[
   {"account_code":"1100","side":"DEBIT",  "amount_field":"late_fee_ugx","memo":"Late fee added to receivable"},
   {"account_code":"3100","side":"CREDIT", "amount_field":"late_fee_ugx","memo":"Late fee income"}
 ]'::jsonb),

('RENT', 'SECURITY_DEPOSIT_RECEIVED',
 'Refundable security deposit received from tenant.',
 '[
   {"account_code":"1000","side":"DEBIT",  "amount_field":"deposit_amount_ugx","memo":"Deposit received via MoMo"},
   {"account_code":"2200","side":"CREDIT", "amount_field":"deposit_amount_ugx","memo":"Security deposit liability"}
 ]'::jsonb),

('RENT', 'SECURITY_DEPOSIT_RETURNED',
 'Security deposit refunded to tenant on move-out.',
 '[
   {"account_code":"2200","side":"DEBIT",  "amount_field":"deposit_amount_ugx","memo":"Release deposit liability"},
   {"account_code":"1000","side":"CREDIT", "amount_field":"deposit_amount_ugx","memo":"MoMo transfer to tenant"}
 ]'::jsonb),

('RENT', 'RENT_ADVANCE_RECEIVED',
 'Advance rent payment — deferred until the billing period.',
 '[
   {"account_code":"1000","side":"DEBIT",  "amount_field":"gross_amount_ugx","memo":"Advance rent received"},
   {"account_code":"2300","side":"CREDIT", "amount_field":"gross_amount_ugx","memo":"Prepaid rent liability"}
 ]'::jsonb),

('RENT', 'RENT_ADVANCE_RECOGNIZED',
 'Advance rent applied to the correct billing period.',
 '[
   {"account_code":"2300","side":"DEBIT",  "amount_field":"gross_amount_ugx","memo":"Recognize prepaid rent"},
   {"account_code":"9000","side":"CREDIT", "amount_field":"gross_amount_ugx","memo":"Suspense: clear on invoice match"}
 ]'::jsonb),

('RENT', 'RENT_PAYMENT_REVERSED',
 'Rent payment reversed (failed gateway confirmation after initial completion).',
 '[
   {"account_code":"1100","side":"DEBIT",  "amount_field":"gross_amount_ugx","memo":"Re-open receivable"},
   {"account_code":"9000","side":"CREDIT", "amount_field":"gross_amount_ugx","memo":"Reinstate suspense"},
   {"account_code":"3010","side":"DEBIT",  "amount_field":"platform_fee_ugx","memo":"Reverse commission earned"},
   {"account_code":"1300","side":"CREDIT", "amount_field":"platform_fee_ugx","memo":"Reduce commission receivable"}
 ]'::jsonb),

-- ── TICKETING: corrected TICKET_SOLD + missing events ────────────────────────

('TICKETING', 'TICKET_SOLD_DEFERRED',
 'Ticket sold — revenue deferred until event occurs. Replaces TICKET_SOLD.',
 '[
   {"account_code":"1000","side":"DEBIT",  "amount_field":"gross_amount_ugx",        "memo":"MoMo receipt from customer"},
   {"account_code":"2100","side":"CREDIT", "amount_field":"payee_amount_ugx",         "memo":"Deferred revenue: organiser share"},
   {"account_code":"1300","side":"DEBIT",  "amount_field":"platform_commission_ugx",  "memo":"Commission receivable"},
   {"account_code":"3020","side":"CREDIT", "amount_field":"platform_commission_ugx",  "memo":"Koddly ticketing commission earned"}
 ]'::jsonb),

('TICKETING', 'EVENT_COMPLETED',
 'Event occurred — deferred revenue recognized, organiser payout payable.',
 '[
   {"account_code":"2100","side":"DEBIT",  "amount_field":"payee_amount_ugx","memo":"Recognise deferred revenue"},
   {"account_code":"2500","side":"CREDIT", "amount_field":"payee_amount_ugx","memo":"Organiser payout payable"}
 ]'::jsonb),

('TICKETING', 'ORGANISER_PAYOUT_ISSUED',
 'Organiser paid out their net share after event completion.',
 '[
   {"account_code":"2500","side":"DEBIT",  "amount_field":"payee_amount_ugx","memo":"Settle organiser payable"},
   {"account_code":"1000","side":"CREDIT", "amount_field":"payee_amount_ugx","memo":"MoMo transfer to organiser"}
 ]'::jsonb),

('TICKETING', 'TICKET_REFUNDED',
 'Ticket refunded before or after the event.',
 '[
   {"account_code":"2100","side":"DEBIT",  "amount_field":"payee_amount_ugx",        "memo":"Reverse deferred organiser amount"},
   {"account_code":"1000","side":"CREDIT", "amount_field":"gross_amount_ugx",         "memo":"MoMo refund to customer"},
   {"account_code":"4200","side":"DEBIT",  "amount_field":"platform_commission_ugx",  "memo":"Commission cost on refund"},
   {"account_code":"3020","side":"CREDIT", "amount_field":"platform_commission_ugx",  "memo":"Reverse commission earned"},
   {"account_code":"1300","side":"CREDIT", "amount_field":"platform_commission_ugx",  "memo":"Reduce commission receivable"}
 ]'::jsonb),

('TICKETING', 'EVENT_CANCELLED',
 'Event cancelled — all deferred revenue moves to suspense pending per-ticket refunds.',
 '[
   {"account_code":"2100","side":"DEBIT",  "amount_field":"gross_amount_ugx","memo":"Write off deferred revenue on cancellation"},
   {"account_code":"9000","side":"CREDIT", "amount_field":"gross_amount_ugx","memo":"Suspense: pending individual refund processing"}
 ]'::jsonb),

('TICKETING', 'PROMOTION_FEE_PAID',
 'Organiser pays event promotion fee.',
 '[
   {"account_code":"1000","side":"DEBIT",  "amount_field":"gross_amount_ugx","memo":"Promotion fee received"},
   {"account_code":"3200","side":"CREDIT", "amount_field":"gross_amount_ugx","memo":"Event promotion revenue"}
 ]'::jsonb),

-- ── CROSS-CUTTING: gateway settlement and payouts ─────────────────────────────

('SYSTEM', 'COMMISSION_SETTLED',
 'PSP settles Koddly commission batch. Clears MoMo clearing into Koddly bank.',
 '[
   {"account_code":"1000","side":"DEBIT",  "amount_field":"gross_amount_ugx","memo":"Settlement received from PSP"},
   {"account_code":"1300","side":"CREDIT", "amount_field":"gross_amount_ugx","memo":"Clear commission receivable"},
   {"account_code":"4000","side":"DEBIT",  "amount_field":"psp_fee_ugx",     "memo":"PSP transaction fee expense"},
   {"account_code":"1000","side":"CREDIT", "amount_field":"psp_fee_ugx",     "memo":"PSP fee deducted"}
 ]'::jsonb),

('SYSTEM', 'MERCHANT_PAYOUT_ISSUED',
 'Koddly pays merchant their cash-order payout (net of commission).',
 '[
   {"account_code":"2400","side":"DEBIT",  "amount_field":"payee_amount_ugx","memo":"Settle merchant payable"},
   {"account_code":"1000","side":"CREDIT", "amount_field":"payee_amount_ugx","memo":"MoMo transfer to merchant"}
 ]'::jsonb),

('SYSTEM', 'LANDLORD_PAYOUT_ISSUED',
 'Landlord paid their share net of platform fee (if Koddly intermediates).',
 '[
   {"account_code":"9000","side":"DEBIT",  "amount_field":"payee_amount_ugx","memo":"Clear suspense for landlord share"},
   {"account_code":"1000","side":"CREDIT", "amount_field":"payee_amount_ugx","memo":"MoMo transfer to landlord"}
 ]'::jsonb)

ON CONFLICT (source_module, event_type) DO NOTHING;

-- ── RESTAURANTS: tips as liability ───────────────────────────────────────────

-- Add tips liability account if not present
INSERT INTO accounting.accounts (code, name, account_type, normal_balance, module_tag, is_system, description)
VALUES ('2600', 'Tips Payable', 'LIABILITY', 'CREDIT', 'RESTAURANTS', TRUE,
        'Customer tips collected on behalf of staff. Disbursed to staff; not Koddly revenue.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO accounting.posting_rules (source_module, event_type, description, rule_json)
VALUES
('RESTAURANTS', 'ORDER_PAID_WITH_TIP',
 'Order paid including a tip amount that is a staff liability.',
 '[
   {"account_code":"1300","side":"DEBIT",  "amount_field":"platform_commission_ugx","memo":"Commission receivable"},
   {"account_code":"3000","side":"CREDIT", "amount_field":"platform_commission_ugx","memo":"Platform commission earned"},
   {"account_code":"1000","side":"DEBIT",  "amount_field":"gross_amount_ugx",       "memo":"Tip received via MoMo"},
   {"account_code":"2600","side":"CREDIT", "amount_field":"gross_amount_ugx",       "memo":"Tip payable to staff"}
 ]'::jsonb)
ON CONFLICT (source_module, event_type) DO NOTHING;
