package com.scanny.controller;

import com.scanny.dto.RentDtos;
import com.scanny.service.RentAccountService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Authenticated REST controller for the rent manager portal.
 *
 * <p>Mirrors {@code MerchantAuthController}: authentication is handled entirely
 * by Keycloak (OAuth2 Authorization Code flow).  The Spring resource server
 * validates the Bearer JWT and requires the {@code RENT_MANAGER} realm role
 * before any of these endpoints are reachable.
 *
 * <h3>Endpoints</h3>
 * <pre>
 *   POST /api/auth/rent-manager/register   (public)  — create Keycloak user + RentAccount
 *   GET  /api/auth/rent-manager/me         (RENT_MANAGER) — post-login account resolution
 * </pre>
 */
@RestController
@RequestMapping("/api/auth/rent-manager")
public class RentManagerAuthController {

    private final RentAccountService rentAccountService;

    public RentManagerAuthController(RentAccountService rentAccountService) {
        this.rentAccountService = rentAccountService;
    }

    /**
     * Public registration endpoint — creates a Keycloak user with the
     * {@code RENT_MANAGER} realm role and a linked {@link com.scanny.entity.RentAccount}.
     * Idempotent on email: repeated calls for the same email return the existing account.
     *
     * <p>Keycloak sends a verify-email + set-password action email automatically.
     */
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public RentDtos.AccountResponse register(
            @Valid @RequestBody RentDtos.RegisterRentManagerRequest request) {
        return rentAccountService.register(request);
    }

    /**
     * Post-login account resolution — called by the frontend immediately after
     * Keycloak redirects back with a valid token.  Resolves (or auto-provisions)
     * the {@link com.scanny.entity.RentAccount} for the authenticated Keycloak user
     * and returns the full account payload.
     *
     * <p>The JWT is already validated by the Spring resource server filter chain;
     * this method only needs to read claims and delegate to the service.
     */
    @GetMapping("/me")
    public RentDtos.AccountResponse me(@AuthenticationPrincipal Jwt jwt) {
        return rentAccountService.getMe(jwt);
    }
}
