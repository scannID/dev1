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
import java.util.List;

/**
 * Validates Keycloak JWTs by signature (JWK set) and timestamp.
 * Optionally accepts LAN issuer hosts so phone/dev access via 192.168.x.x works with localhost API.
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
        @Value("${scanny.jwt.allow-lan-issuers:true}") boolean allowLanIssuers
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

        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(List.of(timestamp, issuer)));
        return decoder;
    }
}
