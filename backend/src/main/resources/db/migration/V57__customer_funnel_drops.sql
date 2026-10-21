-- V57: customer funnel drop-off tracking
-- Tracks anonymous device visits that did not result in a placed order,
-- at which checkout step the customer stopped, and whether they gave feedback.

CREATE TABLE customer_funnel_drops (
    id              BIGSERIAL PRIMARY KEY,
    device_id       VARCHAR(128)    NOT NULL,
    business_id     VARCHAR(64)     NOT NULL,
    qr_token        VARCHAR(128)    NOT NULL DEFAULT '',
    last_step       VARCHAR(32)     NOT NULL,  -- 'menu' | 'cart' | 'details' | 'pay'
    phone           VARCHAR(32),               -- filled in when customer reached pay step
    dropped_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    notified        BOOLEAN         NOT NULL DEFAULT FALSE, -- nudge shown on next scan
    feedback_given  BOOLEAN         NOT NULL DEFAULT FALSE,
    feedback_reason VARCHAR(64),               -- quick-tap reason code
    feedback_text   TEXT,                      -- optional free-text
    feedback_at     TIMESTAMPTZ
);

-- One open drop per device per business (upserted on each step update)
CREATE UNIQUE INDEX uq_funnel_drop_device_business
    ON customer_funnel_drops (device_id, business_id)
    WHERE notified = FALSE;

CREATE INDEX idx_funnel_drop_business_id  ON customer_funnel_drops (business_id);
CREATE INDEX idx_funnel_drop_dropped_at   ON customer_funnel_drops (dropped_at);
