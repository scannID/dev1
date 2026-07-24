package com.scanny.payment.provider;

import com.scanny.exception.ApiException;
import com.scanny.payment.PaymentIntentStatus;
import com.scanny.payment.PaymentProvider;
import com.scanny.payment.config.PaymentProperties;
import com.scanny.payment.model.PaymentCommand;
import com.scanny.payment.model.PaymentProviderResult;
import com.scanny.entity.PaymentIntent;
import org.springframework.stereotype.Component;

/**
 * MTN Mobile Money plug-in skeleton.
 * When you receive MTN API credentials, implement {@link #initiate} and {@link #queryStatus}
 * using their collection / request-to-pay endpoints.
 */
@Component
public class MtnMomoPaymentProvider implements PaymentProvider {

    private final PaymentProperties.ProviderConfig config;

    public MtnMomoPaymentProvider(PaymentProperties properties) {
        this.config = properties.getMtnMomo();
    }

    @Override
    public String id() {
        return "mtn-momo";
    }

    @Override
    public String displayName() {
        return "MTN MoMo";
    }

    @Override
    public boolean isAvailable() {
        return config.isConfigured();
    }

    @Override
    public PaymentProviderResult initiate(PaymentCommand command) {
        ensureConfigured();
        // TODO: POST split-settlement collection:
        //  - merchant MoMo (command.merchantMomoDestination) gets command.merchantPayout (subtotal)
        //  - Scanny (command.scannyFeeDestination) gets command.platformFee
        //  - PSO keeps command.psoFee from the service fee
        // Map command.customerPhone(), command.amount() (gross), command.currency()
        throw new ApiException(501, "MTN MoMo initiate() not implemented — plug in the MTN API client here.");
    }

    @Override
    public PaymentProviderResult queryStatus(PaymentCommand command, PaymentIntent intent) {
        ensureConfigured();
        // TODO: GET {config.apiUrl}/collection/v1_0/requesttopay/{intent.providerReference}
        throw new ApiException(501, "MTN MoMo queryStatus() not implemented — plug in the MTN API client here.");
    }

    private void ensureConfigured() {
        if (!isAvailable()) {
            throw new ApiException(503, "MTN MoMo is not configured");
        }
    }
}
