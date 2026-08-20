-- V41__ticket_transfer.sql
-- Add transfer fields to tickets table to support peer-to-peer ticket transfers
ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS transfer_token         VARCHAR(64) UNIQUE,
    ADD COLUMN IF NOT EXISTS transfer_expires_at    TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS transferred_from_phone VARCHAR(32);

CREATE INDEX IF NOT EXISTS idx_tickets_transfer_token
    ON tickets (transfer_token)
    WHERE transfer_token IS NOT NULL;
