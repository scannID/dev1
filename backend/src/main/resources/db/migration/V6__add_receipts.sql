-- V6: Add Receipts System
-- Automatically generate and send receipts after payment

-- Receipts table
CREATE TABLE IF NOT EXISTS receipts (
    id BIGSERIAL PRIMARY KEY,
    receipt_number VARCHAR(50) UNIQUE NOT NULL,
    
    -- Payment reference
    order_id VARCHAR(100),
    ticket_id BIGINT,
    quick_payment_id BIGINT,
    device_payment_id BIGINT,
    
    -- Business details
    business_id VARCHAR(100) NOT NULL,
    business_name VARCHAR(200) NOT NULL,
    merchant_id VARCHAR(100) NOT NULL,
    
    -- Customer details
    customer_name VARCHAR(200),
    customer_email VARCHAR(200),
    customer_phone VARCHAR(50),
    
    -- Payment details
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'UGX',
    payment_method VARCHAR(50),
    payment_reference VARCHAR(200),
    payment_date TIMESTAMP NOT NULL,
    
    -- Receipt items (JSON for flexibility)
    items JSONB,
    
    -- Tax and fees
    subtotal DECIMAL(12, 2),
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    service_fee DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL,
    
    -- Receipt status
    status VARCHAR(20) DEFAULT 'GENERATED' CHECK (status IN ('GENERATED', 'SENT', 'FAILED', 'VIEWED')),
    
    -- Delivery tracking
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMP,
    email_error TEXT,
    
    in_app_viewed BOOLEAN DEFAULT FALSE,
    in_app_viewed_at TIMESTAMP,
    
    -- PDF generation
    pdf_generated BOOLEAN DEFAULT FALSE,
    pdf_url TEXT,
    pdf_generated_at TIMESTAMP,
    
    -- Metadata
    notes TEXT,
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for receipts
CREATE INDEX idx_receipts_receipt_number ON receipts(receipt_number);
CREATE INDEX idx_receipts_order_id ON receipts(order_id);
CREATE INDEX idx_receipts_ticket_id ON receipts(ticket_id);
CREATE INDEX idx_receipts_business_id ON receipts(business_id);
CREATE INDEX idx_receipts_customer_email ON receipts(customer_email);
CREATE INDEX idx_receipts_payment_date ON receipts(payment_date DESC);
CREATE INDEX idx_receipts_status ON receipts(status);
CREATE INDEX idx_receipts_created_at ON receipts(created_at DESC);

-- Receipt delivery attempts table (for retry logic)
CREATE TABLE IF NOT EXISTS receipt_delivery_attempts (
    id BIGSERIAL PRIMARY KEY,
    receipt_id BIGINT NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    
    delivery_method VARCHAR(20) NOT NULL CHECK (delivery_method IN ('EMAIL', 'SMS', 'PUSH', 'IN_APP')),
    
    -- Attempt details
    attempt_number INT NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED')),
    
    -- Delivery details
    recipient VARCHAR(200),
    subject VARCHAR(300),
    
    -- Error tracking
    error_message TEXT,
    error_code VARCHAR(50),
    
    -- Response tracking
    provider_response JSONB,
    
    -- Timestamps
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Indexes for delivery attempts
CREATE INDEX idx_delivery_attempts_receipt_id ON receipt_delivery_attempts(receipt_id);
CREATE INDEX idx_delivery_attempts_status ON receipt_delivery_attempts(status);
CREATE INDEX idx_delivery_attempts_attempted_at ON receipt_delivery_attempts(attempted_at DESC);

-- Receipt templates table (for customization)
CREATE TABLE IF NOT EXISTS receipt_templates (
    id BIGSERIAL PRIMARY KEY,
    business_id VARCHAR(100) NOT NULL,
    
    -- Template details
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Template type
    template_type VARCHAR(20) DEFAULT 'DEFAULT' CHECK (template_type IN ('DEFAULT', 'CUSTOM', 'BRANDED')),
    
    -- Email template
    email_subject VARCHAR(300),
    email_body_html TEXT,
    email_body_text TEXT,
    
    -- SMS template (160 chars)
    sms_template VARCHAR(160),
    
    -- In-app notification template
    in_app_title VARCHAR(100),
    in_app_message TEXT,
    
    -- Design customization
    primary_color VARCHAR(7),
    logo_url TEXT,
    footer_text TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for templates
CREATE INDEX idx_receipt_templates_business_id ON receipt_templates(business_id);
CREATE INDEX idx_receipt_templates_is_active ON receipt_templates(is_active);

-- Function to generate receipt number
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS VARCHAR(50) AS $$
DECLARE
    new_number VARCHAR(50);
    counter INT;
BEGIN
    -- Get today's date in YYYYMMDD format
    SELECT TO_CHAR(CURRENT_DATE, 'YYYYMMDD') INTO new_number;
    
    -- Count receipts created today
    SELECT COUNT(*) + 1 INTO counter
    FROM receipts
    WHERE created_at::date = CURRENT_DATE;
    
    -- Format: RCT-YYYYMMDD-XXXX (e.g., RCT-20260707-0001)
    new_number := 'RCT-' || new_number || '-' || LPAD(counter::TEXT, 4, '0');
    
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate receipt number
CREATE OR REPLACE FUNCTION set_receipt_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.receipt_number IS NULL THEN
        NEW.receipt_number := generate_receipt_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_receipt_number
BEFORE INSERT ON receipts
FOR EACH ROW
EXECUTE FUNCTION set_receipt_number();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_receipt_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_receipt_updated_at
BEFORE UPDATE ON receipts
FOR EACH ROW
EXECUTE FUNCTION update_receipt_updated_at();

-- Insert default receipt template
INSERT INTO receipt_templates (
    business_id,
    name,
    description,
    template_type,
    email_subject,
    email_body_html,
    email_body_text,
    sms_template,
    in_app_title,
    in_app_message,
    primary_color,
    footer_text,
    is_active,
    is_default
) VALUES (
    'DEFAULT',
    'Default Receipt Template',
    'Standard receipt template for all businesses',
    'DEFAULT',
    'Receipt for your purchase at {{business_name}} - {{receipt_number}}',
    '<html><body><h1>Thank you for your purchase!</h1><p>Receipt Number: {{receipt_number}}</p><p>Amount: {{amount}}</p><p>Date: {{date}}</p></body></html>',
    'Thank you for your purchase! Receipt Number: {{receipt_number}}, Amount: {{amount}}, Date: {{date}}',
    'Receipt {{receipt_number}} from {{business_name}}. Amount: {{amount}}. Thank you!',
    'Payment Receipt',
    'Your receipt for {{receipt_number}} is ready. Amount paid: {{amount}}',
    '#3b82f6',
    'Powered by ScanIT - Digital Receipts',
    TRUE,
    TRUE
);

-- Comments
COMMENT ON TABLE receipts IS 'Stores all payment receipts for orders, tickets, and quick payments';
COMMENT ON TABLE receipt_delivery_attempts IS 'Tracks delivery attempts for receipts via email, SMS, etc.';
COMMENT ON TABLE receipt_templates IS 'Customizable receipt templates per business';
COMMENT ON COLUMN receipts.receipt_number IS 'Unique receipt number in format RCT-YYYYMMDD-XXXX';
COMMENT ON COLUMN receipts.status IS 'Receipt lifecycle status: GENERATED, SENT, FAILED, VIEWED';
COMMENT ON COLUMN receipts.items IS 'JSON array of receipt line items with name, quantity, price';
