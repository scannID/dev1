package com.scanny.entity;

import com.scanny.model.enums.BusinessType;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "businesses")
public class Business {

    @Id
    private String id;

    @Column(name = "merchant_id", nullable = false)
    private String merchantId;

    @Column(name = "branch_label", nullable = false)
    private String branchLabel = "Main";

    @Column(name = "is_primary", nullable = false)
    private boolean primary = true;

    @Column(nullable = false)
    private String address = "";

    @Column(name = "accepting_orders", nullable = false)
    private boolean acceptingOrders = true;

    @Column(name = "busy_mode", nullable = false)
    private boolean busyMode = false;

    @Column(name = "busy_eta_minutes", nullable = false)
    private int busyEtaMinutes = 0;

    @Column(name = "busy_mode_expires_at")
    private Instant busyModeExpiresAt = null;

    @Column(name = "pause_message", nullable = false)
    private String pauseMessage = "";

    @Column(name = "whatsapp_notifications_enabled", nullable = false)
    private boolean whatsappNotificationsEnabled = false;

    @Column(name = "whatsapp_business_phone", nullable = false)
    private String whatsappBusinessPhone = "";

    @Column(name = "daily_digest_enabled", nullable = false)
    private boolean dailyDigestEnabled = false;

    @Column(name = "daily_digest_channel", nullable = false)
    private String dailyDigestChannel = "email";

    @Column(name = "daily_digest_email", nullable = false)
    private String dailyDigestEmail = "";

    @Column(name = "qr_token", nullable = false, unique = true)
    private String qrToken;

    @Column(nullable = false)
    private String name;

    @Column(name = "owner_name", nullable = false)
    private String ownerName;

    @Column(nullable = false)
    private String phone = "";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BusinessType type;

    @Column(name = "table_label", nullable = false)
    private String tableLabel;

    @Column(name = "payment_reference", nullable = false)
    private String paymentReference;

    @Column(nullable = false)
    private String accent = "#2563eb";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "custom_categories")
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    private List<String> customCategories = new ArrayList<>();

    @OneToMany(mappedBy = "business", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("name ASC")
    private List<CatalogItem> items = new ArrayList<>();

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getMerchantId() {
        return merchantId;
    }

    public void setMerchantId(String merchantId) {
        this.merchantId = merchantId;
    }

    public String getBranchLabel() {
        return branchLabel;
    }

    public void setBranchLabel(String branchLabel) {
        this.branchLabel = branchLabel != null ? branchLabel : "Main";
    }

    public boolean isPrimary() {
        return primary;
    }

    public void setPrimary(boolean primary) {
        this.primary = primary;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address != null ? address : "";
    }

    public boolean isAcceptingOrders() {
        return acceptingOrders;
    }

    public void setAcceptingOrders(boolean acceptingOrders) {
        this.acceptingOrders = acceptingOrders;
    }

    public boolean isBusyMode() {
        return busyMode;
    }

    public void setBusyMode(boolean busyMode) {
        this.busyMode = busyMode;
    }

    public int getBusyEtaMinutes() {
        return busyEtaMinutes;
    }

    public void setBusyEtaMinutes(int busyEtaMinutes) {
        this.busyEtaMinutes = Math.max(0, busyEtaMinutes);
    }

    public Instant getBusyModeExpiresAt() {
        return busyModeExpiresAt;
    }

    public void setBusyModeExpiresAt(Instant busyModeExpiresAt) {
        this.busyModeExpiresAt = busyModeExpiresAt;
    }

    public String getPauseMessage() {
        return pauseMessage;
    }

    public void setPauseMessage(String pauseMessage) {
        this.pauseMessage = pauseMessage != null ? pauseMessage : "";
    }

    public boolean isWhatsappNotificationsEnabled() {
        return whatsappNotificationsEnabled;
    }

    public void setWhatsappNotificationsEnabled(boolean whatsappNotificationsEnabled) {
        this.whatsappNotificationsEnabled = whatsappNotificationsEnabled;
    }

    public String getWhatsappBusinessPhone() {
        return whatsappBusinessPhone;
    }

    public void setWhatsappBusinessPhone(String whatsappBusinessPhone) {
        this.whatsappBusinessPhone = whatsappBusinessPhone != null ? whatsappBusinessPhone : "";
    }

    public boolean isDailyDigestEnabled() {
        return dailyDigestEnabled;
    }

    public void setDailyDigestEnabled(boolean dailyDigestEnabled) {
        this.dailyDigestEnabled = dailyDigestEnabled;
    }

    public String getDailyDigestChannel() {
        return dailyDigestChannel;
    }

    public void setDailyDigestChannel(String dailyDigestChannel) {
        this.dailyDigestChannel = dailyDigestChannel != null ? dailyDigestChannel : "email";
    }

    public String getDailyDigestEmail() {
        return dailyDigestEmail;
    }

    public void setDailyDigestEmail(String dailyDigestEmail) {
        this.dailyDigestEmail = dailyDigestEmail != null ? dailyDigestEmail : "";
    }

    public String getQrToken() {
        return qrToken;
    }

    public void setQrToken(String qrToken) {
        this.qrToken = qrToken;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getOwnerName() {
        return ownerName;
    }

    public void setOwnerName(String ownerName) {
        this.ownerName = ownerName;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public BusinessType getType() {
        return type;
    }

    public void setType(BusinessType type) {
        this.type = type;
    }

    public String getTableLabel() {
        return tableLabel;
    }

    public void setTableLabel(String tableLabel) {
        this.tableLabel = tableLabel;
    }

    public String getPaymentReference() {
        return paymentReference;
    }

    public void setPaymentReference(String paymentReference) {
        this.paymentReference = paymentReference;
    }

    public String getAccent() {
        return accent;
    }

    public void setAccent(String accent) {
        this.accent = accent;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public List<String> getCustomCategories() {
        return customCategories;
    }

    public void setCustomCategories(List<String> customCategories) {
        this.customCategories = customCategories != null ? new ArrayList<>(customCategories) : new ArrayList<>();
    }

    public void addCustomCategory(String category) {
        if (customCategories == null) {
            customCategories = new ArrayList<>();
        }
        if (!customCategories.contains(category)) {
            customCategories.add(category);
        }
    }

    public List<CatalogItem> getItems() {
        return items;
    }

    public void setItems(List<CatalogItem> items) {
        this.items = items;
    }

    public void addItem(CatalogItem item) {
        items.add(item);
        item.setBusiness(this);
    }
}
