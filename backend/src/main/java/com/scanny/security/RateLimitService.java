package com.scanny.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class RateLimitService {

    private final StringRedisTemplate redisTemplate;
    private final boolean enabled;
    private final int registerPerMin;
    private final int ordersPerMin;
    private final int menuPerMin;
    private final int devicesPerMin;
    private final int ticketScanPerMin;
    private final int websocketPerMin;
    private final int quickPayCreatePerMin;
    private final Map<String, WindowCounter> localCounters = new ConcurrentHashMap<>();

    public RateLimitService(
            ObjectProvider<StringRedisTemplate> redisTemplateProvider,
            @Value("${scanny.rate-limit.enabled:true}") boolean enabled,
            @Value("${scanny.rate-limit.register-per-min:5}") int registerPerMin,
            @Value("${scanny.rate-limit.orders-per-min:30}") int ordersPerMin,
            @Value("${scanny.rate-limit.menu-per-min:120}") int menuPerMin,
            @Value("${scanny.rate-limit.devices-per-min:20}") int devicesPerMin,
            @Value("${scanny.rate-limit.ticket-scan-per-min:60}") int ticketScanPerMin,
            @Value("${scanny.rate-limit.websocket-per-min:30}") int websocketPerMin,
            @Value("${scanny.rate-limit.quick-pay-create-per-min:10}") int quickPayCreatePerMin
    ) {
        this.redisTemplate = redisTemplateProvider.getIfAvailable();
        this.enabled = enabled;
        this.registerPerMin = registerPerMin;
        this.ordersPerMin = ordersPerMin;
        this.menuPerMin = menuPerMin;
        this.devicesPerMin = devicesPerMin;
        this.ticketScanPerMin = ticketScanPerMin;
        this.websocketPerMin = websocketPerMin;
        this.quickPayCreatePerMin = quickPayCreatePerMin;
    }

    public String resolveBucket(HttpServletRequest request) {
        if (!enabled) {
            return null;
        }
        String method = request.getMethod();
        String path = request.getRequestURI();
        if (path == null) {
            return null;
        }
        if ("POST".equalsIgnoreCase(method) && path.equals("/api/auth/merchant/register")) {
            return "register:" + registerPerMin;
        }
        if ("POST".equalsIgnoreCase(method) && path.equals("/api/quick-payments/public/codes")) {
            return "quick-pay-create:" + quickPayCreatePerMin;
        }
        if ("POST".equalsIgnoreCase(method) && path.matches("/api/businesses/[^/]+/orders")) {
            return "orders:" + ordersPerMin;
        }
        if ("GET".equalsIgnoreCase(method) && (path.matches("/api/businesses/[^/]+/menu")
                || path.startsWith("/api/menu/")
                || path.startsWith("/api/qr/"))) {
            return "menu:" + menuPerMin;
        }
        if (path.startsWith("/api/devices")) {
            return "devices:" + devicesPerMin;
        }
        if (path.contains("/tickets") && path.endsWith("/scan") && "POST".equalsIgnoreCase(method)) {
            return "ticket-scan:" + ticketScanPerMin;
        }
        if (path.startsWith("/ws/")) {
            return "websocket:" + websocketPerMin;
        }
        return null;
    }

    public boolean tryConsume(String bucketSpec, String clientKey) {
        String[] parts = bucketSpec.split(":");
        String name = parts[0];
        int limit = Integer.parseInt(parts[1]);
        String key = "rl:" + name + ":" + clientKey;
        if (redisTemplate != null) {
            try {
                Long count = redisTemplate.opsForValue().increment(key);
                if (count != null && count == 1L) {
                    redisTemplate.expire(key, Duration.ofMinutes(1));
                }
                return count == null || count <= limit;
            } catch (Exception ignored) {
                // fall through to local counter
            }
        }
        return tryConsumeLocal(key, limit);
    }

    private boolean tryConsumeLocal(String key, int limit) {
        long window = System.currentTimeMillis() / 60_000L;
        WindowCounter counter = localCounters.compute(key, (k, existing) -> {
            if (existing == null || existing.window != window) {
                return new WindowCounter(window);
            }
            return existing;
        });
        return counter.count.incrementAndGet() <= limit;
    }

    private static final class WindowCounter {
        private final long window;
        private final AtomicInteger count = new AtomicInteger();

        private WindowCounter(long window) {
            this.window = window;
        }
    }
}
