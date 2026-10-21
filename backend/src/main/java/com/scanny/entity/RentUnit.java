package com.scanny.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * A rentable unit within a {@link RentProperty} (room, flat, office, stall, etc.).
 * Each unit has its own {@code monthlyAmount} and may have an optional per-unit
 * QR token for a door sticker that skips the unit-selection step.
 */
@Entity
@Table(name = "rent_units")
public class RentUnit {

    @Id
    @Column(length = 36)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "property_id", nullable = false)
    private RentProperty property;

    /** Display label, e.g. "A3", "Flat 5", "Ground Floor Office". */
    @Column(name = "unit_number", nullable = false, length = 64)
    private String unitNumber;

    @Column(nullable = false, length = 32)
    private String floor = "";

    /** Monthly rent amount in the property's currency. */
    @Column(name = "monthly_amount", nullable = false)
    private int monthlyAmount;

    @Column(name = "deposit_amount", nullable = false)
    private int depositAmount = 0;

    /**
     * Per-unit QR token — {@code /rent/pay/:qrToken} takes the tenant directly
     * to the payment form without a unit-selection step.
     * Auto-generated with 128-bit {@code SecureRandom} on unit creation (never null
     * after V59 migration).
     */
    @Column(name = "qr_token", unique = true, length = 128)
    private String qrToken;

    /**
     * Day of the month (1–28) on which rent is due each period.
     * Capped at 28 to avoid month-length edge cases (no Feb-29 surprises).
     * Default 5 = 5th of the month.
     */
    @Column(name = "due_day_of_month", nullable = false)
    private int dueDayOfMonth = 5;

    /**
     * Number of calendar days after the due date before a charge flips to OVERDUE.
     * 0 = overdue the day after the due date (strictest).
     */
    @Column(name = "grace_period_days", nullable = false)
    private int gracePeriodDays = 0;

    @OneToMany(mappedBy = "unit", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("createdAt DESC")
    private List<RentTenant> tenants = new ArrayList<>();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    // ── Getters / setters ────────────────────────────────────────────────────

    public String getId()                        { return id; }
    public void setId(String id)                 { this.id = id; }

    public RentProperty getProperty()            { return property; }
    public void setProperty(RentProperty p)      { this.property = p; }

    public String getUnitNumber()                { return unitNumber; }
    public void setUnitNumber(String n)          { this.unitNumber = n; }

    public String getFloor()                     { return floor; }
    public void setFloor(String f)               { this.floor = f != null ? f : ""; }

    public int getMonthlyAmount()                { return monthlyAmount; }
    public void setMonthlyAmount(int a)          { this.monthlyAmount = a; }

    public int getDepositAmount()                { return depositAmount; }
    public void setDepositAmount(int a)          { this.depositAmount = a; }

    public String getQrToken()                   { return qrToken; }
    public void setQrToken(String t)             { this.qrToken = t; }

    public int getDueDayOfMonth()                { return dueDayOfMonth; }
    public void setDueDayOfMonth(int d) {
        if (d < 1 || d > 28) throw new IllegalArgumentException("dueDayOfMonth must be 1–28");
        this.dueDayOfMonth = d;
    }

    public int getGracePeriodDays()              { return gracePeriodDays; }
    public void setGracePeriodDays(int g) {
        if (g < 0) throw new IllegalArgumentException("gracePeriodDays must be >= 0");
        this.gracePeriodDays = g;
    }

    public List<RentTenant> getTenants()         { return tenants; }
    public void setTenants(List<RentTenant> t)   { this.tenants = t; }

    public Instant getCreatedAt()                { return createdAt; }
    public void setCreatedAt(Instant t)          { this.createdAt = t; }

    /** Returns the active tenant in this unit, or null if vacant. */
    public RentTenant getActiveTenant() {
        return tenants.stream().filter(RentTenant::isActive).findFirst().orElse(null);
    }

    /**
     * Computes the due date for a given period label (e.g. "2026-11"), clamping
     * to the last valid day of the month so "day 31 in February" never throws.
     */
    public java.time.LocalDate dueDateForPeriod(String periodLabel) {
        java.time.YearMonth ym = java.time.YearMonth.parse(periodLabel);
        int day = Math.min(dueDayOfMonth, ym.lengthOfMonth());
        return ym.atDay(day);
    }
}
