package com.scanny.model.enums;

public enum RoomStatus {
    /** Room is clean and available to book. */
    VACANT,
    /** Booking confirmed, guest has not yet arrived. */
    BOOKED,
    /** Guest has checked in and is currently occupying the room. */
    OCCUPIED,
    /** Checkout date has passed; awaiting front-desk confirmation or extension. */
    CHECKOUT_PENDING,
    /** Manually blocked — cleaning, maintenance, or renovation. */
    UNDER_MAINTENANCE
}
