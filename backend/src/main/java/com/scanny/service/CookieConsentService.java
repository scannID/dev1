package com.scanny.service;

import com.scanny.dto.CookieConsentDtos;
import com.scanny.exception.ApiException;
import java.time.Instant;
import java.util.Locale;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CookieConsentService {

    private static final int MAX_FIELD_LENGTH = 255;
    private static final int MAX_CLIENT_ID_LENGTH = 120;
    private static final int MAX_USER_AGENT_LENGTH = 512;

    private final JdbcTemplate jdbcTemplate;

    public CookieConsentService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public void saveCookieConsent(
            CookieConsentDtos.SaveCookieConsentRequest request,
            Jwt jwt,
            String userAgent,
            String ipAddress
    ) {
        String choice = normalizeChoice(request.choice());
        String actorSubject = jwt != null ? trimToLimit(jwt.getSubject(), MAX_FIELD_LENGTH) : null;
        String actorEmail = jwt != null ? trimToLimit(
                firstNonBlank(
                        jwt.getClaimAsString("email"),
                        jwt.getClaimAsString("preferred_username")
                ),
                MAX_FIELD_LENGTH
        ) : null;

        jdbcTemplate.update(
                """
                INSERT INTO cookie_consents (
                    choice,
                    client_id,
                    source,
                    path,
                    actor_subject,
                    actor_email,
                    user_agent,
                    ip_address,
                    consented_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                choice,
                trimToLimit(request.clientId(), MAX_CLIENT_ID_LENGTH),
                trimToLimit(request.source(), MAX_FIELD_LENGTH),
                trimToLimit(request.path(), MAX_FIELD_LENGTH),
                actorSubject,
                actorEmail,
                trimToLimit(userAgent, MAX_USER_AGENT_LENGTH),
                trimToLimit(ipAddress, 64),
                Instant.now()
        );
    }

    private String normalizeChoice(String choiceRaw) {
        String choice = choiceRaw == null ? "" : choiceRaw.trim().toLowerCase(Locale.ROOT);
        if (!choice.equals("accepted") && !choice.equals("essential")) {
            throw ApiException.badRequest("Invalid cookie consent choice.");
        }
        return choice;
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) return value;
        }
        return null;
    }

    private static String trimToLimit(String value, int limit) {
        if (value == null) return null;
        String trimmed = value.trim();
        if (trimmed.isEmpty()) return null;
        if (trimmed.length() <= limit) return trimmed;
        return trimmed.substring(0, limit);
    }
}
