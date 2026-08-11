package com.scanny.payment.model;

/**
 * Money split for an order payment.
 *
 * <p>The customer pays {@code grossCharged} (subtotal + serviceFee).
 * The merchant MoMo receives {@code merchantPayout} (subtotal + any merchant share
 * of the service fee). Of the remaining service fee:
 * <ul>
 *   <li>PSO takes {@code psoFee}</li>
 *   <li>Scanny platform keeps {@code platformFee}</li>
 * </ul>
 *
 * <p>Example (1,000 UGX order, 700 fee, 30% PSO, 20% merchant commission):
 * <pre>
 *   subtotal          = 1,000
 *   serviceFee        = 700
 *   merchantFeeShare  = round(700 * 0.20) = 140
 *   remainingFee      = 700 - 140 = 560
 *   psoFee            = round(560 * 0.30) = 168
 *   platformFee       = 560 - 168 = 392
 *   merchantPayout    = 1,000 + 140 = 1,140
 *   grossCharged      = 1,000 + 700 = 1,700
 * </pre>
 */
public record FeeSplit(
        int subtotal,
        int serviceFee,
        int psoFee,
        int platformFee,
        int merchantPayout,
        int grossCharged
) {
    /**
     * Standard split without a per-merchant commission (merchant commission = 0).
     */
    public static FeeSplit of(int subtotal, int serviceFee, double psoPercent) {
        return of(subtotal, serviceFee, psoPercent, 0);
    }

    /**
     * Full split including a per-merchant commission on the service fee.
     *
     * @param subtotal                 order subtotal (UGX)
     * @param serviceFee               flat service fee (UGX)
     * @param psoPercent               PSO share of the *remaining* fee after merchant cut (0–1)
     * @param merchantFeeCommissionPct merchant's share of the service fee as a whole-number
     *                                 percentage (0–100); the value is clamped to [0, 100]
     */
    public static FeeSplit of(int subtotal, int serviceFee, double psoPercent, int merchantFeeCommissionPct) {
        int safeSubtotal = Math.max(0, subtotal);
        int safeFee      = Math.max(0, serviceFee);
        int safeMerchPct = Math.max(0, Math.min(100, merchantFeeCommissionPct));
        double safePso   = Math.max(0, Math.min(1, psoPercent));

        // Merchant's cut from the service fee
        int merchantFeeShare = (int) Math.round(safeFee * (safeMerchPct / 100.0));
        int remainingFee     = safeFee - merchantFeeShare;

        // PSO and platform split the remaining fee
        int psoFee      = (int) Math.round(remainingFee * safePso);
        int platformFee = remainingFee - psoFee;

        int merchantPayout = safeSubtotal + merchantFeeShare;

        return new FeeSplit(
                safeSubtotal,
                safeFee,
                psoFee,
                platformFee,
                merchantPayout,
                safeSubtotal + safeFee
        );
    }
}
