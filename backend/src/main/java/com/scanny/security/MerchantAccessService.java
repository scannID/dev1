package com.scanny.security;

import com.scanny.entity.Business;
import com.scanny.entity.BusinessStaff;
import com.scanny.entity.Merchant;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.StaffRole;
import com.scanny.repository.BusinessRepository;
import com.scanny.repository.MerchantRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;

@Service
public class MerchantAccessService {

    private final MerchantRepository merchantRepository;
    private final BusinessRepository businessRepository;

    public MerchantAccessService(MerchantRepository merchantRepository, BusinessRepository businessRepository) {
        this.merchantRepository = merchantRepository;
        this.businessRepository = businessRepository;
    }

    public Optional<Jwt> currentJwt() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
            return Optional.of(jwt);
        }
        return Optional.empty();
    }

    public boolean isAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            return false;
        }
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(a -> a.equals("ROLE_ADMIN"));
    }

    public boolean isMerchant() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            return false;
        }
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(a -> a.equals("ROLE_MERCHANT") || a.equals("ROLE_ADMIN"));
    }

    public UUID requireKeycloakUserId() {
        Jwt jwt = currentJwt().orElseThrow(() -> new ApiException(401, "Authentication required."));
        try {
            return UUID.fromString(jwt.getSubject());
        } catch (IllegalArgumentException ex) {
            throw new ApiException(401, "Invalid authentication subject.");
        }
    }

    public Merchant requireCurrentMerchant() {
        if (isAdmin()) {
            // Admins may call merchant-scoped endpoints only with explicit IDs elsewhere.
            throw new ApiException(403, "Admin accounts cannot act as a merchant principal.");
        }
        UUID keycloakUserId = requireKeycloakUserId();
        return merchantRepository.findByKeycloakUserId(keycloakUserId)
                .orElseThrow(() -> new ApiException(404, "Merchant profile was not found for this account."));
    }

    public Merchant requireMerchantById(UUID merchantId) {
        if (isAdmin()) {
            return merchantRepository.findById(merchantId)
                    .orElseThrow(() -> new ApiException(404, "Merchant was not found."));
        }
        Merchant current = requireCurrentMerchant();
        if (!current.getId().equals(merchantId)) {
            throw new ApiException(403, "You do not have access to this merchant.");
        }
        return current;
    }

    public Business requireOwnedBusiness(String businessId) {
        Business business = businessRepository.findWithItemsById(businessId)
                .orElseThrow(() -> new ApiException(404, "Business was not found."));
        assertOwnsBusiness(business);
        return business;
    }

    public void assertOwnsBusiness(Business business) {
        if (isAdmin()) {
            return;
        }
        BusinessStaff staff = StaffSessionHolder.get();
        if (staff != null) {
            if (staff.getRole() != StaffRole.MANAGER) {
                throw new ApiException(403, "Your staff role cannot access this.");
            }
            if (staff.getBusiness() == null || !staff.getBusiness().getId().equals(business.getId())) {
                throw new ApiException(403, "You do not have access to this business.");
            }
            return;
        }
        Merchant merchant = requireCurrentMerchant();
        if (!merchant.getId().toString().equals(business.getMerchantId())) {
            throw new ApiException(403, "You do not have access to this business.");
        }
    }

    /** Merchant owner only — branch managers cannot create/list sibling branches. */
    public void requireMerchantOwner(String businessId) {
        if (StaffSessionHolder.get() != null) {
            throw new ApiException(403, "Only the business owner can manage branches.");
        }
        requireOwnedBusiness(businessId);
    }

    public boolean isStaffManager() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            return false;
        }
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(a -> a.equals("ROLE_STAFF_MANAGER"));
    }

    public void assertOwnsBusinessId(String businessId) {
        requireOwnedBusiness(businessId);
    }

    /**
     * Ownership check that does not depend on the Spring SecurityContext.
     * Used by transports (e.g. WebSocket) that authenticate out-of-band and
     * only hold the Keycloak subject id.
     */
    public boolean ownsBusinessBySubject(UUID keycloakUserId, String businessId) {
        if (keycloakUserId == null || businessId == null || businessId.isBlank()) {
            return false;
        }
        Optional<Merchant> merchant = merchantRepository.findByKeycloakUserId(keycloakUserId);
        if (merchant.isEmpty()) {
            return false;
        }
        return businessRepository.findById(businessId)
                .map(business -> merchant.get().getId().toString().equals(business.getMerchantId()))
                .orElse(false);
    }

    public String correlationId() {
        return currentJwt()
                .map(jwt -> jwt.getId() != null ? jwt.getId() : jwt.getSubject())
                .orElse(UUID.randomUUID().toString());
    }

    public String actorEmail() {
        return currentJwt()
                .map(jwt -> {
                    String email = jwt.getClaimAsString("email");
                    if (email != null && !email.isBlank()) {
                        return email;
                    }
                    return jwt.getClaimAsString("preferred_username");
                })
                .orElse("anonymous");
    }

    public String actorId() {
        return currentJwt().map(Jwt::getSubject).orElse("anonymous");
    }
}
