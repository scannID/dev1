ALTER TABLE tickets ADD COLUMN gate_token VARCHAR(64);
CREATE UNIQUE INDEX idx_tickets_gate_token ON tickets (gate_token) WHERE gate_token IS NOT NULL;
