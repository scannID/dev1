package com.scanny.controller;

import com.scanny.dto.AdminUserDtos;
import com.scanny.exception.ApiException;
import com.scanny.service.AdminUserService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Admin user management endpoints — only accessible to admins with MANAGE_ADMINS permission
 * (enforced by AdminPermissionFilter) except /me which any authenticated admin can call.
 */
@RestController
@RequestMapping("/api/admin/admins")
public class AdminUserController {

    private final AdminUserService adminUserService;

    public AdminUserController(AdminUserService adminUserService) {
        this.adminUserService = adminUserService;
    }

    /** Returns the calling admin's own profile and permissions. */
    @GetMapping("/me")
    public AdminUserDtos.AdminMeResponse me(@AuthenticationPrincipal Jwt jwt) {
        return adminUserService.me(toUuid(jwt.getSubject()));
    }

    /** List all sub-admins (super admin only). */
    @GetMapping
    public AdminUserDtos.AdminUserListResponse list() {
        return adminUserService.listAdmins();
    }

    /** Invite a new sub-admin. */
    @PostMapping
    public AdminUserDtos.AdminUserResponse invite(
            @RequestBody AdminUserDtos.InviteAdminRequest req,
            @AuthenticationPrincipal Jwt jwt) {
        String callerEmail = jwt.getClaimAsString("email");
        return adminUserService.invite(req, callerEmail);
    }

    /** Update which pages a sub-admin can access. */
    @PutMapping("/{adminId}/permissions")
    public AdminUserDtos.AdminUserResponse updatePermissions(
            @PathVariable UUID adminId,
            @RequestBody AdminUserDtos.UpdatePermissionsRequest req,
            @AuthenticationPrincipal Jwt jwt) {
        return adminUserService.updatePermissions(adminId, req, toUuid(jwt.getSubject()));
    }

    /** Revoke all access — disables login and clears permissions. */
    @PostMapping("/{adminId}/revoke")
    public AdminUserDtos.AdminUserResponse revoke(
            @PathVariable UUID adminId,
            @AuthenticationPrincipal Jwt jwt) {
        return adminUserService.revoke(adminId, toUuid(jwt.getSubject()));
    }

    /** Re-enable a previously revoked admin. */
    @PostMapping("/{adminId}/restore")
    public AdminUserDtos.AdminUserResponse restore(
            @PathVariable UUID adminId,
            @AuthenticationPrincipal Jwt jwt) {
        return adminUserService.restore(adminId, toUuid(jwt.getSubject()));
    }

    /** Resend the Keycloak password-setup email to a pending admin. */
    @PostMapping("/{adminId}/resend-invite")
    public AdminUserDtos.AdminUserResponse resendInvite(@PathVariable UUID adminId) {
        return adminUserService.resendInvite(adminId);
    }

    private UUID toUuid(String sub) {
        try {
            return UUID.fromString(sub);
        } catch (IllegalArgumentException e) {
            throw new ApiException(401, "Invalid token subject");
        }
    }
}
