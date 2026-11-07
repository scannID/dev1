package com.scanny.accounting;

import java.util.Map;

/**
 * Immutable value object representing an accounting domain event.
 *
 * <p>Every field the PostingService needs to build a journal entry is
 * captured here at the point the business event fires, so the posting
 * service never has to re-query domain tables to reconstruct context.
 *
 * <p>All monetary fields are BIGINT (UGX minor units — whole shillings).
 * A value of zero is valid (e.g. a free ticket).  Negative values are
 * never used; corrections are recorded as separate REVERSAL events.
 */
public record AccountingEvent(

    // ── Identity ─────────────────────────────────────────────────────────────
    /** Unique identifier for this event — used as the idempotency key. */
    String eventId,

    /** The domain event type, must match a posting_rules.event_type row. */
    String eventType,

    /** Source module: RESTAURANTS | RENT | TICKETING | SYSTEM */
    String sourceModule,

    // ── Source record link (for drill-down) ──────────────────────────────────
    /** ID of the originating domain record (order ID, charge ID, ticket ID…). */
    String sourceRecordId,

    // ── Money (all amounts in UGX minor units, always ≥ 0) ───────────────────
    /** Full ticket/order price paid by the customer. 0 if not applicable. */
    long grossAmountUgx,

    /** Platform commission retained by Koddly. */
    long platformCommissionUgx,

    /** The portion that belongs to the merchant/landlord/organiser (gross - commission). */
    long payeeAmountUgx,

    /** PSP fee deducted from the settlement batch. 0 if not known at event time. */
    long pspFeeUgx,

    /** Late fee added to a rent charge. 0 if not applicable. */
    long lateFeeUgx,

    /** Security deposit amount. 0 if not applicable. */
    long depositAmountUgx,

    // ── Dimensions ────────────────────────────────────────────────────────────
    String merchantId,     // restaurant merchant
    String propertyId,     // rent property
    String tenantId,       // rent tenant
    String eventEntityId,  // ticketing event / master ticket id
    String paymentMethod,  // MOMO | CASH | CARD

    // ── Human description ─────────────────────────────────────────────────────
    String description,

    // ── Extra fields for complex posting rules ────────────────────────────────
    /** Arbitrary extra fields referenced by posting rule amount_fields. */
    Map<String, Long> extras
) {
    /** Convenience: look up a named amount field used by posting rules. */
    public long getAmountField(String field) {
        return switch (field) {
            case "gross_amount_ugx"          -> grossAmountUgx;
            case "platform_commission_ugx"   -> platformCommissionUgx;
            case "payee_amount_ugx"          -> payeeAmountUgx;
            case "psp_fee_ugx"               -> pspFeeUgx;
            case "late_fee_ugx"              -> lateFeeUgx;
            case "deposit_amount_ugx"        -> depositAmountUgx;
            // legacy field names from the posting rules seeded in V67
            case "platform_fee_ugx"          -> platformCommissionUgx;
            case "charge_amount_ugx"         -> grossAmountUgx;
            case "paid_amount_ugx"           -> grossAmountUgx;
            case "ticket_price_ugx"          -> grossAmountUgx;
            case "organiser_amount_ugx"      -> payeeAmountUgx;
            case "total_organiser_amount_ugx"-> payeeAmountUgx;
            case "payout_amount_ugx"         -> payeeAmountUgx;
            case "settled_amount_ugx"        -> grossAmountUgx;
            case "promotion_fee_ugx"         -> grossAmountUgx;
            case "total_deferred_ugx"        -> grossAmountUgx;
            default -> extras != null ? extras.getOrDefault(field, 0L) : 0L;
        };
    }
}
