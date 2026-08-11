-- Per-merchant service fee commission split.
-- Stores what percentage (0–100) of the service fee is shared back to the merchant.
-- Default 0 = platform keeps the full service fee.
ALTER TABLE merchants
    ADD COLUMN IF NOT EXISTS service_fee_merchant_percent INTEGER NOT NULL DEFAULT 0;
