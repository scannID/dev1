package com.scanny.payment.provider;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.scanny.entity.PaymentIntent;
import com.scanny.payment.PaymentIntentStatus;
import com.scanny.payment.PaymentProvider;
import com.scanny.payment.config.PaymentProperties;
import com.scanny.payment.model.PaymentCommand;
import com.scanny.payment.model.PaymentProviderResult;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Default provider for local development and manual mobile-money flows.
 */
@Component
public class StubPaymentProvider implements PaymentProvider {

    private static final Logger log = LoggerFactory.getLogger(StubPaymentProvider.class);

    private final PaymentProperties properties;
    private final ObjectMapper objectMapper;

    public StubPaymentProvider(PaymentProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
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

    @Override
    public Optional<PaymentProviderResult> handleWebhook(String rawBody, Map<String, String> headers) {
        if (rawBody == null || rawBody.isBlank()) {
            return Optional.empty();
        }
        try {
            JsonNode root = objectMapper.readTree(rawBody);
            String paymentId = text(root, "paymentId", "payment_id", "id");
            String providerReference = text(root, "providerReference", "provider_reference", "reference");
            String statusRaw = text(root, "status");
            if ((paymentId == null || paymentId.isBlank())
                    && (providerReference == null || providerReference.isBlank())) {
                return Optional.empty();
            }
            PaymentIntentStatus status = parseStatus(statusRaw);
            Map<String, String> metadata = paymentId != null && !paymentId.isBlank()
                    ? Map.of("paymentId", paymentId)
                    : Map.of();
            return Optional.of(new PaymentProviderResult(
                    status,
                    providerReference,
                    "Webhook processed (stub).",
                    null,
                    metadata
            ));
        } catch (Exception ex) {
            log.warn("Failed to parse stub webhook body", ex);
            return Optional.empty();
        }
    }

    private static String text(JsonNode root, String... keys) {
        for (String key : keys) {
            JsonNode node = root.get(key);
            if (node != null && !node.isNull() && !node.asText().isBlank()) {
                return node.asText().trim();
            }
        }
        return null;
    }

    private static PaymentIntentStatus parseStatus(String raw) {
        if (raw == null || raw.isBlank()) {
            return PaymentIntentStatus.Paid;
        }
        try {
            return PaymentIntentStatus.valueOf(raw.trim());
        } catch (IllegalArgumentException ex) {
            String normalized = raw.trim().toUpperCase(Locale.ROOT);
            return switch (normalized) {
                case "SUCCESS", "SUCCESSFUL", "COMPLETED", "COMPLETE" -> PaymentIntentStatus.Paid;
                case "FAILED", "FAILURE", "ERROR" -> PaymentIntentStatus.Failed;
                case "CANCELLED", "CANCELED" -> PaymentIntentStatus.Cancelled;
                case "PROCESSING", "PENDING" -> PaymentIntentStatus.Processing;
                default -> PaymentIntentStatus.Paid;
            };
        }
    }
}
