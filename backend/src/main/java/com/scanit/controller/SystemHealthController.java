package com.scanit.controller;

import com.scanit.dto.admin.SystemHealthDtos;
import com.scanit.service.SystemHealthService;
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
