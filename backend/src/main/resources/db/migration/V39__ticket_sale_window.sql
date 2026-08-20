-- Sale window for event master tickets.
-- sale_starts_at: purchases blocked before this time (null = open immediately).
-- sale_ends_at:   purchases blocked after this time (null = no automatic close).
-- Both apply only to master ticket rows (master_ticket_id IS NULL).

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS sale_starts_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sale_ends_at   TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tickets_sale_window
    ON tickets (sale_starts_at, sale_ends_at)
    WHERE master_ticket_id IS NULL;
