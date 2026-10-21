package com.scanny.model.enums;

/**
 * Classifies a catalog item for URA EFRIS fiscal-document generation.
 *
 * <p>The two EFRIS-relevant dimensions driven by this enum are:
 * <ul>
 *   <li>{@code goodsServiceFlag} — {@code "1"} (Goods) or {@code "2"} (Services/other)</li>
 *   <li>{@code unitOfMeasure} — URA-recognised UOM code embedded in each invoice line</li>
 * </ul>
 *
 * <p>See {@link com.scanny.efris.EfrisApiClient} for the mapping methods.
 */
public enum ItemKind {

    // ── Hospitality ───────────────────────────────────────────────────────────

    /** Food or beverage item (restaurant, bar, café). UOM: EA (each). */
    FOOD,

    /** Standard hotel or guesthouse room. UOM: DAY. */
    ROOM,

    /** Hotel suite or premium room tier. UOM: DAY. */
    SUITE,

    // ── Retail ────────────────────────────────────────────────────────────────

    /**
     * Physical retail goods (boutique, pharmacy, general merchandise).
     * Maps to URA EFRIS goodsServiceFlag {@code "1"} (Goods). UOM: PKG.
     */
    PRODUCT,

    // ── Events ────────────────────────────────────────────────────────────────

    /**
     * Event entry ticket (concert, sports, conference, etc.).
     * UOM: EA (each / per-ticket).  goodsServiceFlag: {@code "2"} (Services).
     */
    TICKET,

    // ── Parking ───────────────────────────────────────────────────────────────

    /**
     * Parking slot charge — typically time-based (hourly, daily).
     * UOM: HUR (hours) or DAY depending on duration; defaults to HUR.
     * goodsServiceFlag: {@code "2"} (Services).
     */
    PARKING_SLOT,

    // ── Services ─────────────────────────────────────────────────────────────

    /**
     * Appointment-based service session (salon, spa, clinic, etc.).
     * UOM: HUR (hours).  goodsServiceFlag: {@code "2"} (Services).
     */
    SERVICE_SESSION,

    // ── Education ────────────────────────────────────────────────────────────

    /**
     * School fee or tuition charge.
     * UOM: EA (each / per-term).  goodsServiceFlag: {@code "2"} (Services).
     */
    FEE,

    // ── Quick Pay ────────────────────────────────────────────────────────────

    /**
     * Generic quick-payment line item — used when a QuickPaymentTransaction is
     * submitted to EFRIS and there is no structured catalog item.
     * UOM: EA.  goodsServiceFlag: {@code "2"} (Services).
     */
    QUICK_PAY;

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Returns {@code true} for kinds that map to URA goodsServiceFlag {@code "1"} (Goods).
     * All other kinds default to {@code "2"} (Services).
     */
    public boolean isGoods() {
        return this == PRODUCT;
    }

    /**
     * Returns the URA unit-of-measure code for this item kind.
     * <ul>
     *   <li>EA  — each (discrete unit)</li>
     *   <li>PKG — package</li>
     *   <li>DAY — calendar day</li>
     *   <li>HUR — hour (ISO 80000-3)</li>
     * </ul>
     */
    public String uraUom() {
        return switch (this) {
            case ROOM, SUITE       -> "DAY";
            case PARKING_SLOT,
                 SERVICE_SESSION   -> "HUR";
            case PRODUCT           -> "PKG";
            default                -> "EA";   // FOOD, TICKET, FEE, QUICK_PAY
        };
    }
}
