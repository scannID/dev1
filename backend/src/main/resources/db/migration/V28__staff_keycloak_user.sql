-- Link staff to Keycloak users (same login as merchants)
ALTER TABLE business_staff ADD COLUMN IF NOT EXISTS keycloak_user_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_staff_keycloak_business
    ON business_staff (keycloak_user_id, business_id)
    WHERE keycloak_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_staff_keycloak_user_id
    ON business_staff (keycloak_user_id)
    WHERE keycloak_user_id IS NOT NULL;
