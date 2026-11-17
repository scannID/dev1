package com.scanny.controller;

import com.scanny.dto.DeviceBindingDtos;
import com.scanny.service.QrDeviceBindingService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Admin endpoints for managing QR device bindings.
 * Requires rent account authentication.
 */
@RestController
@RequestMapping("/api/rent/properties/{propertyId}/device-bindings")
public class RentDeviceBindingController {

    private final QrDeviceBindingService deviceBindingService;

    public RentDeviceBindingController(QrDeviceBindingService deviceBindingService) {
        this.deviceBindingService = deviceBindingService;
    }

    /**
     * Get all device bindings for a property.
     * 
     * <p>GET /api/rent/properties/{propertyId}/device-bindings
     * 
     * <p>Returns list with active, revoked, and expired bindings.
     */
    @GetMapping
    public List<DeviceBindingDtos.DeviceBindingInfo> listBindings(
            @PathVariable String propertyId,
            @AuthenticationPrincipal Jwt jwt) {
        // TODO: Add permission check - only property manager/owner can view
        return deviceBindingService.getPropertyBindings(propertyId);
    }

    /**
     * Get device binding statistics for property dashboard.
     * 
     * <p>GET /api/rent/properties/{propertyId}/device-bindings/stats
     */
    @GetMapping("/stats")
    public DeviceBindingDtos.PropertyBindingStats getStats(
            @PathVariable String propertyId,
            @AuthenticationPrincipal Jwt jwt) {
        return deviceBindingService.getPropertyStats(propertyId);
    }

    /**
     * Revoke a device binding (admin action).
     * Tenant must scan QR again to rebind.
     * 
     * <p>POST /api/rent/properties/{propertyId}/device-bindings/{bindingId}/revoke
     * 
     * <p>Request body:
     * <pre>
     * {
     *   "reason": "Phone lost/stolen"
     * }
     * </pre>
     */
    @PostMapping("/{bindingId}/revoke")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revokeBinding(
            @PathVariable String propertyId,
            @PathVariable Long bindingId,
            @Valid @RequestBody DeviceBindingDtos.RevokeBindingRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        
        // TODO: Add permission check - verify account can manage this property
        
        // Extract account ID from JWT subject
        String accountId = jwt.getSubject();
        
        deviceBindingService.revokeBinding(
            bindingId,
            accountId,
            request.reason()
        );
    }
}
