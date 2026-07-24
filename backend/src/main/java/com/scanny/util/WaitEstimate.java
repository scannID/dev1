package com.scanny.util;

/**
 * Rough kitchen queue ETA for customer waiting / done screens.
 * base + openTickets * perTicket, clamped.
 */
public final class WaitEstimate {

    public static final int BASE_MINUTES = 10;
    public static final int PER_OPEN_ORDER_MINUTES = 3;
    public static final int MAX_MINUTES = 45;
    public static final int RANGE_PAD_MINUTES = 3;

    private WaitEstimate() {}

    public static int estimateMinutes(long openOrders) {
        long raw = BASE_MINUTES + Math.max(0, openOrders) * PER_OPEN_ORDER_MINUTES;
        return (int) Math.min(MAX_MINUTES, Math.max(BASE_MINUTES, raw));
    }

    public static int rangeHigh(int estimateMinutes) {
        return Math.min(MAX_MINUTES, estimateMinutes + RANGE_PAD_MINUTES);
    }
}
