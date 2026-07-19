package com.scanny.controller;

import com.scanny.dto.admin.AdminConfigDtos;
import com.scanny.service.AdminConfigService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/configs")
public class AdminConfigController {

    private final AdminConfigService adminConfigService;

    public AdminConfigController(AdminConfigService adminConfigService) {
        this.adminConfigService = adminConfigService;
    }

    @GetMapping
    public AdminConfigDtos.AllConfigsResponse getAllConfigs() {
        return adminConfigService.getAllConfigs();
    }

    @GetMapping("/{section}")
    public AdminConfigDtos.ConfigSectionResponse getSection(@PathVariable String section) {
        return adminConfigService.getSectionConfig(section);
    }

    @PutMapping("/{section}")
    public AdminConfigDtos.ConfigSectionResponse updateSection(
        @PathVariable String section,
        @RequestBody AdminConfigDtos.UpdateConfigRequest request,
        @AuthenticationPrincipal Jwt jwt
    ) {
        String updatedBy = jwt != null
            ? (jwt.getClaimAsString("email") != null ? jwt.getClaimAsString("email") : jwt.getSubject())
            : "admin";
        return adminConfigService.updateSection(section, request.config(), updatedBy);
    }

    @PostMapping("/actions/{action}")
    @ResponseStatus(HttpStatus.OK)
    public AdminConfigDtos.ActionResult runAction(@PathVariable String action) {
        return adminConfigService.runAction(action);
    }

    @PutMapping
    public AdminConfigDtos.AllConfigsResponse updateMany(
        @RequestBody Map<String, Map<String, Object>> body,
        @AuthenticationPrincipal Jwt jwt
    ) {
        String updatedBy = jwt != null
            ? (jwt.getClaimAsString("email") != null ? jwt.getClaimAsString("email") : jwt.getSubject())
            : "admin";
        if (body != null) {
            for (Map.Entry<String, Map<String, Object>> entry : body.entrySet()) {
                adminConfigService.updateSection(entry.getKey(), entry.getValue(), updatedBy);
            }
        }
        return adminConfigService.getAllConfigs();
    }
}
