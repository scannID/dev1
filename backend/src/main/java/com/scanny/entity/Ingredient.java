package com.scanny.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "ingredients")
public class Ingredient {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "business_id", nullable = false)
    private Business business;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, length = 16)
    private String unit = "pcs";

    @Column(nullable = false)
    private String category = "";

    @Column(name = "qty_on_hand", nullable = false, precision = 18, scale = 4)
    private BigDecimal qtyOnHand = BigDecimal.ZERO;

    /** Moving-average unit cost in UGX (integer). */
    @Column(name = "avg_unit_cost", nullable = false)
    private int avgUnitCost = 0;

    @Column(name = "low_stock_threshold", nullable = false, precision = 18, scale = 4)
    private BigDecimal lowStockThreshold = BigDecimal.ZERO;

    @Column(nullable = false)
    private String sku = "";

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt;

    public boolean isLowStock() {
        return lowStockThreshold.compareTo(BigDecimal.ZERO) > 0
                && qtyOnHand.compareTo(lowStockThreshold) <= 0;
    }

    public int stockValue() {
        return qtyOnHand.multiply(BigDecimal.valueOf(avgUnitCost)).setScale(0, java.math.RoundingMode.HALF_UP).intValue();
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public Business getBusiness() {
        return business;
    }

    public void setBusiness(Business business) {
        this.business = business;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = unit == null || unit.isBlank() ? "pcs" : unit.trim();
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category == null ? "" : category.trim();
    }

    public BigDecimal getQtyOnHand() {
        return qtyOnHand;
    }

    public void setQtyOnHand(BigDecimal qtyOnHand) {
        this.qtyOnHand = qtyOnHand == null ? BigDecimal.ZERO : qtyOnHand;
    }

    public int getAvgUnitCost() {
        return avgUnitCost;
    }

    public void setAvgUnitCost(int avgUnitCost) {
        this.avgUnitCost = Math.max(0, avgUnitCost);
    }

    public BigDecimal getLowStockThreshold() {
        return lowStockThreshold;
    }

    public void setLowStockThreshold(BigDecimal lowStockThreshold) {
        this.lowStockThreshold = lowStockThreshold == null ? BigDecimal.ZERO : lowStockThreshold;
    }

    public String getSku() {
        return sku;
    }

    public void setSku(String sku) {
        this.sku = sku == null ? "" : sku.trim();
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
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
}
