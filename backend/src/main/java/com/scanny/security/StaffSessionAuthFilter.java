package com.scanny.security;

import com.scanny.entity.BusinessStaff;
import com.scanny.model.enums.StaffRole;
import com.scanny.repository.BusinessStaffRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * When a Keycloak JWT has the STAFF realm role, loads {@link BusinessStaff}
 * into {@link StaffSessionHolder} so ownership checks work the same as merchants.
 * Optional header {@code X-Staff-Business} picks which branch when the user has several.
 */
@Component
public class StaffSessionAuthFilter extends OncePerRequestFilter {

    public static final String STAFF_BUSINESS_HEADER = "X-Staff-Business";

    private final BusinessStaffRepository staffRepository;

    public StaffSessionAuthFilter(BusinessStaffRepository staffRepository) {
        this.staffRepository = staffRepository;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        try {
            Authentication existing = SecurityContextHolder.getContext().getAuthentication();
            if (existing != null && existing.getPrincipal() instanceof Jwt jwt && hasStaffRole(existing)) {
                resolveStaffFromJwt(jwt, request.getHeader(STAFF_BUSINESS_HEADER));
            }
            filterChain.doFilter(request, response);
        } finally {
            StaffSessionHolder.clear();
        }
    }

    private boolean hasStaffRole(Authentication auth) {
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(a -> a.equals("ROLE_STAFF"));
    }

    private void resolveStaffFromJwt(Jwt jwt, String preferredBusinessId) {
        UUID keycloakUserId;
        try {
            keycloakUserId = UUID.fromString(jwt.getSubject());
        } catch (IllegalArgumentException ex) {
            return;
        }
        List<BusinessStaff> matches = staffRepository.findByKeycloakUserIdAndActiveTrue(keycloakUserId);
        if (matches.isEmpty()) {
            return;
        }
        BusinessStaff staff = matches.stream()
                .filter(s -> preferredBusinessId != null && preferredBusinessId.equals(s.getBusiness().getId()))
                .findFirst()
                .orElse(matches.get(0));
        StaffSessionHolder.set(staff);
    }
}
