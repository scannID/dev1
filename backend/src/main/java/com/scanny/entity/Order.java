package com.scanny.entity;

import com.scanny.model.enums.OrderStatus;
import com.scanny.model.enums.PaymentStatus;
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
import java.util.UUID;

@Entity
@Table(name = "orders")
public class Order {

    @Id
    private String id;

    @Column(name = "public_id", nullable = false, unique = true)
    private UUID publicId = UUID.randomUUID();

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "business_id", nullable = false)
    private Business business;

    @Column(name = "merchant_id", nullable = false)
    private String merchantId;

    @Column(name = "qr_token", nullable = false)
    private String qrToken;

    @Column(name = "payment_reference", nullable = false)
    private String paymentReference;

    @Column(name = "business_name", nullable = false)
    private String businessName = "";

    @Column(name = "customer_name", nullable = false)
    private String customerName;

    @Column(name = "customer_phone", nullable = false)
    private String customerPhone = "";

    @Column(name = "customer_location", nullable = false)
    private String customerLocation = "";

    @Column(name = "customer_note", nullable = false)
    private String customerNote = "";

    @Column(nullable = false)
    private int total;

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

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderStatus status = OrderStatus.Pending;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", nullable = false)
    private PaymentStatus paymentStatus = PaymentStatus.Unpaid;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "table_id")
    private String tableId;

    @Column(name = "table_session_id")
    private UUID tableSessionId;

    @Column(name = "split_group_id")
    private UUID splitGroupId;

    @Column(name = "kitchen_notes", nullable = false)
    private String kitchenNotes = "";

    /** Locked recipe COGS (UGX) at payment time. */
    @Column(name = "cogs_total", nullable = false, columnDefinition = "integer default 0")
    private int cogsTotal = 0;

    @Column(name = "inventory_consumed", nullable = false, columnDefinition = "boolean default false")
    private boolean inventoryConsumed = false;

    /** True when consumeForPaidOrder() deducted at least one ingredient into negative stock. */
    @Column(name = "inventory_under_stock", nullable = false)
    private boolean inventoryUnderStock = false;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("id ASC")
    private List<OrderLineItem> items = new ArrayList<>();

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public UUID getPublicId() {
        return publicId;
    }

    public void setPublicId(UUID publicId) {
        this.publicId = publicId;
    }

    public Business getBusiness() {
        return business;
    }

    public void setBusiness(Business business) {
        this.business = business;
    }

    public String getMerchantId() {
        return merchantId;
    }

    public void setMerchantId(String merchantId) {
        this.merchantId = merchantId;
    }

    public String getQrToken() {
        return qrToken;
    }

    public void setQrToken(String qrToken) {
        this.qrToken = qrToken;
    }

    public String getPaymentReference() {
        return paymentReference;
    }

    public void setPaymentReference(String paymentReference) {
        this.paymentReference = paymentReference;
    }

    public String getBusinessName() {
        return businessName;
    }

    public void setBusinessName(String businessName) {
        this.businessName = businessName;
    }

    public String getCustomerName() {
        return customerName;
    }

    public void setCustomerName(String customerName) {
        this.customerName = customerName;
    }

    public String getCustomerPhone() {
        return customerPhone;
    }

    public void setCustomerPhone(String customerPhone) {
        this.customerPhone = customerPhone;
    }

    public String getCustomerLocation() {
        return customerLocation;
    }

    public void setCustomerLocation(String customerLocation) {
        this.customerLocation = customerLocation;
    }

    public String getCustomerNote() {
        return customerNote;
    }

    public void setCustomerNote(String customerNote) {
        this.customerNote = customerNote;
    }

    public int getTotal() {
        return total;
    }

    public void setTotal(int total) {
        this.total = total;
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

    public OrderStatus getStatus() {
        return status;
    }

    public void setStatus(OrderStatus status) {
        this.status = status;
    }

    public PaymentStatus getPaymentStatus() {
        return paymentStatus;
    }

    public void setPaymentStatus(PaymentStatus paymentStatus) {
        this.paymentStatus = paymentStatus;
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

    public String getTableId() {
        return tableId;
    }

    public void setTableId(String tableId) {
        this.tableId = tableId;
    }

    public UUID getTableSessionId() {
        return tableSessionId;
    }

    public void setTableSessionId(UUID tableSessionId) {
        this.tableSessionId = tableSessionId;
    }

    public UUID getSplitGroupId() {
        return splitGroupId;
    }

    public void setSplitGroupId(UUID splitGroupId) {
        this.splitGroupId = splitGroupId;
    }

    public String getKitchenNotes() {
        return kitchenNotes;
    }

    public void setKitchenNotes(String kitchenNotes) {
        this.kitchenNotes = kitchenNotes != null ? kitchenNotes : "";
    }

    public int getCogsTotal() {
        return cogsTotal;
    }

    public void setCogsTotal(int cogsTotal) {
        this.cogsTotal = Math.max(0, cogsTotal);
    }

    public boolean isInventoryConsumed() { return inventoryConsumed; }
    public void setInventoryConsumed(boolean inventoryConsumed) { this.inventoryConsumed = inventoryConsumed; }
    public boolean isInventoryUnderStock() { return inventoryUnderStock; }
    public void setInventoryUnderStock(boolean inventoryUnderStock) { this.inventoryUnderStock = inventoryUnderStock; }

    public List<OrderLineItem> getItems() {
        return items;
    }

    public void setItems(List<OrderLineItem> items) {
        this.items = items;
    }

    public void addItem(OrderLineItem item) {
        items.add(item);
        item.setOrder(this);
    }
}
