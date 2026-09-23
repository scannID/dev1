-- V52: Promoted events — organizers pay 40,000 UGX to push their event
--      into nearby restaurant customer sessions.

CREATE TABLE promoted_events (
    id                  VARCHAR(36)     PRIMARY KEY,

    -- Link back to the Ticket master record (ERI-XXXXXX)
    master_ticket_id    VARCHAR(50)     NOT NULL,
    event_name          VARCHAR(255)    NOT NULL,
    event_date          TIMESTAMPTZ,
    event_image_url     TEXT            NOT NULL DEFAULT '',
    purchase_url        TEXT            NOT NULL DEFAULT '',
    host                VARCHAR(255)    NOT NULL DEFAULT '',

    -- Event category for filtering on customer feed
    category            VARCHAR(100)    NOT NULL DEFAULT 'Other',

    -- Venue coordinates for proximity matching (set by organiser at promo time)
    venue_lat           DOUBLE PRECISION,
    venue_lng           DOUBLE PRECISION,
    venue_address       TEXT            NOT NULL DEFAULT '',

    -- Promotion radius the organiser purchased (km)
    radius_km           INT             NOT NULL DEFAULT 5,

    -- Promotion status: PENDING_PAYMENT → ACTIVE → EXPIRED / CANCELLED
    status              VARCHAR(30)     NOT NULL DEFAULT 'PENDING_PAYMENT',

    -- Payment tracking
    payment_id          VARCHAR(100)    NOT NULL DEFAULT '',
    payment_phone       VARCHAR(30)     NOT NULL DEFAULT '',
    payment_status      VARCHAR(30)     NOT NULL DEFAULT 'UNPAID',
    promotion_fee       INT             NOT NULL DEFAULT 40000,
    currency            VARCHAR(8)      NOT NULL DEFAULT 'UGX',

    -- Organiser contact (auto-filled from event metadata)
    organiser_phone     VARCHAR(30)     NOT NULL DEFAULT '',
    organiser_name      VARCHAR(255)    NOT NULL DEFAULT '',

    -- Active window: runs from payment confirmation until event_date
    -- (capped at 30 days). Set server-side on payment confirmation.
    promoted_from       TIMESTAMPTZ,
    promoted_until      TIMESTAMPTZ,

    -- Impression/click counters
    impressions         BIGINT          NOT NULL DEFAULT 0,
    clicks              BIGINT          NOT NULL DEFAULT 0,

    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ
);

CREATE INDEX idx_promoted_events_status ON promoted_events (status);
CREATE INDEX idx_promoted_events_master ON promoted_events (master_ticket_id);
CREATE INDEX idx_promoted_events_until  ON promoted_events (promoted_until);
-- Partial index on active promotions for fast proximity queries
CREATE INDEX idx_promoted_events_active ON promoted_events (status, promoted_until)
    WHERE status = 'ACTIVE';
