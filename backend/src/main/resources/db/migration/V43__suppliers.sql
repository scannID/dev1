-- Supplier / vendor master list per business.
-- Each ingredient can optionally reference its preferred supplier.

CREATE TABLE IF NOT EXISTS suppliers (
    id              VARCHAR(64) PRIMARY KEY,   -- SUP-XXXXXXXX
    business_id     VARCHAR(64) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    contact_name    VARCHAR(255) NOT NULL DEFAULT '',
    phone           VARCHAR(64)  NOT NULL DEFAULT '',
    email           VARCHAR(255) NOT NULL DEFAULT '',
    address         TEXT         NOT NULL DEFAULT '',
    notes           TEXT         NOT NULL DEFAULT '',
    active          BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_suppliers_business ON suppliers (business_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_business_name
    ON suppliers (business_id, lower(name));

-- Link ingredient → preferred supplier
ALTER TABLE ingredients
    ADD COLUMN IF NOT EXISTS supplier_id VARCHAR(64) REFERENCES suppliers(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS par_level    NUMERIC(18,4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reorder_qty  NUMERIC(18,4) NOT NULL DEFAULT 0;

COMMENT ON COLUMN ingredients.par_level IS
    'Target on-hand level. When qty_on_hand falls below low_stock_threshold, the reorder suggestion shows reorder_qty to restore to par_level.';
COMMENT ON COLUMN ingredients.reorder_qty IS
    'Suggested order quantity to raise stock from low_stock_threshold back to par_level.';
