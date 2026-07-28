package com.scanny.service;

import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class WhatsAppNotificationService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppNotificationService.class);

    private final RestClient restClient;
    private final String apiUrl;
    private final String apiToken;
    private final String fromNumber;
    private final boolean enabled;

    public WhatsAppNotificationService(
            @Value("${scanny.whatsapp.api-url:}") String apiUrl,
            @Value("${scanny.whatsapp.api-token:}") String apiToken,
            @Value("${scanny.whatsapp.from-number:}") String fromNumber,
            @Value("${scanny.whatsapp.enabled:false}") boolean enabled
    ) {
        this.apiUrl = apiUrl;
        this.apiToken = apiToken;
        this.fromNumber = fromNumber;
        this.enabled = enabled;
        this.restClient = RestClient.create();
    }

    public void sendText(String toPhone, String message) {
        if (toPhone == null || toPhone.isBlank() || message == null || message.isBlank()) {
            return;
        }
        if (!enabled || apiUrl.isBlank() || apiToken.isBlank()) {
            log.info("WhatsApp (dry-run) to {}: {}", toPhone, message);
            return;
        }
        try {
            restClient.post()
                    .uri(apiUrl)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiToken)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "from", fromNumber,
                            "to", toPhone,
                            "type", "text",
                            "text", Map.of("body", message)
                    ))
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception ex) {
            log.warn("WhatsApp send failed for {}: {}", toPhone, ex.getMessage());
        }
    }

    public void sendOrderStatusUpdate(String toPhone, String businessName, String orderId, String status) {
        sendText(toPhone, businessName + ": your order " + orderId + " is now " + status + ".");
    }
}
