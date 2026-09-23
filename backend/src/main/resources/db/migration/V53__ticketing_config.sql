-- V53: Seed the 'ticketing' platform config section.
--      Promotion tier fees and limits — all values are overrideable from the admin console.

INSERT INTO platform_configs (section, payload) VALUES (
    'ticketing',
    '{
        "promoTierLocalFee": 40000,
        "promoTierCityFee": 80000,
        "promoTierBoostFee": 150000,
        "promoTierLocalRadius": 5,
        "promoTierCityRadius": 20,
        "promoTierBoostRadius": 0,
        "promoMaxActivePerPhone": 10,
        "promoMaxDays": 30
    }'
) ON CONFLICT (section) DO NOTHING;

-- Add 'tier' column to promoted_events to track which tier was purchased.
-- 'LOCAL' = 5 km, 'CITY' = 20 km, 'BOOST' = all restaurants (no radius cap)
ALTER TABLE promoted_events
    ADD COLUMN IF NOT EXISTS tier VARCHAR(20) NOT NULL DEFAULT 'LOCAL';
