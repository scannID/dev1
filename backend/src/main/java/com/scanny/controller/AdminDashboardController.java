package com.scanny.controller;

import com.scanny.dto.admin.AdminDashboardDtos;
import com.scanny.service.AdminDashboardService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/dashboard")
public class AdminDashboardController {

    private final AdminDashboardService adminDashboardService;

    public AdminDashboardController(AdminDashboardService adminDashboardService) {
        this.adminDashboardService = adminDashboardService;
    }

    @GetMapping("/metrics")
    public AdminDashboardDtos.DashboardMetrics getDashboardMetrics() {
        return adminDashboardService.getDashboardMetrics();
    }

    @GetMapping("/activity")
    public List<AdminDashboardDtos.ActivityEvent> getActivityFeed() {
        return adminDashboardService.getActivityFeed();
    }

    @GetMapping("/top-merchants")
    public List<AdminDashboardDtos.TopMerchant> getTopMerchants(
        @RequestParam(defaultValue = "month") String period,
        @RequestParam(defaultValue = "orders") String sortBy,
        @RequestParam(defaultValue = "5") int limit
    ) {
        return adminDashboardService.getTopMerchants(period, sortBy, limit);
    }
}
