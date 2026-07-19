package com.scanny.entity;

import com.scanny.model.enums.QuickPaymentCodeStatus;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "quick_payment_codes")
public class QuickPaymentCode {

    @Id
    private String id;

    @Column(name = "qr_token", nullable = false, unique = true)
    private String qrToken;

    @Column(name = "code_type", nullable = false)
    private String codeType = "FixedPrice";

    @Column(nullable = false)
    private String description;

    @Column(nullable = false)
    private int amount;

    @Column(nullable = false)
    private String currency = "UGX";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private QuickPaymentCodeStatus status = QuickPaymentCodeStatus.Active;

    @Column(name = "usage_count", nullable = false)
    private int usageCount = 0;

    @Column(name = "owner_name", nullable = false)
    private String ownerName = "";

    @Column(name = "owner_phone", nullable = false)
    private String ownerPhone = "";

    @Column(name = "payment_destination", nullable = false)
    private String paymentDestination;

    @Column(name = "payment_destination_type", nullable = false)
    private String paymentDestinationType = "MobileMoney";

    @Column(name = "merchant_id")
    private String merchantId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "business_id")
    private Business business;

    @Column(columnDefinition = "TEXT")
    private String metadata;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "last_used_at")
    private Instant lastUsedAt;

    @OneToMany(mappedBy = "code", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("createdAt DESC")
    private List<QuickPaymentTransaction> transactions = new ArrayList<>();

    // Getters and setters

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getQrToken() {
        return qrToken;
    }

    public void setQrToken(String qrToken) {
        this.qrToken = qrToken;
    }

    public String getCodeType() {
        return codeType;
    }

    public void setCodeType(String codeType) {
        this.codeType = codeType;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public int getAmount() {
        return amount;
    }

    public void setAmount(int amount) {
        this.amount = amount;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public QuickPaymentCodeStatus getStatus() {
        return status;
    }

    public void setStatus(QuickPaymentCodeStatus status) {
        this.status = status;
    }

    public int getUsageCount() {
        return usageCount;
    }

    public void setUsageCount(int usageCount) {
        this.usageCount = usageCount;
    }

    public String getOwnerName() {
        return ownerName;
    }

    public void setOwnerName(String ownerName) {
        this.ownerName = ownerName;
    }

    public String getOwnerPhone() {
        return ownerPhone;
    }

    public void setOwnerPhone(String ownerPhone) {
        this.ownerPhone = ownerPhone;
    }

    public String getPaymentDestination() {
        return paymentDestination;
    }

    public void setPaymentDestination(String paymentDestination) {
        this.paymentDestination = paymentDestination;
    }

    public String getPaymentDestinationType() {
        return paymentDestinationType;
    }

    public void setPaymentDestinationType(String paymentDestinationType) {
        this.paymentDestinationType = paymentDestinationType;
    }

    public String getMerchantId() {
        return merchantId;
    }

    public void setMerchantId(String merchantId) {
        this.merchantId = merchantId;
    }

    public Business getBusiness() {
        return business;
    }

    public void setBusiness(Business business) {
        this.business = business;
    }

    public String getMetadata() {
        return metadata;
    }

    public void setMetadata(String metadata) {
        this.metadata = metadata;
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

    public Instant getLastUsedAt() {
        return lastUsedAt;
    }

    public void setLastUsedAt(Instant lastUsedAt) {
        this.lastUsedAt = lastUsedAt;
    }

    public List<QuickPaymentTransaction> getTransactions() {
        return transactions;
    }

    public void setTransactions(List<QuickPaymentTransaction> transactions) {
        this.transactions = transactions;
    }

    public void addTransaction(QuickPaymentTransaction transaction) {
        transactions.add(transaction);
        transaction.setCode(this);
    }

    public boolean canBeUsed() {
        return status == QuickPaymentCodeStatus.Active;
    }
}
