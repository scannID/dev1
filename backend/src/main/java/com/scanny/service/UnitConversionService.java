package com.scanny.service;

import com.scanny.exception.ApiException;
import com.scanny.repository.UnitConversionRepository;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Unit conversion for inventory recipe lines.
 *
 * Lookup order:
 *   1. DB row with matching business_id  (merchant-specific, e.g. "1 bird = 6 pcs")
 *   2. DB row with business_id IS NULL   (global built-in: kg/g, L/ml)
 *   3. Static fallback map               (safety net if DB is unreachable)
 *
 * This allows each business to define their own conversions for ingredients
 * that cross unit families — e.g. buying live birds in "pcs" and stocking
 * dressed meat in "kg" — without changing the global defaults.
 *
 * Adding a custom conversion (SQL example):
 *   INSERT INTO unit_conversions (business_id, from_unit, to_unit, factor)
 *   VALUES ('BIZ-123', 'bird', 'pcs', 6);   -- 1 bird → 6 pieces
 *   INSERT INTO unit_conversions (business_id, from_unit, to_unit, factor)
 *   VALUES ('BIZ-123', 'pcs', 'bird', 0.1667);
 *
 * The merchant UI for managing custom conversions is in
 * Inventory → Stock (to be added).
 */
@Service
public class UnitConversionService {

    // Static fallback — used when DB is unavailable or for same-family core units.
    private static final Map<String, BigDecimal> STATIC_FACTORS = Map.of(
        "kg:g",   new BigDecimal("1000"),
        "g:kg",   new BigDecimal("0.001"),
        "L:ml",   new BigDecimal("1000"),
        "ml:L",   new BigDecimal("0.001")
    );

    private static final Set<String> MASS_UNITS   = Set.of("kg", "g");
    private static final Set<String> VOLUME_UNITS = Set.of("L", "ml");
    private static final Set<String> COUNT_UNITS  = Set.of("pcs", "portion");

    private final UnitConversionRepository conversionRepository;

    public UnitConversionService(UnitConversionRepository conversionRepository) {
        this.conversionRepository = conversionRepository;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Convert {@code qty} from {@code fromUnit} to {@code toUnit}.
     * Business-specific conversions take precedence over global ones.
     * Throws ApiException(400) if no conversion is found.
     */
    public BigDecimal convert(BigDecimal qty, String fromUnit, String toUnit, String businessId) {
        if (fromUnit == null || toUnit == null) {
            throw new ApiException(400, "Unit must not be null.");
        }
        if (fromUnit.equalsIgnoreCase(toUnit)) {
            return qty;
        }
        BigDecimal factor = resolveFactor(fromUnit.trim(), toUnit.trim(), businessId);
        if (factor == null) {
            throw new ApiException(400,
                "No unit conversion defined from '" + fromUnit + "' to '" + toUnit + "'. " +
                "Add a custom conversion in Inventory settings.");
        }
        return qty.multiply(factor).setScale(8, RoundingMode.HALF_UP);
    }

    /** Overload without businessId — uses global conversions only. */
    public BigDecimal convert(BigDecimal qty, String fromUnit, String toUnit) {
        return convert(qty, fromUnit, toUnit, null);
    }

    /**
     * Validates that two units can be converted.
     * First checks the DB for a conversion row (either business-specific or global).
     * Then falls back to same-family check for the 6 built-in units.
     * If neither applies, throws ApiException(400).
     */
    public void validateCompatible(String fromUnit, String toUnit, String businessId) {
        if (fromUnit == null || fromUnit.isBlank() || fromUnit.equalsIgnoreCase(toUnit)) {
            return;
        }
        String fu = fromUnit.trim();
        String tu = toUnit.trim();

        // Check DB first — if a conversion row exists, it's compatible by definition.
        BigDecimal factor = resolveFactor(fu, tu, businessId);
        if (factor != null) return;

        // Same-family check for the 6 built-in units.
        if (sameFamilyBuiltin(fu, tu)) return;

        throw new ApiException(400,
            "No conversion defined from '" + fu + "' to '" + tu + "'. " +
            "Units must be in the same family (mass: kg/g, volume: L/ml) " +
            "or you can add a custom conversion in Inventory settings.");
    }

    /** Overload without businessId. */
    public void validateCompatible(String fromUnit, String toUnit) {
        validateCompatible(fromUnit, toUnit, null);
    }

    /**
     * Convert recipe line qty (in lineUnit) to the ingredient's stocked unit.
     * Used at consume time and cost estimation.
     */
    public BigDecimal toIngredientUnit(BigDecimal lineQty, String lineUnit,
            String ingredientUnit, String businessId) {
        if (lineUnit == null || lineUnit.isBlank() ||
                lineUnit.equalsIgnoreCase(ingredientUnit)) {
            return lineQty;
        }
        return convert(lineQty, lineUnit, ingredientUnit, businessId);
    }

    /** Overload without businessId. */
    public BigDecimal toIngredientUnit(BigDecimal lineQty, String lineUnit, String ingredientUnit) {
        return toIngredientUnit(lineQty, lineUnit, ingredientUnit, null);
    }

    /** Estimate cost of lineQty (in lineUnit) against avgUnitCost (per ingredientUnit). */
    public int estimateCost(BigDecimal lineQty, String lineUnit,
            String ingredientUnit, int avgUnitCost, String businessId) {
        BigDecimal converted = toIngredientUnit(lineQty, lineUnit, ingredientUnit, businessId);
        return converted.multiply(BigDecimal.valueOf(avgUnitCost))
            .setScale(0, RoundingMode.HALF_UP).intValue();
    }

    /** Overload without businessId. */
    public int estimateCost(BigDecimal lineQty, String lineUnit,
            String ingredientUnit, int avgUnitCost) {
        return estimateCost(lineQty, lineUnit, ingredientUnit, avgUnitCost, null);
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    /**
     * Resolves a conversion factor:
     *   1. Business-specific DB row (exact business match)
     *   2. Global DB row (business_id IS NULL)
     *   3. Static fallback map
     * Returns null if no factor found.
     */
    private BigDecimal resolveFactor(String fromUnit, String toUnit, String businessId) {
        // DB lookup — returns business-specific first, global second
        try {
            List<com.scanny.entity.UnitConversion> rows =
                conversionRepository.findForPair(fromUnit, toUnit,
                    businessId != null ? businessId : "");
            if (!rows.isEmpty()) {
                return rows.get(0).getFactor();
            }
        } catch (Exception ignored) {
            // DB unavailable — fall through to static map
        }

        // Static fallback
        return STATIC_FACTORS.get(fromUnit + ":" + toUnit);
    }

    private boolean sameFamilyBuiltin(String fu, String tu) {
        return (MASS_UNITS.contains(fu)   && MASS_UNITS.contains(tu))   ||
               (VOLUME_UNITS.contains(fu) && VOLUME_UNITS.contains(tu)) ||
               (COUNT_UNITS.contains(fu)  && COUNT_UNITS.contains(tu));
    }
}
