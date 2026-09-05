package com.scanny.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Component
public class RealtimeEventPublisher {

    public static final String CHANNEL = "scanny:realtime";

    private static final Logger log = LoggerFactory.getLogger(RealtimeEventPublisher.class);

    private final ObjectMapper objectMapper;
    private final StringRedisTemplate redisTemplate;
    private final RealtimeWebSocketHandler webSocketHandler;
    private final RedisMessageListenerContainer listenerContainer;

    public RealtimeEventPublisher(
            ObjectMapper objectMapper,
            ObjectProvider<StringRedisTemplate> redisTemplateProvider,
            RealtimeWebSocketHandler webSocketHandler,
            ObjectProvider<RedisMessageListenerContainer> listenerContainerProvider
    ) {
        this.objectMapper = objectMapper;
        this.redisTemplate = redisTemplateProvider.getIfAvailable();
        this.webSocketHandler = webSocketHandler;
        this.listenerContainer = listenerContainerProvider.getIfAvailable();
    }

    @PostConstruct
    public void subscribe() {
        if (listenerContainer == null || redisTemplate == null) {
            return;
        }
        listenerContainer.addMessageListener((message, pattern) -> {
            try {
                String payload = new String(message.getBody());
                webSocketHandler.fanOutLocal(payload);
            } catch (Exception ex) {
                log.debug("Failed to fan-out realtime redis message", ex);
            }
        }, new ChannelTopic(CHANNEL));
    }

    public void publishOrderEvent(String businessId, String type, Object payload) {
        publish("orders:" + businessId, type, businessId, payload);
    }

    public void publishCatalogEvent(String businessId, String type, Object payload) {
        publish("catalog:" + businessId, type, businessId, payload);
    }

    public void publishTicketStats(Object payload) {
        publish("tickets:stats", "TICKET_STATS_UPDATED", null, payload);
    }

    public void publishAdminMetrics(String type, Object payload) {
        publish("admin:metrics", type, null, payload);
    }

    public void publishFloorEvent(String businessId, String type, Object payload) {
        publish("floor:" + businessId, type, businessId, payload);
    }

    /**
     * Publish once: Redis when available (all replicas fan out via listener),
     * otherwise local fan-out only. Avoids double delivery on the publishing instance.
     */
    public void publish(String channel, String type, String businessId, Object payload) {
        publishDirect(channel, type, businessId, payload);
    }

    public void publishDirect(String channel, String type, String businessId, Object payload) {
        try {
            Map<String, Object> envelope = new java.util.LinkedHashMap<>();
            envelope.put("type", type);
            envelope.put("channel", channel);
            envelope.put("businessId", businessId != null ? businessId : "");
            envelope.put("version", Instant.now().toEpochMilli());
            envelope.put("occurredAt", Instant.now().toString());
            envelope.put("eventId", UUID.randomUUID().toString());
            envelope.put("payload", payload != null ? payload : java.util.Collections.emptyMap());
            String json = objectMapper.writeValueAsString(envelope);
            if (redisTemplate != null) {
                try {
                    redisTemplate.convertAndSend(CHANNEL, json);
                    return;
                } catch (Exception ex) {
                    log.debug("Redis pub/sub unavailable; local fan-out only", ex);
                }
            }
            webSocketHandler.fanOutLocal(json);
        } catch (Exception ex) {
            log.warn("Failed to publish realtime event type={}", type, ex);
        }
    }
}
