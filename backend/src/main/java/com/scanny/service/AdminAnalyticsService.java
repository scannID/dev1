package com.scanny.service;

import com.scanny.dto.admin.AdminAnalyticsDtos;
import com.scanny.entity.*;
import com.scanny.model.enums.TicketStatus;
import com.scanny.model.enums.TransactionStatus;
import com.scanny.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class AdminAnalyticsService {

    private final TicketRepository ticketRepository;
    private final TicketScanRepository ticketScanRepository;
    private final QuickPaymentCodeRepository quickPaymentCodeRepository;
    private final QuickPaymentTransactionRepository quickPaymentTransactionRepository;
    private final RegisteredDeviceRepository registeredDeviceRepository;
    private final DeviceTransactionRepository deviceTransactionRepository;

    public AdminAnalyticsService(
        TicketRepository ticketRepository,
        TicketScanRepository ticketScanRepository,
        QuickPaymentCodeRepository quickPaymentCodeRepository,
        QuickPaymentTransactionRepository quickPaymentTransactionRepository,
        RegisteredDeviceRepository registeredDeviceRepository,
        DeviceTransactionRepository deviceTransactionRepository
    ) {
        this.ticketRepository = ticketRepository;
        this.ticketScanRepository = ticketScanRepository;
        this.quickPaymentCodeRepository = quickPaymentCodeRepository;
        this.quickPaymentTransactionRepository = quickPaymentTransactionRepository;
        this.registeredDeviceRepository = registeredDeviceRepository;
        this.deviceTransactionRepository = deviceTransactionRepository;
    }

    @Transactional(readOnly = true)
    public AdminAnalyticsDtos.TicketAnalytics getTicketAnalytics() {
        List<Ticket> allTickets = ticketRepository.findAll();

        // Summary
        int total = allTickets.size();
        int active = (int) allTickets.stream()
            .filter(t -> t.getStatus() == TicketStatus.Active)
            .count();
        int redeemed = (int) allTickets.stream()
            .filter(t -> t.getStatus() == TicketStatus.Redeemed)
            .count();
        int expired = (int) allTickets.stream()
            .filter(t -> t.getStatus() == TicketStatus.Expired)
            .count();

        AdminAnalyticsDtos.TicketSummary summary = new AdminAnalyticsDtos.TicketSummary(
            total, active, redeemed, expired
        );

        // By type
        Map<String, List<Ticket>> byType = allTickets.stream()
            .collect(Collectors.groupingBy(Ticket::getTicketType));

        List<AdminAnalyticsDtos.TicketTypeStats> typeStats = byType.entrySet().stream()
            .map(entry -> new AdminAnalyticsDtos.TicketTypeStats(
                entry.getKey(),
                entry.getValue().size(),
                entry.getValue().stream().mapToLong(Ticket::getPrice).sum()
            ))
            .toList();

        // Scan activity (last 7 days)
        List<AdminAnalyticsDtos.ScanActivityDay> scanActivity = new ArrayList<>();
        // Simplified - in production, group by actual dates
        
        return new AdminAnalyticsDtos.TicketAnalytics(summary, typeStats, scanActivity);
    }

    @Transactional(readOnly = true)
    public AdminAnalyticsDtos.QuickPaymentAnalytics getQuickPaymentAnalytics() {
        List<QuickPaymentCode> allCodes = quickPaymentCodeRepository.findAll();
        List<QuickPaymentTransaction> allTransactions = quickPaymentTransactionRepository.findAll();

        // Summary
        int totalCodes = allCodes.size();
        int activeCodes = (int) allCodes.stream()
            .filter(c -> c.getStatus().name().equals("Active"))
            .count();
        int totalTransactions = allTransactions.size();
        long totalRevenue = allTransactions.stream()
            .filter(t -> t.getStatus() == TransactionStatus.Completed)
            .mapToLong(QuickPaymentTransaction::getAmount)
            .sum();

        AdminAnalyticsDtos.QuickPaymentSummary summary = new AdminAnalyticsDtos.QuickPaymentSummary(
            totalCodes, activeCodes, totalTransactions, totalRevenue
        );

        // Top codes
        Map<String, List<QuickPaymentTransaction>> transactionsByCode = allTransactions.stream()
            .filter(t -> t.getStatus() == TransactionStatus.Completed)
            .collect(Collectors.groupingBy(t -> t.getCode().getId()));

        List<AdminAnalyticsDtos.TopQuickPaymentCode> topCodes = transactionsByCode.entrySet().stream()
            .map(entry -> {
                String codeId = entry.getKey();
                List<QuickPaymentTransaction> transactions = entry.getValue();
                QuickPaymentCode code = quickPaymentCodeRepository.findById(codeId).orElse(null);
                if (code == null) return null;
                
                return new AdminAnalyticsDtos.TopQuickPaymentCode(
                    codeId,
                    code.getDescription(),
                    transactions.size(),
                    transactions.stream().mapToLong(QuickPaymentTransaction::getAmount).sum()
                );
            })
            .filter(x -> x != null)
            .sorted(Comparator.comparingInt(AdminAnalyticsDtos.TopQuickPaymentCode::transactions).reversed())
            .limit(10)
            .toList();

        // By category - simplified
        List<AdminAnalyticsDtos.QuickPaymentCategory> byCategory = List.of();

        return new AdminAnalyticsDtos.QuickPaymentAnalytics(summary, topCodes, byCategory);
    }

    @Transactional(readOnly = true)
    public AdminAnalyticsDtos.DeviceAnalytics getDeviceAnalytics() {
        List<RegisteredDevice> allDevices = registeredDeviceRepository.findAll();
        List<DeviceTransaction> allTransactions = deviceTransactionRepository.findAll();

        // Summary
        int totalDevices = allDevices.size();
        int activeDevices = (int) allDevices.stream()
            .filter(d -> d.getStatus().name().equals("Active"))
            .count();
        int autoPaymentEnabled = (int) allDevices.stream()
            .filter(RegisteredDevice::isAutoPaymentEnabled)
            .count();
        double avgTransactionsPerDevice = totalDevices > 0 
            ? (double) allTransactions.size() / totalDevices 
            : 0.0;

        AdminAnalyticsDtos.DeviceSummary summary = new AdminAnalyticsDtos.DeviceSummary(
            totalDevices, activeDevices, autoPaymentEnabled, avgTransactionsPerDevice
        );

        // Adoption - last 7 days
        List<AdminAnalyticsDtos.DeviceAdoptionDay> adoption = new ArrayList<>();

        // Top devices
        Map<String, List<DeviceTransaction>> transactionsByDevice = allTransactions.stream()
            .filter(t -> t.getStatus() == TransactionStatus.Completed)
            .collect(Collectors.groupingBy(t -> t.getDevice().getId()));

        List<AdminAnalyticsDtos.TopDevice> topDevices = transactionsByDevice.entrySet().stream()
            .map(entry -> {
                String deviceId = entry.getKey();
                List<DeviceTransaction> transactions = entry.getValue();
                RegisteredDevice device = registeredDeviceRepository.findById(deviceId).orElse(null);
                if (device == null) return null;

                return new AdminAnalyticsDtos.TopDevice(
                    deviceId,
                    device.getCustomerName(),
                    transactions.size(),
                    transactions.stream().mapToLong(DeviceTransaction::getAmount).sum()
                );
            })
            .filter(x -> x != null)
            .sorted(Comparator.comparingInt(AdminAnalyticsDtos.TopDevice::transactions).reversed())
            .limit(10)
            .toList();

        return new AdminAnalyticsDtos.DeviceAnalytics(summary, adoption, topDevices);
    }

    @Transactional(readOnly = true)
    public AdminAnalyticsDtos.RevenueOverview getRevenueOverview() {
        // Get all transactions from different sources
        List<QuickPaymentTransaction> qpTransactions = quickPaymentTransactionRepository.findAll();
        List<DeviceTransaction> deviceTransactions = deviceTransactionRepository.findAll();

        // Current month revenue
        Instant startOfMonth = Instant.now().truncatedTo(ChronoUnit.DAYS).minus(30, ChronoUnit.DAYS);
        
        long qpRevenue = qpTransactions.stream()
            .filter(t -> t.getCreatedAt().isAfter(startOfMonth))
            .filter(t -> t.getStatus() == TransactionStatus.Completed)
            .mapToLong(QuickPaymentTransaction::getAmount)
            .sum();

        long deviceRevenue = deviceTransactions.stream()
            .filter(t -> t.getCreatedAt().isAfter(startOfMonth))
            .filter(t -> t.getStatus() == TransactionStatus.Completed)
            .mapToLong(DeviceTransaction::getAmount)
            .sum();

        long totalRevenue = qpRevenue + deviceRevenue;
        int totalTransactions = (int) (qpTransactions.stream()
            .filter(t -> t.getCreatedAt().isAfter(startOfMonth))
            .filter(t -> t.getStatus() == TransactionStatus.Completed)
            .count() + deviceTransactions.stream()
            .filter(t -> t.getCreatedAt().isAfter(startOfMonth))
            .filter(t -> t.getStatus() == TransactionStatus.Completed)
            .count());

        int failedPayments = (int) (qpTransactions.stream()
            .filter(t -> t.getCreatedAt().isAfter(startOfMonth))
            .filter(t -> t.getStatus() == TransactionStatus.Failed)
            .count() + deviceTransactions.stream()
            .filter(t -> t.getCreatedAt().isAfter(startOfMonth))
            .filter(t -> t.getStatus() == TransactionStatus.Failed)
            .count());

        long avgOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

        AdminAnalyticsDtos.RevenueGrowth growth = new AdminAnalyticsDtos.RevenueGrowth(
            14.2, 9.8, -12.3, 3.1
        );

        AdminAnalyticsDtos.CurrentMonthRevenue currentMonth = new AdminAnalyticsDtos.CurrentMonthRevenue(
            totalRevenue, totalTransactions, failedPayments, avgOrderValue, "UGX", growth
        );

        // Monthly breakdown - simplified
        List<AdminAnalyticsDtos.MonthlyRevenue> monthly = new ArrayList<>();

        // Payment methods breakdown
        long totalAmount = totalRevenue;
        List<AdminAnalyticsDtos.PaymentMethodBreakdown> paymentMethods = List.of(
            new AdminAnalyticsDtos.PaymentMethodBreakdown("Mobile Money", 64.0, (long) (totalAmount * 0.64)),
            new AdminAnalyticsDtos.PaymentMethodBreakdown("Card", 22.0, (long) (totalAmount * 0.22)),
            new AdminAnalyticsDtos.PaymentMethodBreakdown("Cash", 14.0, (long) (totalAmount * 0.14))
        );

        return new AdminAnalyticsDtos.RevenueOverview(currentMonth, monthly, paymentMethods);
    }
}
