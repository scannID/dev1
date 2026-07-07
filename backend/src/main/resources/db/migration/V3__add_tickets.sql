CREATE TABLE tickets (
    id                  VARCHAR(32) PRIMARY KEY,
    qr_token            VARCHAR(64) NOT NULL UNIQUE,
    ticket_type         VARCHAR(64) NOT NULL,
    event_name          VARCHAR(255) NOT NULL,
    event_date          TIMESTAMPTZ,
    holder_name         VARCHAR(255) NOT NULL DEFAULT '',
    holder_phone        VARCHAR(32) NOT NULL DEFAULT '',
    holder_email        VARCHAR(255) NOT NULL DEFAULT '',
    price               INTEGER NOT NULL,
    currency            VARCHAR(8) NOT NULL DEFAULT 'UGX',
    status              VARCHAR(32) NOT NULL DEFAULT 'Active',
    usage_limit         INTEGER NOT NULL DEFAULT 1,
    usage_count         INTEGER NOT NULL DEFAULT 0,
    expires_at          TIMESTAMPTZ,
    payment_reference   VARCHAR(64) NOT NULL DEFAULT '',
    payment_status      VARCHAR(32) NOT NULL DEFAULT 'Unpaid',
    issued_by           VARCHAR(255) NOT NULL DEFAULT '',
    metadata            TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ,
    redeemed_at         TIMESTAMPTZ
);

CREATE INDEX idx_tickets_qr_token ON tickets(qr_token);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_payment_status ON tickets(payment_status);

CREATE TABLE ticket_scans (
    id                  BIGSERIAL PRIMARY KEY,
    ticket_id           VARCHAR(32) NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    scanned_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scanned_by          VARCHAR(255) NOT NULL DEFAULT '',
    scan_location       VARCHAR(255) NOT NULL DEFAULT '',
    device_info         TEXT,
    scan_result         VARCHAR(32) NOT NULL DEFAULT 'Success'
);

CREATE INDEX idx_ticket_scans_ticket ON ticket_scans(ticket_id);
CREATE INDEX idx_ticket_scans_time ON ticket_scans(scanned_at);
