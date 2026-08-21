package com.scanny.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
@Table(name = "purchase_orders")
public class PurchaseOrder {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "business_id", nullable = false)
    private Business business;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id")
    private Supplier supplier;

    @Column(name = "supplier_name", nullable = false)
    private String supplierName = "";

    /** DRAFT | SENT | PARTIALLY_RECEIVED | RECEIVED | CANCELLED */
    @Column(nullable = false)
    private String status = "DRAFT";

    @Column(nullable = false)
    private String reference = "";

    @Column(nullable = false, columnDefinition = "TEXT DEFAULT ''")
    private String notes = "";

    @Column(name = "total_cost", nullable = false)
    private int totalCost = 0;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "sent_at")
    private Instant sentAt;

    @Column(name = "received_at")
    private Instant receivedAt;

    @OneToMany(mappedBy = "purchaseOrder", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("id ASC")
    private List<PurchaseOrderLine> lines = new ArrayList<>();

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public Business getBusiness() { return business; }
    public void setBusiness(Business business) { this.business = business; }
    public Supplier getSupplier() { return supplier; }
    public void setSupplier(Supplier supplier) { this.supplier = supplier; }
    public String getSupplierName() { return supplierName; }
    public void setSupplierName(String supplierName) { this.supplierName = supplierName == null ? "" : supplierName; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getReference() { return reference; }
    public void setReference(String reference) { this.reference = reference == null ? "" : reference; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes == null ? "" : notes; }
    public int getTotalCost() { return totalCost; }
    public void setTotalCost(int totalCost) { this.totalCost = totalCost; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
    public Instant getSentAt() { return sentAt; }
    public void setSentAt(Instant sentAt) { this.sentAt = sentAt; }
    public Instant getReceivedAt() { return receivedAt; }
    public void setReceivedAt(Instant receivedAt) { this.receivedAt = receivedAt; }
    public List<PurchaseOrderLine> getLines() { return lines; }
    public void setLines(List<PurchaseOrderLine> lines) { this.lines = lines; }

    public void addLine(PurchaseOrderLine line) {
        lines.add(line);
        line.setPurchaseOrder(this);
    }

    public void recalcTotal() {
        this.totalCost = lines.stream().mapToInt(PurchaseOrderLine::getLineTotal).sum();
    }
}
