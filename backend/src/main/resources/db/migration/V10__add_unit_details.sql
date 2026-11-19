-- V10: Add unit details (bedrooms, bathrooms, amenities) for vacant unit listings

ALTER TABLE rent_units
    ADD COLUMN bedrooms INTEGER,
    ADD COLUMN bathrooms INTEGER,
    ADD COLUMN amenities VARCHAR(1000);

COMMENT ON COLUMN rent_units.bedrooms IS 'Number of bedrooms (0 for studios, null for unspecified)';
COMMENT ON COLUMN rent_units.bathrooms IS 'Number of bathrooms';
COMMENT ON COLUMN rent_units.amenities IS 'Comma-separated amenities (WiFi, AC, Parking, Furnished, etc.)';
