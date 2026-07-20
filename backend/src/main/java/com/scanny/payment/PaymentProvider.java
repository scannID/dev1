package com.scanny.payment;

import com.scanny.payment.model.PaymentCommand;
import com.scanny.payment.model.PaymentProviderResult;
import com.scanny.entity.PaymentIntent;
import java.util.Map;
import java.util.Optional;

/**
 * Plug-in contract for payment providers (MTN MoMo, Airtel Money, card gateways, etc.).
 * Implement this interface and register as a Spring bean to add a new provider.
 */
public interface PaymentProvider {

    /** Stable id used in config and API (e.g. {@code mtn-momo}). */
    String id();

    /** Human-readable label for UI. */
    String displayName();

    /** Whether credentials/config are present and the provider can accept payments. */
    boolean isAvailable();

    PaymentProviderResult initiate(PaymentCommand command);

    PaymentProviderResult queryStatus(PaymentCommand command, PaymentIntent intent);

    default Optional<PaymentProviderResult> handleWebhook(String rawBody, Map<String, String> headers) {
        return Optional.empty();
    }
}
