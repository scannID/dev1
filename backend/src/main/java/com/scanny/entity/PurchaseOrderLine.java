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

@Entity
@Table(name = "purchase_order_lines")
public class PurchaseOrderLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "po_id", nullable = false)
    private PurchaseOrder purchaseOrder;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ingredient_id", nullable = false)
    private Ingredient ingredient;

    @Column(name = "ingredient_name", nullable = false)
    private String ingredientName = "";

    @Column(nullable = false, length = 16)
    private String unit = "pcs";

    @Column(name = "qty_ordered", nullable = false, precision = 18, scale = 4)
    private BigDecimal qtyOrdered;

    @Column(name = "qty_received", nullable = false, precision = 18, scale = 4)
    private BigDecimal qtyReceived = BigDecimal.ZERO;

    @Column(name = "unit_cost", nullable = false)
    private int unitCost = 0;

    @Column(name = "line_total", nullable = false)
    private int lineTotal = 0;

    public void recalcTotal() {
        if (qtyOrdered != null) {
            this.lineTotal = qtyOrdered.multiply(BigDecimal.valueOf(unitCost))
                .setScale(0, java.math.RoundingMode.HALF_UP).intValue();
        }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public PurchaseOrder getPurchaseOrder() { return purchaseOrder; }
    public void setPurchaseOrder(PurchaseOrder purchaseOrder) { this.purchaseOrder = purchaseOrder; }
    public Ingredient getIngredient() { return ingredient; }
    public void setIngredient(Ingredient ingredient) { this.ingredient = ingredient; }
    public String getIngredientName() { return ingredientName; }
    public void setIngredientName(String ingredientName) { this.ingredientName = ingredientName == null ? "" : ingredientName; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public BigDecimal getQtyOrdered() { return qtyOrdered; }
    public void setQtyOrdered(BigDecimal qtyOrdered) { this.qtyOrdered = qtyOrdered; }
    public BigDecimal getQtyReceived() { return qtyReceived; }
    public void setQtyReceived(BigDecimal qtyReceived) { this.qtyReceived = qtyReceived == null ? BigDecimal.ZERO : qtyReceived; }
    public int getUnitCost() { return unitCost; }
    public void setUnitCost(int unitCost) { this.unitCost = unitCost; }
    public int getLineTotal() { return lineTotal; }
    public void setLineTotal(int lineTotal) { this.lineTotal = lineTotal; }
}
