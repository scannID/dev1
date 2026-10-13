package com.scanny.efris;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Writes {@link EfrisSubmission} audit rows in an independent database transaction.
 *
 * <h3>Why a separate bean?</h3>
 * <p>Spring's {@code @Transactional} works by wrapping the bean in a proxy at
 * startup.  When method A calls method B on the <em>same</em> object
 * ({@code this.methodB()}), the call bypasses the proxy and any annotation on B
 * is silently ignored.
 *
 * <p>{@link EfrisSubmissionService#submitForOrder} needs to commit audit rows
 * <em>before</em> throwing {@link EfrisSubmissionService.EfrisRetryableException},
 * so that failure history is preserved even when the outbox re-queues the event.
 * Placing the save in this separate bean ensures every call goes through a real
 * Spring proxy and {@code REQUIRES_NEW} takes effect — the audit row commits
 * immediately, independently of whatever transaction (if any) the caller holds.
 */
@Component
public class EfrisAuditWriter {

    private static final Logger log = LoggerFactory.getLogger(EfrisAuditWriter.class);

    private final EfrisSubmissionRepository submissionRepository;

    public EfrisAuditWriter(EfrisSubmissionRepository submissionRepository) {
        this.submissionRepository = submissionRepository;
    }

    /**
     * Saves {@code row} in a new, immediately-committed transaction.
     *
     * <p>The caller's transaction (or lack of one) is completely unaffected:
     * <ul>
     *   <li>If the caller later throws, this row stays committed.</li>
     *   <li>If this save throws (e.g. DB down), the exception propagates to the
     *       caller but does not affect any outer transaction.</li>
     * </ul>
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void save(EfrisSubmission row) {
        submissionRepository.save(row);
        log.debug("EfrisAuditWriter: persisted {} row for order {} attempt {}",
                row.getStatus(), row.getOrderId(), row.getAttempt());
    }
}
