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
 * A rentable property (apartment block, office building, compound, etc.).
 * <p>
 * {@code ownerMomo} is the MoMo number that receives every rent payment —
 * always required even if the owner has no Scanny account.
 * {@code ownerAccount} is optional: when set, the owner can log in and see
 * payment history for this property.
 * <p>
 * {@code qrToken} drives the property-level QR code printed at the building
 * entrance: {@code /rent/pay/:qrToken}. Tenants scan it and select their unit.
 */
@Entity
@Table(name = "rent_properties")
public class RentProperty {

    @Id
    @Column(length = 36)
    private String id;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(nullable = false, length = 512)
    private String address = "";

    @Column(nullable = false, length = 128)
    private String city = "";

    /** Human name of the property owner — always stored for display. */
    @Column(name = "owner_name", nullable = false, length = 255)
    private String ownerName;

    /** MoMo number to which rent payments are sent. */
    @Column(name = "owner_momo", nullable = false, length = 64)
    private String ownerMomo;

    /** Optional — links this property to a {@link RentAccount} for the owner dashboard. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_account_id")
    private RentAccount ownerAccount;

    @Column(nullable = false, length = 8)
    private String currency = "UGX";

    /**
     * IANA time-zone ID used to compute {@code daysRemaining} on the tenant pay
     * page so a tenant in Kampala always sees the correct countdown even if the
     * server runs in UTC. Defaults to "Africa/Kampala".
     */
    @Column(nullable = false, length = 64)
    private String timezone = "Africa/Kampala";

    /**
     * When {@code true}, tenants may pay any amount from the configured minimum
     * up to the full outstanding balance. When {@code false}, only the full
     * balance is accepted.
     */
    @Column(name = "partial_payment_allowed", nullable = false)
    private boolean partialPaymentAllowed = true;

    /**
     * Minimum partial payment amount in the property's currency minor units.
     * Only enforced when {@code partialPaymentAllowed} is {@code true}.
     * 0 = no floor (any amount > 0 is accepted).
     */
    @Column(name = "min_payment_amount", nullable = false)
    private long minPaymentAmount = 0;

    /** Property-level QR token — tenants scan → pick unit → pay. */
    @Column(name = "qr_token", nullable = false, unique = true, length = 128)
    private String qrToken;

    @OneToMany(mappedBy = "property", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("unitNumber ASC")
    private List<RentUnit> units = new ArrayList<>();

    @OneToMany(mappedBy = "property", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<RentPropertyAccess> accessList = new ArrayList<>();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "created_by", length = 255)
    private String createdBy = "system";

    @Column(name = "updated_at")
    private Instant updatedAt;

    // ── Getters / setters ────────────────────────────────────────────────────

    public String getId()                        { return id; }
    public void setId(String id)                 { this.id = id; }

    public String getName()                      { return name; }
    public void setName(String n)                { this.name = n; }

    public String getAddress()                   { return address; }
    public void setAddress(String a)             { this.address = a != null ? a : ""; }

    public String getCity()                      { return city; }
    public void setCity(String c)                { this.city = c != null ? c : ""; }

    public String getOwnerName()                 { return ownerName; }
    public void setOwnerName(String n)           { this.ownerName = n; }

    public String getOwnerMomo()                 { return ownerMomo; }
    public void setOwnerMomo(String m)           { this.ownerMomo = m; }

    public RentAccount getOwnerAccount()         { return ownerAccount; }
    public void setOwnerAccount(RentAccount a)   { this.ownerAccount = a; }

    public String getCurrency()                  { return currency; }
    public void setCurrency(String c)            { this.currency = c != null ? c : "UGX"; }

    public String getTimezone()                  { return timezone; }
    public void setTimezone(String tz)           { this.timezone = tz != null && !tz.isBlank() ? tz : "Africa/Kampala"; }

    public boolean isPartialPaymentAllowed()     { return partialPaymentAllowed; }
    public void setPartialPaymentAllowed(boolean b) { this.partialPaymentAllowed = b; }

    public long getMinPaymentAmount()            { return minPaymentAmount; }
    public void setMinPaymentAmount(long m)      { this.minPaymentAmount = Math.max(0, m); }

    public String getQrToken()                   { return qrToken; }
    public void setQrToken(String t)             { this.qrToken = t; }

    public List<RentUnit> getUnits()             { return units; }
    public void setUnits(List<RentUnit> u)       { this.units = u; }

    public List<RentPropertyAccess> getAccessList()          { return accessList; }
    public void setAccessList(List<RentPropertyAccess> al)   { this.accessList = al; }

    public Instant getCreatedAt()                { return createdAt; }
    public void setCreatedAt(Instant t)          { this.createdAt = t; }

    public String getCreatedBy()                 { return createdBy; }
    public void setCreatedBy(String by)          { this.createdBy = by != null ? by : "system"; }

    public Instant getUpdatedAt()                { return updatedAt; }
    public void setUpdatedAt(Instant t)          { this.updatedAt = t; }
}
