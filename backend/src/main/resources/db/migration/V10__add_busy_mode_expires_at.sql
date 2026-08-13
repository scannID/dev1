-- Adds a server-side expiry timestamp for busy mode so businesses
-- auto-resume even if the merchant closes their browser before the
-- client-side countdown fires.
ALTER TABLE businesses
    ADD COLUMN busy_mode_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
