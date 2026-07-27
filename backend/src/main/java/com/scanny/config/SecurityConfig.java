package com.scanny.config;

import com.scanny.api.ApiErrorWriter;
import com.scanny.api.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Value("${scanny.cors.allowed-origin-patterns}")
    private String allowedOriginPatterns;

    @Value("${scanny.security.headers.hsts-enabled:false}")
    private boolean hstsEnabled;

    @Value("${scanny.security.headers.hsts-max-age-seconds:31536000}")
    private long hstsMaxAgeSeconds;

    @Value("${scanny.security.headers.content-security-policy:default-src 'none'; frame-ancestors 'none'; base-uri 'none'}")
    private String contentSecurityPolicy;

    private final ApiErrorWriter apiErrorWriter;

    public SecurityConfig(ApiErrorWriter apiErrorWriter) {
        this.apiErrorWriter = apiErrorWriter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .headers(headers -> {
                headers.contentTypeOptions(Customizer.withDefaults());
                headers.frameOptions(frame -> frame.deny());
                headers.referrerPolicy(referrer ->
                        referrer.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN));
                headers.permissionsPolicy(permissions ->
                        permissions.policy("camera=(), microphone=(), geolocation=(), payment=()"));
                if (contentSecurityPolicy != null && !contentSecurityPolicy.isBlank()) {
                    headers.contentSecurityPolicy(csp -> csp.policyDirectives(contentSecurityPolicy));
                }
                if (hstsEnabled) {
                    headers.httpStrictTransportSecurity(hsts -> hsts
                            .includeSubDomains(true)
                            .preload(true)
                            .maxAgeInSeconds(hstsMaxAgeSeconds));
                } else {
                    headers.httpStrictTransportSecurity(hsts -> hsts.disable());
                }
            })
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/health", "/api/health", "/actuator/health", "/actuator/health/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/merchant/register").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/businesses/*/menu").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/businesses/*/scans").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/businesses/*/orders").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/orders/public/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/qr/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/qr/*/scans").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/menu/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/devices").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/devices/*/registered").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/devices/*/pay").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/devices/register").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/devices/*/check").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/devices/*").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/quick-payments/public/codes").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/quick-payments/public/track/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/quick-payments/codes/qr/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/quick-payments/codes/qr/*/pay").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/payments/providers").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/fees").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/payments/initiate").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/payments/*/status").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/payments/webhooks/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/tickets/public/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/tickets/public/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/consents/cookies").permitAll()
                // Temporary: allow public create-event image search (tighten later)
                .requestMatchers("/api/images/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/tickets/qr/*/scan").hasAnyRole("MERCHANT", "ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/tickets/stats").hasAnyRole("MERCHANT", "ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/tickets").hasAnyRole("MERCHANT", "ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/tickets").hasAnyRole("MERCHANT", "ADMIN")
                .requestMatchers("/ws/**").permitAll()
                .requestMatchers("/api/auth/merchant/**").hasRole("MERCHANT")
                .requestMatchers("/api/businesses/**").hasRole("MERCHANT")
                .requestMatchers("/api/catalog/**").hasRole("MERCHANT")
                .requestMatchers("/api/orders/**").hasAnyRole("MERCHANT", "ADMIN")
                .requestMatchers("/api/receipts/**").hasAnyRole("MERCHANT", "ADMIN")
                .requestMatchers("/api/quick-payments/**").hasAnyRole("MERCHANT", "ADMIN")
                .requestMatchers("/api/devices/**").hasAnyRole("MERCHANT", "ADMIN")
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, authException) ->
                        apiErrorWriter.write(request, response, ErrorCode.UNAUTHORIZED))
                .accessDeniedHandler((request, response, accessDeniedException) ->
                        apiErrorWriter.write(request, response, ErrorCode.FORBIDDEN))
            )
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter()))
                .authenticationEntryPoint((request, response, authException) ->
                        apiErrorWriter.write(request, response, ErrorCode.UNAUTHORIZED))
                .accessDeniedHandler((request, response, accessDeniedException) ->
                        apiErrorWriter.write(request, response, ErrorCode.FORBIDDEN))
            );

        return http.build();
    }

    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(jwt -> {
            Map<String, Object> realmAccess = jwt.getClaimAsMap("realm_access");
            if (realmAccess == null || !realmAccess.containsKey("roles")) {
                return List.of();
            }
            @SuppressWarnings("unchecked")
            Collection<String> roles = (Collection<String>) realmAccess.get("roles");
            return roles.stream()
                    .map(role -> new SimpleGrantedAuthority("ROLE_" + role.toUpperCase()))
                    .collect(Collectors.toList());
        });
        return converter;
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        List<String> patterns = Arrays.stream(allowedOriginPatterns.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
        configuration.setAllowedOriginPatterns(patterns);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setExposedHeaders(List.of("X-Correlation-Id", "Retry-After"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
