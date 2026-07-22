package com.scanny.config;

import com.scanny.api.ApiErrorWriter;
import com.scanny.api.ErrorCode;
import com.scanny.security.RateLimitService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class RateLimitFilter extends OncePerRequestFilter {

    private final RateLimitService rateLimitService;
    private final ApiErrorWriter apiErrorWriter;

    public RateLimitFilter(RateLimitService rateLimitService, ApiErrorWriter apiErrorWriter) {
        this.rateLimitService = rateLimitService;
        this.apiErrorWriter = apiErrorWriter;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String bucket = rateLimitService.resolveBucket(request);
        if (bucket != null && !rateLimitService.tryConsume(bucket, clientKey(request))) {
            response.setHeader("Retry-After", "60");
            apiErrorWriter.write(request, response, ErrorCode.RATE_LIMITED);
            return;
        }
        filterChain.doFilter(request, response);
    }

    private String clientKey(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "unknown";
    }
}
