package com.scanny.efris;

import com.scanny.exception.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * CRUD service for {@link EfrisMerchantConfig}.
 *
 * <p>Operations are intentionally coarse-grained (GET + upsert) because the
 * number of fields is small and the data is written infrequently (usually once
 * when onboarding to EFRIS, then updated only if URA reissues credentials).
 *
 * <p>Security: all callers must have already verified that the requesting
 * merchant is allowed to access {@code merchantId} via {@link
 * com.scanny.security.MerchantAccessService#requireMerchantById(java.util.UUID)}.
 */
@Service
public class EfrisMerchantConfigService {

    private static final Logger log = LoggerFactory.getLogger(EfrisMerchantConfigService.class);

    private final EfrisMerchantConfigRepository configRepository;

    public EfrisMerchantConfigService(EfrisMerchantConfigRepository configRepository) {
        this.configRepository = configRepository;
    }

    // ── DTOs ──────────────────────────────────────────────────────────────────

    /**
     * Response body for GET /api/auth/merchant/efris-config.
     *
     * <p>The {@code deviceKey} field is intentionally masked — the raw AES key
     * is never returned to the client once stored.
     */
    public record EfrisConfigResponse(
            String  merchantId,
            String  tin,
            String  deviceNumber,
            /** Always {@code "••••••••"} — key is write-only after initial save. */
            String  deviceKey,
            String  legalName,
            String  registeredAddress,
            boolean enabled
    ) {}

    /**
     * Request body for PUT /api/auth/merchant/efris-config.
     *
     * <p>All fields are optional on update — absent/null values leave the
     * existing value unchanged. To enable the integration, send {@code "enabled": true}
     * along with all required credential fields.
     */
    public record UpsertEfrisConfigRequest(
            String  tin,
            String  deviceNumber,
            /**
             * Raw AES-256 key Base64-encoded (44 chars for a 32-byte key).
             * Send null to leave an existing key unchanged.
             */
            String  deviceKey,
            String  legalName,
            String  registeredAddress,
            Boolean enabled
    ) {}

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Returns the EFRIS config for {@code merchantId}, or a zeroed-out response
     * if no row exists yet (so the frontend can display an empty form).
     */
    @Transactional(readOnly = true)
    public EfrisConfigResponse getConfig(String merchantId) {
        return configRepository.findById(merchantId)
                .map(this::toResponse)
                .orElseGet(() -> new EfrisConfigResponse(merchantId, "", "", "", "", "", false));
    }

    /**
     * Creates or updates the EFRIS config for {@code merchantId}.
     *
     * <p>Enforces that {@code tin}, {@code deviceNumber}, and {@code deviceKey}
     * are all non-blank before {@code enabled} can be set to {@code true}.
     *
     * @throws ApiException 400 if trying to enable without the required credentials
     */
    @Transactional
    public EfrisConfigResponse upsertConfig(String merchantId, UpsertEfrisConfigRequest request) {
        EfrisMerchantConfig config = configRepository.findById(merchantId)
                .orElseGet(() -> {
                    EfrisMerchantConfig c = new EfrisMerchantConfig();
                    c.setMerchantId(merchantId);
                    return c;
                });

        // Apply non-null fields from the request
        if (request.tin()               != null) config.setTin(request.tin());
        if (request.deviceNumber()      != null) config.setDeviceNumber(request.deviceNumber());
        if (request.deviceKey()         != null) config.setDeviceKey(request.deviceKey());
        if (request.legalName()         != null) config.setLegalName(request.legalName());
        if (request.registeredAddress() != null) config.setRegisteredAddress(request.registeredAddress());

        // Validate before enabling
        if (Boolean.TRUE.equals(request.enabled())) {
            if (isBlank(config.getTin())) {
                throw new ApiException(400, "TIN is required to enable EFRIS.");
            }
            if (isBlank(config.getDeviceNumber())) {
                throw new ApiException(400, "Device number is required to enable EFRIS.");
            }
            if (isBlank(config.getDeviceKey())) {
                throw new ApiException(400, "Device key is required to enable EFRIS.");
            }
            config.setEnabled(true);
        } else if (Boolean.FALSE.equals(request.enabled())) {
            config.setEnabled(false);
        }

        config.setUpdatedAt(Instant.now());
        EfrisMerchantConfig saved = configRepository.save(config);
        log.info("EfrisMerchantConfigService: config upserted for merchant {} (enabled={})",
                merchantId, saved.isEnabled());
        return toResponse(saved);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private EfrisConfigResponse toResponse(EfrisMerchantConfig c) {
        return new EfrisConfigResponse(
                c.getMerchantId(),
                c.getTin()               != null ? c.getTin()               : "",
                c.getDeviceNumber()      != null ? c.getDeviceNumber()      : "",
                isBlank(c.getDeviceKey()) ? "" : "••••••••",   // never expose the raw key
                c.getLegalName()         != null ? c.getLegalName()         : "",
                c.getRegisteredAddress() != null ? c.getRegisteredAddress() : "",
                c.isEnabled()
        );
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
