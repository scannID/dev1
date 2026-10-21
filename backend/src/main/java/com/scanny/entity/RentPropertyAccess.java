package com.scanny.entity;

import com.scanny.model.enums.PropertyAccessRole;
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
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;

/**
 * Join entity granting a {@link RentAccount} access to a {@link RentProperty}
 * with a specific role. One account can manage many properties; one property
 * can have multiple accounts with different roles (e.g. an owner account for
 * read-only visibility and a manager account for day-to-day operations).
 */
@Entity
@Table(
    name = "rent_property_access",
    uniqueConstraints = @UniqueConstraint(columnNames = {"account_id", "property_id"})
)
public class RentPropertyAccess {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false)
    private RentAccount account;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "property_id", nullable = false)
    private RentProperty property;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private PropertyAccessRole role;

    @Column(name = "granted_at", nullable = false)
    private Instant grantedAt = Instant.now();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "granted_by")
    private RentAccount grantedBy;

    // ── Getters / setters ────────────────────────────────────────────────────

    public Long getId()                          { return id; }
    public void setId(Long id)                   { this.id = id; }

    public RentAccount getAccount()              { return account; }
    public void setAccount(RentAccount a)        { this.account = a; }

    public RentProperty getProperty()            { return property; }
    public void setProperty(RentProperty p)      { this.property = p; }

    public PropertyAccessRole getRole()          { return role; }
    public void setRole(PropertyAccessRole r)    { this.role = r; }

    public Instant getGrantedAt()                { return grantedAt; }
    public void setGrantedAt(Instant t)          { this.grantedAt = t; }

    public RentAccount getGrantedBy()            { return grantedBy; }
    public void setGrantedBy(RentAccount a)      { this.grantedBy = a; }

    /** Convenience: true when this role can perform day-to-day operations. */
    public boolean canManage() {
        return role == PropertyAccessRole.MANAGER || role == PropertyAccessRole.OWNER_MANAGER;
    }

    /** Convenience: true when this role represents ownership (receives money). */
    public boolean isOwner() {
        return role == PropertyAccessRole.OWNER || role == PropertyAccessRole.OWNER_MANAGER;
    }
}
