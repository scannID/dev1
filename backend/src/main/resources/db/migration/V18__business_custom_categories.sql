ALTER TABLE businesses
    ADD COLUMN IF NOT EXISTS custom_categories JSONB NOT NULL DEFAULT '[]'::jsonb;
