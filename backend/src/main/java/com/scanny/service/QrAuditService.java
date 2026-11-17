package com.scanny.service;

import com.scanny.entity.QrScanAudit;
import com.scanny.repository.QrScanAuditRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;

/**
 * Service for auditing QR code scans and detecting suspicious activity.
 * All audit logging is asynchronous to avoid impacting response times.
 */
@Service
public class QrAuditService {

    private static final Logger log = LoggerFactory.getLogger(QrAuditService.class);
    
    private final QrScanAuditRepository auditRepository;

    public QrAuditService(QrScanAuditRepository auditRepository) {
        this.auditRepository = auditRepository;
    }

    /**
     * Log a QR scan attempt asynchronously.
     * 
     * @param token The QR token (will be hashed before storage)
     * @param tokenType Type of token (MERCHANT, RENT_UNIT, etc.)
     * @param action Action performed (SCAN, ACCESS, PAYMENT)
     * @param request HTTP request for IP and User-Agent extraction
     * @param outcome Result (SUCCESS, DENIED, etc.)
     * @param details Optional details about the outcome
     * @param entityId Optional related entity ID
     */
    @Async
    @Transactional
    public void logScan(String token, String tokenType, String action, 
                       HttpServletRequest request, String outcome, 
                       String details, String entityId) {
        try {
            String tokenHash = hashToken(token);
            String ipAddress = extractIpAddress(request);
            String userAgent = extractUserAgent(request);
            String deviceId = request.getHeader("X-Device-ID");

            QrScanAudit audit = new QrScanAudit(
                tokenHash, tokenType, action,
                ipAddress, userAgent, deviceId,
                outcome, details, entityId
            );

            // Check for suspicious patterns
            if (isSuspicious(audit)) {
                audit.setSuspicious(true);
                log.warn("🚨 SUSPICIOUS QR SCAN DETECTED: {} from IP {} - {}",
                        action, ipAddress, details);
            }

            auditRepository.save(audit);

        } catch (Exception e) {
            // Never fail the request due to audit logging errors
            log.error("Failed to log QR scan audit", e);
        }
    }

    /**
     * Convenience method for successful scans
     */
    @Async
    public void logSuccess(String token, String tokenType, String action, 
                          HttpServletRequest request, String entityId) {
        logScan(token, tokenType, action, request, "SUCCESS", null, entityId);
    }

    /**
     * Convenience method for denied scans
     */
    @Async
    public void logDenied(String token, String tokenType, String action,
                         HttpServletRequest request, String reason) {
        logScan(token, tokenType, action, request, "DENIED", reason, null);
    }

    /**
     * Convenience method for invalid tokens
     */
    @Async
    public void logInvalid(String token, String tokenType, HttpServletRequest request) {
        logScan(token, tokenType, "SCAN", request, "INVALID", "Token not found", null);
    }

    /**
     * Convenience method for expired tokens
     */
    @Async
    public void logExpired(String token, String tokenType, HttpServletRequest request) {
        logScan(token, tokenType, "SCAN", request, "EXPIRED", "Token has expired", null);
    }

    /**
     * Convenience method for blacklisted tokens
     */
    @Async
    public void logBlacklisted(String token, String tokenType, HttpServletRequest request) {
        logScan(token, tokenType, "SCAN", request, "BLACKLISTED", "Token has been revoked", null);
    }

    /**
     * Convenience method for rate limited requests
     */
    @Async
    public void logRateLimited(String token, String tokenType, HttpServletRequest request) {
        logScan(token, tokenType, "SCAN", request, "RATE_LIMITED", "Too many requests", null);
    }

    /**
     * Hash a token using SHA-256 for secure storage in audit logs.
     * We don't store plaintext tokens to prevent leakage if audit table is compromised.
     */
    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    /**
     * Extract client IP address, considering X-Forwarded-For for proxied requests
     */
    private String extractIpAddress(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isBlank()) {
            ip = request.getHeader("X-Real-IP");
        }
        if (ip == null || ip.isBlank()) {
            ip = request.getRemoteAddr();
        }
        // X-Forwarded-For can contain multiple IPs, take the first
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        return ip != null ? ip : "unknown";
    }

    /**
     * Extract and truncate User-Agent header
     */
    private String extractUserAgent(HttpServletRequest request) {
        String ua = request.getHeader("User-Agent");
        if (ua == null || ua.isBlank()) {
            return "unknown";
        }
        // Truncate to 512 chars to fit database column
        return ua.length() > 512 ? ua.substring(0, 512) : ua;
    }

    /**
     * Detect suspicious scan patterns that may indicate attacks:
     * - Multiple failed scans from same IP in short time
     * - Rapid scanning from same device
     * - Many unique IPs hitting the same token (enumeration)
     */
    private boolean isSuspicious(QrScanAudit audit) {
        Instant fiveMinutesAgo = Instant.now().minus(5, ChronoUnit.MINUTES);

        // Check 1: Multiple failures from this IP recently
        if (!audit.getOutcome().equals("SUCCESS")) {
            long recentFailures = auditRepository.countByIpAndFailedOutcomeSince(
                audit.getIpAddress(), fiveMinutesAgo);
            if (recentFailures > 10) {
                log.warn("IP {} has {} failed scans in 5 minutes", 
                        audit.getIpAddress(), recentFailures);
                return true;
            }
        }

        // Check 2: Rapid scanning from same device
        if (audit.getDeviceId() != null) {
            long recentScans = auditRepository.countByDeviceIdSince(
                audit.getDeviceId(), fiveMinutesAgo);
            if (recentScans > 50) {
                log.warn("Device {} has {} scans in 5 minutes", 
                        audit.getDeviceId(), recentScans);
                return true;
            }
        }

        // Check 3: Token enumeration (many IPs hitting same token)
        Instant oneHourAgo = Instant.now().minus(1, ChronoUnit.HOURS);
        long uniqueIps = auditRepository.countDistinctIpsByTokenHashSince(
            audit.getTokenHash(), oneHourAgo);
        if (uniqueIps > 20) {
            log.warn("Token {} accessed by {} unique IPs in 1 hour", 
                    audit.getTokenHash().substring(0, 8), uniqueIps);
            return true;
        }

        return false;
    }

    /**
     * Check if an IP has exceeded failure threshold (for rate limiting decisions)
     */
    public boolean isIpSuspicious(String ipAddress) {
        Instant fiveMinutesAgo = Instant.now().minus(5, ChronoUnit.MINUTES);
        long failures = auditRepository.countByIpAndFailedOutcomeSince(ipAddress, fiveMinutesAgo);
        return failures > 10;
    }

    /**
     * Get recent suspicious activity for admin dashboard
     */
    @Transactional(readOnly = true)
    public java.util.List<QrScanAudit> getRecentSuspiciousActivity() {
        return auditRepository.findTop100BySuspiciousTrueOrderByScannedAtDesc();
    }

    /**
     * Get audit logs for a specific entity (for merchant/property dashboard)
     */
    @Transactional(readOnly = true)
    public java.util.List<QrScanAudit> getAuditLogsForEntity(String entityId) {
        return auditRepository.findTop50ByEntityIdOrderByScannedAtDesc(entityId);
    }
}
