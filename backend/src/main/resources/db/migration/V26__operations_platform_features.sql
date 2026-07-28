-- Multi-location, operations, staff, tables, feedback, reservations, notifications

ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_merchant_id_key;

ALTER TABLE businesses
    ADD COLUMN IF NOT EXISTS branch_label VARCHAR(128) NOT NULL DEFAULT 'Main',
    ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS accepting_orders BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS busy_mode BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS busy_eta_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS pause_message TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS whatsapp_notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS whatsapp_business_phone VARCHAR(32) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS daily_digest_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS daily_digest_channel VARCHAR(16) NOT NULL DEFAULT 'email',
    ADD COLUMN IF NOT EXISTS daily_digest_email VARCHAR(255) NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_businesses_merchant ON businesses (merchant_id);

ALTER TABLE catalog_items
    ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS track_stock BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS table_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS table_session_id UUID,
    ADD COLUMN IF NOT EXISTS split_group_id UUID,
    ADD COLUMN IF NOT EXISTS kitchen_notes TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS business_tables (
    id              VARCHAR(64) PRIMARY KEY,
    business_id     VARCHAR(64) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    label           VARCHAR(128) NOT NULL,
    qr_token        VARCHAR(32) NOT NULL UNIQUE,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_tables_business ON business_tables (business_id);

CREATE TABLE IF NOT EXISTS table_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id     VARCHAR(64) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    table_id        VARCHAR(64) NOT NULL REFERENCES business_tables(id) ON DELETE CASCADE,
    status          VARCHAR(32) NOT NULL DEFAULT 'Open',
    opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_table_sessions_business_status ON table_sessions (business_id, status);

CREATE TABLE IF NOT EXISTS table_session_orders (
    session_id      UUID NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
    order_id        VARCHAR(32) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    PRIMARY KEY (session_id, order_id)
);

CREATE TABLE IF NOT EXISTS business_staff (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id         VARCHAR(64) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    merchant_id         VARCHAR(64) NOT NULL,
    email               VARCHAR(255) NOT NULL,
    display_name        VARCHAR(255) NOT NULL,
    role                VARCHAR(32) NOT NULL,
    pin_hash            VARCHAR(255),
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    session_token       VARCHAR(64),
    session_expires_at  TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ,
    UNIQUE (business_id, email)
);

CREATE INDEX IF NOT EXISTS idx_business_staff_business ON business_staff (business_id);

CREATE TABLE IF NOT EXISTS order_feedback (
    id              BIGSERIAL PRIMARY KEY,
    order_id        VARCHAR(32) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    business_id     VARCHAR(64) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment         TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_order_feedback_business ON order_feedback (business_id, created_at DESC);

CREATE TABLE IF NOT EXISTS customer_phone_sessions (
    phone_normalized    VARCHAR(32) PRIMARY KEY,
    verify_code         VARCHAR(8),
    verify_expires_at   TIMESTAMPTZ,
    verified_at         TIMESTAMPTZ,
    session_token       VARCHAR(64) UNIQUE,
    session_expires_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS reservations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id     VARCHAR(64) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_name   VARCHAR(255) NOT NULL,
    customer_phone  VARCHAR(32) NOT NULL,
    party_size      INTEGER NOT NULL DEFAULT 1,
    reserved_at     TIMESTAMPTZ NOT NULL,
    status          VARCHAR(32) NOT NULL DEFAULT 'Pending',
    note            TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservations_business_at ON reservations (business_id, reserved_at);

CREATE TABLE IF NOT EXISTS order_split_payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    split_group_id  UUID NOT NULL,
    order_id        VARCHAR(32) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    payer_name      VARCHAR(255) NOT NULL DEFAULT '',
    payer_phone     VARCHAR(32) NOT NULL DEFAULT '',
    amount          INTEGER NOT NULL,
    payment_status  VARCHAR(32) NOT NULL DEFAULT 'Unpaid',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_split_group ON order_split_payments (split_group_id);
