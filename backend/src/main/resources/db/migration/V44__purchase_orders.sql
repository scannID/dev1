-- Purchase orders: merchant raises a PO to a supplier, receives lines.
-- Status flow: DRAFT → SENT → PARTIALLY_RECEIVED → RECEIVED | CANCELLED

CREATE TABLE IF NOT EXISTS purchase_orders (
    id              VARCHAR(64) PRIMARY KEY,       -- PO-XXXXXXXXXXXX
    business_id     VARCHAR(64) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    supplier_id     VARCHAR(64) REFERENCES suppliers(id) ON DELETE SET NULL,
    supplier_name   VARCHAR(255) NOT NULL DEFAULT '',   -- snapshot at creation
    status          VARCHAR(32)  NOT NULL DEFAULT 'DRAFT',
    reference       VARCHAR(128) NOT NULL DEFAULT '',   -- merchant's own ref / invoice no.
    notes           TEXT         NOT NULL DEFAULT '',
    total_cost      INTEGER      NOT NULL DEFAULT 0,    -- UGX, derived from lines
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ,
    sent_at         TIMESTAMPTZ,
    received_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_po_business ON purchase_orders (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders (supplier_id);

CREATE TABLE IF NOT EXISTS purchase_order_lines (
    id              BIGSERIAL PRIMARY KEY,
    po_id           VARCHAR(64) NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    ingredient_id   VARCHAR(64) NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    ingredient_name VARCHAR(255) NOT NULL DEFAULT '',   -- snapshot
    unit            VARCHAR(16)  NOT NULL DEFAULT 'pcs',
    qty_ordered     NUMERIC(18,4) NOT NULL,
    qty_received    NUMERIC(18,4) NOT NULL DEFAULT 0,
    unit_cost       INTEGER      NOT NULL DEFAULT 0,    -- UGX per unit
    line_total      INTEGER      NOT NULL DEFAULT 0,    -- qty_ordered * unit_cost
    UNIQUE (po_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_po_lines_po ON purchase_order_lines (po_id);
CREATE INDEX IF NOT EXISTS idx_po_lines_ingredient ON purchase_order_lines (ingredient_id);
