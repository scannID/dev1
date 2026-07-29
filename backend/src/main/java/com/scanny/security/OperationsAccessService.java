package com.scanny.security;

import com.scanny.entity.BusinessStaff;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.StaffRole;
import com.scanny.service.StaffService;
import java.util.EnumSet;
import java.util.Set;
import org.springframework.stereotype.Service;

/**
 * Allows merchant JWT ownership <em>or</em> a staff JWT / legacy session
 * with one of the permitted roles.
 */
@Service
public class OperationsAccessService {

    public static final String STAFF_SESSION_HEADER = "X-Staff-Session";

    private final MerchantAccessService merchantAccessService;
    private final StaffService staffService;

    public OperationsAccessService(MerchantAccessService merchantAccessService, StaffService staffService) {
        this.merchantAccessService = merchantAccessService;
        this.staffService = staffService;
    }

    public void requireMerchantOwner(String businessId) {
        merchantAccessService.requireMerchantOwner(businessId);
    }

    public BusinessStaff requireMerchantOrStaff(String businessId, String staffSession, StaffRole... allowedRoles) {
        // Staff JWT path — holder set by StaffSessionAuthFilter
        BusinessStaff held = StaffSessionHolder.get();
        if (held != null) {
            if (held.getBusiness() == null || !held.getBusiness().getId().equals(businessId)) {
                throw new ApiException(403, "You do not have access to this business.");
            }
            assertRoleAllowed(held, allowedRoles);
            return held;
        }

        if (merchantAccessService.currentJwt().isPresent() && merchantAccessService.isMerchant()) {
            merchantAccessService.assertOwnsBusinessId(businessId);
            return null;
        }

        if (staffSession == null || staffSession.isBlank()) {
            throw new ApiException(401, "Authentication required.");
        }
        BusinessStaff staff = staffService.requireActiveSession(businessId, staffSession.trim());
        assertRoleAllowed(staff, allowedRoles);
        return staff;
    }

    private void assertRoleAllowed(BusinessStaff staff, StaffRole... allowedRoles) {
        if (allowedRoles == null || allowedRoles.length == 0) {
            return;
        }
        Set<StaffRole> allowed = EnumSet.noneOf(StaffRole.class);
        allowed.addAll(Set.of(allowedRoles));
        if (!allowed.contains(staff.getRole())) {
            throw new ApiException(403, "Your staff role cannot access this.");
        }
    }

    public static StaffRole[] kitchenRoles() {
        return new StaffRole[]{StaffRole.KITCHEN, StaffRole.MANAGER, StaffRole.WAITER};
    }

    public static StaffRole[] floorRoles() {
        return new StaffRole[]{StaffRole.WAITER, StaffRole.CASHIER, StaffRole.MANAGER};
    }

    public static StaffRole[] managerRoles() {
        return new StaffRole[]{StaffRole.MANAGER};
    }
}
