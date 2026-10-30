package com.scanny.model.enums;

/** Lifecycle status of a {@link com.scanny.entity.RentLease}. */
public enum RentLeaseStatus {
    /** Created but activation date is in the future. */
    PENDING,
    /** Activation date has passed; charges are being generated. */
    ACTIVE,
    /** leaseEnd date has passed; no new charges will be generated. */
    EXPIRED,
    /** Manually terminated before the natural expiry. */
    TERMINATED
}
