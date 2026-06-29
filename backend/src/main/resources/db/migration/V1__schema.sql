CREATE TABLE businesses (
    id                  VARCHAR(64) PRIMARY KEY,
    merchant_id         VARCHAR(32) NOT NULL UNIQUE,
    qr_token            VARCHAR(32) NOT NULL UNIQUE,
    name                VARCHAR(255) NOT NULL,
    owner_name          VARCHAR(255) NOT NULL,
    phone               VARCHAR(32) NOT NULL DEFAULT '',
    type                VARCHAR(32) NOT NULL,
    table_label         VARCHAR(128) NOT NULL,
    payment_reference   VARCHAR(32) NOT NULL,
    accent              VARCHAR(16) NOT NULL DEFAULT '#2563eb',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE catalog_items (
    id              VARCHAR(128) PRIMARY KEY,
    business_id     VARCHAR(64) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    category        VARCHAR(128) NOT NULL,
    price           INTEGER NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    available       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_catalog_items_business ON catalog_items(business_id);

CREATE TABLE orders (
    id                  VARCHAR(32) PRIMARY KEY,
    public_id           UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    business_id         VARCHAR(64) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    merchant_id         VARCHAR(32) NOT NULL,
    qr_token            VARCHAR(32) NOT NULL,
    payment_reference   VARCHAR(32) NOT NULL,
    business_name       VARCHAR(255) NOT NULL DEFAULT '',
    customer_name       VARCHAR(255) NOT NULL,
    customer_phone      VARCHAR(32) NOT NULL DEFAULT '',
    customer_location   VARCHAR(255) NOT NULL DEFAULT '',
    customer_note       TEXT NOT NULL DEFAULT '',
    total               INTEGER NOT NULL,
    status              VARCHAR(32) NOT NULL DEFAULT 'Pending',
    payment_status      VARCHAR(32) NOT NULL DEFAULT 'Unpaid',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ
);

CREATE INDEX idx_orders_business ON orders(business_id);
CREATE INDEX idx_orders_public_id ON orders(public_id);

CREATE TABLE order_line_items (
    id          BIGSERIAL PRIMARY KEY,
    order_id    VARCHAR(32) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    item_id     VARCHAR(128) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    price       INTEGER NOT NULL,
    quantity    INTEGER NOT NULL,
    line_total  INTEGER NOT NULL
);

CREATE INDEX idx_order_line_items_order ON order_line_items(order_id);
