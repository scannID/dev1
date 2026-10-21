-- V58: Rent collection feature
-- Entities: rent_accounts, rent_properties, rent_property_access,
--           rent_units, rent_tenants, rent_charges, rent_payments

-- ── Accounts (managers / owners who log in) ──────────────────────────────────
CREATE TABLE rent_accounts (
    id          VARCHAR(36)   PRIMARY KEY,
    name        VARCHAR(255)  NOT NULL,
    email       VARCHAR(255)  NOT NULL,
    phone       VARCHAR(32)   NOT NULL DEFAULT '',
    access_key  VARCHAR(64)   NOT NULL UNIQUE,  -- "RAK-XXXXXXXX" — acts as the password
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ
);

CREATE INDEX idx_rent_accounts_email      ON rent_accounts (email);
CREATE INDEX idx_rent_accounts_access_key ON rent_accounts (access_key);

-- ── Properties ────────────────────────────────────────────────────────────────
CREATE TABLE rent_properties (
    id              VARCHAR(36)   PRIMARY KEY,
    name            VARCHAR(255)  NOT NULL,
    address         VARCHAR(512)  NOT NULL DEFAULT '',
    city            VARCHAR(128)  NOT NULL DEFAULT '',
    -- Money destination (always required — even if owner has no account)
    owner_name      VARCHAR(255)  NOT NULL,
    owner_momo      VARCHAR(64)   NOT NULL,  -- MoMo number rent is paid to
    -- Optional: if owner has a Scanny rent account
    owner_account_id VARCHAR(36)  REFERENCES rent_accounts(id) ON DELETE SET NULL,
    currency        VARCHAR(8)    NOT NULL DEFAULT 'UGX',
    qr_token        VARCHAR(128)  NOT NULL UNIQUE,  -- property-level QR for /rent/pay/:token
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);

CREATE INDEX idx_rent_properties_owner_account ON rent_properties (owner_account_id);
CREATE INDEX idx_rent_properties_qr_token      ON rent_properties (qr_token);

-- ── Property access (who can operate which property and in what role) ─────────
CREATE TABLE rent_property_access (
    id              BIGSERIAL     PRIMARY KEY,
    account_id      VARCHAR(36)   NOT NULL REFERENCES rent_accounts(id) ON DELETE CASCADE,
    property_id     VARCHAR(36)   NOT NULL REFERENCES rent_properties(id) ON DELETE CASCADE,
    role            VARCHAR(32)   NOT NULL,  -- OWNER | MANAGER | OWNER_MANAGER
    granted_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    granted_by      VARCHAR(36)   REFERENCES rent_accounts(id) ON DELETE SET NULL,
    UNIQUE (account_id, property_id)
);

CREATE INDEX idx_rent_access_account  ON rent_property_access (account_id);
CREATE INDEX idx_rent_access_property ON rent_property_access (property_id);

-- ── Units (rooms / apartments within a property) ──────────────────────────────
CREATE TABLE rent_units (
    id              VARCHAR(36)   PRIMARY KEY,
    property_id     VARCHAR(36)   NOT NULL REFERENCES rent_properties(id) ON DELETE CASCADE,
    unit_number     VARCHAR(64)   NOT NULL,   -- e.g. "A3", "Flat 5"
    floor           VARCHAR(32)   NOT NULL DEFAULT '',
    monthly_amount  INTEGER       NOT NULL,   -- UGX
    deposit_amount  INTEGER       NOT NULL DEFAULT 0,
    qr_token        VARCHAR(128)  UNIQUE,     -- optional per-unit QR
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rent_units_property ON rent_units (property_id);

-- ── Tenants ───────────────────────────────────────────────────────────────────
CREATE TABLE rent_tenants (
    id          VARCHAR(36)   PRIMARY KEY,
    unit_id     VARCHAR(36)   NOT NULL REFERENCES rent_units(id) ON DELETE CASCADE,
    name        VARCHAR(255)  NOT NULL,
    phone       VARCHAR(32)   NOT NULL,
    email       VARCHAR(255)  NOT NULL DEFAULT '',
    move_in_date DATE,
    active      BOOLEAN       NOT NULL DEFAULT TRUE,
    pay_token   VARCHAR(128)  NOT NULL UNIQUE,  -- personal pay link /rent/pay/:token
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rent_tenants_unit      ON rent_tenants (unit_id);
CREATE INDEX idx_rent_tenants_pay_token ON rent_tenants (pay_token);
CREATE INDEX idx_rent_tenants_phone     ON rent_tenants (phone);

-- ── Charges (one per tenant per period) ──────────────────────────────────────
CREATE TABLE rent_charges (
    id              BIGSERIAL     PRIMARY KEY,
    tenant_id       VARCHAR(36)   NOT NULL REFERENCES rent_tenants(id) ON DELETE CASCADE,
    unit_id         VARCHAR(36)   NOT NULL REFERENCES rent_units(id) ON DELETE CASCADE,
    amount          INTEGER       NOT NULL,
    currency        VARCHAR(8)    NOT NULL DEFAULT 'UGX',
    period_label    VARCHAR(32)   NOT NULL,  -- e.g. "2026-11"
    due_date        DATE          NOT NULL,
    status          VARCHAR(16)   NOT NULL DEFAULT 'UNPAID',  -- UNPAID|PAID|PARTIAL|WAIVED|OVERDUE
    notes           TEXT,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ,
    UNIQUE (tenant_id, period_label)
);

CREATE INDEX idx_rent_charges_tenant  ON rent_charges (tenant_id);
CREATE INDEX idx_rent_charges_unit    ON rent_charges (unit_id);
CREATE INDEX idx_rent_charges_status  ON rent_charges (status);
CREATE INDEX idx_rent_charges_due     ON rent_charges (due_date);

-- ── Payments (one charge can have multiple partial payments) ─────────────────
CREATE TABLE rent_payments (
    id              BIGSERIAL     PRIMARY KEY,
    charge_id       BIGINT        NOT NULL REFERENCES rent_charges(id) ON DELETE CASCADE,
    transaction_ref VARCHAR(128)  NOT NULL UNIQUE,
    amount          INTEGER       NOT NULL,
    currency        VARCHAR(8)    NOT NULL DEFAULT 'UGX',
    payment_method  VARCHAR(32)   NOT NULL DEFAULT 'MobileMoney',
    status          VARCHAR(16)   NOT NULL DEFAULT 'Pending',  -- Pending|Completed|Failed
    paid_at         TIMESTAMPTZ,
    failed_at       TIMESTAMPTZ,
    failure_reason  TEXT,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rent_payments_charge  ON rent_payments (charge_id);
CREATE INDEX idx_rent_payments_txn_ref ON rent_payments (transaction_ref);
