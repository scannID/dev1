CREATE TABLE payment_intents (
    id VARCHAR(64) PRIMARY KEY,
    context VARCHAR(32) NOT NULL,
    reference_id VARCHAR(128) NOT NULL,
    provider_id VARCHAR(64) NOT NULL,
    amount INT NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'UGX',
    customer_phone VARCHAR(32) NOT NULL DEFAULT '',
    customer_name VARCHAR(255) NOT NULL DEFAULT '',
    business_id VARCHAR(64),
    provider_reference VARCHAR(255) NOT NULL DEFAULT '',
    status VARCHAR(32) NOT NULL,
    customer_message TEXT,
    metadata TEXT,
    failure_reason TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP,
    completed_at TIMESTAMP,
    failed_at TIMESTAMP
);

CREATE INDEX idx_payment_intents_reference ON payment_intents (context, reference_id);
CREATE INDEX idx_payment_intents_provider_ref ON payment_intents (provider_id, provider_reference);
