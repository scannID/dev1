package com.scanny.model.enums;

/**
 * Status of a device binding.
 * 
 * - ACTIVE: Binding is valid and in use
 * - REVOKED: Manually revoked by admin or tenant
 * - EXPIRED: Auto-expired due to lease end or time limit
 */
public enum BindingStatus {
    ACTIVE,
    REVOKED,
    EXPIRED
}
