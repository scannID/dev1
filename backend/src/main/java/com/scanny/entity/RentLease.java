package com.scanny.entity;

import com.scanny.model.enums.RentLeaseStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;

/**
 * A lease agreement between a tenant and a unit.
 *
 * <p>A lease is the single source of truth for:
 * <ul>
 *   <li>When rent cycles start ({@code activationDate}).</li>
 *   <li>How long the lease runs ({@code termMonths} → {@code leaseEnd}).</li>
 *   <li>What monthly rent was agreed ({@code monthlyAmountSnapshot}) — snapshotted
 *       from the unit price at activation so future unit price changes never rewrite
 *       past or active leases.</li>
 * </ul>
 *
 * <p>Rent cycles are anchored to the {@code activationDate} day-of-month:
 * cycle N starts on the anniversary {@code N-1} months after activation and is
 * due one month later. Short-month clamping is applied (e.g. activated on the
 * 31st → Feb cycle is due on the 28th/29th).
 *
 * <p>At most one {@code ACTIVE} lease per unit is enforced by the partial unique
 * index {@code idx_rent_leases_one_active_per_unit}.
 */
@Entity
@Table(name = "rent_leases")
public class RentLease {

    @Id
    @Column(length = 36)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private RentTenant tenant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "unit_id", nullable = false)
    private RentUnit unit;

    /**
     * Monthly rent amount snapshotted from {@code unit.monthlyAmount} at activation.
     * Stored in the property's currency minor units (whole-number UGX for Uganda).
     */
    @Column(name = "monthly_amount_snapshot", nullable = false)
    private long monthlyAmountSnapshot;

    @Column(nullable = false, length = 8)
    private String currency = "UGX";

    /**
     * The date on which the lease starts and rent cycles begin.
     * Rent cycle N starts on the month-N anniversary of this date.
     */
    @Column(name = "activation_date", nullable = false)
    private LocalDate activationDate;

    /**
     * Number of whole calendar months the lease runs for.
     * Must be ≥ 1. Default 12.
     */
    @Column(name = "term_months", nullable = false)
    private int termMonths = 12;

    /**
     * Computed as {@code activationDate + termMonths}, with the day clamped
     * to the last valid day of the target month.
     * The last rent cycle is due on this date.
     */
    @Column(name = "lease_end", nullable = false)
    private LocalDate leaseEnd;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private RentLeaseStatus status = RentLeaseStatus.PENDING;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "created_by", length = 255)
    private String createdBy = "system";

    @Column(name = "updated_at")
    private Instant updatedAt;

    // ── Getters / setters ────────────────────────────────────────────────────

    public String getId()                              { return id; }
    public void setId(String id)                       { this.id = id; }

    public RentTenant getTenant()                      { return tenant; }
    public void setTenant(RentTenant t)                { this.tenant = t; }

    public RentUnit getUnit()                          { return unit; }
    public void setUnit(RentUnit u)                    { this.unit = u; }

    public long getMonthlyAmountSnapshot()             { return monthlyAmountSnapshot; }
    public void setMonthlyAmountSnapshot(long a)       { this.monthlyAmountSnapshot = a; }

    public String getCurrency()                        { return currency; }
    public void setCurrency(String c)                  { this.currency = c != null ? c : "UGX"; }

    public LocalDate getActivationDate()               { return activationDate; }
    public void setActivationDate(LocalDate d)         { this.activationDate = d; }

    public int getTermMonths()                         { return termMonths; }
    public void setTermMonths(int m)                   { this.termMonths = Math.max(1, m); }

    public LocalDate getLeaseEnd()                     { return leaseEnd; }
    public void setLeaseEnd(LocalDate d)               { this.leaseEnd = d; }

    public RentLeaseStatus getStatus()                 { return status; }
    public void setStatus(RentLeaseStatus s)           { this.status = s; }

    public Instant getCreatedAt()                      { return createdAt; }
    public void setCreatedAt(Instant t)                { this.createdAt = t; }

    public String getCreatedBy()                       { return createdBy; }
    public void setCreatedBy(String by)                { this.createdBy = by != null ? by : "system"; }

    public Instant getUpdatedAt()                      { return updatedAt; }
    public void setUpdatedAt(Instant t)                { this.updatedAt = t; }

    // ── Computed helpers ──────────────────────────────────────────────────────

    /**
     * True if the lease is currently ACTIVE and today is within the lease window.
     */
    public boolean isCurrentlyActive() {
        if (status != RentLeaseStatus.ACTIVE) return false;
        LocalDate today = LocalDate.now();
        return !today.isBefore(activationDate) && !today.isAfter(leaseEnd);
    }

    /**
     * Determines which 1-based month of the lease "today" falls in.
     * Month 1 starts on {@code activationDate}, month 2 starts one month later, etc.
     * Returns 0 if today is before the activation date.
     */
    public int currentMonthNumber() {
        return currentMonthNumber(LocalDate.now());
    }

    public int currentMonthNumber(LocalDate referenceDate) {
        if (referenceDate.isBefore(activationDate)) return 0;
        int months = monthsBetween(activationDate, referenceDate);
        return Math.min(months + 1, termMonths);
    }

    /**
     * Returns the start date of cycle N (1-based).
     * Clamped to the last valid day of the target month.
     */
    public LocalDate cycleStart(int n) {
        return clampedDatePlusMonths(activationDate, n - 1);
    }

    /**
     * Returns the due date (end) of cycle N (1-based).
     * Due date = cycleStart(N) + 1 month, clamped.
     */
    public LocalDate cycleDueDate(int n) {
        return clampedDatePlusMonths(activationDate, n);
    }

    /**
     * Returns the start of the cycle that contains the given reference date.
     * Returns null if the date is before activation.
     */
    public LocalDate currentCycleStart(LocalDate referenceDate) {
        int n = currentMonthNumber(referenceDate);
        if (n <= 0) return null;
        return cycleStart(n);
    }

    /**
     * Returns the due date of the cycle that contains the given reference date.
     */
    public LocalDate currentCycleDueDate(LocalDate referenceDate) {
        int n = currentMonthNumber(referenceDate);
        if (n <= 0) return null;
        return cycleDueDate(n);
    }

    // ── Static date math ─────────────────────────────────────────────────────

    /**
     * Adds {@code months} whole months to {@code base}, clamping the day to the
     * last valid day of the result month.
     *
     * <p>Examples:
     * <ul>
     *   <li>2026-10-31 + 1 month → 2026-11-30 (November only has 30 days)</li>
     *   <li>2028-01-29 + 1 month → 2028-02-29 (2028 is a leap year)</li>
     *   <li>2027-01-31 + 1 month → 2027-02-28</li>
     * </ul>
     */
    public static LocalDate clampedDatePlusMonths(LocalDate base, int months) {
        int targetYear  = base.getYear();
        int targetMonth = base.getMonthValue() + months;
        // Normalise overflow (e.g. month 13 → year+1, month 1)
        targetYear  += (targetMonth - 1) / 12;
        targetMonth  = ((targetMonth - 1) % 12) + 1;
        java.time.YearMonth ym = java.time.YearMonth.of(targetYear, targetMonth);
        int day = Math.min(base.getDayOfMonth(), ym.lengthOfMonth());
        return ym.atDay(day);
    }

    /**
     * Number of whole months between two dates (floor).
     * E.g. 2026-01-15 → 2026-03-14 = 1 (not yet 2 full months).
     */
    public static int monthsBetween(LocalDate from, LocalDate to) {
        int months = (to.getYear() - from.getYear()) * 12
                + (to.getMonthValue() - from.getMonthValue());
        // Subtract one if we haven't reached the day-of-month anniversary yet
        if (to.getDayOfMonth() < from.getDayOfMonth()) {
            months--;
        }
        return Math.max(0, months);
    }
}
