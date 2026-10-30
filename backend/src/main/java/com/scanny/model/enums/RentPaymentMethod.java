package com.scanny.model.enums;

/**
 * The method by which a rent payment was made.
 * Only {@code MANUAL_*} variants are used for manually-recorded payments.
 * Future gateways (MoMo push, bank debit) would add their own values here.
 */
public enum RentPaymentMethod {
    CASH,
    MOMO,
    BANK,
    OTHER
}
