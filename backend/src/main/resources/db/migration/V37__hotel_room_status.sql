-- Hotel room lifecycle status + item_kind snapshot on order line items

-- Room status column on catalog_items (only meaningful for ROOM/SUITE item_kind)
ALTER TABLE catalog_items
    ADD COLUMN IF NOT EXISTS room_status VARCHAR(32) NOT NULL DEFAULT 'VACANT';

-- item_kind snapshot on order_line_items so kitchen queries never need to re-join catalog_items
ALTER TABLE order_line_items
    ADD COLUMN IF NOT EXISTS item_kind VARCHAR(16) NOT NULL DEFAULT 'FOOD';

-- Index for fast hotel ops queries: all occupied/booked/checkout-pending rooms per business
CREATE INDEX IF NOT EXISTS idx_catalog_items_room_status
    ON catalog_items (business_id, item_kind, room_status)
    WHERE item_kind IN ('ROOM', 'SUITE');

-- Index for kitchen filter: skip lodging-only orders efficiently
CREATE INDEX IF NOT EXISTS idx_order_line_items_item_kind
    ON order_line_items (item_kind);
