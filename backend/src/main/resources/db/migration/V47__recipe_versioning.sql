-- Recipe versioning: never hard-delete recipe lines.
-- Old lines get effective_to stamped when a new set is saved.
-- consumeForPaidOrder resolves the version active at order.paid_at.

ALTER TABLE recipe_lines
    ADD COLUMN IF NOT EXISTS effective_from  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS effective_to    TIMESTAMPTZ,          -- NULL = currently active
    ADD COLUMN IF NOT EXISTS recipe_version  INTEGER NOT NULL DEFAULT 1;

-- Index for version lookups: "give me lines for item X active at time T"
CREATE INDEX IF NOT EXISTS idx_recipe_lines_item_version
    ON recipe_lines (catalog_item_id, effective_from, effective_to);

-- supplier_ref / po_number on stock_movements (task 4 merged here for one migration)
ALTER TABLE stock_movements
    ADD COLUMN IF NOT EXISTS supplier_ref  VARCHAR(128) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS po_number     VARCHAR(128) NOT NULL DEFAULT '';

-- inventory_under_stock flag on orders (task 5)
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS inventory_under_stock BOOLEAN NOT NULL DEFAULT FALSE;
