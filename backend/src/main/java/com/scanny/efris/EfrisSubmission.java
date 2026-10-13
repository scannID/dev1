package com.scanny.efris;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * Immutable audit record for every EFRIS submission attempt.
 *
 * <p>One row is written per attempt (up to {@code maxRetries}).  Rows are never
 * updated — a fresh row is inserted for each retry so the full history is preserved.
 * The most recent row for an orderId with {@code status = SUCCESS} is the canonical
 * fiscal record.
 */
@Entity
@Table(
    name = "efris_submissions",
    indexes = {
        @Index(name = "idx_efris_sub_order",    columnList = "order_id"),
        @Index(name = "idx_efris_sub_business", columnList = "business_id, attempted_at")
    }
)
public class EfrisSubmission {

    @Id
    @Column(nullable = false, updatable = false, length = 64)
    private String id;

    @Column(name = "order_id", nullable = false, updatable = false, length = 64)
    private String orderId;

    @Column(name = "business_id", nullable = false, updatable = false, length = 64)
    private String businessId;

    /** 1-based attempt number for this order. */
    @Column(name = "attempt", nullable = false, updatable = false)
    private int attempt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EfrisSubmissionStatus status;

    public enum EfrisSubmissionStatus {
        SUCCESS, FAILED, STUB
    }

    /**
     * Fiscal Document Number returned by URA on SUCCESS, or a fake value on STUB.
     * Null on FAILED rows.
     */
    @Column(name = "fdn", length = 100)
    private String fdn;

    /** URA verification URL returned on SUCCESS / generated for STUB. */
    @Column(name = "qr_url", columnDefinition = "TEXT")
    private String qrUrl;

    /** Raw JSON request sent to URA (null in STUB mode). */
    @Column(name = "request_json", columnDefinition = "TEXT")
    private String requestJson;

    /** Raw JSON response from URA, or error message on FAILED. */
    @Column(name = "response_json", columnDefinition = "TEXT")
    private String responseJson;

    /** HTTP status code returned by URA, or 0 for network/timeout errors. */
    @Column(name = "http_status")
    private int httpStatus;

    /** Wall-clock time when this attempt was made. */
    @Column(name = "attempted_at", nullable = false, updatable = false)
    private Instant attemptedAt = Instant.now();

    // ── Factory ───────────────────────────────────────────────────────────────

    public static EfrisSubmission success(
            String orderId, String businessId, int attempt,
            String fdn, String qrUrl, String requestJson, String responseJson, int httpStatus
    ) {
        EfrisSubmission s = new EfrisSubmission();
        s.id           = UUID.randomUUID().toString();
        s.orderId      = orderId;
        s.businessId   = businessId;
        s.attempt      = attempt;
        s.status       = EfrisSubmissionStatus.SUCCESS;
        s.fdn          = fdn;
        s.qrUrl        = qrUrl;
        s.requestJson  = requestJson;
        s.responseJson = responseJson;
        s.httpStatus   = httpStatus;
        return s;
    }

    public static EfrisSubmission failed(
            String orderId, String businessId, int attempt,
            String requestJson, String errorMessage, int httpStatus
    ) {
        EfrisSubmission s = new EfrisSubmission();
        s.id           = UUID.randomUUID().toString();
        s.orderId      = orderId;
        s.businessId   = businessId;
        s.attempt      = attempt;
        s.status       = EfrisSubmissionStatus.FAILED;
        s.requestJson  = requestJson;
        s.responseJson = errorMessage;
        s.httpStatus   = httpStatus;
        return s;
    }

    public static EfrisSubmission stub(String orderId, String businessId, String fdn, String qrUrl) {
        EfrisSubmission s = new EfrisSubmission();
        s.id         = UUID.randomUUID().toString();
        s.orderId    = orderId;
        s.businessId = businessId;
        s.attempt    = 1;
        s.status     = EfrisSubmissionStatus.STUB;
        s.fdn        = fdn;
        s.qrUrl      = qrUrl;
        s.httpStatus = 0;
        return s;
    }

    // ── Getters ───────────────────────────────────────────────────────────────

    public String getId()           { return id; }
    public String getOrderId()      { return orderId; }
    public String getBusinessId()   { return businessId; }
    public int getAttempt()         { return attempt; }
    public EfrisSubmissionStatus getStatus() { return status; }
    public String getFdn()          { return fdn; }
    public String getQrUrl()        { return qrUrl; }
    public String getRequestJson()  { return requestJson; }
    public String getResponseJson() { return responseJson; }
    public int getHttpStatus()      { return httpStatus; }
    public Instant getAttemptedAt() { return attemptedAt; }
}
