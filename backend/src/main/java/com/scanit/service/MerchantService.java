package com.scanit.service;

import com.scanit.dto.MerchantDtos.*;
import com.scanit.entity.Merchant;
import com.scanit.exception.ApiException;
import com.scanit.repository.MerchantRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class MerchantService {

    private static final Logger logger = LoggerFactory.getLogger(MerchantService.class);
    
    private final MerchantRepository merchantRepository;
    private final QrCodeService qrCodeService;
    private final KeycloakAdminService keycloakAdminService;
    
    public MerchantService(MerchantRepository merchantRepository, QrCodeService qrCodeService, KeycloakAdminService keycloakAdminService) {
        this.merchantRepository = merchantRepository;
        this.qrCodeService = qrCodeService;
        this.keycloakAdminService = keycloakAdminService;
    }

    /**
     * Register a new merchant
     */
    @Transactional
    public RegisterMerchantResponse registerMerchant(RegisterMerchantRequest request) {
        // Validate email doesn't exist
        if (merchantRepository.existsByEmail(request.email())) {
            throw new ApiException(400, "Email already registered");
        }
        
        // Validate payment details
        validatePaymentDestination(request.paymentDestination());
        
        // Create user in Keycloak first
        UUID keycloakUserId;
        try {
            keycloakUserId = keycloakAdminService.createUser(
                request.email(),
                request.businessName(),  // Use business name as first name
                "",  // No last name for business
                "MERCHANT"  // Assign merchant role
            );
        } catch (ApiException e) {
            // If Keycloak user creation fails, don't create merchant
            throw e;
        }
        
        // Create merchant entity
        Merchant merchant = new Merchant();
        merchant.setKeycloakUserId(keycloakUserId);
        merchant.setEmail(request.email());
        merchant.setPhoneNumber(request.phoneNumber());
        merchant.setBusinessName(request.businessName());
        merchant.setBusinessType(request.businessType());
        merchant.setBusinessDescription(request.businessDescription());
        merchant.setBusinessAddress(request.businessAddress());
        
        // Set payment destination
        setPaymentDestination(merchant, request.paymentDestination());
        
        // Set referral if provided
        if (request.referralCode() != null && !request.referralCode().isBlank()) {
            merchant.setReferredBy(request.referralCode());
        }
        
        // Initial status
        merchant.setStatus(Merchant.MerchantStatus.PENDING_VERIFICATION);
        merchant.setEmailVerified(false);
        merchant.setOnboardingStep(1);
        
        // Save merchant
        merchant = merchantRepository.save(merchant);
        
        logger.info("Registered new merchant: {} ({}) with Keycloak ID: {}", 
            merchant.getBusinessName(), merchant.getEmail(), keycloakUserId);
        
        return new RegisterMerchantResponse(
            merchant.getId(),
            merchant.getEmail(),
            merchant.getBusinessName(),
            "Registration successful! Please check your email to verify your account and set your password.",
            "VERIFY_EMAIL",
            true
        );
    }

    /**
     * Handle post-login logic - generate QR code on first login if needed
     */
    @Transactional
    public MerchantProfile handleLogin(UUID keycloakUserId) {
        Merchant merchant = merchantRepository.findByKeycloakUserId(keycloakUserId)
                .orElseThrow(() -> new ApiException(404, "Merchant not found"));
        
        // Update last login
        merchant.setLastLoginAt(LocalDateTime.now());
        
        // Auto-generate QR code on first login if not exists
        if (merchant.getQrCodeToken() == null) {
            logger.info("Generating QR code for merchant {} on first login", merchant.getId());
            qrCodeService.generateQrCode(merchant.getId(), "FIRST_LOGIN");
            
            // Refresh merchant to get updated QR code
            merchant = merchantRepository.findById(merchant.getId())
                    .orElseThrow(() -> new ApiException(404, "Merchant not found"));
        }
        
        // Update email verified if Keycloak says so
        if (!merchant.getEmailVerified()) {
            merchant.setEmailVerified(true);
            merchant.setEmailVerifiedAt(LocalDateTime.now());
            
            // Activate account if still pending verification
            if (merchant.getStatus() == Merchant.MerchantStatus.PENDING_VERIFICATION) {
                merchant.setStatus(Merchant.MerchantStatus.ACTIVE);
            }
        }
        
        merchantRepository.save(merchant);
        
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

    /**
     * Get merchant profile
     */
    @Transactional(readOnly = true)
    public MerchantProfile getMerchantProfile(UUID merchantId) {
        Merchant merchant = merchantRepository.findById(merchantId)
                .orElseThrow(() -> new ApiException(404, "Merchant not found"));
        
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

    /**
     * Get merchant by Keycloak user ID
     */
    @Transactional(readOnly = true)
    public MerchantProfile getMerchantByKeycloakId(UUID keycloakUserId) {
        Merchant merchant = merchantRepository.findByKeycloakUserId(keycloakUserId)
                .orElseThrow(() -> new ApiException(404, "Merchant not found"));
        
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

    /**
     * Update merchant profile
     */
    @Transactional
    public MerchantProfile updateMerchant(UUID merchantId, UpdateMerchantRequest request) {
        Merchant merchant = merchantRepository.findById(merchantId)
                .orElseThrow(() -> new ApiException(404, "Merchant not found"));
        
        if (request.businessName() != null) {
            merchant.setBusinessName(request.businessName());
        }
        if (request.businessDescription() != null) {
            merchant.setBusinessDescription(request.businessDescription());
        }
        if (request.businessAddress() != null) {
            merchant.setBusinessAddress(request.businessAddress());
        }
        if (request.phoneNumber() != null) {
            merchant.setPhoneNumber(request.phoneNumber());
        }
        if (request.businessLogoUrl() != null) {
            merchant.setBusinessLogoUrl(request.businessLogoUrl());
        }
        
        merchant = merchantRepository.save(merchant);
        
        logger.info("Updated merchant profile: {}", merchantId);
        
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

    /**
     * Get onboarding status
     */
    @Transactional(readOnly = true)
    public OnboardingStatusResponse getOnboardingStatus(UUID merchantId) {
        Merchant merchant = merchantRepository.findById(merchantId)
                .orElseThrow(() -> new ApiException(404, "Merchant not found"));
        
        // Define onboarding steps
        StepStatus emailVerification = new StepStatus(
            1,
            "Verify Email",
            "Check your email and click the verification link",
            merchant.getEmailVerified(),
            merchant.getEmailVerifiedAt(),
            null
        );
        
        StepStatus qrCodeGeneration = new StepStatus(
            2,
            "Get Your QR Code",
            "Your unique QR code for customers to scan",
            merchant.getQrCodeToken() != null,
            merchant.getQrCodeGeneratedAt(),
            "/dashboard/qr-code"
        );
        
        // Check if catalog has items (simplified - would query catalog table in real implementation)
        StepStatus catalogSetup = new StepStatus(
            3,
            "Add Menu Items",
            "Add products or services to your catalog",
            merchant.getOnboardingStep() >= 3,
            null,
            "/dashboard/catalog"
        );
        
        StepStatus testOrder = new StepStatus(
            4,
            "Test an Order",
            "Scan your QR code and place a test order",
            merchant.getOnboardingStep() >= 4,
            null,
            "/dashboard/orders"
        );
        
        StepStatus complete = new StepStatus(
            5,
            "Complete",
            "You're all set! Start accepting orders",
            merchant.getOnboardingCompleted(),
            merchant.getOnboardingCompletedAt(),
            "/dashboard"
        );
        
        OnboardingSteps steps = new OnboardingSteps(
            emailVerification,
            qrCodeGeneration,
            catalogSetup,
            testOrder,
            complete
        );
        
        return new OnboardingStatusResponse(
            merchant.getOnboardingStep(),
            5,
            merchant.getOnboardingCompleted(),
            steps
        );
    }

    /**
     * Complete onboarding
     */
    @Transactional
    public void completeOnboarding(UUID merchantId) {
        Merchant merchant = merchantRepository.findById(merchantId)
                .orElseThrow(() -> new ApiException(404, "Merchant not found"));
        
        merchant.setOnboardingCompleted(true);
        merchant.setOnboardingStep(5);
        merchant.setOnboardingCompletedAt(LocalDateTime.now());
        
        merchantRepository.save(merchant);
        
        logger.info("Merchant {} completed onboarding", merchantId);
    }

    /**
     * Validate payment destination
     */
    private void validatePaymentDestination(PaymentDestination payment) {
        if (payment.type() == Merchant.PaymentType.MOBILE_MONEY) {
            if (payment.provider() == null || payment.provider().isBlank()) {
                throw new ApiException(400, "Mobile money provider is required");
            }
            if (payment.number() == null || payment.number().isBlank()) {
                throw new ApiException(400, "Mobile money number is required");
            }
        } else if (payment.type() == Merchant.PaymentType.BANK_ACCOUNT) {
            if (payment.bankName() == null || payment.bankName().isBlank()) {
                throw new ApiException(400, "Bank name is required");
            }
            if (payment.bankAccountNumber() == null || payment.bankAccountNumber().isBlank()) {
                throw new ApiException(400, "Bank account number is required");
            }
        }
    }

    /**
     * Set payment destination on merchant
     */
    private void setPaymentDestination(Merchant merchant, PaymentDestination payment) {
        merchant.setPaymentType(payment.type());
        
        if (payment.type() == Merchant.PaymentType.MOBILE_MONEY) {
            merchant.setPaymentProvider(payment.provider());
            merchant.setPaymentNumber(payment.number());
            merchant.setPaymentAccountName(payment.accountName());
        } else {
            merchant.setBankName(payment.bankName());
            merchant.setBankAccountNumber(payment.bankAccountNumber());
            merchant.setBankBranchCode(payment.bankBranchCode());
            merchant.setBankSwiftCode(payment.bankSwiftCode());
            merchant.setPaymentAccountName(payment.accountName());
        }
    }
}
