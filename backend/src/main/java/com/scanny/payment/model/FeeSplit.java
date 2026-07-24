package com.scanny.payment.model;

/**
 * Money split for an order payment.
 * Merchant MoMo receives {@code merchantPayout} (subtotal) directly.
 * Of {@code serviceFee}, PSO takes {@code psoFee}; Scanny keeps {@code platformFee}.
 */
public record FeeSplit(
        int subtotal,
        int serviceFee,
        int psoFee,
        int platformFee,
        int merchantPayout,
        int grossCharged
) {
    public static FeeSplit of(int subtotal, int serviceFee, double psoPercent) {
        int safeSubtotal = Math.max(0, subtotal);
        int safeFee = Math.max(0, serviceFee);
        double pct = Math.max(0, Math.min(1, psoPercent));
        int psoFee = (int) Math.round(safeFee * pct);
        if (psoFee > safeFee) {
            psoFee = safeFee;
        }
        int platformFee = safeFee - psoFee;
        return new FeeSplit(
                safeSubtotal,
                safeFee,
                psoFee,
                platformFee,
                safeSubtotal,
                safeSubtotal + safeFee
        );
    }
}
