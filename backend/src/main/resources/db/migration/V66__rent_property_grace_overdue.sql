-- Add grace period and overdue timing columns to rent_properties.
-- These are per-property defaults that managers can configure from the dashboard.

ALTER TABLE rent_properties
    ADD COLUMN IF NOT EXISTS grace_period_days INTEGER NOT NULL DEFAULT 0;

ALTER TABLE rent_properties
    ADD COLUMN IF NOT EXISTS overdue_after_days INTEGER NOT NULL DEFAULT 0;
