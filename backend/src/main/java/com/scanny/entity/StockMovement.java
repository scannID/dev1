package com.scanny.entity;

import com.scanny.model.enums.StockMovementType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "stock_movements")
public class StockMovement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "business_id", nullable = false)
    private Business business;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ingredient_id", nullable = false)
    private Ingredient ingredient;

    @Enumerated(EnumType.STRING)
    @Column(name = "movement_type", nullable = false, length = 24, columnDefinition = "varchar(24)")
    private StockMovementType movementType;

    @Column(name = "qty_delta", nullable = false, precision = 18, scale = 4)
    private BigDecimal qtyDelta;

    @Column(name = "unit_cost", nullable = false)
    private int unitCost = 0;

    @Column(name = "order_id")
    private String orderId;

    /** Shared id for TRANSFER_OUT + TRANSFER_IN pair so both sides match. */
    @Column(name = "transfer_group_id")
    private String transferGroupId;

    @Column(name = "related_business_id")
    private String relatedBusinessId;

    @Column(name = "related_ingredient_id")
    private String relatedIngredientId;

    @Column(nullable = false, columnDefinition = "TEXT DEFAULT ''")
    private String note = "";

    @Column(nullable = false)
    private String actor = "";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Business getBusiness() {
        return business;
    }

    public void setBusiness(Business business) {
        this.business = business;
    }

    public Ingredient getIngredient() {
        return ingredient;
    }

    public void setIngredient(Ingredient ingredient) {
        this.ingredient = ingredient;
    }

    public StockMovementType getMovementType() {
        return movementType;
    }

    public void setMovementType(StockMovementType movementType) {
        this.movementType = movementType;
    }

    public BigDecimal getQtyDelta() {
        return qtyDelta;
    }

    public void setQtyDelta(BigDecimal qtyDelta) {
        this.qtyDelta = qtyDelta;
    }

    public int getUnitCost() {
        return unitCost;
    }

    public void setUnitCost(int unitCost) {
        this.unitCost = Math.max(0, unitCost);
    }

    public String getOrderId() {
        return orderId;
    }

    public void setOrderId(String orderId) {
        this.orderId = orderId;
    }

    public String getTransferGroupId() {
        return transferGroupId;
    }

    public void setTransferGroupId(String transferGroupId) {
        this.transferGroupId = transferGroupId;
    }

    public String getRelatedBusinessId() {
        return relatedBusinessId;
    }

    public void setRelatedBusinessId(String relatedBusinessId) {
        this.relatedBusinessId = relatedBusinessId;
    }

    public String getRelatedIngredientId() {
        return relatedIngredientId;
    }

    public void setRelatedIngredientId(String relatedIngredientId) {
        this.relatedIngredientId = relatedIngredientId;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note == null ? "" : note;
    }

    public String getActor() {
        return actor;
    }

    public void setActor(String actor) {
        this.actor = actor == null ? "" : actor;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
