-- Allow merchant-specific conversions (e.g. "1 bird = 6 pcs" for a specific business).
-- business_id = NULL means global (applies to all businesses).
-- A business-specific row takes precedence over the global row.

ALTER TABLE unit_conversions
    ADD COLUMN IF NOT EXISTS business_id VARCHAR(64) REFERENCES businesses(id) ON DELETE CASCADE;

-- Drop the old global unique constraint so we can have per-business pairs.
ALTER TABLE unit_conversions DROP CONSTRAINT IF EXISTS unit_conversions_from_unit_to_unit_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unit_conversions_global
    ON unit_conversions (from_unit, to_unit)
    WHERE business_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unit_conversions_business
    ON unit_conversions (business_id, from_unit, to_unit)
    WHERE business_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_unit_conversions_lookup
    ON unit_conversions (from_unit, to_unit, business_id);
