package com.scanny.accounting;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Dequeues {@code ACCOUNTING_EVENT} outbox rows and delegates to
 * {@link PostingService}.
 *
 * <p>Called from {@link com.scanny.service.OutboxDispatcher#process} for
 * events with type {@link AccountingEventPublisher#OUTBOX_TYPE}.
 *
 * <p>Each posting runs in its own {@code REQUIRES_NEW} transaction inside
 * {@code PostingService.post()}. A failure there rolls back only the posting
 * transaction; the outbox event is marked processed anyway (in the caller's
 * original transaction) so the outbox does not retry the same event forever.
 * Instead the failure is written to {@code accounting.posting_failures} for
 * manual investigation.
 */
@Component
public class AccountingEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(AccountingEventConsumer.class);

    private final PostingService postingService;
    private final ObjectMapper   objectMapper;

    public AccountingEventConsumer(PostingService postingService, ObjectMapper objectMapper) {
        this.postingService = postingService;
        this.objectMapper   = objectMapper;
    }

    /**
     * Deserializes the outbox payload and calls {@link PostingService#post}.
     * Any {@link PostingException} is caught here so the caller's transaction
     * is not rolled back; the event is routed to the dead-letter queue instead.
     *
     * @param payloadJson the raw JSON stored in {@code outbox_events.payload_json}
     */
    public void consume(String payloadJson) {
        AccountingEvent event = null;
        try {
            event = objectMapper.readValue(payloadJson, AccountingEvent.class);
            postingService.post(event);
        } catch (Exception e) {
            log.error("[Accounting] Posting failed for payload: {} — error: {}",
                    payloadJson, e.getMessage(), e);
            if (event != null) {
                postingService.recordFailure(event, e.getMessage(), payloadJson);
            }
            // Do NOT re-throw — let the outbox dispatcher mark the event as processed
            // so the same event is not retried infinitely. The failure is in the DLQ.
        }
    }
}
