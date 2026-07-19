package com.scanny.controller;

import com.scanny.dto.admin.SystemHealthDtos;
import com.scanny.service.SystemHealthService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
public class SystemHealthController {

    private final SystemHealthService systemHealthService;

    public SystemHealthController(SystemHealthService systemHealthService) {
        this.systemHealthService = systemHealthService;
    }

    @GetMapping("/system/status")
    public SystemHealthDtos.SystemHealthResponse getSystemStatus() {
        return systemHealthService.getSystemHealth();
    }

    @GetMapping("/health/services")
    public SystemHealthDtos.SystemHealthResponse getHealthServices() {
        return systemHealthService.getSystemHealth();
    }
}
