package com.scanny.payment.service;

import com.scanny.dto.PaymentDtos;
import com.scanny.entity.PaymentIntent;
import com.scanny.exception.ApiException;
import com.scanny.payment.PaymentProvider;
import com.scanny.payment.PaymentProviderRegistry;
import com.scanny.payment.config.PaymentProperties;
import com.scanny.payment.model.PaymentCommand;
import com.scanny.payment.model.PaymentProviderResult;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PaymentGatewayService {

    private final PaymentProviderRegistry registry;
    private final PaymentIntentService paymentIntentService;
    private final PaymentProperties properties;

    public PaymentGatewayService(
            PaymentProviderRegistry registry,
            PaymentIntentService paymentIntentService,
            PaymentProperties properties) {
        this.registry = registry;
        this.paymentIntentService = paymentIntentService;
        this.properties = properties;
    }

    @Transactional
    public PaymentDtos.InitiateResponse initiate(PaymentDtos.InitiateRequest request, String idempotencyKey) {
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Optional<PaymentIntent> byKey = paymentIntentService.findByIdempotencyKey(idempotencyKey);
            if (byKey.isPresent()) {
                return paymentIntentService.toInitiateResponse(byKey.get());
            }
        }

        Optional<PaymentIntent> reusable = paymentIntentService.findReusableIntent(
                request.context(),
                request.referenceId()
        );
        if (reusable.isPresent()) {
            return paymentIntentService.toInitiateResponse(reusable.get());
        }

        PaymentProvider provider = registry.resolve(request.provider());
        try {
            PaymentIntent intent = paymentIntentService.createIntent(provider.id(), request, idempotencyKey);
            PaymentCommand command = paymentIntentService.toCommand(intent);
            PaymentProviderResult result = provider.initiate(command);
            intent = paymentIntentService.applyProviderResult(intent, result);
            return paymentIntentService.toInitiateResponse(intent);
        } catch (DataIntegrityViolationException ex) {
            // Concurrent retry hit unique active-reference or idempotency_key — return the winner.
            if (idempotencyKey != null && !idempotencyKey.isBlank()) {
                return paymentIntentService.findByIdempotencyKey(idempotencyKey)
                        .map(paymentIntentService::toInitiateResponse)
                        .orElseThrow(() -> ex);
            }
            return paymentIntentService.findReusableIntent(request.context(), request.referenceId())
                    .map(paymentIntentService::toInitiateResponse)
                    .orElseThrow(() -> ex);
        }
    }

    @Transactional
    public PaymentDtos.InitiateResponse initiate(PaymentDtos.InitiateRequest request) {
        return initiate(request, null);
    }

    @Transactional
    public PaymentDtos.StatusResponse refreshStatus(String paymentId) {
        PaymentIntent intent = paymentIntentService.requireIntent(paymentId);
        if (intent.getStatus().isTerminal()) {
            return paymentIntentService.toStatusResponse(intent);
        }

        PaymentProvider provider = registry.require(intent.getProviderId());
        PaymentCommand command = paymentIntentService.toCommand(intent);
        PaymentProviderResult result = provider.queryStatus(command, intent);
        intent = paymentIntentService.applyProviderResult(intent, result);
        return paymentIntentService.toStatusResponse(intent);
    }

    @Transactional(readOnly = true)
    public PaymentDtos.ProvidersResponse listProviders() {
        List<PaymentDtos.ProviderInfo> providers = registry.all().stream()
            .map(provider -> new PaymentDtos.ProviderInfo(provider.id(), provider.displayName(), provider.isAvailable()))
            .toList();
        return new PaymentDtos.ProvidersResponse(providers, properties.getDefaultProvider());
    }

    @Transactional
    public Optional<PaymentDtos.StatusResponse> handleWebhook(String providerId, String rawBody, Map<String, String> headers) {
        PaymentProvider provider = registry.require(providerId);
        Optional<PaymentProviderResult> result = provider.handleWebhook(rawBody, headers);
        if (result.isEmpty()) {
            return Optional.empty();
        }

        // Webhook handlers should include providerReference in metadata for lookup — extend when implementing real providers.
        throw new ApiException(501, "Webhook handling not wired yet for " + providerId);
    }
}
