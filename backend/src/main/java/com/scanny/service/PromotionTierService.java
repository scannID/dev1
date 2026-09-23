package com.scanny.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.scanny.entity.PlatformConfig;
import com.scanny.repository.PlatformConfigRepository;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reads promotion tier configuration from the 'ticketing' platform_configs row.
 *
 * Three tiers:
 *   LOCAL — 5 km radius        — promoTierLocalFee  (default 40,000 UGX)
 *   CITY  — 20 km radius       — promoTierCityFee   (default 80,000 UGX)
 *   BOOST — all restaurants    — promoTierBoostFee  (default 150,000 UGX)
 *
 * All values are admin-configurable via the 'ticketing' config section.
 */
@Service
public class PromotionTierService {

    private static final Logger log = LoggerFactory.getLogger(PromotionTierService.class);
    private static final String SECTION = "ticketing";

    // Tier identifiers
    public static final String TIER_LOCAL = "LOCAL";
    public static final String TIER_CITY  = "CITY";
    public static final String TIER_BOOST = "BOOST";

    // Default fees in UGX (mirrors AdminConfigService DEFAULTS)
    private static final int DEFAULT_LOCAL_FEE  = 40_000;
    private static final int DEFAULT_CITY_FEE   = 80_000;
    private static final int DEFAULT_BOOST_FEE  = 150_000;

    // Default radii in km (0 = no cap)
    private static final int DEFAULT_LOCAL_RADIUS = 5;
    private static final int DEFAULT_CITY_RADIUS  = 20;
    private static final int DEFAULT_BOOST_RADIUS = 0;

    private static final int DEFAULT_MAX_ACTIVE   = 10;
    private static final int DEFAULT_MAX_DAYS     = 30;

    private final PlatformConfigRepository platformConfigRepository;
    private final ObjectMapper objectMapper;

    public PromotionTierService(
            PlatformConfigRepository platformConfigRepository,
            ObjectMapper objectMapper) {
        this.platformConfigRepository = platformConfigRepository;
        this.objectMapper = objectMapper;
    }

    public record TierDefinition(
        String id,          // LOCAL | CITY | BOOST
        String label,       // "5 km", "20 km", "Boost"
        String description, // short text for UI
        int radiusKm,       // 0 = unlimited
        int fee,
        String currency
    ) {}

    public record TicketingConfig(
        int localFee, int cityFee, int boostFee,
        int localRadius, int cityRadius, int boostRadius,
        int maxActivePerPhone, int maxDays
    ) {}

    // ── Public API ────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public java.util.List<TierDefinition> getTiers() {
        TicketingConfig cfg = readConfig();
        return java.util.List.of(
            new TierDefinition(TIER_LOCAL, "5 km",  "Reaches restaurants within 5 km of your venue", cfg.localRadius(), cfg.localFee(), "UGX"),
            new TierDefinition(TIER_CITY,  "20 km", "Reaches restaurants within 20 km of your venue", cfg.cityRadius(), cfg.cityFee(), "UGX"),
            new TierDefinition(TIER_BOOST, "Boost", "Pushed to all restaurants on the platform",      cfg.boostRadius(), cfg.boostFee(), "UGX")
        );
    }

    @Transactional(readOnly = true)
    public int getFeeForTier(String tier) {
        TicketingConfig cfg = readConfig();
        return switch (normalizeTier(tier)) {
            case TIER_CITY  -> cfg.cityFee();
            case TIER_BOOST -> cfg.boostFee();
            default         -> cfg.localFee();  // LOCAL is default
        };
    }

    @Transactional(readOnly = true)
    public int getRadiusForTier(String tier) {
        TicketingConfig cfg = readConfig();
        return switch (normalizeTier(tier)) {
            case TIER_CITY  -> cfg.cityRadius();
            case TIER_BOOST -> cfg.boostRadius();
            default         -> cfg.localRadius();
        };
    }

    @Transactional(readOnly = true)
    public int getMaxActivePerPhone() {
        return readConfig().maxActivePerPhone();
    }

    @Transactional(readOnly = true)
    public int getMaxDays() {
        return readConfig().maxDays();
    }

    public static String normalizeTier(String tier) {
        if (tier == null) return TIER_LOCAL;
        return switch (tier.trim().toUpperCase()) {
            case TIER_CITY  -> TIER_CITY;
            case TIER_BOOST -> TIER_BOOST;
            default         -> TIER_LOCAL;
        };
    }

    // ── Internal config reader ────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public TicketingConfig readConfig() {
        PlatformConfig stored = platformConfigRepository.findById(SECTION).orElse(null);
        if (stored == null || stored.getPayload() == null) {
            return defaults();
        }
        try {
            Map<String, Object> map = objectMapper.readValue(stored.getPayload(), new TypeReference<>() {});
            return new TicketingConfig(
                intVal(map, "promoTierLocalFee",   DEFAULT_LOCAL_FEE),
                intVal(map, "promoTierCityFee",    DEFAULT_CITY_FEE),
                intVal(map, "promoTierBoostFee",   DEFAULT_BOOST_FEE),
                intVal(map, "promoTierLocalRadius", DEFAULT_LOCAL_RADIUS),
                intVal(map, "promoTierCityRadius",  DEFAULT_CITY_RADIUS),
                intVal(map, "promoTierBoostRadius", DEFAULT_BOOST_RADIUS),
                intVal(map, "promoMaxActivePerPhone", DEFAULT_MAX_ACTIVE),
                intVal(map, "promoMaxDays",          DEFAULT_MAX_DAYS)
            );
        } catch (Exception ex) {
            log.warn("Could not parse ticketing config, using defaults: {}", ex.getMessage());
            return defaults();
        }
    }

    private static TicketingConfig defaults() {
        return new TicketingConfig(
            DEFAULT_LOCAL_FEE, DEFAULT_CITY_FEE, DEFAULT_BOOST_FEE,
            DEFAULT_LOCAL_RADIUS, DEFAULT_CITY_RADIUS, DEFAULT_BOOST_RADIUS,
            DEFAULT_MAX_ACTIVE, DEFAULT_MAX_DAYS
        );
    }

    private static int intVal(Map<String, Object> map, String key, int def) {
        Object v = map.get(key);
        if (v instanceof Number n) return n.intValue();
        if (v instanceof String s) {
            try { return Integer.parseInt(s.trim()); } catch (NumberFormatException ignored) {}
        }
        return def;
    }
}
