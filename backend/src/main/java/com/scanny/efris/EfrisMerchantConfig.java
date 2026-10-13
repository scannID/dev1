package com.scanny.efris;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Per-merchant EFRIS credentials stored by the platform admin.
 *
 * <h3>Fields</h3>
 * <ul>
 *   <li>{@code merchantId} — FK to merchants.id (String UUID), used as PK here.</li>
 *   <li>{@code tin} — Uganda Revenue Authority Taxpayer Identification Number.</li>
 *   <li>{@code deviceNumber} — the EFRIS device number URA issues to the business.</li>
 *   <li>{@code deviceKey} — AES-256 symmetric key issued by URA for this device,
 *       stored Base64-encoded. In production this should be encrypted at rest
 *       (e.g. via Vault or a KMS-backed column-level encryption). For the MVP it
 *       is stored plaintext so the pipeline can be exercised immediately.</li>
 *   <li>{@code enabled} — per-merchant toggle; even when {@code scanny.efris.enabled=true}
 *       globally, a merchant whose config has {@code enabled=false} is silently skipped.</li>
 * </ul>
 *
 * <h3>Stub mode</h3>
 * <p>When {@link EfrisProperties#isEnabled()} is {@code false} OR when no config
 * row exists for a merchant, {@link EfrisApiClient} returns a fake FDN without
 * calling URA. Persisting this entity is therefore only required before going live.
 */
@Entity
@Table(
    name = "efris_merchant_configs",
    indexes = {
        @Index(name = "idx_efris_cfg_merchant", columnList = "merchant_id", unique = true)
    }
)
public class EfrisMerchantConfig {

    /** Same value as merchants.id — no FK constraint to avoid coupling migrations. */
    @Id
    @Column(name = "merchant_id", nullable = false, updatable = false, length = 64)
    private String merchantId;

    /** URA Taxpayer Identification Number, e.g. "1000012345". */
    @Column(name = "tin", nullable = false, length = 20)
    private String tin;

    /** EFRIS device number issued by URA, e.g. "EFD12345". */
    @Column(name = "device_number", nullable = false, length = 50)
    private String deviceNumber;

    /**
     * AES-256 symmetric key issued by URA for this device, stored Base64-encoded.
     * 32 bytes → 44 Base64 chars.
     * TODO: encrypt at rest before production deployment.
     */
    @Column(name = "device_key", nullable = false, length = 256)
    private String deviceKey;

    /** Legal business name as registered with URA (appears on fiscal receipts). */
    @Column(name = "legal_name", length = 200)
    private String legalName;

    /** Physical address as registered with URA. */
    @Column(name = "registered_address", length = 500)
    private String registeredAddress;

    /** When false this merchant's orders are skipped by the EFRIS pipeline. */
    @Column(name = "enabled", nullable = false)
    private boolean enabled = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt = Instant.now();

    // ── Getters / setters ─────────────────────────────────────────────────────

    public String getMerchantId()                          { return merchantId; }
    public void setMerchantId(String merchantId)           { this.merchantId = merchantId; }

    public String getTin()                                 { return tin; }
    public void setTin(String tin)                         { this.tin = tin; }

    public String getDeviceNumber()                        { return deviceNumber; }
    public void setDeviceNumber(String deviceNumber)       { this.deviceNumber = deviceNumber; }

    public String getDeviceKey()                           { return deviceKey; }
    public void setDeviceKey(String deviceKey)             { this.deviceKey = deviceKey; }

    public String getLegalName()                           { return legalName; }
    public void setLegalName(String legalName)             { this.legalName = legalName; }

    public String getRegisteredAddress()                   { return registeredAddress; }
    public void setRegisteredAddress(String v)             { this.registeredAddress = v; }

    public boolean isEnabled()                             { return enabled; }
    public void setEnabled(boolean enabled)                { this.enabled = enabled; }

    public Instant getCreatedAt()                          { return createdAt; }
    public Instant getUpdatedAt()                          { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt)            { this.updatedAt = updatedAt; }
}
