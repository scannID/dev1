CREATE TABLE registered_devices (
    id                      VARCHAR(32) PRIMARY KEY,
    device_id               VARCHAR(128) NOT NULL UNIQUE,
    device_name             VARCHAR(255) NOT NULL DEFAULT '',
    device_model            VARCHAR(255) NOT NULL DEFAULT '',
    device_os               VARCHAR(64) NOT NULL DEFAULT '',
    device_fingerprint      TEXT,
    status                  VARCHAR(32) NOT NULL DEFAULT 'Active',
    primary_phone           VARCHAR(32) NOT NULL,
    secondary_phone         VARCHAR(32),
    customer_name           VARCHAR(255) NOT NULL DEFAULT '',
    customer_email          VARCHAR(255) NOT NULL DEFAULT '',
    auto_payment_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
    pin_hash                VARCHAR(255),
    last_used_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ
);

CREATE INDEX idx_registered_devices_device_id ON registered_devices(device_id);
CREATE INDEX idx_registered_devices_primary_phone ON registered_devices(primary_phone);
CREATE INDEX idx_registered_devices_secondary_phone ON registered_devices(secondary_phone);
CREATE INDEX idx_registered_devices_status ON registered_devices(status);

CREATE TABLE device_payment_methods (
    id                      BIGSERIAL PRIMARY KEY,
    device_id               VARCHAR(32) NOT NULL REFERENCES registered_devices(id) ON DELETE CASCADE,
    phone_number            VARCHAR(32) NOT NULL,
    payment_provider        VARCHAR(64) NOT NULL DEFAULT 'MobileMoney',
    account_name            VARCHAR(255) NOT NULL DEFAULT '',
    is_default              BOOLEAN NOT NULL DEFAULT FALSE,
    is_verified             BOOLEAN NOT NULL DEFAULT FALSE,
    verification_code       VARCHAR(16),
    verified_at             TIMESTAMPTZ,
    added_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at            TIMESTAMPTZ
);

CREATE INDEX idx_device_payment_methods_device ON device_payment_methods(device_id);
CREATE INDEX idx_device_payment_methods_phone ON device_payment_methods(phone_number);

CREATE TABLE device_transactions (
    id                      BIGSERIAL PRIMARY KEY,
    device_id               VARCHAR(32) NOT NULL REFERENCES registered_devices(id) ON DELETE CASCADE,
    transaction_type        VARCHAR(64) NOT NULL,
    reference_id            VARCHAR(128) NOT NULL,
    reference_type          VARCHAR(64) NOT NULL,
    amount                  INTEGER NOT NULL,
    currency                VARCHAR(8) NOT NULL DEFAULT 'UGX',
    payment_method_id       BIGINT REFERENCES device_payment_methods(id) ON DELETE SET NULL,
    phone_number            VARCHAR(32) NOT NULL,
    status                  VARCHAR(32) NOT NULL DEFAULT 'Pending',
    auto_payment            BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at            TIMESTAMPTZ
);

CREATE INDEX idx_device_transactions_device ON device_transactions(device_id);
CREATE INDEX idx_device_transactions_reference ON device_transactions(reference_id, reference_type);
CREATE INDEX idx_device_transactions_status ON device_transactions(status);
CREATE INDEX idx_device_transactions_phone ON device_transactions(phone_number);
