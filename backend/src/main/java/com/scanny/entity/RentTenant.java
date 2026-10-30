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
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * A tenant occupying a {@link RentUnit}.
 * {@code payToken} is a unique token used in the tenant's personal payment URL
 * ({@code /rent/pay/:payToken}) — pre-fills their unit and outstanding balance.
 */
@Entity
@Table(name = "rent_tenants")
public class RentTenant {

    @Id
    @Column(length = 36)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "unit_id", nullable = false)
    private RentUnit unit;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(nullable = false, length = 32)
    private String phone;

    @Column(nullable = false, length = 255)
    private String email = "";

    @Column(name = "move_in_date")
    private LocalDate moveInDate;

    /**
     * Optional end date of the current lease. Null means no fixed end date.
     * When set and the date has passed, the tenant can be automatically flagged
     * or deactivated by a future scheduled job.
     */
    @Column(name = "lease_end")
    private LocalDate leaseEnd;

    @Column(nullable = false)
    private boolean active = true;

    /** Unique token for the tenant's personal pay link — never changes. */
    @Column(name = "pay_token", nullable = false, unique = true, length = 128)
    private String payToken;

    /**
     * Optional national ID number for identification purposes.
     * Not validated — stored as-entered.
     */
    @Column(name = "national_id_number", length = 64)
    private String nationalIdNumber;

    @OneToMany(mappedBy = "tenant", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("dueDate DESC")
    private List<RentCharge> charges = new ArrayList<>();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "created_by", length = 255)
    private String createdBy = "system";

    @Column(name = "updated_at")
    private Instant updatedAt;

    // ── Getters / setters ────────────────────────────────────────────────────

    public String getId()                        { return id; }
    public void setId(String id)                 { this.id = id; }

    public RentUnit getUnit()                    { return unit; }
    public void setUnit(RentUnit u)              { this.unit = u; }

    public String getName()                      { return name; }
    public void setName(String n)                { this.name = n; }

    public String getPhone()                     { return phone; }
    public void setPhone(String p)               { this.phone = p; }

    public String getEmail()                     { return email; }
    public void setEmail(String e)               { this.email = e != null ? e : ""; }

    public LocalDate getMoveInDate()             { return moveInDate; }
    public void setMoveInDate(LocalDate d)       { this.moveInDate = d; }

    public LocalDate getLeaseEnd()               { return leaseEnd; }
    public void setLeaseEnd(LocalDate d)         { this.leaseEnd = d; }

    public boolean isActive()                    { return active; }
    public void setActive(boolean a)             { this.active = a; }

    public String getPayToken()                  { return payToken; }
    public void setPayToken(String t)            { this.payToken = t; }

    public String getNationalIdNumber()          { return nationalIdNumber; }
    public void setNationalIdNumber(String n)    { this.nationalIdNumber = n; }

    public List<RentCharge> getCharges()         { return charges; }
    public void setCharges(List<RentCharge> c)   { this.charges = c; }

    public Instant getCreatedAt()                { return createdAt; }
    public void setCreatedAt(Instant t)          { this.createdAt = t; }

    public String getCreatedBy()                 { return createdBy; }
    public void setCreatedBy(String by)          { this.createdBy = by != null ? by : "system"; }

    public Instant getUpdatedAt()                { return updatedAt; }
    public void setUpdatedAt(Instant t)          { this.updatedAt = t; }
}
