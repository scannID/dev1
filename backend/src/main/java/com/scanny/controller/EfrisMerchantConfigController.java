package com.scanny.controller;

import com.scanny.efris.EfrisMerchantConfigService;
import com.scanny.efris.EfrisMerchantConfigService.EfrisConfigResponse;
import com.scanny.efris.EfrisMerchantConfigService.UpsertEfrisConfigRequest;
import com.scanny.security.MerchantAccessService;
import com.scanny.service.AuditService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * Merchant-facing REST endpoints for managing EFRIS credentials.
 *
 * <pre>
 * GET  /api/auth/merchant/efris-config          — read current config (key masked)
 * PUT  /api/auth/merchant/efris-config          — create or update config
 * </pre>
 *
 * <p>Both endpoints follow the same {@code ?merchantId=} pattern used across
 * {@link MerchantAuthController}: omit the query param to act on the JWT's
 * own merchant; supply it to act on a specific merchant (admin or self only).
 */
@RestController
@RequestMapping("/api/auth/merchant/efris-config")
public class EfrisMerchantConfigController {

    private final EfrisMerchantConfigService efrisConfigService;
    private final MerchantAccessService      merchantAccessService;
    private final AuditService               auditService;

    public EfrisMerchantConfigController(
            EfrisMerchantConfigService efrisConfigService,
            MerchantAccessService merchantAccessService,
            AuditService auditService
    ) {
        this.efrisConfigService   = efrisConfigService;
        this.merchantAccessService = merchantAccessService;
        this.auditService         = auditService;
    }

    /**
     * Returns the merchant's EFRIS configuration.
     *
     * <p>The {@code deviceKey} field is always returned as {@code "••••••••"} —
     * the raw AES key is never echoed back after initial storage.
     */
    @GetMapping
    public ResponseEntity<EfrisConfigResponse> getConfig(
            @RequestParam(required = false) UUID merchantId
    ) {
        String id = resolveMerchantId(merchantId);
        return ResponseEntity.ok(efrisConfigService.getConfig(id));
    }

    /**
     * Creates or updates the merchant's EFRIS credentials.
     *
     * <p>Partial updates are supported — only non-null fields in the request body
     * are written; omitted fields retain their current values. To activate EFRIS
     * for the merchant, include {@code "enabled": true} together with all three
     * required credential fields ({@code tin}, {@code deviceNumber},
     * {@code deviceKey}).
     */
    @PutMapping
    public ResponseEntity<EfrisConfigResponse> upsertConfig(
            @RequestParam(required = false) UUID merchantId,
            @RequestBody UpsertEfrisConfigRequest request
    ) {
        String id = resolveMerchantId(merchantId);
        EfrisConfigResponse response = efrisConfigService.upsertConfig(id, request);
        auditService.success(
                "EFRIS_CONFIG_UPDATE", "merchant", id,
                Map.of("enabled", response.enabled(), "tin", response.tin())
        );
        return ResponseEntity.ok(response);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String resolveMerchantId(UUID merchantId) {
        if (merchantId == null) {
            return merchantAccessService.requireCurrentMerchant().getId().toString();
        }
        return merchantAccessService.requireMerchantById(merchantId).getId().toString();
    }
}
