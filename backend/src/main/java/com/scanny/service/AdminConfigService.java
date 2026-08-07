package com.scanny.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.scanny.dto.admin.AdminConfigDtos;
import com.scanny.entity.PlatformConfig;
import com.scanny.exception.ApiException;
import com.scanny.repository.BusinessRepository;
import com.scanny.repository.OrderRepository;
import com.scanny.repository.PlatformConfigRepository;
import com.scanny.repository.QrScanEventRepository;
import com.scanny.repository.TicketScanRepository;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class AdminConfigService {

    public static final Set<String> SECTIONS = Set.of(
        "platform", "auth", "payments", "orders", "qr", "notifications", "features"
    );

    // injected below — field declared ahead of DEFAULTS to keep constructor tidy
    private final SystemBusyModeService systemBusyModeService;

    private static final Map<String, Map<String, Object>> DEFAULTS = Map.of(
        "platform", Map.of(
            "platformName", "Scanny",
            "supportEmail", "support@scanny.app",
            "qrScanBaseUrl", "http://localhost:5173/b",
            "merchantPortalUrl", "http://localhost:5173"
        ),
        "auth", Map.of(
            "keycloakUrl", "http://localhost:8080",
            "realm", "scanny",
            "merchantClientId", "scanny-client",
            "adminClientId", "scanny-admin"
        ),
        "payments", Map.of(
            "defaultCurrency", "UGX",
            "minOrderAmount", 1000,
            "maxOrderAmount", 5000000,
            "paymentGatewayUrl", "https://payments.scanny.app"
        ),
        "orders", Map.of(
            "orderTimeoutMinutes", 30,
            "maxItemsPerOrder", 20,
            "autoCompleteAfterHours", 2,
            "orderIdPrefix", "ORD-"
        ),
        "qr", Map.of(
            "qrTokenPrefix", "SIT-",
            "qrCodeSizePx", 220,
            "scanRateLimitPerMin", 60,
            "trackScanLocation", false
        ),
        "notifications", Map.of(
            "orderSmsAlerts", true,
            "paymentConfirmationEmail", true,
            "systemAlertEmails", true,
            "smsGatewayUrl", "https://sms.scanny.app"
        ),
        "features", Map.of(
            "merchantSelfRegistration", true,
            "customerAccounts", true,
            "mobileMoneyPayments", true,
            "cardPayments", true,
            "qrScanAnalytics", true,
            "multiBusinessMerchants", false,
            "customerOrderHistory", true,
            "maintenanceMode", false
        )
    );

    private final PlatformConfigRepository platformConfigRepository;
    private final BusinessRepository businessRepository;
    private final OrderRepository orderRepository;
    private final TicketScanRepository ticketScanRepository;
    private final QrScanEventRepository qrScanEventRepository;
    private final ObjectMapper objectMapper;
    private final AuditService auditService;

    public AdminConfigService(
        PlatformConfigRepository platformConfigRepository,
        BusinessRepository businessRepository,
        OrderRepository orderRepository,
        TicketScanRepository ticketScanRepository,
        QrScanEventRepository qrScanEventRepository,
        ObjectMapper objectMapper,
        AuditService auditService,
        @Lazy SystemBusyModeService systemBusyModeService
    ) {
        this.platformConfigRepository = platformConfigRepository;
        this.businessRepository = businessRepository;
        this.orderRepository = orderRepository;
        this.ticketScanRepository = ticketScanRepository;
        this.qrScanEventRepository = qrScanEventRepository;
        this.objectMapper = objectMapper;
        this.auditService = auditService;
        this.systemBusyModeService = systemBusyModeService;
    }

    @Transactional(readOnly = true)
    public AdminConfigDtos.AllConfigsResponse getAllConfigs() {
        Map<String, Map<String, Object>> configs = new LinkedHashMap<>();
        for (String section : SECTIONS) {
            configs.put(section, getSectionConfig(section).config());
        }
        return new AdminConfigDtos.AllConfigsResponse(configs);
    }

    @Transactional(readOnly = true)
    public AdminConfigDtos.ConfigSectionResponse getSectionConfig(String section) {
        String key = normalizeSection(section);
        PlatformConfig stored = platformConfigRepository.findById(key).orElse(null);
        if (stored == null) {
            return new AdminConfigDtos.ConfigSectionResponse(key, new LinkedHashMap<>(DEFAULTS.get(key)), null, null);
        }
        return new AdminConfigDtos.ConfigSectionResponse(
            key,
            parsePayload(stored.getPayload(), key),
            stored.getUpdatedAt() != null ? stored.getUpdatedAt().toString() : null,
            stored.getUpdatedBy()
        );
    }

    @Transactional
    public AdminConfigDtos.ConfigSectionResponse updateSection(String section, Map<String, Object> config, String updatedBy) {
        String key = normalizeSection(section);
        if (config == null || config.isEmpty()) {
            throw new ApiException(400, "Config payload is required.");
        }

        Map<String, Object> merged = new LinkedHashMap<>(DEFAULTS.get(key));
        merged.putAll(config);

        PlatformConfig entity = platformConfigRepository.findById(key).orElseGet(PlatformConfig::new);
        entity.setSection(key);
        entity.setPayload(writePayload(merged));
        entity.setUpdatedBy(updatedBy);
        platformConfigRepository.save(entity);
        auditService.success(
            "ADMIN_CONFIG_UPDATE",
            "config",
            key,
            Map.of("updatedBy", updatedBy != null ? updatedBy : "")
        );
        return getSectionConfig(key);
    }

    @Transactional
    public AdminConfigDtos.ActionResult runAction(String action) {
        AdminConfigDtos.ActionResult result = switch (action) {
            case "purge-test-data" -> purgeTestData();
            case "clear-qr-scan-logs" -> clearQrScanLogs();
            case "revoke-all-sessions" -> new AdminConfigDtos.ActionResult(
                true,
                action,
                "Session revoke requested. Configure Keycloak admin client to force logout in production.",
                Map.of("note", "noop-dev")
            );
            case "reset-platform" -> resetPlatform();
            case "enable-system-busy" -> enableSystemBusy(null);
            case "disable-system-busy" -> disableSystemBusy();
            default -> throw new ApiException(400, "Unknown action: " + action);
        };
        auditService.success("ADMIN_CONFIG_ACTION", "config_action", action, Map.of("success", result.success()));
        return result;
    }

    /** Enable system busy mode with an optional custom message. */
    @Transactional
    public AdminConfigDtos.ActionResult enableSystemBusy(String message) {
        SystemBusyModeService.SystemConfig cfg = systemBusyModeService.enable(message);
        return new AdminConfigDtos.ActionResult(
            true,
            "enable-system-busy",
            "System busy mode enabled. All orders and ticket purchases are blocked.",
            Map.of("busyMode", cfg.busyMode(), "pauseMessage", cfg.pauseMessage())
        );
    }

    /** Disable system busy mode and restore normal operation. */
    @Transactional
    public AdminConfigDtos.ActionResult disableSystemBusy() {
        systemBusyModeService.disable();
        return new AdminConfigDtos.ActionResult(
            true,
            "disable-system-busy",
            "System busy mode disabled. Normal operation resumed.",
            Map.of("busyMode", false)
        );
    }

    /** Current system busy status — used by the admin UI to show live state. */
    @Transactional(readOnly = true)
    public AdminConfigDtos.ActionResult getSystemBusyStatus() {
        SystemBusyModeService.SystemConfig cfg = systemBusyModeService.readConfig();
        return new AdminConfigDtos.ActionResult(
            true,
            "get-system-busy-status",
            cfg.busyMode() ? "System is currently in busy mode." : "System is operating normally.",
            Map.of("busyMode", cfg.busyMode(), "pauseMessage", cfg.pauseMessage())
        );
    }

    private AdminConfigDtos.ActionResult purgeTestData() {
        List<String> seedBusinessIds = List.of("kampala-grill", "city-lounge");
        long deletedOrders = 0;
        long deletedBusinesses = 0;

        for (String id : seedBusinessIds) {
            if (businessRepository.existsById(id)) {
                deletedOrders += orderRepository.findByBusinessIdOrderByCreatedAtDesc(id).size();
                businessRepository.deleteById(id);
                deletedBusinesses++;
            }
        }

        Map<String, Object> details = new HashMap<>();
        details.put("deletedBusinesses", deletedBusinesses);
        details.put("deletedOrdersApprox", deletedOrders);
        return new AdminConfigDtos.ActionResult(true, "purge-test-data", "Seed/test merchants purged.", details);
    }

    private AdminConfigDtos.ActionResult clearQrScanLogs() {
        long ticketCount = ticketScanRepository.count();
        long menuCount = qrScanEventRepository.count();
        ticketScanRepository.deleteAll();
        qrScanEventRepository.deleteAll();
        return new AdminConfigDtos.ActionResult(
            true,
            "clear-qr-scan-logs",
            "QR scan logs cleared.",
            Map.of("deletedTicketScans", ticketCount, "deletedMenuScans", menuCount)
        );
    }

    private AdminConfigDtos.ActionResult resetPlatform() {
        // Restore defaults without wiping live merchant data.
        for (String section : SECTIONS) {
            PlatformConfig entity = platformConfigRepository.findById(section).orElseGet(PlatformConfig::new);
            entity.setSection(section);
            entity.setPayload(writePayload(DEFAULTS.get(section)));
            entity.setUpdatedBy("system-reset");
            platformConfigRepository.save(entity);
        }
        return new AdminConfigDtos.ActionResult(
            true,
            "reset-platform",
            "Platform config restored to factory defaults. Business data was not wiped.",
            Map.of("sectionsReset", SECTIONS.size())
        );
    }

    private String normalizeSection(String section) {
        if (section == null || section.isBlank()) {
            throw new ApiException(400, "Section is required.");
        }
        String key = section.trim().toLowerCase();
        if ("notif".equals(key)) {
            key = "notifications";
        }
        if (!SECTIONS.contains(key)) {
            throw new ApiException(404, "Unknown config section: " + section);
        }
        return key;
    }

    private Map<String, Object> parsePayload(String payload, String section) {
        try {
            Map<String, Object> parsed = objectMapper.readValue(payload, new TypeReference<>() {});
            Map<String, Object> merged = new LinkedHashMap<>(DEFAULTS.get(section));
            merged.putAll(parsed);
            return merged;
        } catch (Exception e) {
            return new LinkedHashMap<>(DEFAULTS.get(section));
        }
    }

    private String writePayload(Map<String, Object> config) {
        try {
            return objectMapper.writeValueAsString(config);
        } catch (Exception e) {
            throw new ApiException(500, "Failed to serialize config payload.");
        }
    }
}
