package com.scanny.controller;

import com.scanny.dto.CookieConsentDtos;
import com.scanny.service.CookieConsentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/consents")
public class CookieConsentController {

    private final CookieConsentService cookieConsentService;

    public CookieConsentController(CookieConsentService cookieConsentService) {
        this.cookieConsentService = cookieConsentService;
    }

    @PostMapping("/cookies")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void saveCookieConsent(
            @Valid @RequestBody CookieConsentDtos.SaveCookieConsentRequest request,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletRequest httpRequest
    ) {
        cookieConsentService.saveCookieConsent(
                request,
                jwt,
                httpRequest.getHeader("User-Agent"),
                httpRequest.getRemoteAddr()
        );
    }
}
