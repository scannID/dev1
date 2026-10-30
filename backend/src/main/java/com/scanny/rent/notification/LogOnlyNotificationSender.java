package com.scanny.rent.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

/**
 * Log-only implementation of {@link NotificationSender}.
 *
 * <p>This is the {@code @Primary} bean so it is injected everywhere unless a
 * more specific qualifier is requested.  It writes a structured INFO log entry
 * and does nothing else — no network calls, no queuing.  Replace (or override
 * with a non-primary bean + qualifier) when real delivery is needed.
 *
 * <p>Log format: {@code [RentNotif] channel={} recipient={} ref={} body="{}"}.
 * The body is truncated to 200 characters in the log to avoid flooding.
 */
@Primary
@Component
public class LogOnlyNotificationSender implements NotificationSender {

    private static final Logger log = LoggerFactory.getLogger(LogOnlyNotificationSender.class);
    private static final int LOG_BODY_LIMIT = 200;

    @Override
    public void send(String channel, String recipient, String subject,
                     String body, String referenceId) {
        String preview = body != null && body.length() > LOG_BODY_LIMIT
                ? body.substring(0, LOG_BODY_LIMIT) + "…"
                : body;
        log.info("[RentNotif] WOULD-SEND channel={} recipient={} ref={} subject=\"{}\" body=\"{}\"",
                channel, recipient, referenceId, subject, preview);
    }
}
