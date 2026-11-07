-- V65: Add late fee and platform fee override columns to rent_properties
-- late_fee_type:      NONE | FLAT | PERCENT (default NONE)
-- late_fee_amount:    flat UGX amount, or percentage × 100 (500 = 5.00%)
-- platform_fee_override: UGX flat fee added to tenant payment (0 = use platform default)

ALTER TABLE rent_properties
    ADD COLUMN IF NOT EXISTS late_fee_type       VARCHAR(16)  NOT NULL DEFAULT 'NONE',
    ADD COLUMN IF NOT EXISTS late_fee_amount     BIGINT       NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS platform_fee_override BIGINT     NOT NULL DEFAULT 0;
