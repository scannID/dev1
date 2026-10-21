package com.scanny.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * A Scanny rent account — used by property managers and/or property owners
 * to log in to the rent dashboard.
 *
 * <p>Authentication is Keycloak-based: the holder signs in via the shared
 * {@code scanny} realm with the {@code RENT_MANAGER} realm role.  The
 * {@code keycloakUserId} column (UUID) is the stable link between the Keycloak
 * user and this record — exactly the same pattern as {@code Merchant}.
 *
 * <p>The legacy {@code accessKey} ("RAK-XXXXXXXX") is kept for now so that
 * existing rows / public pay-page token resolution still works, but it is no
 * longer used for dashboard authentication.
 */
@Entity
@Table(name = "rent_accounts")
public class RentAccount {

    @Id
    @Column(length = 36)
    private String id;

    /**
     * Keycloak user UUID — the {@code sub} claim from the JWT.
     * Nullable for rows that pre-date the Keycloak migration; populated on
     * first login via the email-link fallback.
     */
    @Column(name = "keycloak_user_id", unique = true)
    private UUID keycloakUserId;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(nullable = false, length = 255, unique = true)
    private String email;

    @Column(nullable = false, length = 32)
    private String phone = "";

    /**
     * Legacy access key — retained for backward compatibility with deep-link
     * dashboard URLs and the public pay-page token resolution.  Not used for
     * Keycloak-authenticated requests.
     */
    @Column(name = "access_key", nullable = false, unique = true, length = 64)
    private String accessKey;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt;

    // ── Getters / setters ────────────────────────────────────────────────────

    public String getId()                        { return id; }
    public void setId(String id)                 { this.id = id; }

    public UUID getKeycloakUserId()              { return keycloakUserId; }
    public void setKeycloakUserId(UUID k)        { this.keycloakUserId = k; }

    public String getName()                      { return name; }
    public void setName(String n)                { this.name = n; }

    public String getEmail()                     { return email; }
    public void setEmail(String e)               { this.email = e; }

    public String getPhone()                     { return phone; }
    public void setPhone(String p)               { this.phone = p != null ? p : ""; }

    public String getAccessKey()                 { return accessKey; }
    public void setAccessKey(String k)           { this.accessKey = k; }

    public Instant getCreatedAt()                { return createdAt; }
    public void setCreatedAt(Instant t)          { this.createdAt = t; }

    public Instant getUpdatedAt()                { return updatedAt; }
    public void setUpdatedAt(Instant t)          { this.updatedAt = t; }
}
