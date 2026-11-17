package com.scanny.entity;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * Audit log for all QR code scan attempts.
 * Tracks successful scans, failed validations, and suspicious patterns.
 * Used for security monitoring and intrusion detection.
 */
@Entity
@Table(name = "qr_scan_audit", indexes = {
    @Index(name = "idx_qr_scan_audit_ip_outcome", columnList = "ip_address,outcome,scanned_at"),
    @Index(name = "idx_qr_scan_audit_device_outcome", columnList = "device_id,outcome,scanned_at"),
    @Index(name = "idx_qr_scan_audit_token_hash", columnList = "token_hash"),
    @Index(name = "idx_qr_scan_audit_scanned_at", columnList = "scanned_at")
})
public class QrScanAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * SHA-256 hash of the QR token (not plaintext for security).
     * Allows tracking without exposing actual tokens in logs.
     */
    @Column(name = "token_hash", nullable = false, length = 64)
    private String tokenHash;

    /**
     * Type of QR code: MERCHANT, BUSINESS, RENT_PROPERTY, RENT_UNIT, TENANT_PAY
     */
    @Column(name = "token_type", nullable = false, length = 20)
    private String tokenType;

    /**
     * Action attempted: SCAN, ACCESS, PAYMENT, GENERATE
     */
    @Column(name = "action", nullable = false, length = 20)
    private String action;

    /**
     * IP address of the client (IPv4 or IPv6)
     */
    @Column(name = "ip_address", nullable = false, length = 45)
    private String ipAddress;

    /**
     * User-Agent header for device fingerprinting
     */
    @Column(name = "user_agent", nullable = false, length = 512)
    private String userAgent = "";

    /**
     * Optional device ID from X-Device-ID header
     */
    @Column(name = "device_id", length = 64)
    private String deviceId;

    /**
     * Outcome: SUCCESS, DENIED, EXPIRED, INVALID, BLACKLISTED, RATE_LIMITED
     */
    @Column(name = "outcome", nullable = false, length = 20)
    private String outcome;

    /**
     * Optional details about the outcome (error message, reason, etc.)
     */
    @Column(name = "outcome_details", length = 512)
    private String outcomeDetails;

    /**
     * Timestamp of the scan attempt
     */
    @Column(name = "scanned_at", nullable = false)
    private Instant scannedAt = Instant.now();

    /**
     * Optional entity ID related to this scan (merchant ID, business ID, property ID, etc.)
     */
    @Column(name = "entity_id", length = 100)
    private String entityId;

    /**
     * Flag for suspicious activity detection
     */
    @Column(name = "suspicious", nullable = false)
    private boolean suspicious = false;

    // Constructors
    public QrScanAudit() {}

    public QrScanAudit(String tokenHash, String tokenType, String action, 
                       String ipAddress, String userAgent, String deviceId,
                       String outcome, String outcomeDetails, String entityId) {
        this.tokenHash = tokenHash;
        this.tokenType = tokenType;
        this.action = action;
        this.ipAddress = ipAddress;
        this.userAgent = userAgent != null ? userAgent : "";
        this.deviceId = deviceId;
        this.outcome = outcome;
        this.outcomeDetails = outcomeDetails;
        this.entityId = entityId;
        this.scannedAt = Instant.now();
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTokenHash() {
        return tokenHash;
    }

    public void setTokenHash(String tokenHash) {
        this.tokenHash = tokenHash;
    }

    public String getTokenType() {
        return tokenType;
    }

    public void setTokenType(String tokenType) {
        this.tokenType = tokenType;
    }

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public String getIpAddress() {
        return ipAddress;
    }

    public void setIpAddress(String ipAddress) {
        this.ipAddress = ipAddress;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public void setUserAgent(String userAgent) {
        this.userAgent = userAgent != null ? userAgent : "";
    }

    public String getDeviceId() {
        return deviceId;
    }

    public void setDeviceId(String deviceId) {
        this.deviceId = deviceId;
    }

    public String getOutcome() {
        return outcome;
    }

    public void setOutcome(String outcome) {
        this.outcome = outcome;
    }

    public String getOutcomeDetails() {
        return outcomeDetails;
    }

    public void setOutcomeDetails(String outcomeDetails) {
        this.outcomeDetails = outcomeDetails;
    }

    public Instant getScannedAt() {
        return scannedAt;
    }

    public void setScannedAt(Instant scannedAt) {
        this.scannedAt = scannedAt;
    }

    public String getEntityId() {
        return entityId;
    }

    public void setEntityId(String entityId) {
        this.entityId = entityId;
    }

    public boolean isSuspicious() {
        return suspicious;
    }

    public void setSuspicious(boolean suspicious) {
        this.suspicious = suspicious;
    }
}
