package com.scanny.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Records a customer device visit that did not result in a placed order,
 * capturing the last checkout step they reached. Used to:
 * <ul>
 *   <li>Re-engage the customer with an in-app nudge on their next scan</li>
 *   <li>Collect feedback about why they stopped</li>
 *   <li>Power funnel drop-off analytics in the admin console</li>
 * </ul>
 *
 * One un-notified row per (deviceId, businessId) — upserted on each step update.
 * Once the nudge is shown, {@code notified} is set to true so the nudge doesn't repeat
 * on every subsequent scan.
 */
@Entity
@Table(name = "customer_funnel_drops")
public class CustomerFunnelDrop {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Stable anonymous device UUID stored in the customer's browser localStorage. */
    @Column(name = "device_id", nullable = false, length = 128)
    private String deviceId;

    @Column(name = "business_id", nullable = false, length = 64)
    private String businessId;

    /** Which QR table/token was scanned. May be the business-level token. */
    @Column(name = "qr_token", nullable = false, length = 128)
    private String qrToken = "";

    /**
     * The last checkout step the customer was on before they left.
     * Values mirror the frontend {@code CheckoutStep} type:
     * {@code menu | cart | details | pay}
     */
    @Column(name = "last_step", nullable = false, length = 32)
    private String lastStep;

    /** Phone number — only available when customer reached the pay step and typed it. */
    @Column(name = "phone", length = 32)
    private String phone;

    @Column(name = "dropped_at", nullable = false)
    private Instant droppedAt = Instant.now();

    /** True once the nudge banner has been shown to the customer on a subsequent scan. */
    @Column(name = "notified", nullable = false)
    private boolean notified = false;

    /** True once the customer has submitted a feedback reason. */
    @Column(name = "feedback_given", nullable = false)
    private boolean feedbackGiven = false;

    /** Quick-tap reason code (e.g. {@code "too_expensive"}, {@code "just_browsing"}). */
    @Column(name = "feedback_reason", length = 64)
    private String feedbackReason;

    /** Optional free-text elaboration provided by the customer. */
    @Column(name = "feedback_text", columnDefinition = "TEXT")
    private String feedbackText;

    @Column(name = "feedback_at")
    private Instant feedbackAt;

    // ── Getters / setters ────────────────────────────────────────────────────

    public Long getId()                    { return id; }
    public void setId(Long id)             { this.id = id; }

    public String getDeviceId()            { return deviceId; }
    public void setDeviceId(String d)      { this.deviceId = d; }

    public String getBusinessId()          { return businessId; }
    public void setBusinessId(String b)    { this.businessId = b; }

    public String getQrToken()             { return qrToken; }
    public void setQrToken(String q)       { this.qrToken = q != null ? q : ""; }

    public String getLastStep()            { return lastStep; }
    public void setLastStep(String s)      { this.lastStep = s; }

    public String getPhone()               { return phone; }
    public void setPhone(String p)         { this.phone = p; }

    public Instant getDroppedAt()          { return droppedAt; }
    public void setDroppedAt(Instant t)    { this.droppedAt = t; }

    public boolean isNotified()            { return notified; }
    public void setNotified(boolean n)     { this.notified = n; }

    public boolean isFeedbackGiven()       { return feedbackGiven; }
    public void setFeedbackGiven(boolean f){ this.feedbackGiven = f; }

    public String getFeedbackReason()      { return feedbackReason; }
    public void setFeedbackReason(String r){ this.feedbackReason = r; }

    public String getFeedbackText()        { return feedbackText; }
    public void setFeedbackText(String t)  { this.feedbackText = t; }

    public Instant getFeedbackAt()         { return feedbackAt; }
    public void setFeedbackAt(Instant t)   { this.feedbackAt = t; }
}
