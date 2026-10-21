package com.scanny.model.enums;

/**
 * Canonical business-type enum used by both {@code Business.type} and
 * {@code Merchant.businessType}.  Previously the two entities used separate
 * enum definitions; this single source of truth replaces both.
 *
 * <p>EFRIS pipeline behaviour per type:
 * <ul>
 *   <li>All types that sell via the standard Order flow receive fiscal receipts
 *       automatically once the merchant enrolls (TIN + device key).</li>
 *   <li>TICKET sales use {@code ItemKind.TICKET}.</li>
 *   <li>QUICK_PAY transactions use the Quick-Pay EFRIS path.</li>
 * </ul>
 */
public enum BusinessType {
    /** Dine-in / takeaway food service. */
    RESTAURANT,
    /** Hotel or guest-house room/suite rentals. */
    HOTEL,
    /** Bar or nightclub, primarily beverage service. */
    BAR,
    /** Time/session-based vehicle parking. */
    PARKING,
    /** Live events, concerts, sports — ticket-based revenue. */
    EVENT,
    /** Hair, beauty, or spa appointment services. */
    SALON,
    /** Physical goods retail (boutique, pharmacy, general merchandise). */
    RETAIL,
    /** Primary/secondary school fees and related charges. */
    SCHOOL,
    /** Any business type not covered by the above. */
    OTHER;

    // ── Backward-compat helpers ───────────────────────────────────────────────
    // The old enum used PascalCase names (Restaurant, Hotel, Bar, Boutique, School).
    // JPA @Enumerated(STRING) stores the name(); existing DB rows therefore hold the
    // old casing.  A Flyway migration (V<next>__normalise_business_type.sql) must
    // UPDATE businesses SET type = UPPER(type) before this enum is deployed.

    /**
     * Returns true for business types where catalog items are primarily physical
     * goods (mapped to URA goodsServiceFlag = "1").
     */
    public boolean sellsGoods() {
        return this == RETAIL;
    }

    /**
     * Returns true for business types that use ticket-based revenue rather than
     * catalog orders (routes through the Ticket EFRIS path, not the Order path).
     */
    public boolean isTicketBased() {
        return this == EVENT;
    }
}
