-- Device Binding System for QR Code Security
-- Ensures one device per QR token, admin-controlled rebinding

-- ====================================================================================================
-- 1. QR Device Bindings Table
-- ====================================================================================================

CREATE TABLE IF NOT EXISTS qr_device_bindings (
    id BIGSERIAL PRIMARY KEY,
    
    -- What is bound
    qr_token VARCHAR(128) NOT NULL,
    token_type VARCHAR(20) NOT NULL DEFAULT 'UNIT', -- UNIT, TENANT_PAY
    
    -- Who is bound
    device_id VARCHAR(64) NOT NULL,
    device_fingerprint TEXT, -- JSON with device details (OS, browser, model, etc.)
    phone_number VARCHAR(20) NOT NULL, -- Verified tenant phone
    
    -- Which tenant/unit/property
    tenant_id VARCHAR(36),
    unit_id VARCHAR(36) NOT NULL,
    property_id VARCHAR(36) NOT NULL,
    
    -- Lifecycle timestamps
    bound_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP, -- Auto-set to lease_end + 7 days
    
    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, REVOKED, EXPIRED
    revoked_at TIMESTAMP,
    revoked_by VARCHAR(36), -- admin_id, tenant_id, or 'SYSTEM'
    revoked_reason VARCHAR(255),
    
    -- Usage statistics
    last_used_at TIMESTAMP,
    use_count INT DEFAULT 0,
    
    -- Security metadata
    created_ip VARCHAR(45), -- IP address when first bound
    created_user_agent VARCHAR(512), -- User agent when bound
    
    -- Constraints
    CONSTRAINT chk_device_binding_status CHECK (status IN ('ACTIVE', 'REVOKED', 'EXPIRED')),
    CONSTRAINT chk_device_binding_token_type CHECK (token_type IN ('UNIT', 'TENANT_PAY'))
);

-- ====================================================================================================
-- 2. Indexes for Performance
-- ====================================================================================================

-- Primary lookup: Check if device can access token
CREATE INDEX idx_qr_device_bindings_token_status ON qr_device_bindings(qr_token, status);

-- Find bindings by device
CREATE INDEX idx_qr_device_bindings_device ON qr_device_bindings(device_id);

-- Admin dashboard: List bindings by unit
CREATE INDEX idx_qr_device_bindings_unit ON qr_device_bindings(unit_id, status);

-- Admin dashboard: List bindings by property
CREATE INDEX idx_qr_device_bindings_property ON qr_device_bindings(property_id, status);

-- Scheduled job: Find expired bindings
CREATE INDEX idx_qr_device_bindings_expires ON qr_device_bindings(expires_at, status) 
    WHERE status = 'ACTIVE' AND expires_at IS NOT NULL;

-- Analytics: Find recent revocations
CREATE INDEX idx_qr_device_bindings_revoked ON qr_device_bindings(revoked_at DESC) 
    WHERE status = 'REVOKED';

-- Ensure only ONE active binding per QR token
CREATE UNIQUE INDEX idx_qr_device_bindings_unique_active 
    ON qr_device_bindings(qr_token) 
    WHERE status = 'ACTIVE';

-- ====================================================================================================
-- 3. Foreign Key Constraints (Optional - for data integrity)
-- ====================================================================================================

-- Link to rent units (if unit is deleted, cascade delete bindings)
ALTER TABLE qr_device_bindings 
    ADD CONSTRAINT fk_device_binding_unit 
    FOREIGN KEY (unit_id) REFERENCES rent_units(id) 
    ON DELETE CASCADE;

-- Link to rent properties
ALTER TABLE qr_device_bindings 
    ADD CONSTRAINT fk_device_binding_property 
    FOREIGN KEY (property_id) REFERENCES rent_properties(id) 
    ON DELETE CASCADE;

-- Link to rent tenants (nullable - tenant might be deleted but binding remains for audit)
ALTER TABLE qr_device_bindings 
    ADD CONSTRAINT fk_device_binding_tenant 
    FOREIGN KEY (tenant_id) REFERENCES rent_tenants(id) 
    ON DELETE SET NULL;

-- ====================================================================================================
-- 4. Helper Functions
-- ====================================================================================================

-- Function to auto-expire old bindings (called by scheduled job)
CREATE OR REPLACE FUNCTION expire_old_device_bindings()
RETURNS INT AS $$
DECLARE
    expired_count INT;
BEGIN
    -- Expire bindings that have passed their expiry date
    WITH expired AS (
        UPDATE qr_device_bindings
        SET status = 'EXPIRED',
            revoked_at = CURRENT_TIMESTAMP,
            revoked_by = 'SYSTEM',
            revoked_reason = 'Binding expired (lease ended)'
        WHERE status = 'ACTIVE'
          AND expires_at IS NOT NULL
          AND expires_at < CURRENT_TIMESTAMP
        RETURNING id
    )
    SELECT COUNT(*) INTO expired_count FROM expired;
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION expire_old_device_bindings() IS 
'Auto-expires device bindings past their expiry date. Run daily by scheduled job.';

-- Function to get active binding for a token (helper for queries)
CREATE OR REPLACE FUNCTION get_active_device_binding(token VARCHAR)
RETURNS TABLE (
    binding_id BIGINT,
    device_id VARCHAR,
    phone_number VARCHAR,
    unit_id VARCHAR,
    bound_at TIMESTAMP,
    last_used_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id,
        b.device_id,
        b.phone_number,
        b.unit_id,
        b.bound_at,
        b.last_used_at
    FROM qr_device_bindings b
    WHERE b.qr_token = token
      AND b.status = 'ACTIVE'
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================================================
-- 5. Views for Admin Dashboard
-- ====================================================================================================

-- Property-level device binding summary
CREATE OR REPLACE VIEW device_binding_summary AS
SELECT 
    p.id AS property_id,
    p.name AS property_name,
    COUNT(*) FILTER (WHERE b.status = 'ACTIVE') AS active_bindings,
    COUNT(*) FILTER (WHERE b.status = 'REVOKED') AS revoked_bindings,
    COUNT(*) FILTER (WHERE b.status = 'EXPIRED') AS expired_bindings,
    COUNT(*) FILTER (WHERE b.status = 'REVOKED' AND b.revoked_at > CURRENT_DATE - INTERVAL '7 days') AS recent_revocations,
    AVG(b.use_count) FILTER (WHERE b.status = 'ACTIVE') AS avg_scans_per_device,
    COUNT(DISTINCT b.unit_id) AS units_with_bindings,
    MAX(b.bound_at) AS latest_binding_date
FROM rent_properties p
LEFT JOIN qr_device_bindings b ON b.property_id = p.id
GROUP BY p.id, p.name;

COMMENT ON VIEW device_binding_summary IS 
'Property-level statistics for device bindings. Used in admin dashboard.';

-- Unit-level device binding details
CREATE OR REPLACE VIEW unit_device_bindings AS
SELECT 
    b.id AS binding_id,
    b.qr_token,
    b.device_id,
    b.phone_number,
    b.status,
    b.bound_at,
    b.last_used_at,
    b.use_count,
    b.revoked_at,
    b.revoked_reason,
    u.id AS unit_id,
    u.unit_number,
    p.id AS property_id,
    p.name AS property_name,
    t.id AS tenant_id,
    t.name AS tenant_name,
    t.phone_number AS tenant_phone
FROM qr_device_bindings b
JOIN rent_units u ON u.id = b.unit_id
JOIN rent_properties p ON p.id = b.property_id
LEFT JOIN rent_tenants t ON t.id = b.tenant_id
ORDER BY b.bound_at DESC;

COMMENT ON VIEW unit_device_bindings IS 
'Detailed device binding information joined with unit and tenant data.';

-- ====================================================================================================
-- 6. Audit Log Enhancement
-- ====================================================================================================

-- Add device binding events to existing qr_scan_audit table
-- (No schema change needed, just document new action types)

COMMENT ON COLUMN qr_scan_audit.action IS 
'Action type: SCAN, ACCESS, PAYMENT, GENERATE, BIND, UNBIND, DEVICE_MISMATCH';

COMMENT ON COLUMN qr_scan_audit.outcome IS 
'Outcome: SUCCESS, DENIED, EXPIRED, INVALID, BLACKLISTED, RATE_LIMITED, DEVICE_MISMATCH';

-- ====================================================================================================
-- 7. Sample Data (Development Only - Remove in Production)
-- ====================================================================================================

-- DO NOT run this in production - for local testing only
-- INSERT INTO qr_device_bindings (
--     qr_token, device_id, phone_number, tenant_id, unit_id, property_id,
--     bound_at, status, use_count, device_fingerprint
-- ) VALUES (
--     'test-unit-token-123',
--     'device-abc-123',
--     '+256700123456',
--     'tenant-001',
--     'unit-001',
--     'property-001',
--     CURRENT_TIMESTAMP,
--     'ACTIVE',
--     5,
--     '{"type":"mobile","os":"Android 13","browser":"Chrome 120"}'
-- );

-- ====================================================================================================
-- 8. Grant Permissions (if using restricted database users)
-- ====================================================================================================

-- GRANT SELECT, INSERT, UPDATE, DELETE ON qr_device_bindings TO scanny_app_user;
-- GRANT USAGE, SELECT ON SEQUENCE qr_device_bindings_id_seq TO scanny_app_user;
-- GRANT SELECT ON device_binding_summary TO scanny_app_user;
-- GRANT SELECT ON unit_device_bindings TO scanny_app_user;

-- ====================================================================================================
-- DONE: Device Binding System Schema
-- ====================================================================================================
-- Summary:
-- ✅ Created qr_device_bindings table with unique active constraint
-- ✅ Added 7 performance indexes
-- ✅ Created foreign key constraints for data integrity
-- ✅ Added helper functions for expiry and lookups
-- ✅ Created admin dashboard views
-- ✅ Enhanced audit log documentation
-- ====================================================================================================
