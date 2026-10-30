package com.scanny.rent.gateway;

import com.scanny.entity.RentCharge;

/**
 * Abstraction over payment initiation for the rent-collection module.
 *
 * <p>The only implementation today is {@link ManualGateway}, which records the
 * payment details immediately without touching any external service.  Future
 * implementations (Airtel MoMo push, bank debit) will implement this interface
 * and be selected via a {@code @Qualifier} or Spring profile.
 *
 * <p>The three methods mirror the lifecycle of a payment:
 * <ol>
 *   <li>{@link #initiate} — begin a payment and return a reference.</li>
 *   <li>{@link #status}   — check the current state of a reference.</li>
 *   <li>{@link #parseCallback} — translate a raw callback payload into a result.</li>
 * </ol>
 */
public interface RentPaymentGateway {

    /** Stable identifier for this gateway, e.g. {@code "manual"}, {@code "momo"}. */
    String id();

    /**
     * Initiates a payment for the given charge.
     *
     * @param command the payment details (amount, payer phone, method, etc.)
     * @return a result containing the gateway's transaction reference
     */
    GatewayResult initiate(GatewayCommand command);

    /**
     * Polls the current status of a previously initiated payment.
     *
     * @param transactionRef the reference returned by {@link #initiate}
     * @return the current state of the payment
     */
    GatewayStatus status(String transactionRef);

    /**
     * Translates a raw inbound webhook/callback payload into a {@link GatewayStatus}.
     * For gateways that push callbacks (e.g. MoMo), the controller calls this to
     * determine whether to mark the payment completed or failed.
     * For {@link ManualGateway} this always returns {@link GatewayStatus#COMPLETED}.
     *
     * @param rawPayload the raw request body from the callback, may be empty/null
     * @return the derived payment status
     */
    GatewayStatus parseCallback(String rawPayload);

    // ── Value types ───────────────────────────────────────────────────────────

    /**
     * All inputs required to initiate a rent payment.
     *
     * @param charge         the charge being paid
     * @param payerPhone     payer's phone number (normalised to +256XXXXXXXXX)
     * @param payerName      optional display name
     * @param amount         amount in the charge's currency minor units
     * @param reference      optional external reference provided by the manager
     * @param recordedBy     account ID of the manager recording the payment
     */
    record GatewayCommand(
            RentCharge charge,
            String payerPhone,
            String payerName,
            long amount,
            String reference,
            String recordedBy
    ) {}

    /**
     * The outcome of a gateway call.
     *
     * @param transactionRef the gateway's unique reference for this payment
     * @param status         current lifecycle state
     * @param message        human-readable message (may be null)
     */
    record GatewayResult(
            String transactionRef,
            GatewayStatus status,
            String message
    ) {}

    /**
     * Simplified payment lifecycle state returned by the gateway layer.
     * Intentionally coarser than the database {@code RentPaymentStatus} enum —
     * the service layer translates between them.
     */
    enum GatewayStatus {
        /** Payment confirmed and funds received (or recorded as received). */
        COMPLETED,
        /** Payment is pending external confirmation (e.g. awaiting MoMo push). */
        PENDING,
        /** Payment failed or was declined. */
        FAILED
    }
}
