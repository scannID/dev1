package com.scanny.service;

import com.scanny.dto.admin.SystemHealthDtos;
import com.scanny.payment.PaymentProvider;
import com.scanny.payment.PaymentProviderRegistry;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.Connection;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import javax.sql.DataSource;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
public class SystemHealthService {

    private static final Duration PROBE_TIMEOUT = Duration.ofSeconds(2);

    private final DataSource dataSource;
    private final ObjectProvider<StringRedisTemplate> redisTemplateProvider;
    private final PaymentProviderRegistry paymentProviderRegistry;
    private final boolean redisEnabled;
    private final String jwkSetUri;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(PROBE_TIMEOUT)
            .build();

    public SystemHealthService(
            DataSource dataSource,
            ObjectProvider<StringRedisTemplate> redisTemplateProvider,
            PaymentProviderRegistry paymentProviderRegistry,
            @Value("${scanny.redis.enabled:false}") boolean redisEnabled,
            @Value("${spring.security.oauth2.resourceserver.jwt.jwk-set-uri:}") String jwkSetUri
    ) {
        this.dataSource = dataSource;
        this.redisTemplateProvider = redisTemplateProvider;
        this.paymentProviderRegistry = paymentProviderRegistry;
        this.redisEnabled = redisEnabled;
        this.jwkSetUri = jwkSetUri;
    }

    public SystemHealthDtos.SystemHealthResponse getSystemHealth() {
        List<SystemHealthDtos.ServiceHealth> services = new ArrayList<>();
        services.add(probeApi());
        services.add(probeDatabase());
        services.add(probeRedis());
        services.add(probeKeycloak());
        services.add(probePayments());

        long operational = services.stream().filter(s -> "operational".equals(s.status())).count();
        long down = services.stream().filter(s -> "down".equals(s.status())).count();
        long degraded = services.stream().filter(s -> "degraded".equals(s.status())).count();
        int measured = (int) services.stream().filter(s -> s.latency() != null).count();
        int avgLatency = measured == 0
                ? 0
                : (int) Math.round(services.stream()
                        .filter(s -> s.latency() != null)
                        .mapToInt(SystemHealthDtos.ServiceHealth::latency)
                        .average()
                        .orElse(0));

        String overallStatus;
        if (down > 0) {
            overallStatus = "down";
        } else if (degraded > 0) {
            overallStatus = "degraded";
        } else {
            overallStatus = "operational";
        }

        double errorRate = services.isEmpty()
                ? 0
                : Math.round(((down + degraded) * 1000.0 / services.size())) / 10.0;

        SystemHealthDtos.OverallHealth overall = new SystemHealthDtos.OverallHealth(
                overallStatus,
                operational + "/" + services.size() + " checks ok",
                avgLatency,
                (int) (down + degraded),
                errorRate
        );

        return new SystemHealthDtos.SystemHealthResponse(services, overall);
    }

    private SystemHealthDtos.ServiceHealth probeApi() {
        long start = System.nanoTime();
        return ok("API", latencyMs(start));
    }

    private SystemHealthDtos.ServiceHealth probeDatabase() {
        long start = System.nanoTime();
        try (Connection conn = dataSource.getConnection()) {
            if (!conn.isValid(2)) {
                return status("Database (Primary)", "degraded", latencyMs(start));
            }
            return ok("Database (Primary)", latencyMs(start));
        } catch (Exception e) {
            return status("Database (Primary)", "down", latencyMs(start));
        }
    }

    private SystemHealthDtos.ServiceHealth probeRedis() {
        long start = System.nanoTime();
        if (!redisEnabled) {
            return new SystemHealthDtos.ServiceHealth("Redis", "disabled", "n/a", null, "ms", 0);
        }
        StringRedisTemplate redis = redisTemplateProvider.getIfAvailable();
        if (redis == null) {
            return status("Redis", "degraded", latencyMs(start));
        }
        try {
            var factory = redis.getConnectionFactory();
            if (factory == null) {
                return status("Redis", "degraded", latencyMs(start));
            }
            try (var connection = factory.getConnection()) {
                String pong = connection.ping();
                if (pong == null || pong.isBlank()) {
                    return status("Redis", "degraded", latencyMs(start));
                }
            }
            return ok("Redis", latencyMs(start));
        } catch (Exception e) {
            return status("Redis", "down", latencyMs(start));
        }
    }

    private SystemHealthDtos.ServiceHealth probeKeycloak() {
        long start = System.nanoTime();
        if (jwkSetUri == null || jwkSetUri.isBlank()) {
            return new SystemHealthDtos.ServiceHealth("Keycloak", "disabled", "n/a", null, "ms", 0);
        }
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(jwkSetUri))
                    .timeout(PROBE_TIMEOUT)
                    .GET()
                    .build();
            HttpResponse<Void> response = httpClient.send(request, HttpResponse.BodyHandlers.discarding());
            int code = response.statusCode();
            if (code >= 200 && code < 300) {
                return ok("Keycloak", latencyMs(start));
            }
            if (code >= 500) {
                return status("Keycloak", "down", latencyMs(start));
            }
            return status("Keycloak", "degraded", latencyMs(start));
        } catch (Exception e) {
            return status("Keycloak", "down", latencyMs(start));
        }
    }

    private SystemHealthDtos.ServiceHealth probePayments() {
        long start = System.nanoTime();
        List<PaymentProvider> available = paymentProviderRegistry.all().stream()
                .filter(PaymentProvider::isAvailable)
                .toList();
        if (available.isEmpty()) {
            return status("Payment providers", "down", latencyMs(start));
        }
        boolean hasNonStub = available.stream().anyMatch(p -> !"stub".equalsIgnoreCase(p.id()));
        if (hasNonStub) {
            return ok("Payment providers", latencyMs(start));
        }
        // Stub-only is fine for local/dev; mark degraded so prod (stub fallback off) is visible.
        return status("Payment providers", "degraded", latencyMs(start));
    }

    private static SystemHealthDtos.ServiceHealth ok(String name, int latency) {
        return new SystemHealthDtos.ServiceHealth(name, "operational", "live", latency, "ms", 0);
    }

    private static SystemHealthDtos.ServiceHealth status(String name, String status, int latency) {
        return new SystemHealthDtos.ServiceHealth(name, status, "live", latency, "ms", "down".equals(status) ? 1 : 0);
    }

    private static int latencyMs(long startNanos) {
        return (int) Math.max(0, (System.nanoTime() - startNanos) / 1_000_000L);
    }
}
