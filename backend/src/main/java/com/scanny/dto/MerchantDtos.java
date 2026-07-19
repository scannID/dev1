package com.scanny.dto;

import com.scanny.entity.Merchant;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;
import java.util.UUID;

public class MerchantDtos {

    // Registration Request
    public record RegisterMerchantRequest(
        @NotBlank(message = "Business name is required")
        @Size(min = 2, max = 200, message = "Business name must be between 2 and 200 characters")
        String businessName,
        
        @NotNull(message = "Business type is required")
        Merchant.BusinessType businessType,
        
        @NotBlank(message = "Email is required")
        @Email(message = "Invalid email format")
        String email,
        
        @NotBlank(message = "Phone number is required")
        String phoneNumber,
        
        @NotNull(message = "Payment destination is required")
        PaymentDestination paymentDestination,
        
        String businessDescription,
        String businessAddress,
        String referralCode,
        
        @NotNull(message = "You must accept the terms and conditions")
        Boolean termsAccepted
    ) {}

    // Payment Destination
    public record PaymentDestination(
        @NotNull(message = "Payment type is required")
        Merchant.PaymentType type,
        
        // Mobile Money fields
        String provider,      // MTN, AIRTEL, AFRICELL
        String number,
        String accountName,
        
        // Bank fields
        String bankName,
        String bankAccountNumber,
        String bankBranchCode,
        String bankSwiftCode
    ) {}

    // Registration Response
    public record RegisterMerchantResponse(
        UUID merchantId,
        String email,
        String businessName,
        String message,
        String nextStep,  // VERIFY_EMAIL, COMPLETE_ONBOARDING, etc.
        Boolean success
    ) {}

    // Login Request
    public record LoginRequest(
        @NotBlank(message = "Email is required")
        @Email(message = "Invalid email format")
        String email,
        
        @NotBlank(message = "Password is required")
        String password
    ) {}

    // Login Response
    public record LoginResponse(
        String accessToken,
        String refreshToken,
        Long expiresIn,
        String tokenType,
        MerchantProfile merchant
    ) {}

    // Merchant Profile (returned after login)
    public record MerchantProfile(
        UUID id,
        String email,
        String businessName,
        Merchant.BusinessType businessType,
        String phoneNumber,
        String qrCodeToken,
        String qrCodeUrl,
        Boolean qrCodeGenerated,
        Boolean emailVerified,
        Boolean onboardingCompleted,
        Integer onboardingStep,
        Merchant.MerchantStatus status,
        Merchant.SubscriptionPlan plan,
        LocalDateTime createdAt
    ) {}

    // QR Code Response
    public record QrCodeResponse(
        String qrCodeToken,
        String qrCodeUrl,
        String qrCodeDataUrl,  // Base64 PNG image
        Boolean newlyGenerated,
        LocalDateTime generatedAt,
        Integer printCount,
        String downloadUrl
    ) {}

    // QR Code Generation Request
    public record GenerateQrCodeRequest(
        UUID merchantId,
        String reason  // FIRST_LOGIN, REGENERATE, LOST, DAMAGED
    ) {}

    // Onboarding Status Response
    public record OnboardingStatusResponse(
        Integer currentStep,
        Integer totalSteps,
        Boolean completed,
        OnboardingSteps steps
    ) {}

    // Onboarding Steps
    public record OnboardingSteps(
        StepStatus emailVerification,
        StepStatus qrCodeGeneration,
        StepStatus catalogSetup,
        StepStatus testOrder,
        StepStatus complete
    ) {}

    // Step Status
    public record StepStatus(
        Integer stepNumber,
        String title,
        String description,
        Boolean completed,
        LocalDateTime completedAt,
        String actionUrl
    ) {}

    // Merchant Dashboard Summary
    public record MerchantDashboardSummary(
        MerchantProfile merchant,
        DashboardStats stats,
        QrCodeResponse qrCode,
        OnboardingStatusResponse onboarding,
        RecentActivity recentActivity
    ) {}

    // Dashboard Statistics
    public record DashboardStats(
        Long totalOrders,
        Long pendingOrders,
        Long completedOrders,
        Double totalRevenue,
        Long catalogItems,
        Double averageOrderValue,
        Long customersServed
    ) {}

    // Recent Activity
    public record RecentActivity(
        LocalDateTime lastLogin,
        LocalDateTime lastOrderReceived,
        Integer ordersToday,
        Integer ordersThisWeek
    ) {}

    // Update Merchant Request
    public record UpdateMerchantRequest(
        String businessName,
        String businessDescription,
        String businessAddress,
        String phoneNumber,
        String businessLogoUrl
    ) {}

    // Payment Method Request
    public record AddPaymentMethodRequest(
        Merchant.PaymentType paymentType,
        String provider,
        String number,
        String accountName,
        String bankName,
        String bankAccountNumber,
        String bankBranchCode,
        String bankSwiftCode,
        Boolean makePrimary
    ) {}

    // Token Refresh Request
    public record RefreshTokenRequest(
        @NotBlank(message = "Refresh token is required")
        String refreshToken
    ) {}

    // Token Refresh Response
    public record RefreshTokenResponse(
        String accessToken,
        Long expiresIn
    ) {}

    // Logged-in merchant + linked ordering business
    public record MerchantMeResponse(
        MerchantProfile merchant,
        com.scanny.dto.BusinessResponse business,
        OnboardingStatusResponse onboarding
    ) {}

    // Helper method to convert entity to profile DTO
    public static MerchantProfile toProfile(Merchant merchant) {
        return new MerchantProfile(
            merchant.getId(),
            merchant.getEmail(),
            merchant.getBusinessName(),
            merchant.getBusinessType(),
            merchant.getPhoneNumber(),
            merchant.getQrCodeToken(),
            merchant.getQrCodeUrl(),
            merchant.getQrCodeToken() != null,
            merchant.getEmailVerified(),
            merchant.getOnboardingCompleted(),
            merchant.getOnboardingStep(),
            merchant.getStatus(),
            merchant.getPlan(),
            merchant.getCreatedAt()
        );
    }
}
