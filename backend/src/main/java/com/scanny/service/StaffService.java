package com.scanny.service;

import com.scanny.dto.OperationsDtos;
import com.scanny.entity.Business;
import com.scanny.entity.BusinessStaff;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.StaffRole;
import com.scanny.repository.BusinessStaffRepository;
import com.scanny.security.MerchantAccessService;
import com.scanny.util.CodeUtils;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StaffService {

    private final BusinessStaffRepository staffRepository;
    private final MerchantAccessService merchantAccessService;
    private final PasswordEncoder passwordEncoder;

    public StaffService(
            BusinessStaffRepository staffRepository,
            MerchantAccessService merchantAccessService,
            PasswordEncoder passwordEncoder
    ) {
        this.staffRepository = staffRepository;
        this.merchantAccessService = merchantAccessService;
        this.passwordEncoder = passwordEncoder;
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
        if (staffRepository.findByBusinessIdAndEmailIgnoreCase(businessId, request.email()).isPresent()) {
            throw new ApiException(409, "Staff member with this email already exists.");
        }

        BusinessStaff staff = new BusinessStaff();
        staff.setBusiness(business);
        staff.setMerchantId(business.getMerchantId());
        staff.setEmail(request.email().trim().toLowerCase());
        staff.setDisplayName(request.displayName().trim());
        staff.setRole(request.role());
        staff.setPinHash(passwordEncoder.encode(request.pin()));
        staff.setActive(true);
        return OperationsDtos.StaffResponse.from(staffRepository.save(staff));
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
        }
        if (request.pin() != null && !request.pin().isBlank()) {
            staff.setPinHash(passwordEncoder.encode(request.pin()));
        }
        staff.setUpdatedAt(Instant.now());
        return OperationsDtos.StaffResponse.from(staffRepository.save(staff));
    }

    @Transactional
    public OperationsDtos.StaffSessionResponse login(String businessId, OperationsDtos.StaffLoginRequest request) {
        BusinessStaff staff = staffRepository.findByBusinessIdAndEmailIgnoreCase(businessId, request.email())
                .filter(BusinessStaff::isActive)
                .orElseThrow(() -> new ApiException(401, "Invalid staff credentials."));
        if (staff.getPinHash() == null || !passwordEncoder.matches(request.pin(), staff.getPinHash())) {
            throw new ApiException(401, "Invalid staff credentials.");
        }
        String token = CodeUtils.randomToken(32);
        Instant expires = Instant.now().plus(12, ChronoUnit.HOURS);
        staff.setSessionToken(token);
        staff.setSessionExpiresAt(expires);
        staff.setUpdatedAt(Instant.now());
        staffRepository.save(staff);
        return new OperationsDtos.StaffSessionResponse(token, expires, OperationsDtos.StaffResponse.from(staff));
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
