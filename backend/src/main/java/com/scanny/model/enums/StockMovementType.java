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
    TRANSFER_IN
}
