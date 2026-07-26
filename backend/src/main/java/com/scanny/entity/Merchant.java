package com.scanny.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "merchants")
public class Merchant {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "keycloak_user_id", unique = true, nullable = false)
    private UUID keycloakUserId;

    // Contact
    @Column(name = "email", unique = true, nullable = false, length = 255)
    private String email;

    @Column(name = "phone_number", length = 50)
    private String phoneNumber;

    // Business details
    @Column(name = "business_name", nullable = false, length = 200)
    private String businessName;

    @Column(name = "business_type", nullable = false, length = 50)
    @Enumerated(EnumType.STRING)
    private BusinessType businessType;

    @Column(name = "business_description", columnDefinition = "TEXT")
    private String businessDescription;

    @Column(name = "business_address", columnDefinition = "TEXT")
    private String businessAddress;

    @Column(name = "business_logo_url", columnDefinition = "TEXT")
    private String businessLogoUrl;

    // QR Code
    @Column(name = "qr_code_token", unique = true, length = 100)
    private String qrCodeToken;

    @Column(name = "qr_code_url", columnDefinition = "TEXT")
    private String qrCodeUrl;

    @Column(name = "qr_code_generated_at")
    private LocalDateTime qrCodeGeneratedAt;

    @Column(name = "qr_code_printed")
    private Boolean qrCodePrinted = false;

    @Column(name = "qr_code_print_count")
    private Integer qrCodePrintCount = 0;

    // Payment destination
    @Column(name = "payment_type", nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private PaymentType paymentType;

    @Column(name = "payment_provider", length = 50)
    private String paymentProvider;

    @Column(name = "payment_number", length = 50)
    private String paymentNumber;

    @Column(name = "payment_account_name", length = 200)
    private String paymentAccountName;

    // Bank details
    @Column(name = "bank_name", length = 100)
    private String bankName;

    @Column(name = "bank_account_number", length = 50)
    private String bankAccountNumber;

    @Column(name = "bank_branch_code", length = 20)
    private String bankBranchCode;

    @Column(name = "bank_swift_code", length = 20)
    private String bankSwiftCode;

    // Verification
    @Column(name = "email_verified")
    private Boolean emailVerified = false;

    @Column(name = "email_verified_at")
    private LocalDateTime emailVerifiedAt;

    @Column(name = "phone_verified")
    private Boolean phoneVerified = false;

    @Column(name = "phone_verified_at")
    private LocalDateTime phoneVerifiedAt;

    @Column(name = "payment_verified")
    private Boolean paymentVerified = false;

    @Column(name = "payment_verified_at")
    private LocalDateTime paymentVerifiedAt;

    // Status
    @Column(name = "status", length = 20)
    @Enumerated(EnumType.STRING)
    private MerchantStatus status = MerchantStatus.PENDING_VERIFICATION;

    @Column(name = "approved_by")
    private UUID approvedBy;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "suspension_reason", columnDefinition = "TEXT")
    private String suspensionReason;

    // Subscription
    @Column(name = "plan", length = 20)
    @Enumerated(EnumType.STRING)
    private SubscriptionPlan plan = SubscriptionPlan.FREE;

    @Column(name = "plan_started_at")
    private LocalDateTime planStartedAt;

    @Column(name = "plan_expires_at")
    private LocalDateTime planExpiresAt;

    @Column(name = "trial_ends_at")
    private LocalDateTime trialEndsAt;

    // Onboarding
    @Column(name = "onboarding_completed")
    private Boolean onboardingCompleted = false;

    @Column(name = "onboarding_step")
    private Integer onboardingStep = 1;

    @Column(name = "onboarding_completed_at")
    private LocalDateTime onboardingCompletedAt;

    // Features & Limits
    @Column(name = "max_catalog_items")
    private Integer maxCatalogItems = 50;

    @Column(name = "max_orders_per_month")
    private Integer maxOrdersPerMonth = 1000;

    @Column(name = "allow_online_payments")
    private Boolean allowOnlinePayments = true;

    @Column(name = "allow_table_ordering")
    private Boolean allowTableOrdering = true;

    @Column(name = "allow_takeaway")
    private Boolean allowTakeaway = true;

    // Marketing
    @Column(name = "referral_code", unique = true, length = 20)
    private String referralCode;

    @Column(name = "referred_by", length = 20)
    private String referredBy;

    // Metadata
    @Column(name = "settings", columnDefinition = "jsonb")
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    private String settings;

    @Column(name = "metadata", columnDefinition = "jsonb")
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    private String metadata;

    // Timestamps
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        planStartedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Enums
    public enum BusinessType {
        RESTAURANT,
        HOTEL,
        BAR,
        PARKING,
        EVENT,
        SALON,
        RETAIL,
        OTHER
    }

    public enum PaymentType {
        MOBILE_MONEY,
        BANK_ACCOUNT
    }

    public enum MerchantStatus {
        PENDING_VERIFICATION,
        ACTIVE,
        SUSPENDED,
        CLOSED
    }

    public enum SubscriptionPlan {
        FREE,
        BASIC,
        PRO,
        ENTERPRISE
    }

    // Getters and Setters
    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getKeycloakUserId() {
        return keycloakUserId;
    }

    public void setKeycloakUserId(UUID keycloakUserId) {
        this.keycloakUserId = keycloakUserId;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    public String getBusinessName() {
        return businessName;
    }

    public void setBusinessName(String businessName) {
        this.businessName = businessName;
    }

    public BusinessType getBusinessType() {
        return businessType;
    }

    public void setBusinessType(BusinessType businessType) {
        this.businessType = businessType;
    }

    public String getBusinessDescription() {
        return businessDescription;
    }

    public void setBusinessDescription(String businessDescription) {
        this.businessDescription = businessDescription;
    }

    public String getBusinessAddress() {
        return businessAddress;
    }

    public void setBusinessAddress(String businessAddress) {
        this.businessAddress = businessAddress;
    }

    public String getBusinessLogoUrl() {
        return businessLogoUrl;
    }

    public void setBusinessLogoUrl(String businessLogoUrl) {
        this.businessLogoUrl = businessLogoUrl;
    }

    public String getQrCodeToken() {
        return qrCodeToken;
    }

    public void setQrCodeToken(String qrCodeToken) {
        this.qrCodeToken = qrCodeToken;
    }

    public String getQrCodeUrl() {
        return qrCodeUrl;
    }

    public void setQrCodeUrl(String qrCodeUrl) {
        this.qrCodeUrl = qrCodeUrl;
    }

    public LocalDateTime getQrCodeGeneratedAt() {
        return qrCodeGeneratedAt;
    }

    public void setQrCodeGeneratedAt(LocalDateTime qrCodeGeneratedAt) {
        this.qrCodeGeneratedAt = qrCodeGeneratedAt;
    }

    public Boolean getQrCodePrinted() {
        return qrCodePrinted;
    }

    public void setQrCodePrinted(Boolean qrCodePrinted) {
        this.qrCodePrinted = qrCodePrinted;
    }

    public Integer getQrCodePrintCount() {
        return qrCodePrintCount;
    }

    public void setQrCodePrintCount(Integer qrCodePrintCount) {
        this.qrCodePrintCount = qrCodePrintCount;
    }

    public PaymentType getPaymentType() {
        return paymentType;
    }

    public void setPaymentType(PaymentType paymentType) {
        this.paymentType = paymentType;
    }

    public String getPaymentProvider() {
        return paymentProvider;
    }

    public void setPaymentProvider(String paymentProvider) {
        this.paymentProvider = paymentProvider;
    }

    public String getPaymentNumber() {
        return paymentNumber;
    }

    public void setPaymentNumber(String paymentNumber) {
        this.paymentNumber = paymentNumber;
    }

    public String getPaymentAccountName() {
        return paymentAccountName;
    }

    public void setPaymentAccountName(String paymentAccountName) {
        this.paymentAccountName = paymentAccountName;
    }

    public String getBankName() {
        return bankName;
    }

    public void setBankName(String bankName) {
        this.bankName = bankName;
    }

    public String getBankAccountNumber() {
        return bankAccountNumber;
    }

    public void setBankAccountNumber(String bankAccountNumber) {
        this.bankAccountNumber = bankAccountNumber;
    }

    public String getBankBranchCode() {
        return bankBranchCode;
    }

    public void setBankBranchCode(String bankBranchCode) {
        this.bankBranchCode = bankBranchCode;
    }

    public String getBankSwiftCode() {
        return bankSwiftCode;
    }

    public void setBankSwiftCode(String bankSwiftCode) {
        this.bankSwiftCode = bankSwiftCode;
    }

    public Boolean getEmailVerified() {
        return emailVerified;
    }

    public void setEmailVerified(Boolean emailVerified) {
        this.emailVerified = emailVerified;
    }

    public LocalDateTime getEmailVerifiedAt() {
        return emailVerifiedAt;
    }

    public void setEmailVerifiedAt(LocalDateTime emailVerifiedAt) {
        this.emailVerifiedAt = emailVerifiedAt;
    }

    public Boolean getPhoneVerified() {
        return phoneVerified;
    }

    public void setPhoneVerified(Boolean phoneVerified) {
        this.phoneVerified = phoneVerified;
    }

    public LocalDateTime getPhoneVerifiedAt() {
        return phoneVerifiedAt;
    }

    public void setPhoneVerifiedAt(LocalDateTime phoneVerifiedAt) {
        this.phoneVerifiedAt = phoneVerifiedAt;
    }

    public Boolean getPaymentVerified() {
        return paymentVerified;
    }

    public void setPaymentVerified(Boolean paymentVerified) {
        this.paymentVerified = paymentVerified;
    }

    public LocalDateTime getPaymentVerifiedAt() {
        return paymentVerifiedAt;
    }

    public void setPaymentVerifiedAt(LocalDateTime paymentVerifiedAt) {
        this.paymentVerifiedAt = paymentVerifiedAt;
    }

    public MerchantStatus getStatus() {
        return status;
    }

    public void setStatus(MerchantStatus status) {
        this.status = status;
    }

    public UUID getApprovedBy() {
        return approvedBy;
    }

    public void setApprovedBy(UUID approvedBy) {
        this.approvedBy = approvedBy;
    }

    public LocalDateTime getApprovedAt() {
        return approvedAt;
    }

    public void setApprovedAt(LocalDateTime approvedAt) {
        this.approvedAt = approvedAt;
    }

    public String getSuspensionReason() {
        return suspensionReason;
    }

    public void setSuspensionReason(String suspensionReason) {
        this.suspensionReason = suspensionReason;
    }

    public SubscriptionPlan getPlan() {
        return plan;
    }

    public void setPlan(SubscriptionPlan plan) {
        this.plan = plan;
    }

    public LocalDateTime getPlanStartedAt() {
        return planStartedAt;
    }

    public void setPlanStartedAt(LocalDateTime planStartedAt) {
        this.planStartedAt = planStartedAt;
    }

    public LocalDateTime getPlanExpiresAt() {
        return planExpiresAt;
    }

    public void setPlanExpiresAt(LocalDateTime planExpiresAt) {
        this.planExpiresAt = planExpiresAt;
    }

    public LocalDateTime getTrialEndsAt() {
        return trialEndsAt;
    }

    public void setTrialEndsAt(LocalDateTime trialEndsAt) {
        this.trialEndsAt = trialEndsAt;
    }

    public Boolean getOnboardingCompleted() {
        return onboardingCompleted;
    }

    public void setOnboardingCompleted(Boolean onboardingCompleted) {
        this.onboardingCompleted = onboardingCompleted;
    }

    public Integer getOnboardingStep() {
        return onboardingStep;
    }

    public void setOnboardingStep(Integer onboardingStep) {
        this.onboardingStep = onboardingStep;
    }

    public LocalDateTime getOnboardingCompletedAt() {
        return onboardingCompletedAt;
    }

    public void setOnboardingCompletedAt(LocalDateTime onboardingCompletedAt) {
        this.onboardingCompletedAt = onboardingCompletedAt;
    }

    public Integer getMaxCatalogItems() {
        return maxCatalogItems;
    }

    public void setMaxCatalogItems(Integer maxCatalogItems) {
        this.maxCatalogItems = maxCatalogItems;
    }

    public Integer getMaxOrdersPerMonth() {
        return maxOrdersPerMonth;
    }

    public void setMaxOrdersPerMonth(Integer maxOrdersPerMonth) {
        this.maxOrdersPerMonth = maxOrdersPerMonth;
    }

    public Boolean getAllowOnlinePayments() {
        return allowOnlinePayments;
    }

    public void setAllowOnlinePayments(Boolean allowOnlinePayments) {
        this.allowOnlinePayments = allowOnlinePayments;
    }

    public Boolean getAllowTableOrdering() {
        return allowTableOrdering;
    }

    public void setAllowTableOrdering(Boolean allowTableOrdering) {
        this.allowTableOrdering = allowTableOrdering;
    }

    public Boolean getAllowTakeaway() {
        return allowTakeaway;
    }

    public void setAllowTakeaway(Boolean allowTakeaway) {
        this.allowTakeaway = allowTakeaway;
    }

    public String getReferralCode() {
        return referralCode;
    }

    public void setReferralCode(String referralCode) {
        this.referralCode = referralCode;
    }

    public String getReferredBy() {
        return referredBy;
    }

    public void setReferredBy(String referredBy) {
        this.referredBy = referredBy;
    }

    public String getSettings() {
        return settings;
    }

    public void setSettings(String settings) {
        this.settings = settings;
    }

    public String getMetadata() {
        return metadata;
    }

    public void setMetadata(String metadata) {
        this.metadata = metadata;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public LocalDateTime getLastLoginAt() {
        return lastLoginAt;
    }

    public void setLastLoginAt(LocalDateTime lastLoginAt) {
        this.lastLoginAt = lastLoginAt;
    }
}
