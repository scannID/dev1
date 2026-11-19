-- Manual seed script for testing pagination
-- Run this after the backend has started successfully
-- Connect to your database and run: psql -U scanny -d scanny -f seed-pagination-test-data.sql

-- Or if you're using a different database name/user, adjust accordingly

\c scanny

-- Check if V64 migration already ran
SELECT COUNT(*) as "V64_exists" FROM flyway_schema_history WHERE version = '64';

-- If V64 doesn't exist in flyway_schema_history, you can run the migration manually
-- Otherwise, the data should already be there

-- Quick check: count properties
SELECT COUNT(*) as total_properties FROM rent_properties;

-- Quick check: count units
SELECT COUNT(*) as total_units FROM rent_units;

-- If you see only 2 properties and 10 units, the V64 migration hasn't run yet
-- In that case, run this command from your terminal:

-- Windows PowerShell:
-- cd backend
-- mvn flyway:migrate -Dflyway.configFiles=src/main/resources/application-dev.yml

-- Or restart your backend after ensuring the V64__rent_pagination_test_seed.sql file is in:
-- backend/src/main/resources/db/migration/

SELECT 'Seed data summary:' as info;
SELECT 
    p.name as property_name,
    COUNT(u.id) as total_units,
    SUM(CASE WHEN t.id IS NOT NULL THEN 1 ELSE 0 END) as occupied_units,
    SUM(CASE WHEN t.id IS NULL THEN 1 ELSE 0 END) as vacant_units
FROM rent_properties p
LEFT JOIN rent_units u ON u.property_id = p.id
LEFT JOIN rent_tenants t ON t.unit_id = u.id AND t.active = true
WHERE p.id LIKE 'RP-SEED-%'
GROUP BY p.id, p.name
ORDER BY p.created_at;
