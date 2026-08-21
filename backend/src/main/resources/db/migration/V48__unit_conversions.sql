-- Unit conversions table.
-- Stores conversion factors between compatible units.
-- e.g. 1 kg = 1000 g → factor = 1000 (from_unit=kg, to_unit=g)
-- Conversions are bidirectional: the inverse is 1/factor.
-- The application also has a built-in static table for the 6 core units
-- as a fallback; this table allows merchant-defined overrides.

CREATE TABLE IF NOT EXISTS unit_conversions (
    id          BIGSERIAL PRIMARY KEY,
    from_unit   VARCHAR(16) NOT NULL,
    to_unit     VARCHAR(16) NOT NULL,
    factor      NUMERIC(24, 8) NOT NULL,  -- to_qty = from_qty * factor
    UNIQUE (from_unit, to_unit)
);

-- Seed the 6 core unit conversions (mass and volume families).
-- The application enforces that recipe_lines and ingredients must use
-- units within the same family (mass or volume), or the same unit (pcs/portion).
INSERT INTO unit_conversions (from_unit, to_unit, factor) VALUES
    -- Mass
    ('kg',  'g',   1000.0),
    ('g',   'kg',  0.001),
    -- Volume
    ('L',   'ml',  1000.0),
    ('ml',  'L',   0.001)
ON CONFLICT (from_unit, to_unit) DO NOTHING;

-- Add unit column to recipe_lines so a line can use a different unit than the ingredient
-- (e.g. ingredient stocked in kg, recipe line in g).
ALTER TABLE recipe_lines
    ADD COLUMN IF NOT EXISTS line_unit VARCHAR(16) NOT NULL DEFAULT '';
-- '' means "use ingredient's unit" (backward-compatible default).
