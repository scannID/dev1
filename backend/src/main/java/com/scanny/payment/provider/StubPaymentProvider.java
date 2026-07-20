package com.scanny.payment.provider;

import com.scanny.payment.PaymentIntentStatus;
import com.scanny.payment.PaymentProvider;
import com.scanny.payment.config.PaymentProperties;
import com.scanny.payment.model.PaymentCommand;
import com.scanny.payment.model.PaymentProviderResult;
import com.scanny.entity.PaymentIntent;
import java.time.Duration;
import java.time.Instant;
import org.springframework.stereotype.Component;

/**
 * Default provider for local development and manual mobile-money flows.
 * Replace {@link #queryStatus} auto-complete with real provider polling in production.
 */
@Component
public class StubPaymentProvider implements PaymentProvider {

    private final PaymentProperties properties;

    public StubPaymentProvider(PaymentProperties properties) {
        this.properties = properties;
    }

    @Override
    public String id() {
        return "stub";
    }

    @Override
    public String displayName() {
        return "Manual / Dev";
    }

    @Override
    public boolean isAvailable() {
        return true;
    }

    @Override
    public PaymentProviderResult initiate(PaymentCommand command) {
        return new PaymentProviderResult(
            PaymentIntentStatus.Processing,
            "STUB-" + command.paymentIntentId(),
            "Approve the mobile money prompt on your phone. We will confirm once payment is received."
        );
    }

    @Override
    public PaymentProviderResult queryStatus(PaymentCommand command, PaymentIntent intent) {
        int autoCompleteSeconds = properties.getStub().getAutoCompleteSeconds();
        if (autoCompleteSeconds > 0 && intent.getStatus() != PaymentIntentStatus.Paid) {
            Instant deadline = intent.getCreatedAt().plusSeconds(autoCompleteSeconds);
            if (Instant.now().isAfter(deadline)) {
                return new PaymentProviderResult(
                    PaymentIntentStatus.Paid,
                    intent.getProviderReference(),
                    "Payment confirmed (stub auto-complete)."
                );
            }
        }

        PaymentIntentStatus status = intent.getStatus();
        if (status == PaymentIntentStatus.Pending) {
            status = PaymentIntentStatus.Processing;
        }
        return new PaymentProviderResult(
            status,
            intent.getProviderReference(),
            intent.getCustomerMessage() != null
                ? intent.getCustomerMessage()
                : "Waiting for mobile money confirmation."
        );
    }
}
