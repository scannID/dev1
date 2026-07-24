package com.scanny.payment.model;

import com.scanny.payment.PaymentIntentStatus;
import java.util.Map;

public record PaymentProviderResult(
    PaymentIntentStatus status,
    String providerReference,
    String customerMessage,
    String failureReason,
    Map<String, String> metadata
) {
    public PaymentProviderResult(PaymentIntentStatus status, String providerReference, String customerMessage) {
        this(status, providerReference, customerMessage, null, Map.of());
    }

    public PaymentProviderResult(
            PaymentIntentStatus status,
            String providerReference,
            String customerMessage,
            Map<String, String> metadata
    ) {
        this(status, providerReference, customerMessage, null, metadata != null ? metadata : Map.of());
    }
}
