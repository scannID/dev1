package com.scanny.controller;

import com.scanny.dto.admin.AdminAnalyticsDtos;
import com.scanny.service.AdminAnalyticsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
public class AdminAnalyticsController {

    private final AdminAnalyticsService adminAnalyticsService;

    public AdminAnalyticsController(AdminAnalyticsService adminAnalyticsService) {
        this.adminAnalyticsService = adminAnalyticsService;
    }

    @GetMapping("/analytics/tickets")
    public AdminAnalyticsDtos.TicketAnalytics getTicketAnalytics() {
        return adminAnalyticsService.getTicketAnalytics();
    }

    @GetMapping("/analytics/quick-payments")
    public AdminAnalyticsDtos.QuickPaymentAnalytics getQuickPaymentAnalytics() {
        return adminAnalyticsService.getQuickPaymentAnalytics();
    }

    @GetMapping("/analytics/devices")
    public AdminAnalyticsDtos.DeviceAnalytics getDeviceAnalytics() {
        return adminAnalyticsService.getDeviceAnalytics();
    }

    @GetMapping("/analytics/scans-orders")
    public AdminAnalyticsDtos.ScansOrdersSeries getScansOrders(
        @RequestParam(defaultValue = "daily") String range
    ) {
        return adminAnalyticsService.getScansOrders(range);
    }

    @GetMapping("/revenue/overview")
    public AdminAnalyticsDtos.RevenueOverview getRevenueOverview() {
        return adminAnalyticsService.getRevenueOverview();
    }
}
