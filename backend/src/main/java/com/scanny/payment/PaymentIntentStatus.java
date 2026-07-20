package com.scanny.payment;

public enum PaymentIntentStatus {
    Pending,
    Processing,
    Paid,
    Failed,
    Cancelled;

    public boolean isTerminal() {
        return this == Paid || this == Failed || this == Cancelled;
    }
}
