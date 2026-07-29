-- Staff invite + password login (replaces PIN auth)
ALTER TABLE business_staff ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE business_staff ADD COLUMN IF NOT EXISTS invite_token VARCHAR(64);
ALTER TABLE business_staff ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMP;
ALTER TABLE business_staff ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMP;

-- Migrate existing pin_hash → password_hash so old staff can still log in
UPDATE business_staff SET password_hash = pin_hash WHERE pin_hash IS NOT NULL AND password_hash IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_staff_invite_token ON business_staff (invite_token) WHERE invite_token IS NOT NULL;

-- Allow looking up staff by email across all businesses (for branchless login)
CREATE INDEX IF NOT EXISTS idx_business_staff_email ON business_staff (LOWER(email));
