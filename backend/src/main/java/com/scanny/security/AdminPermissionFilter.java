package com.scanny.security;

import com.scanny.api.ApiErrorWriter;
import com.scanny.api.ErrorCode;
import com.scanny.model.enums.AdminPermission;
import com.scanny.service.AdminUserService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationContext;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * Enforces granular admin permissions on every {@code /api/admin/**} request.
 *
 * NOT a @Component — registered explicitly in SecurityConfig to avoid double-registration.
 *
 * AdminUserService is looked up from the ApplicationContext on first use rather than
 * injected at construction time — this breaks the SecurityConfig → AdminPermissionFilter
 * → AdminUserService circular dependency without needing @Lazy proxies, which caused
 * transaction proxy issues on H2 and produced 500s on the /api/admin/admins endpoint.
 */
public class AdminPermissionFilter extends OncePerRequestFilter {

    private static final Logger logger = LoggerFactory.getLogger(AdminPermissionFilter.class);

    private final ApplicationContext applicationContext;
    private final ApiErrorWriter apiErrorWriter;

    // Cached after first lookup — ApplicationContext.getBean() is thread-safe.
    private volatile AdminUserService adminUserService;

    public AdminPermissionFilter(ApplicationContext applicationContext, ApiErrorWriter apiErrorWriter) {
        this.applicationContext = applicationContext;
        this.apiErrorWriter = apiErrorWriter;
    }

    private AdminUserService service() {
        if (adminUserService == null) {
            adminUserService = applicationContext.getBean(AdminUserService.class);
        }
        return adminUserService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {

        String path = request.getRequestURI();
        if (!path.startsWith("/api/admin/")) {
            chain.doFilter(request, response);
            return;
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Jwt jwt)) {
            chain.doFilter(request, response);
            return;
        }

        UUID subject;
        try {
            subject = UUID.fromString(jwt.getSubject());
        } catch (IllegalArgumentException e) {
            apiErrorWriter.write(request, response, ErrorCode.UNAUTHORIZED);
            return;
        }

        // /api/admin/admins/** — service enforces MANAGE_ADMINS internally.
        if (path.startsWith("/api/admin/admins")) {
            chain.doFilter(request, response);
            return;
        }

        String required = permissionForPath(path);
        if (required == null) {
            chain.doFilter(request, response);
            return;
        }

        boolean allowed;
        try {
            allowed = service().hasPermission(subject, required);
        } catch (Exception ex) {
            // DB not ready / table missing — fail open so existing admins aren't locked out.
            logger.warn("AdminPermissionFilter: permission check failed, allowing through: {}", ex.getMessage());
            chain.doFilter(request, response);
            return;
        }

        if (!allowed) {
            apiErrorWriter.write(request, response, ErrorCode.FORBIDDEN);
            return;
        }

        chain.doFilter(request, response);
    }

    private String permissionForPath(String path) {
        if (path.startsWith("/api/admin/dashboard"))              return AdminPermission.VIEW_OVERVIEW.name();
        if (path.startsWith("/api/admin/merchants"))              return AdminPermission.VIEW_MERCHANTS.name();
        if (path.startsWith("/api/admin/orders"))                 return AdminPermission.VIEW_ORDERS.name();
        if (path.startsWith("/api/admin/analytics/tickets"))      return AdminPermission.VIEW_TICKETING.name();
        if (path.startsWith("/api/admin/analytics/quick-payments")) return AdminPermission.VIEW_REVENUE.name();
        if (path.startsWith("/api/admin/analytics/devices"))      return AdminPermission.VIEW_OVERVIEW.name();
        if (path.startsWith("/api/admin/analytics/scans-orders")) return AdminPermission.VIEW_QR_ACTIVITY.name();
        if (path.startsWith("/api/admin/analytics/traffic"))      return AdminPermission.VIEW_QR_ACTIVITY.name();
        if (path.startsWith("/api/admin/analytics/cookie-consents")) return AdminPermission.VIEW_COOKIE_CONSENT.name();
        if (path.startsWith("/api/admin/analytics"))              return AdminPermission.VIEW_OVERVIEW.name();
        if (path.startsWith("/api/admin/users"))                  return AdminPermission.VIEW_USERS.name();
        if (path.startsWith("/api/admin/broadcasts"))             return AdminPermission.VIEW_COMMUNICATIONS.name();
        if (path.startsWith("/api/admin/revenue"))                return AdminPermission.VIEW_REVENUE.name();
        if (path.startsWith("/api/admin/qr-activity"))            return AdminPermission.VIEW_QR_ACTIVITY.name();
        if (path.startsWith("/api/admin/reports"))                return AdminPermission.VIEW_REPORTS.name();
        if (path.startsWith("/api/admin/system"))                 return AdminPermission.VIEW_SYSTEM.name();
        if (path.startsWith("/api/admin/audit"))                  return AdminPermission.VIEW_AUDIT.name();
        if (path.startsWith("/api/admin/configs"))                return AdminPermission.VIEW_CONFIGS.name();
        if (path.startsWith("/api/admin/notifications"))          return AdminPermission.VIEW_OVERVIEW.name();
        if (path.startsWith("/api/admin/catalog"))                return AdminPermission.VIEW_MERCHANTS.name();
        return null;
    }
}
