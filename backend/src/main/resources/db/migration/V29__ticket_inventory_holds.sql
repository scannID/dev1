-- Soft holds for class/table inventory (TTL on unpaid attendee tickets).
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tickets_inventory_hold
    ON tickets (master_ticket_id, ticket_type, payment_status, hold_expires_at);
