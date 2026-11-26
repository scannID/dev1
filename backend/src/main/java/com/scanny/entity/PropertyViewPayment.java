package com.scanny.entity;

import com.scanny.model.enums.RentPaymentStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Tracks payments for viewing property details (vacant units).
 * <p>
 * When a user scans a property QR code, they must pay a viewing fee (typically 2000 UGX)
 * before seeing the list of vacant units and property manager contact info.
 * <p>
 * This entity records each viewing payment to:
 * <ul>
 *   <li>Prevent duplicate charges for the same viewer</li>
 *   <li>Track revenue from property viewing fees</li>
 *   <li>Provide analytics on property interest</li>
 * </ul>
 */
@Entity
@Table(name = "property_view_payments")
public class PropertyViewPayment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * The property whose vacant units are being viewed.
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "property_id", nullable = false)
    private RentProperty property;

    /**
     * Unique transaction reference from the payment gateway.
     */
    @Column(name = "transaction_ref", nullable = false, unique = true, length = 128)
    private String transactionRef;

    /**
     * Mobile money number of the person viewing the property.
     */
    @Column(name = "viewer_phone", nullable = false, length = 64)
    private String viewerPhone;

    /**
     * Amount paid for viewing access (typically 2000 UGX).
     */
    @Column(nullable = false)
    private long amount;

    @Column(nullable = false, length = 8)
    private String currency = "UGX";

    /**
     * Payment status: Pending | Completed | Failed
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private RentPaymentStatus status = RentPaymentStatus.Pending;

    @Column(name = "paid_at")
    private Instant paidAt;

    @Column(name = "failed_at")
    private Instant failedAt;

    @Column(name = "failure_reason", columnDefinition = "TEXT")
    private String failureReason;

    /**
     * When this viewing access expires (optional — could be 24h or permanent).
     * Null = permanent access after payment.
     */
    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt;

    // ── Getters / setters ────────────────────────────────────────────────────

    public Long getId()                              { return id; }
    public void setId(Long id)                       { this.id = id; }

    public RentProperty getProperty()                { return property; }
    public void setProperty(RentProperty p)          { this.property = p; }

    public String getTransactionRef()                { return transactionRef; }
    public void setTransactionRef(String r)          { this.transactionRef = r; }

    public String getViewerPhone()                   { return viewerPhone; }
    public void setViewerPhone(String p)             { this.viewerPhone = p; }

    public long getAmount()                          { return amount; }
    public void setAmount(long a)                    { this.amount = a; }

    public String getCurrency()                      { return currency; }
    public void setCurrency(String c)                { this.currency = c != null ? c : "UGX"; }

    public RentPaymentStatus getStatus()             { return status; }
    public void setStatus(RentPaymentStatus s)       { this.status = s; }

    public Instant getPaidAt()                       { return paidAt; }
    public void setPaidAt(Instant t)                 { this.paidAt = t; }

    public Instant getFailedAt()                     { return failedAt; }
    public void setFailedAt(Instant t)               { this.failedAt = t; }

    public String getFailureReason()                 { return failureReason; }
    public void setFailureReason(String r)           { this.failureReason = r; }

    public Instant getExpiresAt()                    { return expiresAt; }
    public void setExpiresAt(Instant t)              { this.expiresAt = t; }

    public Instant getCreatedAt()                    { return createdAt; }
    public void setCreatedAt(Instant t)              { this.createdAt = t; }

    public Instant getUpdatedAt()                    { return updatedAt; }
    public void setUpdatedAt(Instant t)              { this.updatedAt = t; }
}
