ALTER TABLE quick_payment_codes
    ADD COLUMN owner_email VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN tracking_number VARCHAR(32);

UPDATE quick_payment_codes
SET tracking_number = 'TRK-' || UPPER(SUBSTRING(REPLACE(id, 'QPC-', ''), 1, 8))
WHERE tracking_number IS NULL;

ALTER TABLE quick_payment_codes
    ALTER COLUMN tracking_number SET NOT NULL;

CREATE UNIQUE INDEX idx_quick_payment_codes_tracking ON quick_payment_codes(tracking_number);
CREATE INDEX idx_quick_payment_codes_owner_email ON quick_payment_codes(owner_email);
