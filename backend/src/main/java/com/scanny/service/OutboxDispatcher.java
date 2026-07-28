package com.scanny.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.scanny.entity.OutboxEvent;
import com.scanny.entity.PaymentIntent;
import com.scanny.payment.service.PaymentIntentService;
import com.scanny.repository.OutboxEventRepository;
import com.scanny.websocket.RealtimeEventPublisher;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class OutboxDispatcher {

    private static final Logger log = LoggerFactory.getLogger(OutboxDispatcher.class);

    private final OutboxEventRepository outboxEventRepository;
    private final ObjectMapper objectMapper;
    private final RealtimeEventPublisher realtimeEventPublisher;
    private final PaymentIntentService paymentIntentService;
    private final OrderService orderService;
    private final AuditService auditService;
    private final WhatsAppNotificationService whatsAppNotificationService;

    public OutboxDispatcher(
            OutboxEventRepository outboxEventRepository,
            ObjectMapper objectMapper,
            RealtimeEventPublisher realtimeEventPublisher,
            @Lazy PaymentIntentService paymentIntentService,
            @Lazy OrderService orderService,
            AuditService auditService,
            WhatsAppNotificationService whatsAppNotificationService
    ) {
        this.outboxEventRepository = outboxEventRepository;
        this.objectMapper = objectMapper;
        this.realtimeEventPublisher = realtimeEventPublisher;
        this.paymentIntentService = paymentIntentService;
        this.orderService = orderService;
        this.auditService = auditService;
        this.whatsAppNotificationService = whatsAppNotificationService;
    }

    @Scheduled(fixedDelayString = "${scanny.outbox.poll-ms:500}")
    @Transactional
    public void dispatchPending() {
        List<OutboxEvent> pending = outboxEventRepository.findPending(PageRequest.of(0, 100));
        for (OutboxEvent event : pending) {
            try {
                process(event);
                event.setProcessedAt(Instant.now());
                outboxEventRepository.save(event);
            } catch (Exception ex) {
                log.warn("Outbox event {} ({}) failed: {}", event.getId(), event.getEventType(), ex.getMessage());
            }
        }
    }

    private void process(OutboxEvent event) throws Exception {
        Map<String, Object> payload = objectMapper.readValue(event.getPayloadJson(), new TypeReference<>() {});
        switch (event.getEventType()) {
            case OutboxService.TYPE_REALTIME -> {
                String type = String.valueOf(payload.getOrDefault("type", "EVENT"));
                String channel = String.valueOf(payload.getOrDefault("channel", event.getChannel()));
                String businessId = String.valueOf(payload.getOrDefault("businessId", event.getBusinessId()));
                Object body = payload.get("payload");
                realtimeEventPublisher.publishDirect(channel, type, blankToNull(businessId), body);
            }
            case OutboxService.TYPE_PAYMENT_PAID -> {
                String paymentIntentId = String.valueOf(payload.get("paymentIntentId"));
                PaymentIntent intent = paymentIntentService.requireIntent(paymentIntentId);
                paymentIntentService.applyPaidSideEffects(intent);
            }
            case OutboxService.TYPE_RECEIPT -> {
                String orderId = String.valueOf(payload.get("orderId"));
                orderService.generateReceiptForOrderId(orderId);
            }
            case OutboxService.TYPE_AUDIT -> {
                auditService.success(
                        String.valueOf(payload.getOrDefault("action", "EVENT")),
                        String.valueOf(payload.getOrDefault("resourceType", "")),
                        String.valueOf(payload.getOrDefault("resourceId", "")),
                        castDetails(payload.get("details"))
                );
            }
            case OutboxService.TYPE_WHATSAPP -> {
                String to = String.valueOf(payload.getOrDefault("to", ""));
                String message = String.valueOf(payload.getOrDefault("message", ""));
                whatsAppNotificationService.sendText(to, message);
            }
            default -> log.debug("Unknown outbox type {}", event.getEventType());
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> castDetails(Object details) {
        if (details instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        return Map.of();
    }

    private static String blankToNull(String value) {
        if (value == null || value.isBlank() || "null".equals(value)) {
            return null;
        }
        return value;
    }
}
