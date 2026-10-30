-- V62: Close gaps identified in the rent-management spec review.
--
-- Changes:
--  1. Add `created_by` audit column to all rent tables.
--  2. Add `national_id_number` to rent_tenants.
--  3. Add partial unique index for one-active-tenant-per-unit at the DB level.
--  4. Add `priority` to rent_maintenance_requests.
--  5. Add `recorded_by` and `payment_method` (enum) to rent_payments.
--  6. Widen monetary columns from INTEGER to BIGINT (long).
--  7. Create rent_notifications table.
--  8. Rename/standardise payment_method values on existing rows.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. created_by on every rent table
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE rent_accounts
    ADD COLUMN IF NOT EXISTS created_by VARCHAR(255) NOT NULL DEFAULT 'system';

ALTER TABLE rent_properties
    ADD COLUMN IF NOT EXISTS created_by VARCHAR(255) NOT NULL DEFAULT 'system';

ALTER TABLE rent_property_access
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE rent_units
    ADD COLUMN IF NOT EXISTS created_by VARCHAR(255) NOT NULL DEFAULT 'system',
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE rent_tenants
    ADD COLUMN IF NOT EXISTS created_by VARCHAR(255) NOT NULL DEFAULT 'system',
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE rent_charges
    ADD COLUMN IF NOT EXISTS created_by VARCHAR(255) NOT NULL DEFAULT 'system';

ALTER TABLE rent_payments
    ADD COLUMN IF NOT EXISTS created_by VARCHAR(255) NOT NULL DEFAULT 'system',
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE rent_maintenance_requests
    ADD COLUMN IF NOT EXISTS created_by VARCHAR(255) NOT NULL DEFAULT 'system',
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. National ID number on tenants (optional, per spec)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE rent_tenants
    ADD COLUMN IF NOT EXISTS national_id_number VARCHAR(64);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Partial unique index: at most one active tenant per unit
--    (supplements the application-layer check with a DB-level guarantee)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_rent_tenants_one_active_per_unit
    ON rent_tenants (unit_id)
    WHERE active = TRUE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Priority on maintenance requests
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE rent_maintenance_requests
    ADD COLUMN IF NOT EXISTS priority VARCHAR(16) NOT NULL DEFAULT 'NORMAL';
    -- Allowed values: LOW | NORMAL | HIGH | URGENT

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Manual-payment fields on rent_payments
--    - recorded_by:     account ID of the manager who recorded the payment
--    - payment_method:  enum column replacing the old free-text column
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE rent_payments
    ADD COLUMN IF NOT EXISTS recorded_by VARCHAR(64);

-- Rename existing payment_method values to the new enum tokens.
-- Old value 'MobileMoney' maps to 'MOMO'; anything else maps to 'OTHER'.
UPDATE rent_payments
SET payment_method = CASE
    WHEN LOWER(payment_method) IN ('mobilemoney', 'momo', 'mobile_money') THEN 'MOMO'
    WHEN LOWER(payment_method) = 'cash'                                   THEN 'CASH'
    WHEN LOWER(payment_method) IN ('bank', 'bank_transfer')               THEN 'BANK'
    ELSE 'OTHER'
END
WHERE payment_method NOT IN ('CASH', 'MOMO', 'BANK', 'OTHER');

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Widen monetary columns from INTEGER → BIGINT
--    integer max = ~2.1 billion; UGX amounts can easily exceed that for deposits
--    or property portfolio totals.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE rent_units
    ALTER COLUMN monthly_amount TYPE BIGINT,
    ALTER COLUMN deposit_amount TYPE BIGINT;

ALTER TABLE rent_charges
    ALTER COLUMN amount TYPE BIGINT;

ALTER TABLE rent_payments
    ALTER COLUMN amount TYPE BIGINT;

ALTER TABLE rent_properties
    ALTER COLUMN min_payment_amount TYPE BIGINT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Notifications table
--    One row per (charge, event_type) — unique constraint prevents duplicates
--    when the scheduler reruns.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rent_notifications (
    id           VARCHAR(36)   NOT NULL PRIMARY KEY,
    charge_id    BIGINT        NOT NULL REFERENCES rent_charges(id) ON DELETE CASCADE,
    event_type   VARCHAR(32)   NOT NULL,   -- UPCOMING_3D | OVERDUE_1D | OVERDUE_3D | OVERDUE_7D
    channel      VARCHAR(32)   NOT NULL DEFAULT 'WHATSAPP',
    recipient    VARCHAR(64)   NOT NULL,
    body         TEXT          NOT NULL,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    sent_at      TIMESTAMPTZ,
    created_by   VARCHAR(64)   NOT NULL DEFAULT 'scheduler',
    UNIQUE (charge_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_rent_notifications_charge    ON rent_notifications (charge_id);
CREATE INDEX IF NOT EXISTS idx_rent_notifications_unsent    ON rent_notifications (sent_at) WHERE sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rent_notifications_created   ON rent_notifications (created_at DESC);
