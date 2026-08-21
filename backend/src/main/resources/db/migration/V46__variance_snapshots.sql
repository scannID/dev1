-- Variance snapshots: periodic theoretical-vs-actual stock reconciliation.
-- The variance report computes theoretical consumption from recipes + orders
-- and compares it to actual stock movements to surface wastage or recording gaps.

CREATE TABLE IF NOT EXISTS variance_snapshots (
    id              BIGSERIAL PRIMARY KEY,
    business_id     VARCHAR(64)  NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    ingredient_id   VARCHAR(64)  NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    ingredient_name VARCHAR(255) NOT NULL,
    unit            VARCHAR(16)  NOT NULL,
    period_start    TIMESTAMPTZ  NOT NULL,
    period_end      TIMESTAMPTZ  NOT NULL,
    -- Stock at period start (manually entered or pulled from last snapshot)
    opening_qty     NUMERIC(18,4) NOT NULL DEFAULT 0,
    -- Total received during period (sum of RECEIVE movements)
    received_qty    NUMERIC(18,4) NOT NULL DEFAULT 0,
    -- Theoretical consumption = sum(recipe qty_per_sale × order qty) for paid orders
    theoretical_consumption NUMERIC(18,4) NOT NULL DEFAULT 0,
    -- Actual consumption = sum of CONSUME movements
    actual_consumption      NUMERIC(18,4) NOT NULL DEFAULT 0,
    -- Recorded waste = sum of WASTE movements
    recorded_waste  NUMERIC(18,4) NOT NULL DEFAULT 0,
    -- Closing stock = opening + received - actual_consumption - recorded_waste
    closing_qty     NUMERIC(18,4) NOT NULL DEFAULT 0,
    -- variance = actual_consumption - theoretical_consumption
    -- positive = used more than expected (wastage/over-portioning)
    -- negative = used less than expected (under-recording or theft?)
    variance_qty    NUMERIC(18,4) NOT NULL DEFAULT 0,
    variance_cost   INTEGER       NOT NULL DEFAULT 0,  -- UGX: variance_qty × avg_unit_cost
    avg_unit_cost   INTEGER       NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_variance_business ON variance_snapshots (business_id, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_variance_ingredient ON variance_snapshots (ingredient_id, period_end DESC);
