package com.scanny.model.enums;

public enum StockMovementType {
    RECEIVE,
    ADJUST,
    WASTE,
    CONSUME,
    RETURN,
    /** Stock leaving this branch toward a sibling branch (matched by transferGroupId). */
    TRANSFER_OUT,
    /** Stock arriving from a sibling branch (matched by transferGroupId). */
    TRANSFER_IN,
    /** Exact reversal of CONSUME movements when an order is refunded or cancelled. */
    CONSUME_REVERSE
}
