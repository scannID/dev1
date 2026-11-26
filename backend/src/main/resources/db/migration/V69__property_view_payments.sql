-- ============================================================================
-- V69: Property View Payments
-- ============================================================================
-- Tracks payments for viewing property details (vacant units).
-- Users must pay a viewing fee (typically 2000 UGX) before seeing vacant units
-- when they scan a property QR code.

CREATE TABLE property_view_payments (
    id                  BIGSERIAL PRIMARY KEY,
    property_id         VARCHAR(36) NOT NULL REFERENCES rent_properties(id),
    transaction_ref     VARCHAR(128) NOT NULL UNIQUE,
    viewer_phone        VARCHAR(64) NOT NULL,
    amount              BIGINT NOT NULL,
    currency            VARCHAR(8) NOT NULL DEFAULT 'UGX',
    status              VARCHAR(16) NOT NULL DEFAULT 'Pending',
    paid_at             TIMESTAMP,
    failed_at           TIMESTAMP,
    failure_reason      TEXT,
    expires_at          TIMESTAMP,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP
);

-- Index for checking if a viewer has already paid for a property
CREATE INDEX idx_property_view_payments_lookup 
    ON property_view_payments(property_id, viewer_phone, status);

-- Index for transaction reference lookups (payment polling)
CREATE INDEX idx_property_view_payments_transaction_ref 
    ON property_view_payments(transaction_ref);

-- Index for property analytics (how many people paid to view this property)
CREATE INDEX idx_property_view_payments_property_status 
    ON property_view_payments(property_id, status, created_at DESC);

COMMENT ON TABLE property_view_payments IS 
'Tracks payments for viewing property vacant units. Required before showing property details to QR scanners.';

COMMENT ON COLUMN property_view_payments.viewer_phone IS 
'Mobile money number of the person viewing the property.';

COMMENT ON COLUMN property_view_payments.expires_at IS 
'When this viewing access expires. NULL = permanent access after payment.';
