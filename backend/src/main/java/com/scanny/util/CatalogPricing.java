package com.scanny.util;

public final class CatalogPricing {

    private CatalogPricing() {}

    public static int clampDiscountPercent(Integer discountPercent) {
        if (discountPercent == null) {
            return 0;
        }
        if (discountPercent < 0 || discountPercent > 100) {
            throw new IllegalArgumentException("Discount percent must be between 0 and 100.");
        }
        return discountPercent;
    }

    /** Sale unit price after knocking off discountPercent from list price. */
    public static int effectivePrice(int listPrice, int discountPercent) {
        int percent = Math.max(0, Math.min(100, discountPercent));
        if (percent == 0) {
            return listPrice;
        }
        return (int) Math.round(listPrice * (100 - percent) / 100.0);
    }
}
