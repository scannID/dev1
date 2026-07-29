package com.scanny.security;

import com.scanny.entity.BusinessStaff;
import com.scanny.model.enums.StaffRole;
import com.scanny.repository.BusinessStaffRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Authenticates branch staff via {@code X-Staff-Session} when there is no merchant JWT.
 * Managers receive {@code ROLE_STAFF_MANAGER} for full control of their assigned branch.
 */
@Component
public class StaffSessionAuthFilter extends OncePerRequestFilter {

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
            boolean hasJwt = existing != null && existing.getPrincipal() instanceof Jwt;
            if (!hasJwt) {
                String token = request.getHeader(OperationsAccessService.STAFF_SESSION_HEADER);
                if (token != null && !token.isBlank()) {
                    staffRepository.findBySessionTokenAndSessionExpiresAtAfter(token.trim(), Instant.now())
                            .filter(BusinessStaff::isActive)
                            .ifPresent(this::authenticateStaff);
                }
            }
            filterChain.doFilter(request, response);
        } finally {
            StaffSessionHolder.clear();
        }
    }

    private void authenticateStaff(BusinessStaff staff) {
        StaffSessionHolder.set(staff);
        List<SimpleGrantedAuthority> authorities = new ArrayList<>();
        authorities.add(new SimpleGrantedAuthority("ROLE_STAFF"));
        if (staff.getRole() == StaffRole.MANAGER) {
            authorities.add(new SimpleGrantedAuthority("ROLE_STAFF_MANAGER"));
        }
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                staff.getEmail(),
                null,
                authorities
        );
        SecurityContextHolder.getContext().setAuthentication(auth);
    }
}
