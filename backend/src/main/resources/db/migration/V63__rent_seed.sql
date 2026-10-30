-- V63: Seed data for the rent module — 2 properties, 10 units, a few tenants.
-- Idempotent: only inserts if the seed account doesn't already exist.

-- ── Seed account (landlord / manager) ───────────────────────────────────────
INSERT INTO rent_accounts (id, name, email, phone, access_key, created_at, created_by)
SELECT 'RP-SEED-ACCT-01', 'Sarah Namutebi', 'sarah@example.com', '+256700123456',
       'RAK-SEED000001', NOW(), 'seed'
WHERE NOT EXISTS (SELECT 1 FROM rent_accounts WHERE id = 'RP-SEED-ACCT-01');

-- ── Property 1: Sunset Apartments ─────────────────────────────────────────────
INSERT INTO rent_properties (id, name, address, city, owner_name, owner_momo, currency, timezone,
    partial_payment_allowed, min_payment_amount, qr_token, created_at, created_by)
SELECT 'RP-SEED-PROP-01', 'Sunset Apartments', 'Plot 12, Kampala Road', 'Kampala',
       'Sarah Namutebi', '+256700123456', 'UGX', 'Africa/Kampala',
       true, 0, 'SEEDQRPROP01SUNSETAPT', NOW(), 'seed'
WHERE NOT EXISTS (SELECT 1 FROM rent_properties WHERE id = 'RP-SEED-PROP-01');

-- Property access for seed account
INSERT INTO rent_property_access (account_id, property_id, role, granted_at, granted_by)
SELECT 'RP-SEED-ACCT-01', 'RP-SEED-PROP-01', 'OWNER_MANAGER', NOW(), 'RP-SEED-ACCT-01'
WHERE NOT EXISTS (
    SELECT 1 FROM rent_property_access
    WHERE account_id = 'RP-SEED-ACCT-01' AND property_id = 'RP-SEED-PROP-01'
);

-- Units for Sunset Apartments (5 units)
INSERT INTO rent_units (id, property_id, unit_number, floor, monthly_amount, deposit_amount,
    qr_token, due_day_of_month, grace_period_days, created_at, created_by)
VALUES
    ('RU-SEED-001', 'RP-SEED-PROP-01', 'A1', 'Ground',  500000, 1000000, 'SEEDQRU001A1',  5, 3, NOW(), 'seed'),
    ('RU-SEED-002', 'RP-SEED-PROP-01', 'A2', 'Ground',  500000, 1000000, 'SEEDQRU002A2',  5, 3, NOW(), 'seed'),
    ('RU-SEED-003', 'RP-SEED-PROP-01', 'A3', 'First',   600000, 1200000, 'SEEDQRU003A3',  5, 3, NOW(), 'seed'),
    ('RU-SEED-004', 'RP-SEED-PROP-01', 'B1', 'First',   600000, 1200000, 'SEEDQRU004B1',  5, 3, NOW(), 'seed'),
    ('RU-SEED-005', 'RP-SEED-PROP-01', 'B2', 'Second', 700000, 1400000, 'SEEDQRU005B2',  5, 3, NOW(), 'seed')
ON CONFLICT (id) DO NOTHING;

-- Tenants for Sunset Apartments (3 active tenants)
INSERT INTO rent_tenants (id, unit_id, name, phone, email, move_in_date, lease_end, active, pay_token, created_at, created_by)
VALUES
    ('RT-SEED-001', 'RU-SEED-001', 'John Mukasa',    '+256712345678', 'john@example.com',  '2026-01-15', '2027-01-14', true, 'SEEDTPT001JOHN',   NOW(), 'seed'),
    ('RT-SEED-002', 'RU-SEED-003', 'Mary Achieng',   '+256723456789', 'mary@example.com',  '2026-02-01', NULL,         true, 'SEEDTPT002MARY',   NOW(), 'seed'),
    ('RT-SEED-003', 'RU-SEED-005', 'Peter Okello',   '+256734567890', 'peter@example.com', '2026-03-10', '2026-12-31', true, 'SEEDTPT003PETER',  NOW(), 'seed')
ON CONFLICT (id) DO NOTHING;

-- ── Property 2: Riverside Offices ─────────────────────────────────────────────
INSERT INTO rent_properties (id, name, address, city, owner_name, owner_momo, currency, timezone,
    partial_payment_allowed, min_payment_amount, qr_token, created_at, created_by)
SELECT 'RP-SEED-PROP-02', 'Riverside Offices', 'Plot 45, Jinja Road', 'Jinja',
       'Sarah Namutebi', '+256700123456', 'UGX', 'Africa/Kampala',
       false, 0, 'SEEDQRPROP02RIVERSIDE', NOW(), 'seed'
WHERE NOT EXISTS (SELECT 1 FROM rent_properties WHERE id = 'RP-SEED-PROP-02');

-- Property access for seed account
INSERT INTO rent_property_access (account_id, property_id, role, granted_at, granted_by)
SELECT 'RP-SEED-ACCT-01', 'RP-SEED-PROP-02', 'OWNER_MANAGER', NOW(), 'RP-SEED-ACCT-01'
WHERE NOT EXISTS (
    SELECT 1 FROM rent_property_access
    WHERE account_id = 'RP-SEED-ACCT-01' AND property_id = 'RP-SEED-PROP-02'
);

-- Units for Riverside Offices (5 units)
INSERT INTO rent_units (id, property_id, unit_number, floor, monthly_amount, deposit_amount,
    qr_token, due_day_of_month, grace_period_days, created_at, created_by)
VALUES
    ('RU-SEED-006', 'RP-SEED-PROP-02', 'OF-01', 'Ground', 1200000, 2400000, 'SEEDQRU006OF01', 1, 0, NOW(), 'seed'),
    ('RU-SEED-007', 'RP-SEED-PROP-02', 'OF-02', 'Ground', 1200000, 2400000, 'SEEDQRU007OF02', 1, 0, NOW(), 'seed'),
    ('RU-SEED-008', 'RP-SEED-PROP-02', 'OF-03', 'First',  1500000, 3000000, 'SEEDQRU008OF03', 1, 0, NOW(), 'seed'),
    ('RU-SEED-009', 'RP-SEED-PROP-02', 'OF-04', 'First',  1500000, 3000000, 'SEEDQRU009OF04', 1, 0, NOW(), 'seed'),
    ('RU-SEED-010', 'RP-SEED-PROP-02', 'OF-05', 'Second', 1800000, 3600000, 'SEEDQRU010OF05', 1, 0, NOW(), 'seed')
ON CONFLICT (id) DO NOTHING;

-- Tenants for Riverside Offices (2 active tenants)
INSERT INTO rent_tenants (id, unit_id, name, phone, email, move_in_date, lease_end, active, pay_token, created_at, created_by)
VALUES
    ('RT-SEED-004', 'RU-SEED-006', 'Grace Nakato',  '+256745678901', 'grace@example.com',  '2026-01-01', '2026-12-31', true, 'SEEDTPT004GRACE', NOW(), 'seed'),
    ('RT-SEED-005', 'RU-SEED-008', 'David Tumusiim', '+256756789012', 'david@example.com',  '2026-02-15', NULL,         true, 'SEEDTPT005DAVID', NOW(), 'seed')
ON CONFLICT (id) DO NOTHING;

-- ── One maintenance request for demo ─────────────────────────────────────────
INSERT INTO rent_maintenance_requests (id, property_id, unit_id, tenant_name, tenant_phone,
    title, description, priority, status, submitted_at, created_by)
SELECT 'RM-SEED-001', 'RP-SEED-PROP-01', 'RU-SEED-001', 'John Mukasa', '+256712345678',
       'Leaking tap in kitchen', 'The kitchen tap has been leaking for 3 days. Needs urgent repair.',
       'HIGH', 'OPEN', NOW(), 'seed'
WHERE NOT EXISTS (SELECT 1 FROM rent_maintenance_requests WHERE id = 'RM-SEED-001');
