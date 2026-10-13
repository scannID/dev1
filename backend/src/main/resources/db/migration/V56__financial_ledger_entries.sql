-- V56: Create financial_ledger_entries table
--
-- This table was previously created by Hibernate ddl-auto:create/update during
-- early development and was never codified in a Flyway migration.  Adding it here
-- ensures a fresh database or a clean deployment always has the table, and the
-- Hibernate ddl-auto:validate setting can verify the schema on startup.
--
-- Design:
--   - One row per payment or refund event (never updated after insert).
--   - REFUND rows carry negative amounts so SUM(net_amount) over any window
--     yields the correct net-settled figure without special-casing.
--   - All monetary values are in UGX (integer, 1 UGX = smallest unit).

CREATE TABLE IF NOT EXISTS financial_ledger_entries (
    id              VARCHAR(64)  NOT NULL,

    -- FK to orders.id — retained for audit, not used in aggregation.
    order_id        VARCHAR(64)  NOT NULL,

    -- Same value as businesses.id.
    business_id     VARCHAR(64)  NOT NULL,

    -- PAYMENT or REFUND.
    entry_type      VARCHAR(16)  NOT NULL,

    -- Customer-paid gross (subtotal + service_fee). Negative for REFUND rows.
    gross_amount    BIGINT       NOT NULL DEFAULT 0,

    -- Amount credited to merchant. Negative for REFUND rows.
    net_amount      BIGINT       NOT NULL DEFAULT 0,

    -- Service fee charged. Negative for REFUND rows.
    service_fee     BIGINT       NOT NULL DEFAULT 0,

    -- MoMo provider (PSO) share of the fee. Negative for REFUND rows.
    pso_fee         BIGINT       NOT NULL DEFAULT 0,

    -- Scanny platform share of the fee. Negative for REFUND rows.
    platform_fee    BIGINT       NOT NULL DEFAULT 0,

    -- Recipe / ingredient COGS locked at payment time. Negative for REFUND rows.
    cogs_amount     BIGINT       NOT NULL DEFAULT 0,

    -- "MOMO" or "CASH".
    payment_method  VARCHAR(16)  NOT NULL DEFAULT '',

    -- UTC instant of the financial event (payment confirmed or refund processed).
    -- All date-range queries filter and order by this column.
    settled_at      TIMESTAMP    NOT NULL,

    -- When this row was written to the ledger.
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_financial_ledger_entries PRIMARY KEY (id),
    CONSTRAINT chk_fle_entry_type CHECK (entry_type IN ('PAYMENT', 'REFUND'))
);

-- Covering index for all merchant summary and ledger queries
-- (range scans on settled_at within a business).
CREATE INDEX IF NOT EXISTS idx_fle_business_settled
    ON financial_ledger_entries (business_id, settled_at);

-- Lookup by order for the deduplication guard in LedgerWriterService.
CREATE INDEX IF NOT EXISTS idx_fle_order_id
    ON financial_ledger_entries (order_id);

COMMENT ON TABLE  financial_ledger_entries                   IS 'Immutable financial ledger — one row per payment or refund event.';
COMMENT ON COLUMN financial_ledger_entries.entry_type        IS 'PAYMENT = positive row; REFUND = negative row (all money fields negated).';
COMMENT ON COLUMN financial_ledger_entries.gross_amount      IS 'Customer-paid total (subtotal + service_fee). Negative for REFUND.';
COMMENT ON COLUMN financial_ledger_entries.net_amount        IS 'Merchant net payout. Negative for REFUND.';
COMMENT ON COLUMN financial_ledger_entries.cogs_amount       IS 'Recipe COGS locked at payment time. Negative for REFUND.';
COMMENT ON COLUMN financial_ledger_entries.settled_at        IS 'UTC instant of the financial event — used in all date-range queries.';
