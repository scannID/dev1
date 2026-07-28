package com.scanny.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.scanny.entity.OutboxEvent;
import com.scanny.repository.OutboxEventRepository;
import java.time.Instant;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OutboxService {

    public static final String TYPE_REALTIME = "REALTIME";
    public static final String TYPE_PAYMENT_PAID = "PAYMENT_PAID";
    public static final String TYPE_RECEIPT = "RECEIPT";
    public static final String TYPE_AUDIT = "AUDIT";
    public static final String TYPE_WHATSAPP = "WHATSAPP";

    private static final Logger log = LoggerFactory.getLogger(OutboxService.class);

    private final OutboxEventRepository outboxEventRepository;
    private final ObjectMapper objectMapper;

    public OutboxService(OutboxEventRepository outboxEventRepository, ObjectMapper objectMapper) {
        this.outboxEventRepository = outboxEventRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public void enqueueRealtime(String channel, String type, String businessId, Object payload) {
        enqueue(TYPE_REALTIME, channel, businessId, Map.of(
                "type", type,
                "channel", channel != null ? channel : "",
                "businessId", businessId != null ? businessId : "",
                "payload", payload
        ));
    }

    @Transactional
    public void enqueuePaymentPaid(String paymentIntentId) {
        enqueue(TYPE_PAYMENT_PAID, "", "", Map.of("paymentIntentId", paymentIntentId));
    }

    @Transactional
    public void enqueueReceipt(String orderId) {
        enqueue(TYPE_RECEIPT, "", "", Map.of("orderId", orderId));
    }

    @Transactional
    public void enqueueAudit(String action, String resourceType, String resourceId, Map<String, ?> details) {
        enqueue(TYPE_AUDIT, "", resourceId != null ? resourceId : "", Map.of(
                "action", action,
                "resourceType", resourceType != null ? resourceType : "",
                "resourceId", resourceId != null ? resourceId : "",
                "details", details != null ? details : Map.of()
        ));
    }

    @Transactional
    public void enqueueWhatsapp(String toPhone, String message) {
        enqueue(TYPE_WHATSAPP, toPhone != null ? toPhone : "", "", Map.of(
                "to", toPhone != null ? toPhone : "",
                "message", message != null ? message : ""
        ));
    }

    @Transactional
    public void enqueueOrderStatusWhatsapp(String orderId, String toPhone, String businessName, String status) {
        enqueue(TYPE_WHATSAPP, toPhone != null ? toPhone : "", orderId != null ? orderId : "", Map.of(
                "to", toPhone != null ? toPhone : "",
                "message", businessName + ": your order " + orderId + " is now " + status + ".",
                "orderId", orderId != null ? orderId : "",
                "businessName", businessName != null ? businessName : "",
                "status", status != null ? status : ""
        ));
    }

    @Transactional
    public void enqueue(String eventType, String channel, String businessId, Object payload) {
        OutboxEvent event = new OutboxEvent();
        event.setEventType(eventType);
        event.setChannel(channel != null ? channel : "");
        event.setBusinessId(businessId != null ? businessId : "");
        event.setPayloadJson(writeJson(payload));
        event.setCreatedAt(Instant.now());
        outboxEventRepository.save(event);
    }

    private String writeJson(Object payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize outbox payload", e);
            return "{}";
        }
    }
}
