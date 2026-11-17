package com.scanny.entity;

import com.scanny.model.enums.BindingStatus;
import com.scanny.model.enums.TokenType;
import jakarta.persistence.*;
import java.time.Instant;

/**
 * Represents a binding between a device and a QR code token.
 * 
 * <p>Security Model:
 * <ul>
 *   <li>One active binding per QR token (enforced by unique constraint)</li>
 *   <li>Tenant scans QR → verifies phone → creates binding</li>
 *   <li>Future scans from same device → instant access</li>
 *   <li>Scans from different device → denied with admin contact info</li>
 *   <li>Admin can revoke → tenant must scan again to rebind</li>
 * </ul>
 * 
 * <p>Lifecycle:
 * <ol>
 *   <li>ACTIVE: Created on first scan, device can access token</li>
 *   <li>REVOKED: Admin manually revokes (phone change, security issue)</li>
 *   <li>EXPIRED: Auto-expires after lease end date</li>
 * </ol>
 */
@Entity
@Table(name = "qr_device_bindings", indexes = {
    @Index(name = "idx_qr_device_bindings_token_status", columnList = "qr_token,status"),
    @Index(name = "idx_qr_device_bindings_device", columnList = "device_id"),
    @Index(name = "idx_qr_device_bindings_unit", columnList = "unit_id,status"),
    @Index(name = "idx_qr_device_bindings_property", columnList = "property_id,status")
})
public class QrDeviceBinding {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * The QR token this device is bound to (from rent_units.qr_token or rent_tenants.pay_token)
     */
    @Column(name = "qr_token", nullable = false, length = 128)
    private String qrToken;

    /**
     * Type of token: UNIT (door QR) or TENANT_PAY (personal payment link)
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "token_type", nullable = false, length = 20)
    private TokenType tokenType = TokenType.UNIT;

    /**
     * Device identifier (browser fingerprint or app-generated UUID).
     * Sent in X-Device-ID header or generated client-side.
     */
    @Column(name = "device_id", nullable = false, length = 64)
    private String deviceId;

    /**
     * JSON with detailed device information for admin reference:
     * {
     *   "type": "mobile",
     *   "os": "Android 13",
     *   "browser": "Chrome 120",
     *   "model": "Samsung Galaxy A53",
     *   "screenSize": "1080x2400",
     *   "timezone": "Africa/Kampala"
     * }
     */
    @Column(name = "device_fingerprint", columnDefinition = "TEXT")
    private String deviceFingerprint;

    /**
     * Tenant's phone number verified during first scan.
     * Must match rent_tenants.phone_number to create binding.
     */
    @Column(name = "phone_number", nullable = false, length = 20)
    private String phoneNumber;

    /**
     * Tenant ID (may be null if tenant is deleted but binding kept for audit)
     */
    @Column(name = "tenant_id", length = 36)
    private String tenantId;

    /**
     * Unit ID (required - this binding grants access to this unit's payment page)
     */
    @Column(name = "unit_id", nullable = false, length = 36)
    private String unitId;

    /**
     * Property ID (for admin filtering and cascade deletes)
     */
    @Column(name = "property_id", nullable = false, length = 36)
    private String propertyId;

    /**
     * When this binding was created
     */
    @Column(name = "bound_at", nullable = false)
    private Instant boundAt = Instant.now();

    /**
     * Optional expiry date (auto-set to lease_end + 7 days).
     * System will auto-expire binding after this date.
     */
    @Column(name = "expires_at")
    private Instant expiresAt;

    /**
     * Current status of the binding
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private BindingStatus status = BindingStatus.ACTIVE;

    /**
     * When binding was revoked or expired
     */
    @Column(name = "revoked_at")
    private Instant revokedAt;

    /**
     * Who revoked the binding: admin_id, tenant_id, or 'SYSTEM'
     */
    @Column(name = "revoked_by", length = 36)
    private String revokedBy;

    /**
     * Why the binding was revoked: "Phone lost/stolen", "Phone changed", "Security concern", etc.
     */
    @Column(name = "revoked_reason", length = 255)
    private String revokedReason;

    /**
     * Last time this device successfully scanned the QR code
     */
    @Column(name = "last_used_at")
    private Instant lastUsedAt;

    /**
     * How many times this device has scanned the QR code
     */
    @Column(name = "use_count")
    private Integer useCount = 0;

    /**
     * IP address when binding was created (for security audit)
     */
    @Column(name = "created_ip", length = 45)
    private String createdIp;

    /**
     * User-Agent when binding was created
     */
    @Column(name = "created_user_agent", length = 512)
    private String createdUserAgent;

    // Constructors
    public QrDeviceBinding() {}

    public QrDeviceBinding(String qrToken, TokenType tokenType, String deviceId, 
                           String phoneNumber, String unitId, String propertyId) {
        this.qrToken = qrToken;
        this.tokenType = tokenType;
        this.deviceId = deviceId;
        this.phoneNumber = phoneNumber;
        this.unitId = unitId;
        this.propertyId = propertyId;
        this.boundAt = Instant.now();
        this.status = BindingStatus.ACTIVE;
        this.useCount = 0;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getQrToken() {
        return qrToken;
    }

    public void setQrToken(String qrToken) {
        this.qrToken = qrToken;
    }

    public TokenType getTokenType() {
        return tokenType;
    }

    public void setTokenType(TokenType tokenType) {
        this.tokenType = tokenType;
    }

    public String getDeviceId() {
        return deviceId;
    }

    public void setDeviceId(String deviceId) {
        this.deviceId = deviceId;
    }

    public String getDeviceFingerprint() {
        return deviceFingerprint;
    }

    public void setDeviceFingerprint(String deviceFingerprint) {
        this.deviceFingerprint = deviceFingerprint;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    public String getTenantId() {
        return tenantId;
    }

    public void setTenantId(String tenantId) {
        this.tenantId = tenantId;
    }

    public String getUnitId() {
        return unitId;
    }

    public void setUnitId(String unitId) {
        this.unitId = unitId;
    }

    public String getPropertyId() {
        return propertyId;
    }

    public void setPropertyId(String propertyId) {
        this.propertyId = propertyId;
    }

    public Instant getBoundAt() {
        return boundAt;
    }

    public void setBoundAt(Instant boundAt) {
        this.boundAt = boundAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }

    public BindingStatus getStatus() {
        return status;
    }

    public void setStatus(BindingStatus status) {
        this.status = status;
    }

    public Instant getRevokedAt() {
        return revokedAt;
    }

    public void setRevokedAt(Instant revokedAt) {
        this.revokedAt = revokedAt;
    }

    public String getRevokedBy() {
        return revokedBy;
    }

    public void setRevokedBy(String revokedBy) {
        this.revokedBy = revokedBy;
    }

    public String getRevokedReason() {
        return revokedReason;
    }

    public void setRevokedReason(String revokedReason) {
        this.revokedReason = revokedReason;
    }

    public Instant getLastUsedAt() {
        return lastUsedAt;
    }

    public void setLastUsedAt(Instant lastUsedAt) {
        this.lastUsedAt = lastUsedAt;
    }

    public Integer getUseCount() {
        return useCount;
    }

    public void setUseCount(Integer useCount) {
        this.useCount = useCount;
    }

    public String getCreatedIp() {
        return createdIp;
    }

    public void setCreatedIp(String createdIp) {
        this.createdIp = createdIp;
    }

    public String getCreatedUserAgent() {
        return createdUserAgent;
    }

    public void setCreatedUserAgent(String createdUserAgent) {
        this.createdUserAgent = createdUserAgent;
    }

    // Utility methods
    public boolean isActive() {
        return status == BindingStatus.ACTIVE;
    }

    public boolean isExpired() {
        return expiresAt != null && Instant.now().isAfter(expiresAt);
    }

    public void incrementUseCount() {
        this.useCount++;
        this.lastUsedAt = Instant.now();
    }
}
