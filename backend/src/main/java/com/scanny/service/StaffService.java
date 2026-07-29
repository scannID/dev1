package com.scanny.service;

import com.scanny.dto.BusinessResponse;
import com.scanny.dto.OperationsDtos;
import com.scanny.entity.Business;
import com.scanny.entity.BusinessStaff;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.StaffRole;
import com.scanny.repository.BusinessStaffRepository;
import com.scanny.security.MerchantAccessService;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StaffService {

    private final BusinessStaffRepository staffRepository;
    private final MerchantAccessService merchantAccessService;
    private final KeycloakAdminService keycloakAdminService;
    private final BusinessService businessService;

    public StaffService(
            BusinessStaffRepository staffRepository,
            MerchantAccessService merchantAccessService,
            KeycloakAdminService keycloakAdminService,
            BusinessService businessService
    ) {
        this.staffRepository = staffRepository;
        this.merchantAccessService = merchantAccessService;
        this.keycloakAdminService = keycloakAdminService;
        this.businessService = businessService;
    }

    @Transactional(readOnly = true)
    public List<OperationsDtos.StaffResponse> listStaff(String businessId) {
        merchantAccessService.assertOwnsBusinessId(businessId);
        return staffRepository.findByBusinessIdOrderByDisplayNameAsc(businessId).stream()
                .map(OperationsDtos.StaffResponse::from)
                .toList();
    }

    @Transactional
    public OperationsDtos.StaffResponse createStaff(String businessId, OperationsDtos.CreateStaffRequest request) {
        Business business = merchantAccessService.requireOwnedBusiness(businessId);
        String email = request.email().trim().toLowerCase();
        if (staffRepository.findByBusinessIdAndEmailIgnoreCase(businessId, email).isPresent()) {
            throw new ApiException(409, "Staff member with this email already exists.");
        }

        UUID keycloakUserId = keycloakAdminService.createOrInviteStaffUser(email, request.displayName().trim());

        BusinessStaff staff = new BusinessStaff();
        staff.setBusiness(business);
        staff.setMerchantId(business.getMerchantId());
        staff.setKeycloakUserId(keycloakUserId);
        staff.setEmail(email);
        staff.setDisplayName(request.displayName().trim());
        staff.setRole(request.role());
        staff.setActive(true);
        return OperationsDtos.StaffResponse.from(staffRepository.save(staff));
    }

    @Transactional
    public void resendInvite(String businessId, UUID staffId) {
        merchantAccessService.assertOwnsBusinessId(businessId);
        BusinessStaff staff = requireStaff(businessId, staffId);
        if (staff.getKeycloakUserId() == null) {
            UUID keycloakUserId = keycloakAdminService.createOrInviteStaffUser(staff.getEmail(), staff.getDisplayName());
            staff.setKeycloakUserId(keycloakUserId);
            staff.setUpdatedAt(Instant.now());
            staffRepository.save(staff);
            return;
        }
        keycloakAdminService.resendPasswordSetupEmail(staff.getKeycloakUserId());
    }

    @Transactional
    public OperationsDtos.StaffResponse updateStaff(String businessId, UUID staffId, OperationsDtos.UpdateStaffRequest request) {
        merchantAccessService.assertOwnsBusinessId(businessId);
        BusinessStaff staff = requireStaff(businessId, staffId);
        if (request.displayName() != null) {
            staff.setDisplayName(request.displayName().trim());
        }
        if (request.role() != null) {
            staff.setRole(request.role());
        }
        if (request.active() != null) {
            staff.setActive(request.active());
            if (staff.getKeycloakUserId() != null) {
                if (Boolean.FALSE.equals(request.active())) {
                    keycloakAdminService.disableUser(staff.getKeycloakUserId().toString());
                } else {
                    keycloakAdminService.enableUser(staff.getKeycloakUserId().toString());
                }
            }
        }
        staff.setUpdatedAt(Instant.now());
        return OperationsDtos.StaffResponse.from(staffRepository.save(staff));
    }

    @Transactional
    public OperationsDtos.StaffMeResponse getMe(Jwt jwt, String preferredBusinessId) {
        UUID keycloakUserId = UUID.fromString(jwt.getSubject());
        List<BusinessStaff> matches = staffRepository.findByKeycloakUserIdAndActiveTrue(keycloakUserId);
        if (matches.isEmpty()) {
            throw new ApiException(404, "No staff profile found for this account.");
        }

        BusinessStaff selected = matches.stream()
                .filter(s -> preferredBusinessId != null && preferredBusinessId.equals(s.getBusiness().getId()))
                .findFirst()
                .orElse(matches.get(0));

        if (selected.getPasswordSetAt() == null) {
            selected.setPasswordSetAt(Instant.now());
            selected.setUpdatedAt(Instant.now());
            staffRepository.save(selected);
        }

        // Ensure ownership checks see this staff row for the selected branch
        com.scanny.security.StaffSessionHolder.set(selected);
        BusinessResponse business = businessService.getBusiness(selected.getBusiness().getId());
        List<OperationsDtos.StaffBusinessOption> options = matches.stream()
                .map(s -> new OperationsDtos.StaffBusinessOption(
                        s.getBusiness().getId(),
                        s.getBusiness().getName()
                ))
                .toList();

        return new OperationsDtos.StaffMeResponse(
                OperationsDtos.StaffResponse.from(selected),
                business,
                options
        );
    }

    @Transactional(readOnly = true)
    public BusinessStaff requireActiveSession(String businessId, String sessionToken) {
        BusinessStaff staff = staffRepository.findBySessionTokenAndSessionExpiresAtAfter(sessionToken, Instant.now())
                .orElseThrow(() -> new ApiException(401, "Staff session expired."));
        if (!staff.getBusiness().getId().equals(businessId)) {
            throw new ApiException(403, "Staff session does not match this business.");
        }
        if (!staff.isActive()) {
            throw new ApiException(403, "Staff account is inactive.");
        }
        return staff;
    }

    @Transactional(readOnly = true)
    public BusinessStaff requireByKeycloakUser(UUID keycloakUserId, String businessId) {
        return staffRepository.findByKeycloakUserIdAndBusinessIdAndActiveTrue(keycloakUserId, businessId)
                .orElseThrow(() -> new ApiException(403, "You do not have access to this business."));
    }

    @Transactional(readOnly = true)
    public List<BusinessStaff> listByKeycloakUser(UUID keycloakUserId) {
        return staffRepository.findByKeycloakUserIdAndActiveTrue(keycloakUserId);
    }

    public boolean roleCanAccessKitchen(StaffRole role) {
        return role == StaffRole.KITCHEN || role == StaffRole.MANAGER || role == StaffRole.WAITER;
    }

    public boolean roleCanAccessFloor(StaffRole role) {
        return role == StaffRole.WAITER || role == StaffRole.CASHIER || role == StaffRole.MANAGER;
    }

    public boolean roleCanManage(StaffRole role) {
        return role == StaffRole.MANAGER;
    }

    private BusinessStaff requireStaff(String businessId, UUID staffId) {
        BusinessStaff staff = staffRepository.findById(staffId)
                .orElseThrow(() -> new ApiException(404, "Staff member was not found."));
        if (!staff.getBusiness().getId().equals(businessId)) {
            throw new ApiException(404, "Staff member was not found.");
        }
        return staff;
    }
}
