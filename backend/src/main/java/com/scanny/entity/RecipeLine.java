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

@Entity
@Table(name = "recipe_lines")
public class RecipeLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "catalog_item_id", nullable = false)
    private CatalogItem catalogItem;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ingredient_id", nullable = false)
    private Ingredient ingredient;

    @Column(name = "qty_per_sale", nullable = false, precision = 18, scale = 4)
    private BigDecimal qtyPerSale;

    /**
     * Unit for this recipe line — may differ from the ingredient's stocked unit.
     * Empty string means "same as ingredient unit". The service converts via UnitConversionService.
     */
    @Column(name = "line_unit", nullable = false)
    private String lineUnit = "";

    /** When this version of the recipe was set. */
    @Column(name = "effective_from", nullable = false)
    private Instant effectiveFrom = Instant.now();

    /** NULL = currently active. Set to NOW() when a new recipe version is saved. */
    @Column(name = "effective_to")
    private Instant effectiveTo;

    /** Monotonically increasing version number for this catalog item's recipe. */
    @Column(name = "recipe_version", nullable = false)
    private int recipeVersion = 1;

    public boolean isActive() {
        return effectiveTo == null;
    }

    // ── Getters and setters ───────────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public CatalogItem getCatalogItem() { return catalogItem; }
    public void setCatalogItem(CatalogItem catalogItem) { this.catalogItem = catalogItem; }

    public Ingredient getIngredient() { return ingredient; }
    public void setIngredient(Ingredient ingredient) { this.ingredient = ingredient; }

    public BigDecimal getQtyPerSale() { return qtyPerSale; }
    public void setQtyPerSale(BigDecimal qtyPerSale) { this.qtyPerSale = qtyPerSale; }

    public String getLineUnit() { return lineUnit; }
    public void setLineUnit(String lineUnit) { this.lineUnit = lineUnit == null ? "" : lineUnit.trim(); }

    /** Returns the effective unit: lineUnit if set, otherwise the ingredient's unit. */
    public String effectiveUnit() {
        return (lineUnit == null || lineUnit.isBlank()) ? ingredient.getUnit() : lineUnit;
    }

    public Instant getEffectiveFrom() { return effectiveFrom; }
    public void setEffectiveFrom(Instant effectiveFrom) { this.effectiveFrom = effectiveFrom; }

    public Instant getEffectiveTo() { return effectiveTo; }
    public void setEffectiveTo(Instant effectiveTo) { this.effectiveTo = effectiveTo; }

    public int getRecipeVersion() { return recipeVersion; }
    public void setRecipeVersion(int recipeVersion) { this.recipeVersion = recipeVersion; }
}
