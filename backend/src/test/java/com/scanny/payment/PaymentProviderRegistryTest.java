package com.scanny.payment;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.scanny.payment.config.PaymentProperties;
import com.scanny.payment.provider.AirtelMoneyPaymentProvider;
import com.scanny.payment.provider.MtnMomoPaymentProvider;
import com.scanny.payment.provider.StubPaymentProvider;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class PaymentProviderRegistryTest {

    private final PaymentProperties properties = new PaymentProperties();
    private final ObjectMapper objectMapper = new ObjectMapper();

    private PaymentProviderRegistry registry() {
        properties.setFallbackToStub(true);
        List<PaymentProvider> providers = List.of(
            new StubPaymentProvider(properties, objectMapper),
            new MtnMomoPaymentProvider(properties),
            new AirtelMoneyPaymentProvider(properties)
        );
        return new PaymentProviderRegistry(providers, properties);
    }

    @Test
    void mapsMtnAliasToStubWhenNotConfigured() {
        PaymentProvider provider = registry().resolve("MTN");
        assertEquals("stub", provider.id());
    }

    @Test
    void usesDefaultProviderWhenRequestBlank() {
        PaymentProvider provider = registry().resolve(null);
        assertEquals("stub", provider.id());
    }

    @Test
    void throwsForUnknownProvider() {
        assertThrows(com.scanny.exception.ApiException.class, () -> registry().resolve("paypal"));
    }
}
