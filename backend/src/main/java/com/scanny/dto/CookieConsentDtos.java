package com.scanny.dto;

import jakarta.validation.constraints.NotBlank;

public final class CookieConsentDtos {

    private CookieConsentDtos() {
    }

    public record SaveCookieConsentRequest(
            @NotBlank String choice,
            String clientId,
            String source,
            String path
    ) {
    }
}
