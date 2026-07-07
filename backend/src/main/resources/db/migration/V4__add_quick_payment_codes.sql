CREATE TABLE quick_payment_codes (
    id                      VARCHAR(32) PRIMARY KEY,
    qr_token                VARCHAR(64) NOT NULL UNIQUE,
    code_type               VARCHAR(64) NOT NULL DEFAULT 'FixedPrice',
    description             VARCHAR(255) NOT NULL,
    amount                  INTEGER NOT NULL,
    currency                VARCHAR(8) NOT NULL DEFAULT 'UGX',
    status                  VARCHAR(32) NOT NULL DEFAULT 'Active',
    usage_count             INTEGER NOT NULL DEFAULT 0,
    owner_name              VARCHAR(255) NOT NULL DEFAULT '',
    owner_phone             VARCHAR(32) NOT NULL DEFAULT '',
    payment_destination     VARCHAR(128) NOT NULL,
    payment_destination_type VARCHAR(32) NOT NULL DEFAULT 'MobileMoney',
    merchant_id             VARCHAR(64),
    business_id             VARCHAR(64) REFERENCES businesses(id) ON DELETE SET NULL,
    metadata                TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ,
    last_used_at            TIMESTAMPTZ
);

CREATE INDEX idx_quick_payment_codes_qr_token ON quick_payment_codes(qr_token);
CREATE INDEX idx_quick_payment_codes_status ON quick_payment_codes(status);
CREATE INDEX idx_quick_payment_codes_merchant ON quick_payment_codes(merchant_id);
CREATE INDEX idx_quick_payment_codes_business ON quick_payment_codes(business_id);

CREATE TABLE quick_payment_transactions (
    id                  BIGSERIAL PRIMARY KEY,
    code_id             VARCHAR(32) NOT NULL REFERENCES quick_payment_codes(id) ON DELETE CASCADE,
    transaction_ref     VARCHAR(128) NOT NULL UNIQUE,
    amount              INTEGER NOT NULL,
    currency            VARCHAR(8) NOT NULL DEFAULT 'UGX',
    customer_phone      VARCHAR(32) NOT NULL DEFAULT '',
    customer_name       VARCHAR(255) NOT NULL DEFAULT '',
    payment_method      VARCHAR(64) NOT NULL DEFAULT '',
    payment_provider    VARCHAR(64) NOT NULL DEFAULT '',
    status              VARCHAR(32) NOT NULL DEFAULT 'Pending',
    device_info         TEXT,
    location            VARCHAR(255) NOT NULL DEFAULT '',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ,
    failed_at           TIMESTAMPTZ,
    failure_reason      TEXT
);

CREATE INDEX idx_quick_payment_transactions_code ON quick_payment_transactions(code_id);
CREATE INDEX idx_quick_payment_transactions_ref ON quick_payment_transactions(transaction_ref);
CREATE INDEX idx_quick_payment_transactions_status ON quick_payment_transactions(status);
CREATE INDEX idx_quick_payment_transactions_phone ON quick_payment_transactions(customer_phone);
