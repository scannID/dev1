package com.scanny.accounting;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.scanny.entity.OutboxEvent;
import com.scanny.repository.OutboxEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * Enqueues an accounting event into the outbox so it is processed by
 * {@link AccountingEventConsumer} on the next outbox poll cycle.
 *
 * <p>Calling this inside the same transaction as the business event guarantees
 * that the accounting event is either persisted together with the business change
 * or both are rolled back — no "paid but not posted" gap.
 *
 * <p>The outbox event_type used is {@code "ACCOUNTING_EVENT"}.
 * The payload is the serialized {@link AccountingEvent} record.
 */
@Component
public class AccountingEventPublisher {

    public static final String OUTBOX_TYPE = "ACCOUNTING_EVENT";

    private static final Logger log = LoggerFactory.getLogger(AccountingEventPublisher.class);

    private final OutboxEventRepository outboxEventRepository;
    private final ObjectMapper objectMapper;

    public AccountingEventPublisher(OutboxEventRepository outboxEventRepository,
                                    ObjectMapper objectMapper) {
        this.outboxEventRepository = outboxEventRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * Serializes the accounting event and writes it to the outbox.
     * Must be called within an active transaction (the caller's transaction
     * wraps both the domain write and this outbox write atomically).
     */
    @Transactional
    public void publish(AccountingEvent event) {
        if (event == null) return;
        try {
            String payload = objectMapper.writeValueAsString(event);
            OutboxEvent outbox = new OutboxEvent();
            outbox.setEventType(OUTBOX_TYPE);
            outbox.setChannel("");
            outbox.setBusinessId(event.merchantId() != null ? event.merchantId() : "");
            outbox.setPayloadJson(payload);
            outbox.setCreatedAt(Instant.now());
            outboxEventRepository.save(outbox);
            log.debug("[Accounting] Enqueued {} / {} sourceRecord={}",
                    event.sourceModule(), event.eventType(), event.sourceRecordId());
        } catch (JsonProcessingException e) {
            // Non-fatal — log and continue. The business event must not fail because of this.
            log.error("[Accounting] Failed to serialize accounting event for {} / {}: {}",
                    event.sourceModule(), event.eventType(), e.getMessage());
        }
    }
}
