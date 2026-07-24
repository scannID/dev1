package com.scanny.config;

import jakarta.annotation.PostConstruct;
import java.util.Arrays;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Fails fast in production when CORS patterns are missing or overly permissive.
 */
@Component
@Profile("prod")
public class ProdCorsGuard {

    private static final Logger log = LoggerFactory.getLogger(ProdCorsGuard.class);

    private final String allowedOriginPatterns;
    private final boolean allowWildcardPatterns;

    public ProdCorsGuard(
            @Value("${scanny.cors.allowed-origin-patterns:}") String allowedOriginPatterns,
            @Value("${scanny.cors.allow-wildcard-patterns:false}") boolean allowWildcardPatterns
    ) {
        this.allowedOriginPatterns = allowedOriginPatterns;
        this.allowWildcardPatterns = allowWildcardPatterns;
    }

    @PostConstruct
    void validate() {
        List<String> patterns = Arrays.stream(allowedOriginPatterns.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();

        if (patterns.isEmpty()) {
            throw new IllegalStateException(
                    "Production requires SCANNY_CORS_ORIGIN_PATTERNS with exact https origins."
            );
        }

        for (String pattern : patterns) {
            if ("*".equals(pattern) || "null".equalsIgnoreCase(pattern)) {
                throw new IllegalStateException("Production CORS must not allow origin '*'/null: " + pattern);
            }
            if (!allowWildcardPatterns && pattern.contains("*")) {
                throw new IllegalStateException(
                        "Production CORS patterns must be exact origins (no wildcards): " + pattern
                                + ". Set scanny.cors.allow-wildcard-patterns=true only if intentional."
                );
            }
            if (!(pattern.startsWith("https://") || pattern.startsWith("http://localhost")
                    || pattern.startsWith("http://127.0.0.1"))) {
                log.warn("Production CORS origin is not https: {}", pattern);
            }
        }
        log.info("Production CORS origins validated ({} entries)", patterns.size());
    }
}
