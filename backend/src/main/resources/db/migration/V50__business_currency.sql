-- Currency setting per business.
-- Defaults to UGX. Merchant can change in Operations → Settings.
ALTER TABLE businesses
    ADD COLUMN IF NOT EXISTS currency VARCHAR(8) NOT NULL DEFAULT 'UGX';
