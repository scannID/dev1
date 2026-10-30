-- V64: Lease entity, per-cycle period_start on charges.
--
-- Design decisions:
--   • A RentLease captures the full lifecycle of a single tenancy agreement:
--     activation date, term length, computed expiry, monthly amount snapshot,
--     and a status enum (PENDING | ACTIVE | EXPIRED | TERMINATED).
--   • rent_charges gains a nullable lease_id FK and a period_start DATE so the
--     pay page can render the exact cycle window (periodStart → dueDate).
--   • The existing (tenant_id, period_label) unique constraint is preserved for
--     backward compatibility with legacy charges that have no lease_id.

-- ── rent_leases ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rent_leases (
    id                      VARCHAR(36)   NOT NULL PRIMARY KEY,
    tenant_id               VARCHAR(36)   NOT NULL REFERENCES rent_tenants(id) ON DELETE CASCADE,
    unit_id                 VARCHAR(36)   NOT NULL REFERENCES rent_units(id)   ON DELETE CASCADE,

    -- Rent amount at the time the lease was activated (snapshot from unit.monthly_amount).
    -- Later unit price changes do NOT affect active or past leases.
    monthly_amount_snapshot BIGINT        NOT NULL,
    currency                VARCHAR(8)    NOT NULL DEFAULT 'UGX',

    -- The day the lease starts ticking; rent cycles are anchored to this date.
    activation_date         DATE          NOT NULL,

    -- Lease term in whole months. Default 12 if not specified.
    term_months             SMALLINT      NOT NULL DEFAULT 12
        CHECK (term_months >= 1),

    -- Computed by the service: activation_date + term_months (last day clamped).
    lease_end               DATE          NOT NULL,

    -- PENDING | ACTIVE | EXPIRED | TERMINATED
    status                  VARCHAR(16)   NOT NULL DEFAULT 'PENDING',

    -- Audit
    created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_by              VARCHAR(255),
    updated_at              TIMESTAMPTZ
);

-- At most one ACTIVE lease per unit at any time (mirrors the one-active-tenant index).
CREATE UNIQUE INDEX IF NOT EXISTS idx_rent_leases_one_active_per_unit
    ON rent_leases (unit_id)
    WHERE status = 'ACTIVE';

-- Fast tenant + unit lookups
CREATE INDEX IF NOT EXISTS idx_rent_leases_tenant   ON rent_leases (tenant_id);
CREATE INDEX IF NOT EXISTS idx_rent_leases_unit      ON rent_leases (unit_id);
CREATE INDEX IF NOT EXISTS idx_rent_leases_status    ON rent_leases (status);
CREATE INDEX IF NOT EXISTS idx_rent_leases_end       ON rent_leases (lease_end);

-- ── rent_charges: add lease context ──────────────────────────────────────────
-- lease_id  — links a charge to the lease that generated it.
--             NULL for legacy charges generated before V64.
-- period_start — the first day of this rent cycle; together with due_date it
--                defines the exact window shown on the pay page calendar.
--                NULL for legacy charges (due_date-1 month is an acceptable approximation).
ALTER TABLE rent_charges
    ADD COLUMN IF NOT EXISTS lease_id     VARCHAR(36) REFERENCES rent_leases(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS period_start DATE;

CREATE INDEX IF NOT EXISTS idx_rent_charges_lease ON rent_charges (lease_id);
