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
 * A single payment attempt toward a {@link RentCharge}.
 * {@code transactionRef} links back to the {@link PaymentIntent} created by
 * the payment gateway, allowing the standard callback flow to locate this row
 * and mark it {@code Completed} or {@code Failed}.
 */
@Entity
@Table(name = "rent_payments")
public class RentPayment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "charge_id", nullable = false)
    private RentCharge charge;

    /** Unique reference that also serves as the PaymentIntent referenceId. */
    @Column(name = "transaction_ref", nullable = false, unique = true, length = 128)
    private String transactionRef;

    @Column(nullable = false)
    private int amount;

    @Column(nullable = false, length = 8)
    private String currency = "UGX";

    @Column(name = "payment_method", nullable = false, length = 32)
    private String paymentMethod = "MobileMoney";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private RentPaymentStatus status = RentPaymentStatus.Pending;

    @Column(name = "paid_at")
    private Instant paidAt;

    @Column(name = "failed_at")
    private Instant failedAt;

    @Column(name = "failure_reason", columnDefinition = "TEXT")
    private String failureReason;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    // ── Getters / setters ────────────────────────────────────────────────────

    public Long getId()                              { return id; }
    public void setId(Long id)                       { this.id = id; }

    public RentCharge getCharge()                    { return charge; }
    public void setCharge(RentCharge c)              { this.charge = c; }

    public String getTransactionRef()                { return transactionRef; }
    public void setTransactionRef(String r)          { this.transactionRef = r; }

    public int getAmount()                           { return amount; }
    public void setAmount(int a)                     { this.amount = a; }

    public String getCurrency()                      { return currency; }
    public void setCurrency(String c)                { this.currency = c != null ? c : "UGX"; }

    public String getPaymentMethod()                 { return paymentMethod; }
    public void setPaymentMethod(String m)           { this.paymentMethod = m; }

    public RentPaymentStatus getStatus()             { return status; }
    public void setStatus(RentPaymentStatus s)       { this.status = s; }

    public Instant getPaidAt()                       { return paidAt; }
    public void setPaidAt(Instant t)                 { this.paidAt = t; }

    public Instant getFailedAt()                     { return failedAt; }
    public void setFailedAt(Instant t)               { this.failedAt = t; }

    public String getFailureReason()                 { return failureReason; }
    public void setFailureReason(String r)           { this.failureReason = r; }

    public Instant getCreatedAt()                    { return createdAt; }
    public void setCreatedAt(Instant t)              { this.createdAt = t; }
}
