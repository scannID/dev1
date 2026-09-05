package com.scanny.model.enums;

/**
 * Granular permissions for admin console sections.
 * Each constant maps 1-to-1 to a nav item/page in the frontend.
 *
 * Super admins bypass all checks. Invited sub-admins are granted
 * a subset of these by the super admin at invite time and can have
 * permissions updated or fully revoked at any time.
 */
public enum AdminPermission {

    // ── Platform ──────────────────────────────────────────────────────────────
    VIEW_OVERVIEW("Overview dashboard"),
    VIEW_MERCHANTS("Merchants list and details"),
    VIEW_ORDERS("All orders"),
    VIEW_TICKETING("Ticketing analytics and events"),
    VIEW_USERS("Platform users"),
    VIEW_COMMUNICATIONS("Broadcasts and communications"),

    // ── Finance ───────────────────────────────────────────────────────────────
    VIEW_REVENUE("Revenue and payments"),

    // ── Analytics ─────────────────────────────────────────────────────────────
    VIEW_QR_ACTIVITY("QR scan activity"),
    VIEW_COOKIE_CONSENT("Cookie consent analytics"),
    VIEW_REPORTS("Reports"),

    // ── System ────────────────────────────────────────────────────────────────
    VIEW_SYSTEM("System health"),
    VIEW_AUDIT("Audit log"),
    VIEW_CONFIGS("Platform configs"),

    // ── Admin management ──────────────────────────────────────────────────────
    /** Only super admins have this; controls who can manage other admins. */
    MANAGE_ADMINS("Invite and manage sub-admins");

    private final String description;

    AdminPermission(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
