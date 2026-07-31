-- Inventory: ingredients, recipes, stock movements, order COGS

CREATE TABLE IF NOT EXISTS ingredients (
    id                      VARCHAR(64) PRIMARY KEY,
    business_id             VARCHAR(64) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name                    VARCHAR(255) NOT NULL,
    unit                    VARCHAR(16) NOT NULL DEFAULT 'pcs',
    category                VARCHAR(64) NOT NULL DEFAULT '',
    qty_on_hand             NUMERIC(18, 4) NOT NULL DEFAULT 0,
    avg_unit_cost           INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold     NUMERIC(18, 4) NOT NULL DEFAULT 0,
    sku                     VARCHAR(64) NOT NULL DEFAULT '',
    active                  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ingredients_business ON ingredients (business_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredients_business_name
    ON ingredients (business_id, lower(name));

CREATE TABLE IF NOT EXISTS recipe_lines (
    id                      BIGSERIAL PRIMARY KEY,
    catalog_item_id         VARCHAR(64) NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
    ingredient_id           VARCHAR(64) NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    qty_per_sale            NUMERIC(18, 4) NOT NULL,
    UNIQUE (catalog_item_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_lines_item ON recipe_lines (catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_recipe_lines_ingredient ON recipe_lines (ingredient_id);

CREATE TABLE IF NOT EXISTS stock_movements (
    id                      BIGSERIAL PRIMARY KEY,
    business_id             VARCHAR(64) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    ingredient_id           VARCHAR(64) NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    movement_type           VARCHAR(16) NOT NULL,
    qty_delta               NUMERIC(18, 4) NOT NULL,
    unit_cost               INTEGER NOT NULL DEFAULT 0,
    order_id                VARCHAR(32) REFERENCES orders(id) ON DELETE SET NULL,
    note                    TEXT NOT NULL DEFAULT '',
    actor                   VARCHAR(255) NOT NULL DEFAULT '',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_business ON stock_movements (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_ingredient ON stock_movements (ingredient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_order ON stock_movements (order_id);

ALTER TABLE order_line_items
    ADD COLUMN IF NOT EXISTS cost_amount INTEGER NOT NULL DEFAULT 0;

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS cogs_total INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS inventory_consumed BOOLEAN NOT NULL DEFAULT FALSE;
