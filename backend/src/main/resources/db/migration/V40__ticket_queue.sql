-- V40__ticket_queue.sql
CREATE TABLE ticket_queue_entries (
    id                  VARCHAR(64) PRIMARY KEY,
    master_id           VARCHAR(32) NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    ticket_class        VARCHAR(64) NOT NULL,
    holder_name         VARCHAR(255) NOT NULL,
    holder_phone        VARCHAR(32) NOT NULL,
    holder_email        VARCHAR(255),
    payment_phone       VARCHAR(32),
    provider            VARCHAR(32),
    presale_code        VARCHAR(128),
    status              VARCHAR(32) NOT NULL DEFAULT 'Waiting',
    position            INTEGER,
    attendee_ticket_id  VARCHAR(32),
    view_url            TEXT,
    error_message       TEXT,
    queued_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at        TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_ticket_queue_status  ON ticket_queue_entries(master_id, status, queued_at);
CREATE INDEX idx_ticket_queue_expires ON ticket_queue_entries(expires_at) WHERE status = 'Waiting';
