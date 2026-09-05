package com.scanny.service;

import com.scanny.dto.AdminUserDtos;
import com.scanny.entity.AdminUser;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.AdminPermission;
import com.scanny.repository.AdminUserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class AdminUserService {

    private static final Logger log = LoggerFactory.getLogger(AdminUserService.class);

    private final AdminUserRepository adminUserRepository;
    private final KeycloakAdminService keycloakAdminService;

    public AdminUserService(AdminUserRepository adminUserRepository,
                            KeycloakAdminService keycloakAdminService) {
        this.adminUserRepository = adminUserRepository;
        this.keycloakAdminService = keycloakAdminService;
    }

    // ── List ──────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public AdminUserDtos.AdminUserListResponse listAdmins() {
        List<AdminUserDtos.AdminUserRow> rows = adminUserRepository
                .findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::toRow)
                .collect(Collectors.toList());
        return new AdminUserDtos.AdminUserListResponse(rows);
    }

    // ── Me — auto-activates on first successful login ─────────────────────────

    @Transactional
    public AdminUserDtos.AdminMeResponse me(UUID keycloakUserId) {
        AdminUser admin = adminUserRepository.findByKeycloakUserId(keycloakUserId)
                .orElseThrow(() -> new ApiException(404, "Admin account not found"));

        if (!admin.isActive() && !admin.isPending()) {
            throw new ApiException(403, "Admin account has been revoked");
        }

        // First login — flip pending → active
        if (admin.isPending()) {
            admin.setPending(false);
            admin.setActive(true);
            adminUserRepository.save(admin);
            log.info("Sub-admin {} activated on first login", admin.getEmail());
        }

        Set<String> perms = admin.isSuperAdmin()
                ? allPermissions()
                : Collections.unmodifiableSet(admin.getPermissions());
        return new AdminUserDtos.AdminMeResponse(
                admin.getId().toString(),
                admin.getEmail(),
                admin.getDisplayName(),
                admin.isSuperAdmin(),
                perms
        );
    }

    // ── Invite ────────────────────────────────────────────────────────────────

    @Transactional
    public AdminUserDtos.AdminUserResponse invite(AdminUserDtos.InviteAdminRequest req,
                                                   String invitedByEmail) {
        if (req.email() == null || req.email().isBlank()) {
            throw new ApiException(400, "Email is required");
        }
        if (req.displayName() == null || req.displayName().isBlank()) {
            throw new ApiException(400, "Display name is required");
        }

        String email = req.email().trim().toLowerCase();

        if (adminUserRepository.existsByEmail(email)) {
            throw new ApiException(409, "An admin with this email already exists");
        }

        // Validate permissions
        Set<String> validPerms = validatePermissions(req.permissions());

        // Create/invite in Keycloak with the ADMIN realm role
        UUID keycloakUserId = keycloakAdminService.createOrInviteAdminUser(email, req.displayName().trim());

        AdminUser admin = new AdminUser(keycloakUserId, email, req.displayName().trim(), false, invitedByEmail);
        admin.setPermissions(validPerms);
        // active=false, pending=true are the entity field defaults — no need to set explicitly
        adminUserRepository.save(admin);

        log.info("Super admin {} invited sub-admin {} with permissions {}",
                invitedByEmail, email, validPerms);

        return new AdminUserDtos.AdminUserResponse(toRow(admin));
    }

    // ── Update permissions ────────────────────────────────────────────────────

    @Transactional
    public AdminUserDtos.AdminUserResponse updatePermissions(UUID adminId,
                                                              AdminUserDtos.UpdatePermissionsRequest req,
                                                              UUID callerKeycloakId) {
        AdminUser admin = adminUserRepository.findById(adminId)
                .orElseThrow(() -> new ApiException(404, "Admin not found"));

        if (admin.isSuperAdmin()) {
            throw new ApiException(403, "Cannot modify super admin permissions");
        }

        // Prevent self-modification (caller cannot change their own permissions)
        if (admin.getKeycloakUserId().equals(callerKeycloakId)) {
            throw new ApiException(403, "Admins cannot modify their own permissions");
        }

        Set<String> validPerms = validatePermissions(req.permissions());
        admin.setPermissions(validPerms);
        adminUserRepository.save(admin);

        log.info("Permissions updated for admin {} → {}", admin.getEmail(), validPerms);
        return new AdminUserDtos.AdminUserResponse(toRow(admin));
    }

    // ── Revoke (disable) ──────────────────────────────────────────────────────

    @Transactional
    public AdminUserDtos.AdminUserResponse revoke(UUID adminId, UUID callerKeycloakId) {
        AdminUser admin = adminUserRepository.findById(adminId)
                .orElseThrow(() -> new ApiException(404, "Admin not found"));

        if (admin.isSuperAdmin()) {
            throw new ApiException(403, "Cannot revoke the super admin");
        }
        if (admin.getKeycloakUserId().equals(callerKeycloakId)) {
            throw new ApiException(403, "Admins cannot revoke themselves");
        }

        admin.setActive(false);
        admin.setPermissions(new HashSet<>());
        adminUserRepository.save(admin);

        // Disable in Keycloak so the JWT can no longer be issued
        try {
            keycloakAdminService.disableUser(admin.getKeycloakUserId().toString());
        } catch (Exception ex) {
            log.warn("Could not disable Keycloak user for admin {}: {}", admin.getEmail(), ex.getMessage());
        }

        log.info("Sub-admin {} revoked", admin.getEmail());
        return new AdminUserDtos.AdminUserResponse(toRow(admin));
    }

    // ── Resend invite ─────────────────────────────────────────────────────────

    @Transactional
    public AdminUserDtos.AdminUserResponse resendInvite(UUID adminId) {
        AdminUser admin = adminUserRepository.findById(adminId)
                .orElseThrow(() -> new ApiException(404, "Admin not found"));
        if (!admin.isPending()) {
            throw new ApiException(400, "Admin has already accepted their invite");
        }
        try {
            keycloakAdminService.resendPasswordSetupEmail(admin.getKeycloakUserId());
        } catch (Exception ex) {
            log.warn("Could not resend invite email for {}: {}", admin.getEmail(), ex.getMessage());
            throw new ApiException(500, "Failed to resend invite: " + ex.getMessage());
        }
        log.info("Invite resent for sub-admin {}", admin.getEmail());
        return new AdminUserDtos.AdminUserResponse(toRow(admin));
    }

    // ── Restore (re-enable) ───────────────────────────────────────────────────

    @Transactional
    public AdminUserDtos.AdminUserResponse restore(UUID adminId, UUID callerKeycloakId) {
        AdminUser admin = adminUserRepository.findById(adminId)
                .orElseThrow(() -> new ApiException(404, "Admin not found"));

        if (admin.getKeycloakUserId().equals(callerKeycloakId)) {
            throw new ApiException(403, "Admins cannot restore themselves");
        }

        admin.setActive(true);
        adminUserRepository.save(admin);

        try {
            keycloakAdminService.enableUser(admin.getKeycloakUserId().toString());
        } catch (Exception ex) {
            log.warn("Could not re-enable Keycloak user for admin {}: {}", admin.getEmail(), ex.getMessage());
        }

        log.info("Sub-admin {} restored", admin.getEmail());
        return new AdminUserDtos.AdminUserResponse(toRow(admin));
    }

    // ── Permission gate (called by the filter) ────────────────────────────────

    /**
     * Returns true if the given Keycloak subject may access the requested
     * admin permission. Super admins always pass. If the admin record does
     * not exist they are treated as an ordinary ADMIN realm-role user and
     * allowed through (backwards compatibility for the platform owner who
     * has not yet been seeded into admin_users).
     */
    @Transactional(readOnly = true)
    public boolean hasPermission(UUID keycloakUserId, String permission) {
        Optional<AdminUser> opt = adminUserRepository.findByKeycloakUserId(keycloakUserId);
        if (opt.isEmpty()) {
            // Not yet seeded — treat as super admin (platform owner)
            return true;
        }
        AdminUser admin = opt.get();
        if (!admin.isActive() && !admin.isPending()) return false; // revoked
        if (admin.isPending()) return false; // not yet set password
        if (admin.isSuperAdmin()) return true;
        return admin.getPermissions().contains(permission);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private AdminUserDtos.AdminUserRow toRow(AdminUser a) {
        return new AdminUserDtos.AdminUserRow(
                a.getId().toString(),
                a.getEmail(),
                a.getDisplayName(),
                a.isSuperAdmin(),
                a.isActive(),
                a.isPending(),
                Collections.unmodifiableSet(a.getPermissions()),
                a.getInvitedByEmail(),
                a.getCreatedAt().toString()
        );
    }

    private Set<String> validatePermissions(Set<String> raw) {
        if (raw == null) return new HashSet<>();
        Set<String> valid = new HashSet<>();
        Set<String> allowed = Arrays.stream(AdminPermission.values())
                .map(Enum::name)
                .collect(Collectors.toSet());
        for (String p : raw) {
            if (!allowed.contains(p)) {
                throw new ApiException(400, "Unknown permission: " + p);
            }
            // MANAGE_ADMINS cannot be granted to sub-admins
            if (AdminPermission.MANAGE_ADMINS.name().equals(p)) {
                throw new ApiException(400, "MANAGE_ADMINS can only be held by super admins");
            }
            valid.add(p);
        }
        return valid;
    }

    private Set<String> allPermissions() {
        return Arrays.stream(AdminPermission.values())
                .map(Enum::name)
                .collect(Collectors.toSet());
    }
}
