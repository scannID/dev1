-- V7: Merchant Registration and Authentication
-- Comprehensive merchant onboarding with QR code generation

-- Merchants table (business owners)
CREATE TABLE IF NOT EXISTS merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keycloak_user_id UUID UNIQUE NOT NULL,
    
    -- Contact
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(50),
    
    -- Business details
    business_name VARCHAR(200) NOT NULL,
    business_type VARCHAR(50) NOT NULL CHECK (business_type IN ('RESTAURANT', 'BAR', 'PARKING', 'EVENT', 'SALON', 'RETAIL', 'OTHER')),
    business_description TEXT,
    business_address TEXT,
    business_logo_url TEXT,
    
    -- QR Code (auto-generated on first login)
    qr_code_token VARCHAR(100) UNIQUE,
    qr_code_url TEXT,
    qr_code_generated_at TIMESTAMP,
    qr_code_printed BOOLEAN DEFAULT FALSE,
    qr_code_print_count INT DEFAULT 0,
    
    -- Payment destination (primary)
    payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('MOBILE_MONEY', 'BANK_ACCOUNT')),
    payment_provider VARCHAR(50),        -- MTN, AIRTEL, AFRICELL, etc.
    payment_number VARCHAR(50),          -- Mobile money number
    payment_account_name VARCHAR(200),   -- Account holder name
    
    -- Bank details (if payment_type = BANK_ACCOUNT)
    bank_name VARCHAR(100),
    bank_account_number VARCHAR(50),
    bank_branch_code VARCHAR(20),
    bank_swift_code VARCHAR(20),
    
    -- Verification & Status
    email_verified BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMP,
    phone_verified BOOLEAN DEFAULT FALSE,
    phone_verified_at TIMESTAMP,
    payment_verified BOOLEAN DEFAULT FALSE,
    payment_verified_at TIMESTAMP,
    
    -- Account status
    status VARCHAR(20) DEFAULT 'PENDING_VERIFICATION' CHECK (status IN ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'CLOSED')),
    approved_by UUID,  -- Admin user ID
    approved_at TIMESTAMP,
    suspension_reason TEXT,
    
    -- Subscription & Plan
    plan VARCHAR(20) DEFAULT 'FREE' CHECK (plan IN ('FREE', 'BASIC', 'PRO', 'ENTERPRISE')),
    plan_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    plan_expires_at TIMESTAMP,
    trial_ends_at TIMESTAMP,
    
    -- Onboarding progress
    onboarding_completed BOOLEAN DEFAULT FALSE,
    onboarding_step INT DEFAULT 1,
    onboarding_completed_at TIMESTAMP,
    
    -- Features & Limits
    max_catalog_items INT DEFAULT 50,
    max_orders_per_month INT DEFAULT 1000,
    allow_online_payments BOOLEAN DEFAULT TRUE,
    allow_table_ordering BOOLEAN DEFAULT TRUE,
    allow_takeaway BOOLEAN DEFAULT TRUE,
    
    -- Marketing
    referral_code VARCHAR(20) UNIQUE,
    referred_by VARCHAR(20),
    
    -- Metadata
    settings JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,
    
    -- Constraints
    CONSTRAINT payment_details_check CHECK (
        (payment_type = 'MOBILE_MONEY' AND payment_number IS NOT NULL) OR
        (payment_type = 'BANK_ACCOUNT' AND bank_account_number IS NOT NULL)
    )
);

-- Additional payment destinations (merchants can have multiple)
CREATE TABLE IF NOT EXISTS merchant_payment_methods (
    id BIGSERIAL PRIMARY KEY,
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    
    -- Payment type
    payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('MOBILE_MONEY', 'BANK_ACCOUNT')),
    
    -- Mobile Money
    mobile_money_provider VARCHAR(20),  -- MTN, AIRTEL, AFRICELL
    mobile_money_number VARCHAR(50),
    mobile_money_name VARCHAR(200),
    
    -- Bank Account
    bank_name VARCHAR(100),
    bank_account_number VARCHAR(50),
    bank_account_name VARCHAR(200),
    bank_branch_code VARCHAR(20),
    bank_swift_code VARCHAR(20),
    
    -- Status
    is_primary BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- QR Code generation logs
CREATE TABLE IF NOT EXISTS qr_code_generations (
    id BIGSERIAL PRIMARY KEY,
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    
    qr_token VARCHAR(100) NOT NULL,
    qr_url TEXT NOT NULL,
    generation_reason VARCHAR(50),  -- FIRST_LOGIN, REGENERATE, LOST, DAMAGED
    
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    generated_by UUID,  -- User who triggered generation
    
    -- Was this QR code printed?
    printed BOOLEAN DEFAULT FALSE,
    printed_at TIMESTAMP,
    print_count INT DEFAULT 0,
    
    -- Metadata
    metadata JSONB
);

-- Merchant activity log
CREATE TABLE IF NOT EXISTS merchant_activity_log (
    id BIGSERIAL PRIMARY KEY,
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    
    activity_type VARCHAR(50) NOT NULL,  -- LOGIN, LOGOUT, QR_GENERATED, SETTINGS_UPDATED, etc.
    description TEXT,
    ip_address VARCHAR(50),
    user_agent TEXT,
    
    -- Metadata
    metadata JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for merchants
CREATE INDEX idx_merchants_keycloak_id ON merchants(keycloak_user_id);
CREATE INDEX idx_merchants_email ON merchants(email);
CREATE INDEX idx_merchants_qr_token ON merchants(qr_code_token);
CREATE INDEX idx_merchants_status ON merchants(status);
CREATE INDEX idx_merchants_business_type ON merchants(business_type);
CREATE INDEX idx_merchants_referral_code ON merchants(referral_code);
CREATE INDEX idx_merchants_created_at ON merchants(created_at DESC);

-- Indexes for payment methods
CREATE INDEX idx_payment_methods_merchant ON merchant_payment_methods(merchant_id);
CREATE INDEX idx_payment_methods_primary ON merchant_payment_methods(merchant_id, is_primary) WHERE is_primary = TRUE;

-- Indexes for QR generations
CREATE INDEX idx_qr_generations_merchant ON qr_code_generations(merchant_id);
CREATE INDEX idx_qr_generations_token ON qr_code_generations(qr_token);

-- Indexes for activity log
CREATE INDEX idx_activity_log_merchant ON merchant_activity_log(merchant_id);
CREATE INDEX idx_activity_log_type ON merchant_activity_log(activity_type);
CREATE INDEX idx_activity_log_created ON merchant_activity_log(created_at DESC);

-- Function to generate unique QR token
CREATE OR REPLACE FUNCTION generate_qr_token()
RETURNS VARCHAR(100) AS $$
DECLARE
    new_token VARCHAR(100);
    token_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate token: QR-<random 12 chars>-<timestamp>
        new_token := 'QR-' || 
                    upper(substring(md5(random()::text) from 1 for 12)) || 
                    '-' || 
                    extract(epoch from current_timestamp)::bigint;
        
        -- Check if token exists
        SELECT EXISTS(SELECT 1 FROM merchants WHERE qr_code_token = new_token) INTO token_exists;
        
        EXIT WHEN NOT token_exists;
    END LOOP;
    
    RETURN new_token;
END;
$$ LANGUAGE plpgsql;

-- Function to generate referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS VARCHAR(20) AS $$
DECLARE
    new_code VARCHAR(20);
    code_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate code: 6 uppercase alphanumeric
        new_code := upper(substring(md5(random()::text) from 1 for 6));
        
        -- Check if code exists
        SELECT EXISTS(SELECT 1 FROM merchants WHERE referral_code = new_code) INTO code_exists;
        
        EXIT WHEN NOT code_exists;
    END LOOP;
    
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate referral code
CREATE OR REPLACE FUNCTION set_merchant_defaults()
RETURNS TRIGGER AS $$
BEGIN
    -- Generate referral code if not provided
    IF NEW.referral_code IS NULL THEN
        NEW.referral_code := generate_referral_code();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_merchant_defaults
BEFORE INSERT ON merchants
FOR EACH ROW
EXECUTE FUNCTION set_merchant_defaults();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_merchant_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_merchant_updated_at
BEFORE UPDATE ON merchants
FOR EACH ROW
EXECUTE FUNCTION update_merchant_updated_at();

-- Link existing businesses to merchants (migration helper)
-- This allows gradual migration of existing data
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES merchants(id);
CREATE INDEX IF NOT EXISTS idx_businesses_merchant_id ON businesses(merchant_id);

-- Comments
COMMENT ON TABLE merchants IS 'Merchant accounts for business owners';
COMMENT ON TABLE merchant_payment_methods IS 'Multiple payment destinations per merchant';
COMMENT ON TABLE qr_code_generations IS 'Audit log of QR code generations';
COMMENT ON TABLE merchant_activity_log IS 'Activity tracking for security and analytics';

COMMENT ON COLUMN merchants.qr_code_token IS 'Unique token embedded in QR code, format: QR-XXXXXXXXXXXX-timestamp';
COMMENT ON COLUMN merchants.qr_code_url IS 'Full URL that QR code points to: https://scanit.app/menu/{qr_token}';
COMMENT ON COLUMN merchants.onboarding_step IS 'Current step in onboarding: 1=Email Verified, 2=QR Generated, 3=Catalog Added, 4=First Order, 5=Complete';
COMMENT ON COLUMN merchants.status IS 'Account status: PENDING_VERIFICATION (just registered), ACTIVE (can accept orders), SUSPENDED (temporarily disabled), CLOSED (permanently disabled)';
