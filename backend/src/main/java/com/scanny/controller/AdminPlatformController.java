package com.scanny.controller;

import com.scanny.dto.admin.AdminPlatformDtos;
import com.scanny.service.AdminPlatformService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
public class AdminPlatformController {

    private final AdminPlatformService adminPlatformService;

    public AdminPlatformController(AdminPlatformService adminPlatformService) {
        this.adminPlatformService = adminPlatformService;
    }

    @GetMapping("/catalog")
    public AdminPlatformDtos.CatalogListResponse listCatalog() {
        return adminPlatformService.listCatalog();
    }

    @GetMapping("/users")
    public AdminPlatformDtos.UsersListResponse listUsers() {
        return adminPlatformService.listUsers();
    }

    @GetMapping("/qr-activity")
    public AdminPlatformDtos.QrActivityResponse getQrActivity() {
        return adminPlatformService.getQrActivity();
    }

    @GetMapping("/audit")
    public AdminPlatformDtos.AuditListResponse getAuditLog() {
        return adminPlatformService.getAuditLog();
    }

    @GetMapping("/revenue/transactions")
    public AdminPlatformDtos.RevenueTransactionsResponse listRevenueTransactions() {
        return adminPlatformService.listRevenueTransactions();
    }

    @GetMapping("/reports/overview")
    public AdminPlatformDtos.ReportsOverview getReportsOverview() {
        return adminPlatformService.getReportsOverview();
    }
}
