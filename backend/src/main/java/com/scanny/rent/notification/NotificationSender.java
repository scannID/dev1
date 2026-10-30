package com.scanny.rent.notification;

/**
 * Abstraction for sending rent-related notifications (WhatsApp, SMS, email).
 *
 * <p>The active implementation is chosen via Spring's primary/qualifier mechanism.
 * The default (and only current) implementation is {@link LogOnlyNotificationSender},
 * which writes structured log entries instead of dispatching real messages.
 * A real WhatsApp / Twilio sender will replace it when the integration is ready.
 *
 * <p>All implementations must be idempotent — the scheduler may call them more
 * than once for the same notification row if a retry occurs.
 */
public interface NotificationSender {

    /**
     * Send (or enqueue) a notification.
     *
     * @param channel     delivery channel, e.g. {@code "WHATSAPP"}, {@code "SMS"}
     * @param recipient   normalised phone number or email address
     * @param subject     short subject / title (used by email; may be blank for SMS/WA)
     * @param body        full message body
     * @param referenceId an opaque ID linking this notification to a DB row
     *                    (e.g. {@code "RENT_NOTIF:" + notifId}) for de-duplication
     */
    void send(String channel, String recipient, String subject, String body, String referenceId);
}
