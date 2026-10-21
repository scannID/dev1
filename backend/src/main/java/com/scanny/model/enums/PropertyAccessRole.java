package com.scanny.model.enums;

public enum PropertyAccessRole {
    /** Account owns the property — receives rent money, read-only dashboard. */
    OWNER,
    /** Account manages day-to-day operations (units, tenants, charges). */
    MANAGER,
    /** Account is both the owner and the manager (self-managed property). */
    OWNER_MANAGER
}
