package com.scanny.efris;

import com.scanny.entity.Order;
import com.scanny.entity.Receipt.EfrisStatus;
import com.scanny.repository.OrderRepository;
import com.scanny.repository.ReceiptRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * Orchestrates EFRIS submission for a single order.
 *
 * <h3>Flow</h3>
 * <ol>
 *   <li>Load the order and resolve the merchant's EFRIS config (null → stub / exempt).</li>
 *   <li>Deduplication guard — skip entirely if a SUCCESS or STUB row already exists.</li>
 *   <li>Call {@link EfrisApiClient#submit} (live or stub).</li>
 *   <li>Delegate audit-row persistence to {@link EfrisAuditWriter} — a separate Spring
 *       bean whose {@code REQUIRES_NEW} transaction commits immediately and independently
 *       of whatever the caller is doing.</li>
 *   <li>On success: update the {@link com.scanny.entity.Receipt} with FDN + QR + SUBMITTED.</li>
 *   <li>On failure: throw {@link EfrisRetryableException} if attempts remain so the
 *       outbox keeps the event unprocessed; otherwise mark the receipt FAILED.</li>
 * </ol>
 *
 * <h3>Transaction design</h3>
 * <p>{@code submitForOrder} itself carries no {@code @Transactional} annotation —
 * it does not hold a transaction of its own.  All database writes go through either:
 * <ul>
 *   <li>{@link EfrisAuditWriter#save} — {@code REQUIRES_NEW}, commits before control
 *       returns here.  Audit rows are durable even when a retry exception follows.</li>
 *   <li>{@link #updateReceipt} / {@link #markReceiptExempt} — each carries
 *       {@code @Transactional} and commits on return.</li>
 * </ul>
 * This avoids the Spring proxy self-invocation problem: calling {@code REQUIRES_NEW}
 * methods on {@code this} bypasses the proxy and the annotation is silently ignored.
 * By routing through a distinct bean ({@code EfrisAuditWriter}) the proxy is always
 * in the call path.
 *
 * <h3>Idempotency / duplicate-FDN protection</h3>
 * <p>The deduplication guard at step 2 is the primary protection against issuing a
 * second fiscal document after a lost-response retry.  The guard only holds when the
 * audit row for a successful submission has already committed — which is guaranteed by
 * the {@code REQUIRES_NEW} design above.
 *
 * <p>As a best-effort secondary hint, the request envelope carries a deterministic
 * {@code dataExchangeId} derived from {@code SHA-256(orderId + ":" + attempt)}.
 * Whether URA actually deduplicates on this field is not guaranteed by the public
 * v3 spec and must be verified against the live EFRIS sandbox before relying on it
 * as a hard guarantee.  The Scanny-side guard is the reliable layer.
 *
 * <h3>Retry-limit semantics</h3>
 * <p>{@code maxRetries} = maximum <em>total</em> attempts (initial + retries).
 * With the default of 3: attempt 1 (initial) and attempt 2 (retry 1) throw
 * {@link EfrisRetryableException}; attempt 3 (retry 2, last) marks the receipt FAILED
 * if it also fails.
 */
@Service
public class EfrisSubmissionService {

    private static final Logger log = LoggerFactory.getLogger(EfrisSubmissionService.class);

    private final EfrisProperties               props;
    private final EfrisApiClient                apiClient;
    private final EfrisMerchantConfigRepository configRepository;
    private final EfrisSubmissionRepository     submissionRepository;
    private final EfrisAuditWriter              auditWriter;
    private final OrderRepository               orderRepository;
    private final ReceiptRepository             receiptRepository;

    public EfrisSubmissionService(
            EfrisProperties props,
            EfrisApiClient apiClient,
            EfrisMerchantConfigRepository configRepository,
            EfrisSubmissionRepository submissionRepository,
            EfrisAuditWriter auditWriter,
            OrderRepository orderRepository,
            ReceiptRepository receiptRepository
    ) {
        this.props                = props;
        this.apiClient            = apiClient;
        this.configRepository     = configRepository;
        this.submissionRepository = submissionRepository;
        this.auditWriter          = auditWriter;
        this.orderRepository      = orderRepository;
        this.receiptRepository    = receiptRepository;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Submits the order identified by {@code orderId} to EFRIS.
     * Called by {@link com.scanny.service.OutboxDispatcher} from the EFRIS outbox event.
     *
     * <p>No {@code @Transactional} annotation here — each internal write opens its
     * own transaction through the appropriate bean.  See class-level Javadoc for the
     * full transaction design.
     *
     * @throws EfrisRetryableException when the attempt failed and retries remain.
     *         The outbox dispatcher leaves the event unprocessed; the next poll cycle
     *         retries automatically.  The audit row for this failed attempt has already
     *         committed before the exception is thrown.
     */
    public void submitForOrder(String orderId) {

        // ── Load order ─────────────────────────────────────────────────────────
        Order order = orderRepository.findWithItemsById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderId));

        // ── Deduplication guard ─────────────────────────────────────────────────
        // Primary protection against duplicate FDNs on lost-response retries.
        // The guard is reliable because the SUCCESS audit row commits atomically
        // (via EfrisAuditWriter.REQUIRES_NEW) before updateReceipt() is called.
        if (submissionRepository.existsSuccessfulSubmission(orderId)) {
            log.debug("EfrisSubmissionService: order {} already submitted — skipping", orderId);
            return;
        }

        // ── Merchant EFRIS config ──────────────────────────────────────────────
        String merchantId = order.getMerchantId();
        EfrisMerchantConfig config = configRepository
                .findByMerchantIdAndEnabledTrue(merchantId)
                .orElse(null);

        if (!props.isEnabled() && config == null) {
            // Dev / staging: run through stub so the receipt gets an FDN.
            runStub(order);
            return;
        }

        if (props.isEnabled() && config == null) {
            // Live mode, merchant not enrolled — mark exempt immediately.
            markReceiptExempt(orderId, merchantId);
            return;
        }

        // ── Attempt submission ─────────────────────────────────────────────────
        // Attempt number = (previously committed FAILED rows) + 1.
        long failedAttempts = submissionRepository.countFailedAttempts(orderId);
        int  attemptNumber  = (int) failedAttempts + 1;

        EfrisApiClient.EfrisResult result = apiClient.submit(order, config, attemptNumber);

        if (result.stub()) {
            // Defensive guard — should not reach here with enabled=true + config != null.
            runStub(order);
            return;
        }

        if (result.success()) {
            // Commit the SUCCESS audit row FIRST via the separate bean so the dedup guard
            // is satisfied before updateReceipt touches the Receipt table.  If updateReceipt
            // subsequently fails, the audit row stays committed and the next call will
            // hit the dedup guard and no-op, preventing a second URA submission.
            auditWriter.save(EfrisSubmission.success(
                    orderId, order.getBusiness().getId(), attemptNumber,
                    result.fdn(), result.qrUrl(),
                    result.requestJson(), result.responseJson(), result.httpStatus()
            ));
            updateReceipt(orderId, result.fdn(), result.qrUrl(), EfrisStatus.SUBMITTED);
            log.info("EfrisSubmissionService: FDN {} issued for order {} (attempt {})",
                    result.fdn(), orderId, attemptNumber);

        } else {
            // Commit the FAILED audit row BEFORE throwing so it is never rolled back
            // by the retry exception.  History is preserved across all attempts.
            auditWriter.save(EfrisSubmission.failed(
                    orderId, order.getBusiness().getId(), attemptNumber,
                    result.requestJson(), result.errorMessage(), result.httpStatus()
            ));

            // maxRetries = max total attempts; < means "more attempts are still allowed".
            if (attemptNumber < props.getMaxRetries()) {
                log.warn("EfrisSubmissionService: attempt {}/{} failed for order {} — will retry: {}",
                        attemptNumber, props.getMaxRetries(), orderId, result.errorMessage());
                throw new EfrisRetryableException(
                        "EFRIS attempt " + attemptNumber + "/" + props.getMaxRetries()
                        + " failed for order " + orderId + ": " + result.errorMessage());
            } else {
                // Final attempt exhausted — stop retrying.
                updateReceipt(orderId, null, null, EfrisStatus.FAILED);
                log.error("EfrisSubmissionService: all {} attempts exhausted for order {} — marked FAILED",
                        props.getMaxRetries(), orderId);
            }
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void runStub(Order order) {
        // auditWriter.save goes through the proxy — REQUIRES_NEW fires correctly.
        EfrisApiClient.EfrisResult result = apiClient.submit(order, null, 1);
        auditWriter.save(EfrisSubmission.stub(
                order.getId(), order.getBusiness().getId(),
                result.fdn(), result.qrUrl()));
        updateReceipt(order.getId(), result.fdn(), result.qrUrl(), EfrisStatus.SUBMITTED);
        log.info("EfrisSubmissionService: STUB FDN {} for order {}", result.fdn(), order.getId());
    }

    @Transactional
    public void updateReceipt(String orderId, String fdn, String qrUrl, EfrisStatus status) {
        receiptRepository.findByOrderId(orderId).ifPresent(receipt -> {
            receipt.setEfrisFdn(fdn);
            receipt.setEfrisQrUrl(qrUrl);
            receipt.setEfrisStatus(status);
            receipt.setUpdatedAt(Instant.now()
                    .atZone(java.time.ZoneOffset.UTC)
                    .toLocalDateTime());
            receiptRepository.save(receipt);
        });
    }

    @Transactional
    public void markReceiptExempt(String orderId, String merchantId) {
        receiptRepository.findByOrderId(orderId).ifPresent(receipt -> {
            receipt.setEfrisStatus(EfrisStatus.EXEMPT);
            receipt.setUpdatedAt(Instant.now()
                    .atZone(java.time.ZoneOffset.UTC)
                    .toLocalDateTime());
            receiptRepository.save(receipt);
        });
        log.info("EfrisSubmissionService: merchant {} not enrolled — order {} marked EXEMPT",
                merchantId, orderId);
    }

    // ── Exception types ───────────────────────────────────────────────────────

    /**
     * Signals the outbox dispatcher that this submission failed transiently and
     * the event should stay unprocessed for retry on the next poll cycle.
     *
     * <p>By the time this exception is thrown, the FAILED {@link EfrisSubmission}
     * audit row has already been committed by {@link EfrisAuditWriter} — the failure
     * history is durable regardless of what the dispatcher does with this exception.
     */
    public static class EfrisRetryableException extends RuntimeException {
        public EfrisRetryableException(String message) {
            super(message);
        }
    }
}
