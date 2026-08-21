-- Batch / lot tracking for ingredients that need expiry management
-- (perishables, medication, chemicals, etc.).
-- A batch is created when stock is received and consumed FIFO by the consume path.

CREATE TABLE IF NOT EXISTS ingredient_batches (
    id              BIGSERIAL PRIMARY KEY,
    business_id     VARCHAR(64) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    ingredient_id   VARCHAR(64) NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    batch_number    VARCHAR(128) NOT NULL DEFAULT '',  -- supplier lot / merchant label
    qty_original    NUMERIC(18,4) NOT NULL,
    qty_remaining   NUMERIC(18,4) NOT NULL,
    unit_cost       INTEGER      NOT NULL DEFAULT 0,
    expiry_date     DATE,                              -- NULL = no expiry tracked
    received_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    po_id           VARCHAR(64) REFERENCES purchase_orders(id) ON DELETE SET NULL,
    notes           TEXT         NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_batches_business ON ingredient_batches (business_id);
CREATE INDEX IF NOT EXISTS idx_batches_ingredient ON ingredient_batches (ingredient_id, received_at ASC);
CREATE INDEX IF NOT EXISTS idx_batches_expiry ON ingredient_batches (expiry_date)
    WHERE expiry_date IS NOT NULL;
