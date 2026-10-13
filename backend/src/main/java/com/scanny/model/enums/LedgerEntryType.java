package com.scanny.model.enums;

/**
 * Discriminator for rows in {@code financial_ledger_entries}.
 *
 * <ul>
 *   <li>{@code PAYMENT} – positive row written when an order transitions to Paid.</li>
 *   <li>{@code REFUND}  – negative compensating row written when an order transitions
 *       from Paid to Refunded. The original PAYMENT row is never mutated.</li>
 * </ul>
 */
public enum LedgerEntryType {
    PAYMENT,
    REFUND
}
