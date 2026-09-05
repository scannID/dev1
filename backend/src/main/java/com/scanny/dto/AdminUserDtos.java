package com.scanny.dto;

import java.util.List;
import java.util.Set;

public class AdminUserDtos {

    public record AdminUserRow(
            String id,
            String email,
            String displayName,
            boolean superAdmin,
            boolean active,
            boolean pending,
            Set<String> permissions,
            String invitedByEmail,
            String createdAt
    ) {}

    public record AdminUserListResponse(List<AdminUserRow> admins) {}

    public record InviteAdminRequest(
            String email,
            String displayName,
            Set<String> permissions
    ) {}

    public record UpdatePermissionsRequest(Set<String> permissions) {}

    /** Returned after any mutating operation so the UI can update immediately. */
    public record AdminUserResponse(AdminUserRow admin) {}

    /** Returned by the /me endpoint so the frontend knows what the caller can see. */
    public record AdminMeResponse(
            String id,
            String email,
            String displayName,
            boolean superAdmin,
            Set<String> permissions
    ) {}
}
