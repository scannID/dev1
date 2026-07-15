package com.scanit.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            )
            .authorizeHttpRequests(auth -> auth
                // Public endpoints (no authentication required)
                .requestMatchers("/health", "/api/health").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/merchant/register").permitAll()
                // Customer menu + order placement (must be before /api/businesses/** merchant rule)
                .requestMatchers(HttpMethod.GET, "/api/businesses/*/menu").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/businesses/*/orders").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/qr/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/menu/**").permitAll()
                
                // Merchant endpoints (requires MERCHANT role)
                .requestMatchers("/api/auth/merchant/**").hasRole("MERCHANT")
                .requestMatchers("/api/businesses/**").hasRole("MERCHANT")
                .requestMatchers("/api/catalog/**").hasRole("MERCHANT")
                .requestMatchers("/api/orders/**").hasAnyRole("MERCHANT", "ADMIN")
                .requestMatchers("/api/receipts/**").hasAnyRole("MERCHANT", "ADMIN")
                
                // Admin endpoints (requires ADMIN role)
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                
                // All other requests require authentication
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt
                    .jwtAuthenticationConverter(jwtAuthenticationConverter())
                )
            );

        return http.build();
    }

    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(jwt -> {
            // Extract roles from Keycloak token
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
        configuration.setAllowedOrigins(List.of("http://localhost:5173", "http://localhost:5174", "https://scanit.app"));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);
        
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        
        return source;
    }
}
