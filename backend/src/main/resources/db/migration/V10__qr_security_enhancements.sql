-- QR Code Security Enhancements
-- This migration adds comprehensive QR scan audit logging and updates token columns

-- ====================================================================================================
-- 1. QR Scan Audit Table
-- ====================================================================================================
-- Tracks all QR code scan attempts for security monitoring and intrusion detection

CREATE TABLE IF NOT EXISTS qr_scan_audit (
    id BIGSERIAL PRIMARY KEY,
    
    -- Token identification (hashed for security - never store plaintext in logs)
    token_hash VARCHAR(64) NOT NULL,
    token_type VARCHAR(20) NOT NULL, -- MERCHANT, BUSINESS, RENT_PROPERTY, RENT_UNIT, TENANT_PAY
    
    -- Action and outcome
    action VARCHAR(20) NOT NULL, -- SCAN, ACCESS, PAYMENT, GENERATE
    outcome VARCHAR(20) NOT NULL, -- SUCCESS, DENIED, EXPIRED, INVALID, BLACKLISTED, RATE_LIMITED
    outcome_details VARCHAR(512),
    
    -- Client identification
    ip_address VARCHAR(45) NOT NULL, -- IPv4 or IPv6
    user_agent VARCHAR(512) NOT NULL DEFAULT '',
    device_id VARCHAR(64), -- Optional X-Device-ID header
    
    -- Related entity (merchant_id, business_id, property_id, etc.)
    entity_id VARCHAR(100),
    
    -- Security flags
    suspicious BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Timestamp
    scanned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    CONSTRAINT chk_qr_audit_token_type CHECK (token_type IN (
        'MERCHANT', 'BUSINESS', 'RENT_PROPERTY', 'RENT_UNIT', 'TENANT_PAY', 'UNKNOWN'
    )),
    CONSTRAINT chk_qr_audit_action CHECK (action IN (
        'SCAN', 'ACCESS', 'PAYMENT', 'GENERATE'
    )),
    CONSTRAINT chk_qr_audit_outcome CHECK (outcome IN (
        'SUCCESS', 'DENIED', 'EXPIRED', 'INVALID', 'BLACKLISTED', 'RATE_LIMITED'
    ))
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_qr_scan_audit_ip_outcome ON qr_scan_audit(ip_address, outcome, scanned_at);
CREATE INDEX IF NOT EXISTS idx_qr_scan_audit_device_outcome ON qr_scan_audit(device_id, outcome, scanned_at);
CREATE INDEX IF NOT EXISTS idx_qr_scan_audit_token_hash ON qr_scan_audit(token_hash);
CREATE INDEX IF NOT EXISTS idx_qr_scan_audit_scanned_at ON qr_scan_audit(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_qr_scan_audit_entity_id ON qr_scan_audit(entity_id);
CREATE INDEX IF NOT EXISTS idx_qr_scan_audit_suspicious ON qr_scan_audit(suspicious, scanned_at DESC) WHERE suspicious = TRUE;

COMMENT ON TABLE qr_scan_audit IS 'Audit log for all QR code scan attempts. Used for security monitoring, intrusion detection, and compliance.';
COMMENT ON COLUMN qr_scan_audit.token_hash IS 'SHA-256 hash of the QR token (not plaintext). Allows tracking without exposing actual tokens.';
COMMENT ON COLUMN qr_scan_audit.suspicious IS 'Flagged by automated detection: multiple failures, rapid scanning, enumeration patterns.';
COMMENT ON COLUMN qr_scan_audit.outcome_details IS 'Additional context about the outcome (error message, validation failure reason, etc.)';

-- ====================================================================================================
-- 2. Update Token Column Sizes
-- ====================================================================================================
-- Increase token column sizes to accommodate 256-bit Base64 tokens (43 characters)
-- Old format: QR-XXXXXXXXXXXX-1737513600 (28 chars)
-- New format: QR-8fK3mN9pL2dQ7xR4vT6wY1sZ5cA0hJ8bE4gU7iO9kXy (46 chars)

-- Merchant QR tokens
ALTER TABLE merchants ALTER COLUMN qr_code_token TYPE VARCHAR(100);

-- Business QR tokens
ALTER TABLE businesses ALTER COLUMN qr_token TYPE VARCHAR(100);

-- Rent property QR tokens (already 128 chars, but document the change)
-- ALTER TABLE rent_properties ALTER COLUMN qr_token TYPE VARCHAR(128); -- Already sufficient

-- Rent unit QR tokens (already 128 chars)
-- ALTER TABLE rent_units ALTER COLUMN qr_token TYPE VARCHAR(128); -- Already sufficient

-- Rent tenant pay tokens (already 128 chars with TPT- prefix)
-- ALTER TABLE rent_tenants ALTER COLUMN pay_token TYPE VARCHAR(128); -- Already sufficient

-- ====================================================================================================
-- 3. Add Token Metadata Columns (for future rotation features)
-- ====================================================================================================

-- Merchants: Track QR code issuance and rotation
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS qr_token_issued_at TIMESTAMP;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS qr_token_version INT DEFAULT 1;

COMMENT ON COLUMN merchants.qr_token_issued_at IS 'When the current QR token was issued. Used for rotation tracking.';
COMMENT ON COLUMN merchants.qr_token_version IS 'Incremented each time QR token is regenerated. Helps track rotation history.';

-- Businesses: Track QR code metadata
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS qr_token_issued_at TIMESTAMP;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS qr_token_version INT DEFAULT 1;

-- Rent properties: Already have created_at, but add version tracking
ALTER TABLE rent_properties ADD COLUMN IF NOT EXISTS qr_token_version INT DEFAULT 1;

-- Rent units: Add version tracking
ALTER TABLE rent_units ADD COLUMN IF NOT EXISTS qr_token_version INT DEFAULT 1;

-- ====================================================================================================
-- 4. Set Default Values for Existing Records
-- ====================================================================================================

-- Set issued_at to creation date for existing QR codes
UPDATE merchants 
SET qr_token_issued_at = created_at 
WHERE qr_code_token IS NOT NULL AND qr_token_issued_at IS NULL;

UPDATE businesses 
SET qr_token_issued_at = created_at 
WHERE qr_token IS NOT NULL AND qr_token_issued_at IS NULL;

-- ====================================================================================================
-- 5. Create View for Security Dashboard
-- ====================================================================================================

CREATE OR REPLACE VIEW qr_security_summary AS
SELECT 
    DATE(scanned_at) as scan_date,
    token_type,
    outcome,
    COUNT(*) as scan_count,
    COUNT(DISTINCT ip_address) as unique_ips,
    COUNT(DISTINCT device_id) as unique_devices,
    SUM(CASE WHEN suspicious THEN 1 ELSE 0 END) as suspicious_count
FROM qr_scan_audit
WHERE scanned_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(scanned_at), token_type, outcome
ORDER BY scan_date DESC, token_type, outcome;

COMMENT ON VIEW qr_security_summary IS 'Daily QR scan statistics for security monitoring dashboard';

-- ====================================================================================================
-- 6. Add Retention Policy Comment (for ops team)
-- ====================================================================================================

COMMENT ON TABLE qr_scan_audit IS 
'Audit log for QR code security. RETENTION POLICY: Keep 90 days for compliance, archive older records. 
Consider partitioning by month if table grows > 10M rows.';

-- ====================================================================================================
-- 7. Optional: Sample Audit Log Cleanup Function
-- ====================================================================================================

CREATE OR REPLACE FUNCTION cleanup_old_qr_audit_logs()
RETURNS INT AS $$
DECLARE
    deleted_count INT;
BEGIN
    -- Delete non-suspicious audit logs older than 90 days
    -- Keep suspicious logs for 1 year
    WITH deleted AS (
        DELETE FROM qr_scan_audit
        WHERE (suspicious = FALSE AND scanned_at < CURRENT_DATE - INTERVAL '90 days')
           OR (suspicious = TRUE AND scanned_at < CURRENT_DATE - INTERVAL '365 days')
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_qr_audit_logs() IS 
'Cleanup function for qr_scan_audit table. Run monthly via cron or scheduled job.
Deletes normal logs after 90 days, suspicious logs after 1 year.';

-- To run cleanup manually:
-- SELECT cleanup_old_qr_audit_logs();

-- ====================================================================================================
-- DONE: QR Security Enhancements Applied
-- ====================================================================================================
-- Summary of changes:
-- ✅ Added qr_scan_audit table with comprehensive tracking
-- ✅ Increased token column sizes for 256-bit entropy
-- ✅ Added token versioning columns for future rotation
-- ✅ Created security monitoring view
-- ✅ Added retention policy and cleanup function
-- ====================================================================================================
