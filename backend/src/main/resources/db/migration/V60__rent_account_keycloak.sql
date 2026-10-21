-- V60: Add Keycloak integration to rent_accounts
-- Replaces the RAK- access-key dashboard login with proper Keycloak SSO
-- (same pattern as the merchants table).  The access_key column is kept
-- so existing pay-page deep links and token resolution still work.

-- Add the keycloak_user_id column.  Nullable so existing rows are not broken;
-- the application fills it on the user's first Keycloak login via the
-- email-link fallback (same strategy as MerchantService.linkMerchantByEmail).
ALTER TABLE rent_accounts
    ADD COLUMN IF NOT EXISTS keycloak_user_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rent_accounts_keycloak_user_id
    ON rent_accounts (keycloak_user_id)
    WHERE keycloak_user_id IS NOT NULL;

-- Make email unique so the email-link fallback is safe to use.
-- (The application already treated it as unique; this makes it a DB constraint.)
ALTER TABLE rent_accounts
    ADD CONSTRAINT IF NOT EXISTS uq_rent_accounts_email UNIQUE (email);
