package com.scanny.controller;

import com.scanny.dto.OperationsDtos;
import com.scanny.service.StaffService;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth/staff")
public class StaffAuthController {

    private final StaffService staffService;

    public StaffAuthController(StaffService staffService) {
        this.staffService = staffService;
    }

    @GetMapping("/me")
    public OperationsDtos.StaffMeResponse me(
            @org.springframework.security.core.annotation.AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String businessId
    ) {
        return staffService.getMe(jwt, businessId);
    }
}
