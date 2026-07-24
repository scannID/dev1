ALTER TABLE catalog_items
    ADD COLUMN IF NOT EXISTS discount_percent INT NOT NULL DEFAULT 0;
