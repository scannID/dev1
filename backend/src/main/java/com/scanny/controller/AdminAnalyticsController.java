package com.scanny.controller;

import com.scanny.dto.admin.AdminAnalyticsDtos;
import com.scanny.service.AdminAnalyticsService;
import com.scanny.service.CookieConsentAnalyticsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
public class AdminAnalyticsController {

    private final AdminAnalyticsService adminAnalyticsService;
    private final CookieConsentAnalyticsService cookieConsentAnalyticsService;

    public AdminAnalyticsController(
            AdminAnalyticsService adminAnalyticsService,
            CookieConsentAnalyticsService cookieConsentAnalyticsService
    ) {
        this.adminAnalyticsService = adminAnalyticsService;
        this.cookieConsentAnalyticsService = cookieConsentAnalyticsService;
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

    @GetMapping("/analytics/traffic")
    public AdminAnalyticsDtos.TrafficAnalytics getTrafficAnalytics(
        @RequestParam(defaultValue = "daily") String range
    ) {
        return adminAnalyticsService.getTrafficAnalytics(range);
    }

    @GetMapping("/analytics/cookie-consents")
    public AdminAnalyticsDtos.CookieConsentAnalytics getCookieConsents(
        @RequestParam(defaultValue = "daily") String range
    ) {
        return cookieConsentAnalyticsService.getAnalytics(range);
    }

    @GetMapping("/revenue/overview")
    public AdminAnalyticsDtos.RevenueOverview getRevenueOverview() {
        return adminAnalyticsService.getRevenueOverview();
    }
}
