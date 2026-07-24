-- Order + payment intent fee split ledger (merchant MoMo = subtotal; fee shared PSO then Scanny)

ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal INT NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_fee INT NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pso_fee INT NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform_fee INT NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS merchant_payout INT NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS merchant_momo_destination VARCHAR(64) NOT NULL DEFAULT '';

UPDATE orders
SET
    subtotal = CASE WHEN total > 700 THEN total - 700 ELSE total END,
    service_fee = CASE WHEN total > 700 THEN 700 ELSE 0 END,
    pso_fee = CASE WHEN total > 700 THEN CAST(ROUND(700 * 0.30) AS INT) ELSE 0 END,
    platform_fee = CASE WHEN total > 700 THEN 700 - CAST(ROUND(700 * 0.30) AS INT) ELSE 0 END,
    merchant_payout = CASE WHEN total > 700 THEN total - 700 ELSE total END
WHERE subtotal = 0 AND total > 0;

ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS subtotal INT NOT NULL DEFAULT 0;
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS service_fee INT NOT NULL DEFAULT 0;
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS pso_fee INT NOT NULL DEFAULT 0;
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS platform_fee INT NOT NULL DEFAULT 0;
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS merchant_payout INT NOT NULL DEFAULT 0;
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS merchant_momo_destination VARCHAR(64) NOT NULL DEFAULT '';
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS scanny_fee_destination VARCHAR(64) NOT NULL DEFAULT '';
