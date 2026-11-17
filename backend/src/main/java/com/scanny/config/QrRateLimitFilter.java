package com.scanny.config;

import com.scanny.service.QrAuditService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.concurrent.TimeUnit;

/**
 * Rate limiting filter for QR code endpoints to prevent:
 * - Brute force token enumeration
 * - Denial of service attacks
 * - Excessive scan metric inflation
 * 
 * Limits:
 * - Public QR endpoints: 60 requests/minute per IP
 * - Rent payment endpoints: 30 requests/minute per IP
 * - Admin QR generation: 10 requests/minute per authenticated user
 */
@Component
public class QrRateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(QrRateLimitFilter.class);
    
    // Rate limits (requests per minute)
    private static final int PUBLIC_QR_LIMIT = 60;
    private static final int RENT_PAY_LIMIT = 30;
    private static final int ADMIN_LIMIT = 10;
    
    private final StringRedisTemplate redis;
    private final QrAuditService auditService;

    public QrRateLimitFilter(
            ObjectProvider<StringRedisTemplate> redisProvider,
            QrAuditService auditService) {
        this.redis = redisProvider.getIfAvailable();
        this.auditService = auditService;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain chain) throws ServletException, IOException {

        String path = request.getRequestURI();
        
        // Determine if this is a QR-related endpoint and get appropriate limit
        Integer limit = getRateLimitForPath(path);
        if (limit == null) {
            // Not a QR endpoint, skip rate limiting
            chain.doFilter(request, response);
            return;
        }

        // Generate client identifier (IP + User-Agent hash)
        String clientId = getClientId(request);
        String rateLimitKey = "rate:qr:" + clientId;

        // Check rate limit
        if (redis != null) {
            try {
                Long count = redis.opsForValue().increment(rateLimitKey);
                
                if (count != null) {
                    if (count == 1) {
                        // First request in window, set expiry
                        redis.expire(rateLimitKey, 60, TimeUnit.SECONDS);
                    }
                    
                    // Add rate limit headers
                    response.setHeader("X-RateLimit-Limit", String.valueOf(limit));
                    response.setHeader("X-RateLimit-Remaining", String.valueOf(Math.max(0, limit - count)));
                    
                    if (count > limit) {
                        // Rate limit exceeded
                        log.warn("Rate limit exceeded for client {} on path {} (count: {})", 
                                clientId, path, count);
                        
                        // Log to audit (extract token if in path)
                        String token = extractTokenFromPath(path);
                        if (token != null) {
                            auditService.logRateLimited(token, guessTokenType(path), request);
                        }
                        
                        response.setStatus(429);
                        response.setContentType("application/json");
                        response.getWriter().write(String.format(
                            "{\"error\":\"Rate limit exceeded\",\"message\":\"Maximum %d requests per minute. Try again later.\",\"retryAfter\":60}",
                            limit));
                        return;
                    }
                }
            } catch (Exception e) {
                // Redis failure - allow request but log error
                log.error("Redis rate limiting failed, allowing request", e);
            }
        } else {
            // No Redis available - log warning but allow request
            log.debug("Redis not available, rate limiting disabled");
        }

        // Check IP-level suspicious activity from audit logs
        String ip = extractIpAddress(request);
        if (auditService.isIpSuspicious(ip)) {
            log.warn("Blocking suspicious IP: {}", ip);
            response.setStatus(403);
            response.setContentType("application/json");
            response.getWriter().write(
                "{\"error\":\"Forbidden\",\"message\":\"Too many failed attempts. Contact support if you believe this is an error.\"}");
            return;
        }

        chain.doFilter(request, response);
    }

    /**
     * Determine rate limit based on path, or null if not a QR endpoint
     */
    private Integer getRateLimitForPath(String path) {
        // Public QR scan endpoints
        if (path.matches("^/api/qr/.*") ||
            path.matches("^/api/businesses/[^/]+/scans$") ||
            path.matches("^/api/qr/[^/]+/scans$")) {
            return PUBLIC_QR_LIMIT;
        }
        
        // Public rent payment endpoints
        if (path.startsWith("/api/public/rent/pay/") ||
            path.startsWith("/api/public/rent/maintenance/")) {
            return RENT_PAY_LIMIT;
        }
        
        // Admin/merchant QR generation endpoints
        if (path.matches("^/api/merchants/.*/qr.*") ||
            path.matches("^/api/admin/.*/qr.*") ||
            path.contains("/regenerate") && path.contains("qr")) {
            return ADMIN_LIMIT;
        }
        
        return null; // Not a QR endpoint
    }

    /**
     * Generate a stable client identifier combining IP and User-Agent
     * to prevent trivial bypasses while handling proxies correctly
     */
    private String getClientId(HttpServletRequest request) {
        String ip = extractIpAddress(request);
        String userAgent = request.getHeader("User-Agent");
        if (userAgent == null) userAgent = "unknown";
        
        // Hash to keep key size reasonable
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest((ip + ":" + userAgent).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash).substring(0, 16); // First 8 bytes
        } catch (Exception e) {
            return ip.replaceAll("[^a-zA-Z0-9]", "");
        }
    }

    /**
     * Extract IP address considering proxies
     */
    private String extractIpAddress(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isBlank()) {
            ip = request.getHeader("X-Real-IP");
        }
        if (ip == null || ip.isBlank()) {
            ip = request.getRemoteAddr();
        }
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        return ip != null ? ip : "unknown";
    }

    /**
     * Extract token from path for audit logging
     */
    private String extractTokenFromPath(String path) {
        // Examples:
        // /api/qr/TOKEN/scans -> TOKEN
        // /api/public/rent/pay/TOKEN -> TOKEN
        // /api/qr/TOKEN -> TOKEN
        
        String[] parts = path.split("/");
        for (int i = 0; i < parts.length; i++) {
            if ((parts[i].equals("qr") || parts[i].equals("pay")) && i + 1 < parts.length) {
                return parts[i + 1];
            }
        }
        return null;
    }

    /**
     * Guess token type from path for audit categorization
     */
    private String guessTokenType(String path) {
        if (path.contains("/rent/")) return "RENT";
        if (path.contains("/businesses/")) return "BUSINESS";
        if (path.contains("/merchants/")) return "MERCHANT";
        return "UNKNOWN";
    }
}
