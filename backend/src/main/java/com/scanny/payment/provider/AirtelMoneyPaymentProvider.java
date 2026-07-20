package com.scanny.payment.provider;

import com.scanny.exception.ApiException;
import com.scanny.payment.PaymentProvider;
import com.scanny.payment.config.PaymentProperties;
import com.scanny.payment.model.PaymentCommand;
import com.scanny.payment.model.PaymentProviderResult;
import com.scanny.entity.PaymentIntent;
import org.springframework.stereotype.Component;

/**
 * Airtel Money plug-in skeleton.
 * Implement {@link #initiate} and {@link #queryStatus} when Airtel API docs/credentials arrive.
 */
@Component
public class AirtelMoneyPaymentProvider implements PaymentProvider {

    private final PaymentProperties.ProviderConfig config;

    public AirtelMoneyPaymentProvider(PaymentProperties properties) {
        this.config = properties.getAirtelMoney();
    }

    @Override
    public String id() {
        return "airtel-money";
    }

    @Override
    public String displayName() {
        return "Airtel Money";
    }

    @Override
    public boolean isAvailable() {
        return config.isConfigured();
    }

    @Override
    public PaymentProviderResult initiate(PaymentCommand command) {
        ensureConfigured();
        // TODO: call Airtel collection API with command + config credentials
        throw new ApiException(501, "Airtel Money initiate() not implemented — plug in the Airtel API client here.");
    }

    @Override
    public PaymentProviderResult queryStatus(PaymentCommand command, PaymentIntent intent) {
        ensureConfigured();
        // TODO: poll Airtel payment status endpoint
        throw new ApiException(501, "Airtel Money queryStatus() not implemented — plug in the Airtel API client here.");
    }

    private void ensureConfigured() {
        if (!isAvailable()) {
            throw new ApiException(503, "Airtel Money is not configured");
        }
    }
}
