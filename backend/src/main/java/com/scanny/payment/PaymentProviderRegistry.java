package com.scanny.payment;

import com.scanny.exception.ApiException;
import com.scanny.payment.config.PaymentProperties;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class PaymentProviderRegistry {

    private final Map<String, PaymentProvider> providersById;
    private final PaymentProperties properties;

    public PaymentProviderRegistry(List<PaymentProvider> providers, PaymentProperties properties) {
        this.properties = properties;
        Map<String, PaymentProvider> map = new LinkedHashMap<>();
        for (PaymentProvider provider : providers) {
            map.put(normalize(provider.id()), provider);
        }
        this.providersById = Map.copyOf(map);
    }

    public Collection<PaymentProvider> all() {
        return providersById.values();
    }

    public PaymentProvider resolve(String requestedProviderId) {
        if (requestedProviderId != null && !requestedProviderId.isBlank()) {
            String mapped = mapAlias(requestedProviderId);
            PaymentProvider requested = providersById.get(normalize(mapped));
            if (requested == null) {
                throw new ApiException(400, "Unknown payment provider: " + requestedProviderId);
            }
            if (requested.isAvailable()) {
                return requested;
            }
            if (properties.isFallbackToStub()) {
                PaymentProvider stub = providersById.get("stub");
                if (stub != null && stub.isAvailable()) {
                    return stub;
                }
            }
            throw new ApiException(
                503,
                requested.displayName() + " is not configured. Add API credentials in scanny.payments.* config."
            );
        }
        return require(properties.getDefaultProvider());
    }

    public PaymentProvider require(String providerId) {
        PaymentProvider provider = providersById.get(normalize(providerId));
        if (provider == null) {
            throw new ApiException(400, "Unknown payment provider: " + providerId);
        }
        if (!provider.isAvailable()) {
            throw new ApiException(
                503,
                provider.displayName() + " is not configured. Add API credentials in scanny.payments.* config."
            );
        }
        return provider;
    }

    public static String mapAlias(String alias) {
        String normalized = alias.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "mtn", "mtn-momo", "mtn_momo", "mom" -> "mtn-momo";
            case "airtel", "airtel-money", "airtel_money" -> "airtel-money";
            case "stub", "manual", "dev" -> "stub";
            default -> normalized;
        };
    }

    private static String normalize(String providerId) {
        return providerId.trim().toLowerCase(Locale.ROOT);
    }
}
