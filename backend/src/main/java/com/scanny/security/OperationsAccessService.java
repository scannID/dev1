package com.scanny.security;

import com.scanny.entity.BusinessStaff;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.StaffRole;
import com.scanny.service.StaffService;
import java.util.EnumSet;
import java.util.Set;
import org.springframework.stereotype.Service;

/**
 * Allows merchant JWT ownership <em>or</em> a valid staff session header
 * ({@code X-Staff-Session}) with one of the permitted roles.
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
        merchantAccessService.assertOwnsBusinessId(businessId);
    }

    public BusinessStaff requireMerchantOrStaff(String businessId, String staffSession, StaffRole... allowedRoles) {
        if (merchantAccessService.currentJwt().isPresent()) {
            merchantAccessService.assertOwnsBusinessId(businessId);
            return null;
        }
        if (staffSession == null || staffSession.isBlank()) {
            throw new ApiException(401, "Authentication required.");
        }
        BusinessStaff staff = staffService.requireActiveSession(businessId, staffSession.trim());
        if (allowedRoles != null && allowedRoles.length > 0) {
            Set<StaffRole> allowed = EnumSet.noneOf(StaffRole.class);
            allowed.addAll(Set.of(allowedRoles));
            if (!allowed.contains(staff.getRole())) {
                throw new ApiException(403, "Your staff role cannot access this.");
            }
        }
        return staff;
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
