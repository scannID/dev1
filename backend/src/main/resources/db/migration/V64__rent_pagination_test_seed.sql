-- V64: Additional seed data for testing pagination — 3 more properties with 50+ units each
-- Idempotent: only inserts if the test properties don't already exist.

-- ── Property 3: Skyline Heights (50 units) ───────────────────────────────────
INSERT INTO rent_properties (id, name, address, city, owner_name, owner_momo, currency, timezone,
    partial_payment_allowed, min_payment_amount, qr_token, created_at, created_by)
SELECT 'RP-SEED-PROP-03', 'Skyline Heights', 'Plot 78, Entebbe Road', 'Kampala',
       'Sarah Namutebi', '+256700123456', 'UGX', 'Africa/Kampala',
       true, 100000, 'SEEDQRPROP03SKYLINE', NOW(), 'seed'
WHERE NOT EXISTS (SELECT 1 FROM rent_properties WHERE id = 'RP-SEED-PROP-03');

-- Property access for seed account
INSERT INTO rent_property_access (account_id, property_id, role, granted_at, granted_by)
SELECT 'RP-SEED-ACCT-01', 'RP-SEED-PROP-03', 'OWNER_MANAGER', NOW(), 'RP-SEED-ACCT-01'
WHERE NOT EXISTS (
    SELECT 1 FROM rent_property_access
    WHERE account_id = 'RP-SEED-ACCT-01' AND property_id = 'RP-SEED-PROP-03'
);

-- Generate 50 units for Skyline Heights (10 floors, 5 units per floor)
DO $$
DECLARE
    floor_num INT;
    unit_num INT;
    unit_id TEXT;
    unit_code TEXT;
    qr_code TEXT;
    floor_name TEXT;
    monthly_rent INT;
    has_tenant BOOLEAN;
    tenant_id TEXT;
    tenant_names TEXT[] := ARRAY['Alice Namuli', 'Bob Kasozi', 'Catherine Aber', 'Daniel Okoth', 'Emma Nabirye', 
                                   'Frank Mugisha', 'Grace Akello', 'Henry Kato', 'Irene Nassali', 'James Opio',
                                   'Kate Nalongo', 'Louis Ssemakula', 'Monica Achan', 'Nathan Kintu', 'Olivia Atim',
                                   'Paul Waiswa', 'Queen Namukasa', 'Robert Omara', 'Sophia Namatovu', 'Thomas Egau'];
    phone_nums TEXT[] := ARRAY['+256701111111', '+256702222222', '+256703333333', '+256704444444', '+256705555555',
                                '+256706666666', '+256707777777', '+256708888888', '+256709999999', '+256710000000',
                                '+256711111111', '+256712222222', '+256713333333', '+256714444444', '+256715555555',
                                '+256716666666', '+256717777777', '+256718888888', '+256719999999', '+256720000000'];
BEGIN
    FOR floor_num IN 1..10 LOOP
        floor_name := CASE 
            WHEN floor_num = 1 THEN 'First'
            WHEN floor_num = 2 THEN 'Second'
            WHEN floor_num = 3 THEN 'Third'
            WHEN floor_num = 10 THEN 'Tenth'
            ELSE floor_num || 'th'
        END;
        
        monthly_rent := 450000 + (floor_num * 50000); -- Rent increases with floor
        
        FOR unit_num IN 1..5 LOOP
            unit_code := floor_num || chr(64 + unit_num); -- 1A, 1B, ..., 10E
            unit_id := 'RU-SEED-SKY-' || LPAD(((floor_num-1)*5 + unit_num)::TEXT, 3, '0');
            qr_code := 'SEEDQRSKY' || unit_code;
            
            -- 60% occupancy rate (30 out of 50 units occupied)
            has_tenant := ((floor_num * 5 + unit_num) % 5) != 0;
            
            -- Insert unit
            INSERT INTO rent_units (id, property_id, unit_number, floor, monthly_amount, deposit_amount,
                qr_token, due_day_of_month, grace_period_days, bedrooms, bathrooms, amenities, created_at, created_by)
            VALUES (unit_id, 'RP-SEED-PROP-03', unit_code, floor_name, monthly_rent, monthly_rent * 2,
                qr_code, 5, 3, 2, 1, 'WiFi, Parking, Water', NOW(), 'seed')
            ON CONFLICT (id) DO NOTHING;
            
            -- Insert tenant if unit is occupied
            IF has_tenant THEN
                tenant_id := 'RT-SEED-SKY-' || LPAD(((floor_num-1)*5 + unit_num)::TEXT, 3, '0');
                INSERT INTO rent_tenants (id, unit_id, name, phone, email, move_in_date, lease_end, active, pay_token, created_at, created_by)
                VALUES (tenant_id, unit_id, 
                    tenant_names[(((floor_num-1)*5 + unit_num) % 20) + 1],
                    phone_nums[(((floor_num-1)*5 + unit_num) % 20) + 1],
                    LOWER(REPLACE(tenant_names[(((floor_num-1)*5 + unit_num) % 20) + 1], ' ', '.')) || '@example.com',
                    CURRENT_DATE - INTERVAL '3 months',
                    CURRENT_DATE + INTERVAL '9 months',
                    true,
                    'SEEDPAYSKY' || unit_code,
                    NOW(), 'seed')
                ON CONFLICT (id) DO NOTHING;
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- ── Property 4: Garden View Residences (60 units) ─────────────────────────────
INSERT INTO rent_properties (id, name, address, city, owner_name, owner_momo, currency, timezone,
    partial_payment_allowed, min_payment_amount, qr_token, created_at, created_by)
SELECT 'RP-SEED-PROP-04', 'Garden View Residences', 'Plot 22, Ntinda', 'Kampala',
       'Sarah Namutebi', '+256700123456', 'UGX', 'Africa/Kampala',
       true, 150000, 'SEEDQRPROP04GARDEN', NOW(), 'seed'
WHERE NOT EXISTS (SELECT 1 FROM rent_properties WHERE id = 'RP-SEED-PROP-04');

-- Property access for seed account
INSERT INTO rent_property_access (account_id, property_id, role, granted_at, granted_by)
SELECT 'RP-SEED-ACCT-01', 'RP-SEED-PROP-04', 'OWNER_MANAGER', NOW(), 'RP-SEED-ACCT-01'
WHERE NOT EXISTS (
    SELECT 1 FROM rent_property_access
    WHERE account_id = 'RP-SEED-ACCT-01' AND property_id = 'RP-SEED-PROP-04'
);

-- Generate 60 units for Garden View (12 floors, 5 units per floor)
DO $$
DECLARE
    floor_num INT;
    unit_num INT;
    unit_id TEXT;
    unit_code TEXT;
    qr_code TEXT;
    floor_name TEXT;
    monthly_rent INT;
    has_tenant BOOLEAN;
    tenant_id TEXT;
BEGIN
    FOR floor_num IN 1..12 LOOP
        floor_name := floor_num || 'F';
        monthly_rent := 550000 + (floor_num * 30000);
        
        FOR unit_num IN 1..5 LOOP
            unit_code := 'GV-' || floor_num || LPAD(unit_num::TEXT, 2, '0');
            unit_id := 'RU-SEED-GVR-' || LPAD(((floor_num-1)*5 + unit_num)::TEXT, 3, '0');
            qr_code := 'SEEDQRGVR' || floor_num || unit_num;
            
            -- 70% occupancy rate (42 out of 60 units occupied)
            has_tenant := ((floor_num + unit_num) % 10) < 7;
            
            -- Insert unit
            INSERT INTO rent_units (id, property_id, unit_number, floor, monthly_amount, deposit_amount,
                qr_token, due_day_of_month, grace_period_days, bedrooms, bathrooms, amenities, created_at, created_by)
            VALUES (unit_id, 'RP-SEED-PROP-04', unit_code, floor_name, monthly_rent, monthly_rent * 2,
                qr_code, 1, 5, 3, 2, 'WiFi, Gym, Pool, Security', NOW(), 'seed')
            ON CONFLICT (id) DO NOTHING;
            
            -- Insert tenant if unit is occupied
            IF has_tenant THEN
                tenant_id := 'RT-SEED-GVR-' || LPAD(((floor_num-1)*5 + unit_num)::TEXT, 3, '0');
                INSERT INTO rent_tenants (id, unit_id, name, phone, email, move_in_date, lease_end, active, pay_token, created_at, created_by)
                VALUES (tenant_id, unit_id, 
                    'Tenant ' || unit_code,
                    '+25670' || LPAD(((floor_num-1)*5 + unit_num)::TEXT, 7, '0'),
                    'tenant.gvr' || ((floor_num-1)*5 + unit_num) || '@example.com',
                    CURRENT_DATE - INTERVAL '2 months',
                    CURRENT_DATE + INTERVAL '10 months',
                    true,
                    'SEEDPAYGVR' || floor_num || unit_num,
                    NOW(), 'seed')
                ON CONFLICT (id) DO NOTHING;
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- ── Property 5: Pearl Towers (75 units) ───────────────────────────────────────
INSERT INTO rent_properties (id, name, address, city, owner_name, owner_momo, currency, timezone,
    partial_payment_allowed, min_payment_amount, qr_token, created_at, created_by)
SELECT 'RP-SEED-PROP-05', 'Pearl Towers', 'Plot 101, Kololo', 'Kampala',
       'Sarah Namutebi', '+256700123456', 'UGX', 'Africa/Kampala',
       false, 0, 'SEEDQRPROP05PEARL', NOW(), 'seed'
WHERE NOT EXISTS (SELECT 1 FROM rent_properties WHERE id = 'RP-SEED-PROP-05');

-- Property access for seed account
INSERT INTO rent_property_access (account_id, property_id, role, granted_at, granted_by)
SELECT 'RP-SEED-ACCT-01', 'RP-SEED-PROP-05', 'OWNER_MANAGER', NOW(), 'RP-SEED-ACCT-01'
WHERE NOT EXISTS (
    SELECT 1 FROM rent_property_access
    WHERE account_id = 'RP-SEED-ACCT-01' AND property_id = 'RP-SEED-PROP-05'
);

-- Generate 75 units for Pearl Towers (15 floors, 5 units per floor)
DO $$
DECLARE
    floor_num INT;
    unit_num INT;
    unit_id TEXT;
    unit_code TEXT;
    qr_code TEXT;
    floor_name TEXT;
    monthly_rent INT;
    has_tenant BOOLEAN;
    tenant_id TEXT;
    bedroom_count INT;
BEGIN
    FOR floor_num IN 1..15 LOOP
        floor_name := 'Level ' || floor_num;
        
        FOR unit_num IN 1..5 LOOP
            unit_code := 'PT' || LPAD(floor_num::TEXT, 2, '0') || chr(64 + unit_num);
            unit_id := 'RU-SEED-PTW-' || LPAD(((floor_num-1)*5 + unit_num)::TEXT, 3, '0');
            qr_code := 'SEEDQRPTW' || floor_num || chr(64 + unit_num);
            
            -- Vary bedroom count (1-3 bedrooms)
            bedroom_count := (unit_num % 3) + 1;
            monthly_rent := 600000 + (bedroom_count * 200000) + (floor_num * 25000);
            
            -- 50% occupancy rate (high vacancy for testing vacant unit animations)
            has_tenant := ((floor_num * unit_num) % 2) = 0;
            
            -- Insert unit
            INSERT INTO rent_units (id, property_id, unit_number, floor, monthly_amount, deposit_amount,
                qr_token, due_day_of_month, grace_period_days, bedrooms, bathrooms, amenities, created_at, created_by)
            VALUES (unit_id, 'RP-SEED-PROP-05', unit_code, floor_name, monthly_rent, monthly_rent * 2,
                qr_code, 10, 7, bedroom_count, bedroom_count, 'WiFi, Parking, Gym, Pool, Security, Elevator', NOW(), 'seed')
            ON CONFLICT (id) DO NOTHING;
            
            -- Insert tenant if unit is occupied
            IF has_tenant THEN
                tenant_id := 'RT-SEED-PTW-' || LPAD(((floor_num-1)*5 + unit_num)::TEXT, 3, '0');
                INSERT INTO rent_tenants (id, unit_id, name, phone, email, move_in_date, lease_end, active, pay_token, created_at, created_by)
                VALUES (tenant_id, unit_id, 
                    'Resident ' || unit_code,
                    '+25677' || LPAD(((floor_num-1)*5 + unit_num)::TEXT, 7, '0'),
                    'resident.ptw' || ((floor_num-1)*5 + unit_num) || '@example.com',
                    CURRENT_DATE - INTERVAL '6 months',
                    CURRENT_DATE + INTERVAL '6 months',
                    true,
                    'SEEDPAYPTW' || floor_num || chr(64 + unit_num),
                    NOW(), 'seed')
                ON CONFLICT (id) DO NOTHING;
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- Summary: 
-- - Skyline Heights: 50 units (60% occupancy = 30 occupied, 20 vacant)
-- - Garden View Residences: 60 units (70% occupancy = 42 occupied, 18 vacant)
-- - Pearl Towers: 75 units (50% occupancy = 38 occupied, 37 vacant)
-- Total new units: 185 units
-- Total all properties: 195 units (including the original 10 from V63)
