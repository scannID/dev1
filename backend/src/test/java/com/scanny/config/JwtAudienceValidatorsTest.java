package com.scanny.config;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;

class JwtAudienceValidatorsTest {

    @Test
    void emptyAudienceConfigAcceptsAny() {
        OAuth2TokenValidator<Jwt> validator = JwtConfig.audienceValidator(Set.of());
        Jwt jwt = baseJwt().audience(List.of("other")).build();
        assertFalse(validator.validate(jwt).hasErrors());
    }

    @Test
    void audienceMustMatchWhenConfigured() {
        OAuth2TokenValidator<Jwt> validator = JwtConfig.audienceValidator(Set.of("account", "scanny-backend"));
        assertFalse(validator.validate(baseJwt().audience(List.of("account")).build()).hasErrors());
        assertTrue(validator.validate(baseJwt().audience(List.of("wrong")).build()).hasErrors());
    }

    @Test
    void azpMustMatchWhenConfigured() {
        OAuth2TokenValidator<Jwt> validator = JwtConfig.azpValidator(Set.of("scanny-client", "scanny-admin"));
        assertFalse(validator.validate(baseJwt().claim("azp", "scanny-client").build()).hasErrors());
        assertTrue(validator.validate(baseJwt().claim("azp", "evil-client").build()).hasErrors());
        assertTrue(validator.validate(baseJwt().build()).hasErrors());
    }

    private static Jwt.Builder baseJwt() {
        return Jwt.withTokenValue("t")
                .header("alg", "none")
                .subject("sub")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60));
    }
}
