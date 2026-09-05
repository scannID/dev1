package com.scanny.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Represents a sub-admin account created by the super admin.
 * Permissions control which sections of the admin console are accessible.
 * A superAdmin flag bypasses all permission checks (used for the original platform owner).
 */
@Entity
@Table(name = "admin_users")
public class AdminUser {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Keycloak user ID — links this record to the JWT subject. */
    @Column(name = "keycloak_user_id", unique = true, nullable = false)
    private UUID keycloakUserId;

    @Column(name = "email", unique = true, nullable = false, length = 255)
    private String email;

    @Column(name = "display_name", nullable = false, length = 200)
    private String displayName;

    /**
     * When true this admin bypasses all permission checks.
     * Only set on the initial platform owner account, never on invited admins.
     */
    @Column(name = "super_admin", nullable = false)
    private boolean superAdmin = false;

    /** Whether this admin can still log in. Revoked admins are disabled here AND in Keycloak. */
    @Column(name = "active", nullable = false)
    private boolean active = false;

    /**
     * True while the invite email has been sent but the sub-admin has not yet
     * logged in for the first time. Flips to false (and active flips to true)
     * automatically on their first successful call to /api/admin/admins/me.
     */
    @Column(name = "pending", nullable = false)
    private boolean pending = true;

    /**
     * Granted permissions — values must match {@link com.scanny.model.enums.AdminPermission}.
     * Empty set means the admin can log in but sees nothing.
     */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "admin_user_permissions", joinColumns = @JoinColumn(name = "admin_user_id"))
    @Column(name = "permission", length = 60)
    private Set<String> permissions = new HashSet<>();

    @Column(name = "invited_by_email", length = 255)
    private String invitedByEmail;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = Instant.now();
    }

    // ── Constructors ──────────────────────────────────────────────────────────

    public AdminUser() {}

    public AdminUser(UUID keycloakUserId, String email, String displayName,
                     boolean superAdmin, String invitedByEmail) {
        this.keycloakUserId = keycloakUserId;
        this.email = email;
        this.displayName = displayName;
        this.superAdmin = superAdmin;
        this.invitedByEmail = invitedByEmail;
        // Super admins are immediately active — they don't go through the invite flow.
        if (superAdmin) {
            this.active = true;
            this.pending = false;
        }
    }

    // ── Getters / setters ─────────────────────────────────────────────────────

    public UUID getId() { return id; }

    public UUID getKeycloakUserId() { return keycloakUserId; }
    public void setKeycloakUserId(UUID keycloakUserId) { this.keycloakUserId = keycloakUserId; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public boolean isSuperAdmin() { return superAdmin; }
    public void setSuperAdmin(boolean superAdmin) { this.superAdmin = superAdmin; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public boolean isPending() { return pending; }
    public void setPending(boolean pending) { this.pending = pending; }

    public Set<String> getPermissions() { return permissions; }
    public void setPermissions(Set<String> permissions) { this.permissions = permissions; }

    public String getInvitedByEmail() { return invitedByEmail; }
    public void setInvitedByEmail(String invitedByEmail) { this.invitedByEmail = invitedByEmail; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
