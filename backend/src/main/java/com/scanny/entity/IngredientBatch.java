package com.scanny.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "ingredient_batches")
public class IngredientBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "business_id", nullable = false)
    private Business business;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ingredient_id", nullable = false)
    private Ingredient ingredient;

    @Column(name = "batch_number", nullable = false)
    private String batchNumber = "";

    @Column(name = "qty_original", nullable = false, precision = 18, scale = 4)
    private BigDecimal qtyOriginal;

    @Column(name = "qty_remaining", nullable = false, precision = 18, scale = 4)
    private BigDecimal qtyRemaining;

    @Column(name = "unit_cost", nullable = false)
    private int unitCost = 0;

    @Column(name = "expiry_date")
    private LocalDate expiryDate;

    @Column(name = "received_at", nullable = false)
    private Instant receivedAt = Instant.now();

    @Column(name = "po_id")
    private String poId;

    @Column(nullable = false, columnDefinition = "TEXT DEFAULT ''")
    private String notes = "";

    public boolean isExpired() {
        return expiryDate != null && LocalDate.now().isAfter(expiryDate);
    }

    public boolean expiresWithinDays(int days) {
        if (expiryDate == null) return false;
        return !LocalDate.now().isAfter(expiryDate)
            && !expiryDate.isAfter(LocalDate.now().plusDays(days));
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Business getBusiness() { return business; }
    public void setBusiness(Business business) { this.business = business; }
    public Ingredient getIngredient() { return ingredient; }
    public void setIngredient(Ingredient ingredient) { this.ingredient = ingredient; }
    public String getBatchNumber() { return batchNumber; }
    public void setBatchNumber(String batchNumber) { this.batchNumber = batchNumber == null ? "" : batchNumber; }
    public BigDecimal getQtyOriginal() { return qtyOriginal; }
    public void setQtyOriginal(BigDecimal qtyOriginal) { this.qtyOriginal = qtyOriginal; }
    public BigDecimal getQtyRemaining() { return qtyRemaining; }
    public void setQtyRemaining(BigDecimal qtyRemaining) { this.qtyRemaining = qtyRemaining; }
    public int getUnitCost() { return unitCost; }
    public void setUnitCost(int unitCost) { this.unitCost = unitCost; }
    public LocalDate getExpiryDate() { return expiryDate; }
    public void setExpiryDate(LocalDate expiryDate) { this.expiryDate = expiryDate; }
    public Instant getReceivedAt() { return receivedAt; }
    public void setReceivedAt(Instant receivedAt) { this.receivedAt = receivedAt; }
    public String getPoId() { return poId; }
    public void setPoId(String poId) { this.poId = poId; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes == null ? "" : notes; }
}
