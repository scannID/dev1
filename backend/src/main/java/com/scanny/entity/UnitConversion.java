package com.scanny.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;

@Entity
@Table(name = "unit_conversions")
public class UnitConversion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** NULL = global (applies to all businesses). */
    @Column(name = "business_id")
    private String businessId;

    @Column(name = "from_unit", nullable = false, length = 16)
    private String fromUnit;

    @Column(name = "to_unit", nullable = false, length = 16)
    private String toUnit;

    /** to_qty = from_qty × factor */
    @Column(nullable = false, precision = 24, scale = 8)
    private BigDecimal factor;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getBusinessId() { return businessId; }
    public void setBusinessId(String businessId) { this.businessId = businessId; }
    public String getFromUnit() { return fromUnit; }
    public void setFromUnit(String fromUnit) { this.fromUnit = fromUnit; }
    public String getToUnit() { return toUnit; }
    public void setToUnit(String toUnit) { this.toUnit = toUnit; }
    public BigDecimal getFactor() { return factor; }
    public void setFactor(BigDecimal factor) { this.factor = factor; }
}
