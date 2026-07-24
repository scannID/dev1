package com.scanny.entity;

import com.scanny.payment.PaymentContext;
import com.scanny.payment.PaymentIntentStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "payment_intents")
public class PaymentIntent {

    @Id
    private String id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PaymentContext context;

    @Column(name = "reference_id", nullable = false)
    private String referenceId;

    @Column(name = "provider_id", nullable = false)
    private String providerId;

    @Column(nullable = false)
    private int amount;

    @Column(nullable = false)
    private int subtotal;

    @Column(name = "service_fee", nullable = false)
    private int serviceFee;

    @Column(name = "pso_fee", nullable = false)
    private int psoFee;

    @Column(name = "platform_fee", nullable = false)
    private int platformFee;

    @Column(name = "merchant_payout", nullable = false)
    private int merchantPayout;

    @Column(name = "merchant_momo_destination", nullable = false)
    private String merchantMomoDestination = "";

    @Column(name = "scanny_fee_destination", nullable = false)
    private String scannyFeeDestination = "";

    @Column(nullable = false)
    private String currency = "UGX";

    @Column(name = "customer_phone", nullable = false)
    private String customerPhone = "";

    @Column(name = "customer_name", nullable = false)
    private String customerName = "";

    @Column(name = "business_id")
    private String businessId;

    @Column(name = "provider_reference", nullable = false)
    private String providerReference = "";

    @Column(name = "idempotency_key", length = 128)
    private String idempotencyKey;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PaymentIntentStatus status = PaymentIntentStatus.Pending;

    @Column(name = "customer_message", columnDefinition = "TEXT")
    private String customerMessage;

    @Column(columnDefinition = "TEXT")
    private String metadata;

    @Column(name = "failure_reason", columnDefinition = "TEXT")
    private String failureReason;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "failed_at")
    private Instant failedAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public PaymentContext getContext() {
        return context;
    }

    public void setContext(PaymentContext context) {
        this.context = context;
    }

    public String getReferenceId() {
        return referenceId;
    }

    public void setReferenceId(String referenceId) {
        this.referenceId = referenceId;
    }

    public String getProviderId() {
        return providerId;
    }

    public void setProviderId(String providerId) {
        this.providerId = providerId;
    }

    public int getAmount() {
        return amount;
    }

    public void setAmount(int amount) {
        this.amount = amount;
    }

    public int getSubtotal() {
        return subtotal;
    }

    public void setSubtotal(int subtotal) {
        this.subtotal = subtotal;
    }

    public int getServiceFee() {
        return serviceFee;
    }

    public void setServiceFee(int serviceFee) {
        this.serviceFee = serviceFee;
    }

    public int getPsoFee() {
        return psoFee;
    }

    public void setPsoFee(int psoFee) {
        this.psoFee = psoFee;
    }

    public int getPlatformFee() {
        return platformFee;
    }

    public void setPlatformFee(int platformFee) {
        this.platformFee = platformFee;
    }

    public int getMerchantPayout() {
        return merchantPayout;
    }

    public void setMerchantPayout(int merchantPayout) {
        this.merchantPayout = merchantPayout;
    }

    public String getMerchantMomoDestination() {
        return merchantMomoDestination;
    }

    public void setMerchantMomoDestination(String merchantMomoDestination) {
        this.merchantMomoDestination = merchantMomoDestination != null ? merchantMomoDestination : "";
    }

    public String getScannyFeeDestination() {
        return scannyFeeDestination;
    }

    public void setScannyFeeDestination(String scannyFeeDestination) {
        this.scannyFeeDestination = scannyFeeDestination != null ? scannyFeeDestination : "";
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public String getCustomerPhone() {
        return customerPhone;
    }

    public void setCustomerPhone(String customerPhone) {
        this.customerPhone = customerPhone;
    }

    public String getCustomerName() {
        return customerName;
    }

    public void setCustomerName(String customerName) {
        this.customerName = customerName;
    }

    public String getBusinessId() {
        return businessId;
    }

    public void setBusinessId(String businessId) {
        this.businessId = businessId;
    }

    public String getProviderReference() {
        return providerReference;
    }

    public void setProviderReference(String providerReference) {
        this.providerReference = providerReference;
    }

    public String getIdempotencyKey() {
        return idempotencyKey;
    }

    public void setIdempotencyKey(String idempotencyKey) {
        this.idempotencyKey = idempotencyKey;
    }

    public PaymentIntentStatus getStatus() {
        return status;
    }

    public void setStatus(PaymentIntentStatus status) {
        this.status = status;
    }

    public String getCustomerMessage() {
        return customerMessage;
    }

    public void setCustomerMessage(String customerMessage) {
        this.customerMessage = customerMessage;
    }

    public String getMetadata() {
        return metadata;
    }

    public void setMetadata(String metadata) {
        this.metadata = metadata;
    }

    public String getFailureReason() {
        return failureReason;
    }

    public void setFailureReason(String failureReason) {
        this.failureReason = failureReason;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(Instant completedAt) {
        this.completedAt = completedAt;
    }

    public Instant getFailedAt() {
        return failedAt;
    }

    public void setFailedAt(Instant failedAt) {
        this.failedAt = failedAt;
    }
}
