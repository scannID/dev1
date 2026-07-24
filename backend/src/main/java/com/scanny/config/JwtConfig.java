package com.scanny.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Validates Keycloak JWTs by signature (JWK set), timestamp, issuer,
 * and optionally audience ({@code aud}) / authorized party ({@code azp}).
 */
@Configuration
public class JwtConfig {

    private static final String LAN_ISSUER_REGEX =
        "^https?://(localhost|127\\.0\\.0\\.1|192\\.168\\.\\d{1,3}\\.\\d{1,3}|10\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}):8080/realms/scanny$";

    @Bean
    @ConditionalOnMissingBean(JwtDecoder.class)
    public JwtDecoder jwtDecoder(
        @Value("${spring.security.oauth2.resourceserver.jwt.jwk-set-uri}") String jwkSetUri,
        @Value("${scanny.jwt.accepted-issuers:http://localhost:8080/realms/scanny,http://127.0.0.1:8080/realms/scanny}") String acceptedIssuers,
        @Value("${scanny.jwt.allow-lan-issuers:true}") boolean allowLanIssuers,
        @Value("${scanny.jwt.accepted-audiences:}") String acceptedAudiences,
        @Value("${scanny.jwt.accepted-azp:}") String acceptedAzp
    ) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build();

        OAuth2TokenValidator<Jwt> timestamp = new JwtTimestampValidator();
        OAuth2TokenValidator<Jwt> issuer = jwt -> {
            String iss = jwt.getIssuer() != null ? jwt.getIssuer().toString() : "";
            boolean exactMatch = Arrays.stream(acceptedIssuers.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .anyMatch(iss::equals);
            boolean lanMatch = allowLanIssuers && iss.matches(LAN_ISSUER_REGEX);
            if (exactMatch || lanMatch) {
                return OAuth2TokenValidatorResult.success();
            }
            return OAuth2TokenValidatorResult.failure(
                new OAuth2Error("invalid_token", "Invalid token issuer: " + iss, null)
            );
        };

        List<OAuth2TokenValidator<Jwt>> validators = List.of(
                timestamp,
                issuer,
                audienceValidator(parseSet(acceptedAudiences)),
                azpValidator(parseSet(acceptedAzp))
        );

        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(validators));
        return decoder;
    }

    static OAuth2TokenValidator<Jwt> audienceValidator(Set<String> accepted) {
        return jwt -> {
            if (accepted.isEmpty()) {
                return OAuth2TokenValidatorResult.success();
            }
            Collection<String> audiences = jwt.getAudience();
            if (audiences != null) {
                for (String aud : audiences) {
                    if (accepted.contains(aud)) {
                        return OAuth2TokenValidatorResult.success();
                    }
                }
            }
            // Keycloak sometimes puts a single audience as a string claim.
            Object raw = jwt.getClaim("aud");
            if (raw instanceof String s && accepted.contains(s)) {
                return OAuth2TokenValidatorResult.success();
            }
            return OAuth2TokenValidatorResult.failure(
                    new OAuth2Error("invalid_token", "Invalid token audience", null)
            );
        };
    }

    static OAuth2TokenValidator<Jwt> azpValidator(Set<String> accepted) {
        return jwt -> {
            if (accepted.isEmpty()) {
                return OAuth2TokenValidatorResult.success();
            }
            String azp = jwt.getClaimAsString("azp");
            if (azp == null || azp.isBlank()) {
                azp = jwt.getClaimAsString("client_id");
            }
            if (azp != null && accepted.contains(azp)) {
                return OAuth2TokenValidatorResult.success();
            }
            return OAuth2TokenValidatorResult.failure(
                    new OAuth2Error("invalid_token", "Invalid token authorized party", null)
            );
        };
    }

    private static Set<String> parseSet(String csv) {
        if (csv == null || csv.isBlank()) {
            return Set.of();
        }
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toUnmodifiableSet());
    }
}
