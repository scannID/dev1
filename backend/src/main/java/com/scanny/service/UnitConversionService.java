package com.scanny.service;

import com.scanny.exception.ApiException;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import java.util.Set;

/**
 * Unit conversion for inventory recipe lines.
 *
 * A recipe line may be authored in a different unit than the ingredient is stocked in,
 * e.g. ingredient stocked in "kg", recipe line in "g".
 *
 * Conversions are only allowed within the same unit family:
 *   Mass family:   kg ↔ g
 *   Volume family: L ↔ ml
 *   Count family:  pcs, portion (must match exactly — no conversion)
 *
 * The static table below covers all built-in conversions. A DB table (unit_conversions)
 * allows future merchant-defined extensions.
 */
@Service
public class UnitConversionService {

    private static final Map<String, BigDecimal> FACTORS = Map.of(
        "kg:g",   new BigDecimal("1000"),
        "g:kg",   new BigDecimal("0.001"),
        "L:ml",   new BigDecimal("1000"),
        "ml:L",   new BigDecimal("0.001")
        // Same-unit conversions (kg:kg etc.) handled by key not found → factor = 1
    );

    // Units grouped by family — conversions only permitted within a family.
    private static final Set<String> MASS_UNITS   = Set.of("kg", "g");
    private static final Set<String> VOLUME_UNITS = Set.of("L", "ml");
    private static final Set<String> COUNT_UNITS  = Set.of("pcs", "portion");

    /**
     * Convert a quantity from {@code fromUnit} to {@code toUnit}.
     * Returns qty unchanged if units are identical.
     * Throws ApiException(400) if the units are incompatible.
     */
    public BigDecimal convert(BigDecimal qty, String fromUnit, String toUnit) {
        if (fromUnit == null || toUnit == null) {
            throw new ApiException(400, "Unit must not be null.");
        }
        if (fromUnit.equalsIgnoreCase(toUnit)) {
            return qty;
        }
        validateCompatible(fromUnit, toUnit);
        String key = fromUnit.trim() + ":" + toUnit.trim();
        BigDecimal factor = FACTORS.get(key);
        if (factor == null) {
            throw new ApiException(400,
                "No conversion defined from '" + fromUnit + "' to '" + toUnit + "'.");
        }
        return qty.multiply(factor).setScale(8, RoundingMode.HALF_UP);
    }

    /**
     * Validates that a recipe line unit is compatible with the ingredient's stocked unit.
     * Throws ApiException(400) if they are in different families.
     */
    public void validateCompatible(String lineUnit, String ingredientUnit) {
        if (lineUnit == null || lineUnit.isBlank() || lineUnit.equalsIgnoreCase(ingredientUnit)) {
            return; // same unit or unset — always valid
        }
        String lu = lineUnit.trim();
        String iu = ingredientUnit.trim();
        boolean sameFamily =
            (MASS_UNITS.contains(lu)   && MASS_UNITS.contains(iu))   ||
            (VOLUME_UNITS.contains(lu) && VOLUME_UNITS.contains(iu)) ||
            (COUNT_UNITS.contains(lu)  && COUNT_UNITS.contains(iu));
        if (!sameFamily) {
            throw new ApiException(400,
                "Incompatible units: recipe line is in '" + lu +
                "' but ingredient is stocked in '" + iu + "'. " +
                "Use units from the same family (mass: kg/g, volume: L/ml, count: pcs/portion).");
        }
    }

    /**
     * Convert a recipe line qty (in lineUnit) to the ingredient's stocked unit.
     * Used when deducting stock at consume time.
     */
    public BigDecimal toIngredientUnit(BigDecimal lineQty, String lineUnit, String ingredientUnit) {
        if (lineUnit == null || lineUnit.isBlank()) {
            return lineQty; // no conversion needed
        }
        return convert(lineQty, lineUnit, ingredientUnit);
    }

    /**
     * Estimate cost of lineQty (in lineUnit) using ingredient's avgUnitCost (per ingredientUnit).
     */
    public int estimateCost(BigDecimal lineQty, String lineUnit, String ingredientUnit, int avgUnitCost) {
        BigDecimal qtyInIngredientUnit = toIngredientUnit(lineQty, lineUnit, ingredientUnit);
        return qtyInIngredientUnit
            .multiply(BigDecimal.valueOf(avgUnitCost))
            .setScale(0, RoundingMode.HALF_UP)
            .intValue();
    }
}
