package com.scanny.security;

import com.scanny.entity.BusinessStaff;

/**
 * Request-scoped staff identity set by {@link StaffSessionAuthFilter}
 * when {@code X-Staff-Session} is present (no merchant JWT).
 */
public final class StaffSessionHolder {

    private static final ThreadLocal<BusinessStaff> CURRENT = new ThreadLocal<>();

    private StaffSessionHolder() {}

    public static void set(BusinessStaff staff) {
        CURRENT.set(staff);
    }

    public static BusinessStaff get() {
        return CURRENT.get();
    }

    public static void clear() {
        CURRENT.remove();
    }
}
