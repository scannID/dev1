-- Branch transfer matching fields on stock movements

ALTER TABLE stock_movements
    ADD COLUMN IF NOT EXISTS transfer_group_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS related_business_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS related_ingredient_id VARCHAR(64);

-- Keep movement_type as free-form string so new types (TRANSFER_OUT/IN) work without enum migrations
ALTER TABLE stock_movements
    ALTER COLUMN movement_type TYPE VARCHAR(24);

CREATE INDEX IF NOT EXISTS idx_stock_movements_transfer_group
    ON stock_movements (transfer_group_id);
