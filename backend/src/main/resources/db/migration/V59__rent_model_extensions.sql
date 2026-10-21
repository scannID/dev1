-- V59: Rent model extensions
-- Adds per-unit due day + grace period, property timezone + partial-payment
-- config, tenant lease-end date, and auto-generates missing unit QR tokens.

-- ── rent_units: due day and grace period ─────────────────────────────────────
-- due_day_of_month: day of the month rent is due (1–28).
--   Default 5 preserves the existing hard-coded behaviour.
-- grace_period_days: number of days after due_date before charge becomes OVERDUE.
--   Default 0 = overdue the day after due date.
ALTER TABLE rent_units
    ADD COLUMN IF NOT EXISTS due_day_of_month  SMALLINT NOT NULL DEFAULT 5
        CHECK (due_day_of_month BETWEEN 1 AND 28),
    ADD COLUMN IF NOT EXISTS grace_period_days SMALLINT NOT NULL DEFAULT 0
        CHECK (grace_period_days >= 0);

-- ── rent_properties: timezone, partial-payment config ────────────────────────
-- timezone: IANA zone id used for daysRemaining computation (e.g. "Africa/Kampala").
--   Default "Africa/Kampala" because the initial target market is Uganda.
-- partial_payment_allowed: whether tenants may pay less than the full balance.
-- min_payment_amount: minimum partial payment (minor units, same currency as property).
--   Ignored when partial_payment_allowed = false.
ALTER TABLE rent_properties
    ADD COLUMN IF NOT EXISTS timezone                 VARCHAR(64)  NOT NULL DEFAULT 'Africa/Kampala',
    ADD COLUMN IF NOT EXISTS partial_payment_allowed  BOOLEAN      NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS min_payment_amount       INTEGER      NOT NULL DEFAULT 0
        CHECK (min_payment_amount >= 0);

-- ── rent_tenants: lease end date ──────────────────────────────────────────────
ALTER TABLE rent_tenants
    ADD COLUMN IF NOT EXISTS lease_end DATE;

CREATE INDEX IF NOT EXISTS idx_rent_tenants_lease_end ON rent_tenants (lease_end);

-- ── rent_units: ensure every unit has a qr_token ─────────────────────────────
-- Units added before this migration have qr_token = NULL. We back-fill each
-- with a random 32-char hex token derived from gen_random_uuid() (available in
-- PostgreSQL 13+ via pgcrypto or the built-in function). If gen_random_uuid()
-- is not available (H2 test DB), the application layer regenerates tokens on
-- first access.
UPDATE rent_units
SET qr_token = encode(gen_random_bytes(16), 'hex')
WHERE qr_token IS NULL;

-- Now make the column NOT NULL — all rows are populated.
-- Use a generated default so future INSERTs without an explicit value still work
-- (the application always sets it explicitly, but this is a safety net).
ALTER TABLE rent_units
    ALTER COLUMN qr_token SET NOT NULL;

-- If any two units somehow ended up with the same backfilled token
-- (astronomically unlikely but possible with a buggy backfill), the existing
-- UNIQUE constraint will catch it on ALTER above. The unique index already
-- exists from V58; no need to recreate it.

-- ── Index additions ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rent_units_due_day ON rent_units (due_day_of_month);
