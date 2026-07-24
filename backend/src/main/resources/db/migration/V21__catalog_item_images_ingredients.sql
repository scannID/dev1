ALTER TABLE catalog_items
    ADD COLUMN IF NOT EXISTS image_url TEXT,
    ADD COLUMN IF NOT EXISTS details TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS ingredients_json TEXT NOT NULL DEFAULT '[]';

ALTER TABLE order_line_items
    ADD COLUMN IF NOT EXISTS removed_ingredients_json TEXT NOT NULL DEFAULT '[]';
