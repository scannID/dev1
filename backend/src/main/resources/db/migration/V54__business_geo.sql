-- V54: Persist restaurant coordinates for automatic event-promo radius matching.
ALTER TABLE businesses
    ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS geo_query VARCHAR(512) NOT NULL DEFAULT '';

-- Seed Kampala coords for known demo venues so nearby matching works out of the box.
UPDATE businesses
SET
    latitude = 0.3476,
    longitude = 32.5825,
    address = CASE WHEN address IS NULL OR address = '' THEN 'Kampala, Uganda' ELSE address END,
    geo_query = 'Kampala, Uganda'
WHERE id IN ('kampala-grill', 'city-lounge', 'samantha-restaurant')
  AND latitude IS NULL;
