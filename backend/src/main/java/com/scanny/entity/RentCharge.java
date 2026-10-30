package com.scanny.entity;

import com.scanny.model.enums.RentChargeStatus;
import jakarta.persistence.CascadeType;
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
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * A single rent charge for a tenant for one period (e.g. "2026-11").
 * One charge may have multiple {@link RentPayment} rows (partial payments).
 * The {@code status} is computed/updated by {@code RentChargeService} as
 * payments arrive.
 * <p>
 * {@code UNIQUE (tenant_id, period_label)} prevents double-generation for the
 * same period.
 */
@Entity
@Table(
    name = "rent_charges",
    uniqueConstraints = @UniqueConstraint(columnNames = {"tenant_id", "period_label"})
)
public class RentCharge {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private RentTenant tenant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "unit_id", nullable = false)
    private RentUnit unit;

    @Column(nullable = false)
    private long amount;

    @Column(nullable = false, length = 8)
    private String currency = "UGX";

    /** ISO year-month string, e.g. "2026-11". Used as the deduplication key. */
    @Column(name = "period_label", nullable = false, length = 32)
    private String periodLabel;

    @Column(name = "due_date", nullable = false)
    private LocalDate dueDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private RentChargeStatus status = RentChargeStatus.UNPAID;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @OneToMany(mappedBy = "charge", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("createdAt DESC")
    private List<RentPayment> payments = new ArrayList<>();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "created_by", length = 255)
    private String createdBy = "system";

    @Column(name = "updated_at")
    private Instant updatedAt;

    /**
     * The start date of this rent cycle.
     * Null for legacy charges created before the Lease feature (V64).
     * Together with {@code dueDate} this defines the exact cycle window shown
     * on the tenant pay page calendar.
     */
    @Column(name = "period_start")
    private LocalDate periodStart;

    /**
     * The lease this charge belongs to.
     * Null for legacy charges created via the manual generation flow before V64.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lease_id")
    private RentLease lease;

    // ── Getters / setters ────────────────────────────────────────────────────

    public Long getId()                          { return id; }
    public void setId(Long id)                   { this.id = id; }

    public RentTenant getTenant()                { return tenant; }
    public void setTenant(RentTenant t)          { this.tenant = t; }

    public RentUnit getUnit()                    { return unit; }
    public void setUnit(RentUnit u)              { this.unit = u; }

    public long getAmount()                      { return amount; }
    public void setAmount(long a)                { this.amount = a; }

    public String getCurrency()                  { return currency; }
    public void setCurrency(String c)            { this.currency = c != null ? c : "UGX"; }

    public String getPeriodLabel()               { return periodLabel; }
    public void setPeriodLabel(String p)         { this.periodLabel = p; }

    public LocalDate getDueDate()                { return dueDate; }
    public void setDueDate(LocalDate d)          { this.dueDate = d; }

    public RentChargeStatus getStatus()          { return status; }
    public void setStatus(RentChargeStatus s)    { this.status = s; }

    public String getNotes()                     { return notes; }
    public void setNotes(String n)               { this.notes = n; }

    public List<RentPayment> getPayments()       { return payments; }
    public void setPayments(List<RentPayment> p) { this.payments = p; }

    public Instant getCreatedAt()                { return createdAt; }
    public void setCreatedAt(Instant t)          { this.createdAt = t; }

    public String getCreatedBy()                 { return createdBy; }
    public void setCreatedBy(String by)          { this.createdBy = by != null ? by : "system"; }

    public Instant getUpdatedAt()                      { return updatedAt; }
    public void setUpdatedAt(Instant t)                { this.updatedAt = t; }

    public LocalDate getPeriodStart()                  { return periodStart; }
    public void setPeriodStart(LocalDate d)            { this.periodStart = d; }

    public RentLease getLease()                        { return lease; }
    public void setLease(RentLease l)                  { this.lease = l; }

    /** Sum of completed payments toward this charge. */
    public long getPaidAmount() {
        return payments.stream()
                .filter(p -> p.getStatus() == com.scanny.model.enums.RentPaymentStatus.Completed)
                .mapToLong(RentPayment::getAmount)
                .sum();
    }

    /** Remaining balance after completed payments. */
    public long getOutstandingAmount() {
        return Math.max(0, amount - getPaidAmount());
    }
}
