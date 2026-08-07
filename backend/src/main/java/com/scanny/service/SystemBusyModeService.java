package com.scanny.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.scanny.entity.PlatformConfig;
import com.scanny.repository.PlatformConfigRepository;
import com.scanny.websocket.RealtimeEventPublisher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * System-wide busy mode.
 *
 * When active, ALL inbound activity is blocked regardless of per-business settings:
 *  - Restaurant / hotel orders (OrderService)
 *  - Ticket purchases (TicketPurchaseService)
 *
 * State is stored in platform_configs under the key "system" so it survives restarts.
 */
@Service
public class SystemBusyModeService {

    public static final String SECTION = "system";
    public static final String KEY_BUSY = "busyMode";
    public static final String KEY_MESSAGE = "pauseMessage";
    public static final String DEFAULT_MESSAGE =
            "The platform is temporarily paused. Please try again shortly.";

    private static final Logger log = LoggerFactory.getLogger(SystemBusyModeService.class);

    private final PlatformConfigRepository platformConfigRepository;
    private final ObjectMapper objectMapper;
    private final RealtimeEventPublisher realtimeEventPublisher;

    public SystemBusyModeService(
            PlatformConfigRepository platformConfigRepository,
            ObjectMapper objectMapper,
            RealtimeEventPublisher realtimeEventPublisher) {
        this.platformConfigRepository = platformConfigRepository;
        this.objectMapper = objectMapper;
        this.realtimeEventPublisher = realtimeEventPublisher;
    }

    /** Fast read — called on every order/ticket request. */
    @Transactional(readOnly = true)
    public boolean isSystemBusy() {
        return readConfig().busyMode();
    }

    @Transactional(readOnly = true)
    public String getPauseMessage() {
        SystemConfig cfg = readConfig();
        String msg = cfg.pauseMessage();
        return (msg == null || msg.isBlank()) ? DEFAULT_MESSAGE : msg;
    }

    @Transactional
    public SystemConfig enable(String message) {
        SystemConfig cfg = new SystemConfig(true, message == null || message.isBlank() ? DEFAULT_MESSAGE : message.trim());
        persist(cfg);
        publishStatusEvent(true);
        log.warn("SYSTEM BUSY MODE ENABLED — all orders and ticket purchases are blocked");
        return cfg;
    }

    @Transactional
    public SystemConfig disable() {
        SystemConfig cfg = new SystemConfig(false, "");
        persist(cfg);
        publishStatusEvent(false);
        log.info("System busy mode disabled — normal operation resumed");
        return cfg;
    }

    @Transactional(readOnly = true)
    public SystemConfig readConfig() {
        PlatformConfig stored = platformConfigRepository.findById(SECTION).orElse(null);
        if (stored == null || stored.getPayload() == null) {
            return new SystemConfig(false, "");
        }
        try {
            Map<String, Object> map = objectMapper.readValue(stored.getPayload(), new TypeReference<>() {});
            boolean busy = Boolean.TRUE.equals(map.get(KEY_BUSY));
            String msg = map.get(KEY_MESSAGE) instanceof String s ? s : "";
            return new SystemConfig(busy, msg);
        } catch (Exception ex) {
            log.warn("Could not parse system config payload", ex);
            return new SystemConfig(false, "");
        }
    }

    private void persist(SystemConfig cfg) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put(KEY_BUSY, cfg.busyMode());
        payload.put(KEY_MESSAGE, cfg.pauseMessage());

        PlatformConfig entity = platformConfigRepository.findById(SECTION).orElseGet(PlatformConfig::new);
        entity.setSection(SECTION);
        try {
            entity.setPayload(objectMapper.writeValueAsString(payload));
        } catch (Exception ex) {
            throw new RuntimeException("Failed to serialize system config", ex);
        }
        entity.setUpdatedBy("admin");
        platformConfigRepository.save(entity);
    }

    private void publishStatusEvent(boolean busy) {
        try {
            realtimeEventPublisher.publish(
                    "system:status",
                    "SYSTEM_BUSY_MODE_CHANGED",
                    null,
                    Map.of("busyMode", busy)
            );
        } catch (Exception ex) {
            log.warn("Failed to publish system busy mode event", ex);
        }
    }

    public record SystemConfig(boolean busyMode, String pauseMessage) {}
}
