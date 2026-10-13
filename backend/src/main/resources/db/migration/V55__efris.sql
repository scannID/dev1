-- V55: EFRIS (Uganda Revenue Authority Electronic Fiscal Receipting and Invoicing System)
--
-- Creates two new tables and extends `receipts` with three EFRIS columns.
--
-- efris_merchant_configs  — per-merchant URA credentials (TIN, device key, etc.)
-- efris_submissions       — immutable audit log of every URA submission attempt
-- receipts (ALTER)        — efris_fdn, efris_qr_url, efris_status columns

-- ── 1. Per-merchant EFRIS credentials ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS efris_merchant_configs (
    -- Same UUID string as merchants.id; no FK to avoid coupling migrations.
    merchant_id         VARCHAR(64)  NOT NULL,

    -- URA Taxpayer Identification Number, e.g. "1000012345"
    tin                 VARCHAR(20)  NOT NULL,

    -- EFRIS device number issued by URA, e.g. "EFD12345"
    device_number       VARCHAR(50)  NOT NULL,

    -- AES-256 symmetric key issued by URA, stored Base64-encoded (44 chars).
    -- TODO: encrypt at rest (KMS / Vault) before production deployment.
    device_key          VARCHAR(256) NOT NULL,

    -- Legal business name as registered with URA (appears on fiscal receipts).
    legal_name          VARCHAR(200),

    -- Physical address as registered with URA.
    registered_address  VARCHAR(500),

    -- When false this merchant's orders are silently skipped by the EFRIS pipeline.
    enabled             BOOLEAN      NOT NULL DEFAULT FALSE,

    created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_efris_merchant_configs PRIMARY KEY (merchant_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_efris_cfg_merchant
    ON efris_merchant_configs (merchant_id);

-- ── 2. Immutable submission audit log ─────────────────────────────────────────
-- One row per attempt.  Rows are never updated — each retry inserts a fresh row
-- so the full history is preserved.  The most recent SUCCESS/STUB row is canonical.
CREATE TABLE IF NOT EXISTS efris_submissions (
    id              VARCHAR(64)  NOT NULL,
    order_id        VARCHAR(64)  NOT NULL,
    business_id     VARCHAR(64)  NOT NULL,

    -- 1-based attempt number for this order.
    attempt         INT          NOT NULL,

    -- SUCCESS | FAILED | STUB
    status          VARCHAR(20)  NOT NULL,

    -- Fiscal Document Number returned by URA on SUCCESS, or fake value on STUB.
    -- NULL on FAILED rows.
    fdn             VARCHAR(100),

    -- URA-hosted verification URL embedded as QR on customer receipts.
    qr_url          TEXT,

    -- Raw JSON request sent to URA (NULL in STUB mode).
    request_json    TEXT,

    -- Raw JSON response from URA, or error message on FAILED.
    response_json   TEXT,

    -- HTTP status code returned by URA, or 0 for network/timeout errors.
    http_status     INT          NOT NULL DEFAULT 0,

    -- Wall-clock time when this attempt was made.
    attempted_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_efris_submissions PRIMARY KEY (id),
    CONSTRAINT chk_efris_status CHECK (status IN ('SUCCESS', 'FAILED', 'STUB'))
);

CREATE INDEX IF NOT EXISTS idx_efris_sub_order
    ON efris_submissions (order_id);

CREATE INDEX IF NOT EXISTS idx_efris_sub_business
    ON efris_submissions (business_id, attempted_at);

-- ── 3. Extend receipts with EFRIS fiscal fields ────────────────────────────────
ALTER TABLE receipts
    ADD COLUMN IF NOT EXISTS efris_fdn      VARCHAR(100),
    ADD COLUMN IF NOT EXISTS efris_qr_url   TEXT,
    ADD COLUMN IF NOT EXISTS efris_status   VARCHAR(20) NOT NULL DEFAULT 'PENDING';

ALTER TABLE receipts
    ADD CONSTRAINT chk_receipt_efris_status
        CHECK (efris_status IN ('PENDING', 'SUBMITTED', 'FAILED', 'EXEMPT'));

CREATE INDEX IF NOT EXISTS idx_receipts_efris_status
    ON receipts (efris_status)
    WHERE efris_status = 'PENDING';

-- Comments
COMMENT ON TABLE  efris_merchant_configs                  IS 'Per-merchant URA EFRIS credentials — TIN, device number, and AES device key.';
COMMENT ON TABLE  efris_submissions                       IS 'Immutable audit log of every EFRIS/URA submission attempt (one row per attempt).';
COMMENT ON COLUMN efris_submissions.attempt               IS '1-based attempt number; increments on each retry for the same order.';
COMMENT ON COLUMN efris_submissions.fdn                   IS 'Fiscal Document Number from URA (null on FAILED, fake on STUB).';
COMMENT ON COLUMN receipts.efris_fdn                      IS 'URA Fiscal Document Number populated once submission succeeds.';
COMMENT ON COLUMN receipts.efris_qr_url                   IS 'URA-hosted verification URL — embed as QR code on the printed receipt.';
COMMENT ON COLUMN receipts.efris_status                   IS 'EFRIS submission lifecycle: PENDING → SUBMITTED | FAILED | EXEMPT.';
