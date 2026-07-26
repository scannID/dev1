-- Hotel business type + lodging catalog fields + stay booking dates on order lines

ALTER TABLE merchants DROP CONSTRAINT IF EXISTS merchants_business_type_check;
ALTER TABLE merchants ADD CONSTRAINT merchants_business_type_check
    CHECK (business_type IN (
        'RESTAURANT', 'BAR', 'PARKING', 'EVENT', 'SALON', 'RETAIL', 'OTHER', 'HOTEL'
    ));

ALTER TABLE catalog_items
    ADD COLUMN IF NOT EXISTS item_kind VARCHAR(16) NOT NULL DEFAULT 'FOOD';

ALTER TABLE catalog_items
    ADD COLUMN IF NOT EXISTS image_urls TEXT NOT NULL DEFAULT '[]';

ALTER TABLE catalog_items
    ADD COLUMN IF NOT EXISTS capacity INTEGER NOT NULL DEFAULT 0;

ALTER TABLE catalog_items
    ADD COLUMN IF NOT EXISTS amenities_json TEXT NOT NULL DEFAULT '[]';

ALTER TABLE catalog_items
    ADD COLUMN IF NOT EXISTS units_available INTEGER NOT NULL DEFAULT 0;

ALTER TABLE order_line_items
    ADD COLUMN IF NOT EXISTS check_in_date DATE;

ALTER TABLE order_line_items
    ADD COLUMN IF NOT EXISTS check_out_date DATE;

ALTER TABLE order_line_items
    ADD COLUMN IF NOT EXISTS nights INTEGER;
