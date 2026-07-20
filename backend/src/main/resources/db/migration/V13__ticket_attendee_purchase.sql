ALTER TABLE tickets ADD COLUMN master_ticket_id VARCHAR(32);
ALTER TABLE tickets ADD COLUMN access_token VARCHAR(64);

CREATE INDEX idx_tickets_master_ticket ON tickets (master_ticket_id);
CREATE UNIQUE INDEX idx_tickets_access_token ON tickets (access_token);
