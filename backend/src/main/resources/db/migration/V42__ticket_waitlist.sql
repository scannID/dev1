-- Waitlist for sold-out ticket classes/tables.
-- When a class sells out, customers join the waitlist.
-- When a hold expires or a ticket is cancelled/refunded,
-- TicketWaitlistService notifies the next person via WhatsApp
-- with a time-limited purchase link.

CREATE TABLE ticket_waitlist (
    id          VARCHAR(64)  PRIMARY KEY,        -- WL-XXXXXXXXXXXXXXXX
    master_id   VARCHAR(32)  NOT NULL,            -- FK to tickets.id (master)
    ticket_class VARCHAR(64) NOT NULL,            -- which class/table they want
    holder_name VARCHAR(255) NOT NULL,
    holder_phone VARCHAR(32) NOT NULL,
    notified    BOOLEAN      NOT NULL DEFAULT FALSE,
    notified_at TIMESTAMPTZ,
    -- one-time purchase token sent in the WhatsApp link (30 min TTL)
    claim_token VARCHAR(64)  UNIQUE,
    claim_expires_at TIMESTAMPTZ,
    joined_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (master_id, holder_phone)
);

CREATE INDEX idx_ticket_waitlist_master
    ON ticket_waitlist (master_id, ticket_class, notified, joined_at);

CREATE INDEX idx_ticket_waitlist_claim
    ON ticket_waitlist (claim_token)
    WHERE claim_token IS NOT NULL;
