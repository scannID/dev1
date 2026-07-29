package com.scanny.service;

import com.scanny.dto.BusinessResponse;
import com.scanny.dto.MerchantDtos;
import com.scanny.dto.MerchantDtos.*;
import com.scanny.entity.Merchant;
import com.scanny.exception.ApiException;
import com.scanny.repository.MerchantRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.oauth2.jwt.Jwt;
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
    private final BusinessService businessService;
    
    public MerchantService(
            MerchantRepository merchantRepository,
            QrCodeService qrCodeService,
            KeycloakAdminService keycloakAdminService,
            BusinessService businessService
    ) {
        this.merchantRepository = merchantRepository;
        this.qrCodeService = qrCodeService;
        this.keycloakAdminService = keycloakAdminService;
        this.businessService = businessService;
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
     * Full post-login payload for the merchant portal.
     */
    @Transactional
    public MerchantMeResponse getMe(Jwt jwt) {
        UUID keycloakUserId = UUID.fromString(jwt.getSubject());
        MerchantProfile profile = handleLogin(jwt, keycloakUserId);
        var businesses = businessService.listBusinessesForMerchant(profile.id().toString());
        BusinessResponse business = businesses.isEmpty()
                ? businessService.getBusinessForMerchant(profile.id().toString())
                : businesses.get(0);
        OnboardingStatusResponse onboarding = getOnboardingStatus(profile.id());
        return new MerchantMeResponse(profile, business, businesses, onboarding);
    }

    /**
     * Handle post-login logic - resolve merchant (auto-provision if needed),
     * generate QR on first login, ensure ordering Business exists.
     */
    @Transactional
    public MerchantProfile handleLogin(Jwt jwt, UUID keycloakUserId) {
        Merchant merchant = resolveMerchantForLogin(jwt, keycloakUserId);
        
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

        // Local demo accounts (e.g. pentagon@) were historically forced to RESTAURANT — correct them.
        merchant = applyLocalDemoTypeOverrides(merchant);

        // Bridge Merchant → Business for catalog/orders
        BusinessResponse business = businessService.ensureBusinessForMerchant(merchant);
        // Keep merchant QR URL aligned with customer deep link
        String customerUrl = business.customerUrl();
        if (customerUrl != null && !customerUrl.equals(merchant.getQrCodeUrl())) {
            merchant.setQrCodeUrl(customerUrl);
            merchantRepository.save(merchant);
        }
        
        return toProfileEntity(merchant);
    }

    /**
     * Find merchant by Keycloak ID, link by email, or auto-provision on first login.
     * Any caller of /me already has the MERCHANT role in Keycloak.
     */
    private Merchant resolveMerchantForLogin(Jwt jwt, UUID keycloakUserId) {
        return merchantRepository.findByKeycloakUserId(keycloakUserId)
                .or(() -> linkMerchantByEmail(jwt, keycloakUserId))
                .orElseGet(() -> provisionMerchantFromJwt(jwt, keycloakUserId));
    }

    private java.util.Optional<Merchant> linkMerchantByEmail(Jwt jwt, UUID keycloakUserId) {
        String email = extractEmail(jwt);
        if (email == null || email.isBlank()) {
            return java.util.Optional.empty();
        }

        return merchantRepository.findByEmail(email.toLowerCase().trim())
                .map(existing -> {
                    existing.setKeycloakUserId(keycloakUserId);
                    Merchant linked = merchantRepository.save(existing);
                    logger.info("Linked existing merchant {} to Keycloak user {}", email, keycloakUserId);
                    return linked;
                });
    }

    private Merchant provisionMerchantFromJwt(Jwt jwt, UUID keycloakUserId) {
        String email = extractEmail(jwt);
        if (email == null || email.isBlank()) {
            throw new ApiException(
                    400,
                    "No merchant account found. Add an email to your Keycloak user or register via the merchant signup flow."
            );
        }

        email = email.toLowerCase().trim();
        if (merchantRepository.existsByEmail(email)) {
            throw new ApiException(409, "Email already registered under a different Keycloak account.");
        }

        String businessName = extractBusinessName(jwt, email);

        Merchant merchant = new Merchant();
        merchant.setKeycloakUserId(keycloakUserId);
        merchant.setEmail(email);
        merchant.setBusinessName(businessName);
        merchant.setBusinessType(resolveLocalDemoBusinessType(email, businessName));
        merchant.setPhoneNumber("");
        merchant.setPaymentType(Merchant.PaymentType.MOBILE_MONEY);
        merchant.setPaymentProvider("MTN");
        merchant.setPaymentNumber("+256700000000");
        merchant.setPaymentAccountName(businessName);
        merchant.setStatus(Merchant.MerchantStatus.ACTIVE);
        merchant.setEmailVerified(Boolean.TRUE.equals(jwt.getClaim("email_verified")));
        if (Boolean.TRUE.equals(merchant.getEmailVerified())) {
            merchant.setEmailVerifiedAt(LocalDateTime.now());
        }
        merchant.setOnboardingStep(1);

        // Flush immediately so the merchant row physically exists before the
        // first-login QR log (raw JDBC insert) and business bridge reference it
        // via foreign key within the same transaction.
        merchant = merchantRepository.saveAndFlush(merchant);
        logger.info("Auto-provisioned merchant {} ({}) for Keycloak user {}", businessName, email, keycloakUserId);
        return merchant;
    }

    /**
     * Local Keycloak demo accounts are always provisioned without a signup form,
     * so map known emails/names to the right venue type (e.g. Pentagon = Hotel).
     */
    static Merchant.BusinessType resolveLocalDemoBusinessType(String email, String businessName) {
        String e = email == null ? "" : email.toLowerCase(java.util.Locale.ROOT).trim();
        String n = businessName == null ? "" : businessName.toLowerCase(java.util.Locale.ROOT).trim();
        if (e.startsWith("pentagon@") || n.contains("pentagon") || n.contains("hotel") || n.contains("suite")) {
            return Merchant.BusinessType.HOTEL;
        }
        if (e.startsWith("city-lounge@") || n.contains("lounge") || n.contains(" bar")) {
            return Merchant.BusinessType.BAR;
        }
        return Merchant.BusinessType.RESTAURANT;
    }

    /** Keep already-provisioned local demo merchants on the intended type. */
    @Transactional
    public Merchant applyLocalDemoTypeOverrides(Merchant merchant) {
        if (merchant == null || merchant.getEmail() == null) {
            return merchant;
        }
        Merchant.BusinessType intended = resolveLocalDemoBusinessType(merchant.getEmail(), merchant.getBusinessName());
        if (intended == Merchant.BusinessType.HOTEL && merchant.getBusinessType() != Merchant.BusinessType.HOTEL) {
            merchant.setBusinessType(Merchant.BusinessType.HOTEL);
            if (merchant.getBusinessName() != null
                    && !merchant.getBusinessName().toLowerCase(java.util.Locale.ROOT).contains("hotel")) {
                merchant.setBusinessName(merchant.getBusinessName().trim() + " Hotel");
            }
            merchant = merchantRepository.save(merchant);
            logger.info("Corrected local demo merchant {} to HOTEL", merchant.getEmail());
        }
        return merchant;
    }

    private static String extractEmail(Jwt jwt) {
        String email = jwt.getClaimAsString("email");
        if (email != null && !email.isBlank()) {
            return email.trim();
        }
        String preferredUsername = jwt.getClaimAsString("preferred_username");
        if (preferredUsername != null && preferredUsername.contains("@")) {
            return preferredUsername.trim();
        }
        return null;
    }

    private static String extractBusinessName(Jwt jwt, String email) {
        String name = jwt.getClaimAsString("name");
        if (name != null && !name.isBlank()) {
            return name.trim();
        }

        String givenName = jwt.getClaimAsString("given_name");
        String familyName = jwt.getClaimAsString("family_name");
        if (givenName != null && !givenName.isBlank()) {
            if (familyName != null && !familyName.isBlank()) {
                return (givenName + " " + familyName).trim();
            }
            return givenName.trim();
        }

        String preferredUsername = jwt.getClaimAsString("preferred_username");
        if (preferredUsername != null && !preferredUsername.isBlank() && !preferredUsername.contains("@")) {
            return preferredUsername.trim();
        }

        if (email.contains("@")) {
            String localPart = email.substring(0, email.indexOf('@')).replace('.', ' ').replace('_', ' ');
            if (!localPart.isBlank()) {
                return Character.toUpperCase(localPart.charAt(0)) + localPart.substring(1);
            }
        }

        return "My Business";
    }

    private MerchantProfile toProfileEntity(Merchant merchant) {
        return MerchantDtos.toProfile(merchant);
    }

    /**
     * Get merchant profile
     */
    @Transactional(readOnly = true)
    public MerchantProfile getMerchantProfile(UUID merchantId) {
        Merchant merchant = merchantRepository.findById(merchantId)
                .orElseThrow(() -> new ApiException(404, "Merchant not found"));
        
        return MerchantDtos.toProfile(merchant);
    }

    /**
     * Get merchant by Keycloak user ID
     */
    @Transactional(readOnly = true)
    public MerchantProfile getMerchantByKeycloakId(UUID keycloakUserId) {
        Merchant merchant = merchantRepository.findByKeycloakUserId(keycloakUserId)
                .orElseThrow(() -> new ApiException(404, "Merchant not found"));
        
        return MerchantDtos.toProfile(merchant);
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
            String logoUrl = request.businessLogoUrl().trim();
            if (logoUrl.isEmpty()) {
                merchant.setBusinessLogoUrl(null);
            } else if (logoUrl.length() > 500_000) {
                throw new ApiException(400, "Logo image is too large. Maximum size is 500KB.");
            } else if (!logoUrl.startsWith("data:image/") && !logoUrl.startsWith("http://") && !logoUrl.startsWith("https://")) {
                throw new ApiException(400, "Logo must be an uploaded image or a valid image URL.");
            } else {
                merchant.setBusinessLogoUrl(logoUrl);
            }
        }
        
        merchant = merchantRepository.save(merchant);
        
        logger.info("Updated merchant profile: {}", merchantId);
        
        return MerchantDtos.toProfile(merchant);
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
