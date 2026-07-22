-- Payment idempotency: optional client key + one active intent per (context, reference_id).

ALTER TABLE payment_intents
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128);

-- Keep the newest row for each active (context, reference_id); mark older active dupes Failed.
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY context, reference_id
               ORDER BY created_at DESC NULLS LAST, id DESC
           ) AS rn
    FROM payment_intents
    WHERE status IN ('Pending', 'Processing')
)
UPDATE payment_intents p
SET status = 'Failed',
    failure_reason = COALESCE(failure_reason, 'Superseded by newer payment intent (idempotency cleanup)'),
    failed_at = COALESCE(failed_at, NOW()),
    updated_at = NOW()
FROM ranked r
WHERE p.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_intents_idempotency_key
    ON payment_intents (idempotency_key)
    WHERE idempotency_key IS NOT NULL AND idempotency_key <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_intents_active_reference
    ON payment_intents (context, reference_id)
    WHERE status IN ('Pending', 'Processing');
