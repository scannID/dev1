package com.scanny.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "floor_plan_elements")
public class FloorPlanElement {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "floor_plan_id", nullable = false)
    private FloorPlan floorPlan;

    /** 'rect' | 'circle' | 'polygon' | 'custom-path' */
    @Column(name = "shape_type", nullable = false)
    private String shapeType = "rect";

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal x = BigDecimal.ZERO;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal y = BigDecimal.ZERO;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal width = BigDecimal.valueOf(80);

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal height = BigDecimal.valueOf(80);

    @Column(nullable = false, precision = 6, scale = 2)
    private BigDecimal rotation = BigDecimal.ZERO;

    @Column(name = "z_index", nullable = false)
    private int zIndex = 1;

    @Column(nullable = false)
    private String color = "#d4a373";

    /**
     * TABLE | CHAIR | WALL | BAR | DOOR | WINDOW | STAGE |
     * PLANT | DECOR | HOTEL_ROOM | ZONE | LABEL
     */
    @Column(name = "element_kind", nullable = false)
    private String elementKind = "TABLE";

    @Column
    private String label;

    @Column(name = "seat_count", nullable = false)
    private int seatCount = 0;

    /** Null = top-level element; non-null = child of another element (e.g. chair belongs to table) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_element_id")
    private FloorPlanElement parent;

    /** Links this element to a real BusinessTable for session / order tracking */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "business_table_id")
    private BusinessTable businessTable;

    @Column(name = "custom_style", columnDefinition = "jsonb")
    private String customStyle;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    /** Live status — created on demand when the element gets its first status change */
    @OneToOne(mappedBy = "element", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval = true)
    private FloorPlanElementStatus status;

    // --- getters / setters ---

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public FloorPlan getFloorPlan() { return floorPlan; }
    public void setFloorPlan(FloorPlan floorPlan) { this.floorPlan = floorPlan; }

    public String getShapeType() { return shapeType; }
    public void setShapeType(String shapeType) { this.shapeType = shapeType; }

    public BigDecimal getX() { return x; }
    public void setX(BigDecimal x) { this.x = x; }

    public BigDecimal getY() { return y; }
    public void setY(BigDecimal y) { this.y = y; }

    public BigDecimal getWidth() { return width; }
    public void setWidth(BigDecimal width) { this.width = width; }

    public BigDecimal getHeight() { return height; }
    public void setHeight(BigDecimal height) { this.height = height; }

    public BigDecimal getRotation() { return rotation; }
    public void setRotation(BigDecimal rotation) { this.rotation = rotation; }

    public int getZIndex() { return zIndex; }
    public void setZIndex(int zIndex) { this.zIndex = zIndex; }

    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }

    public String getElementKind() { return elementKind; }
    public void setElementKind(String elementKind) { this.elementKind = elementKind; }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }

    public int getSeatCount() { return seatCount; }
    public void setSeatCount(int seatCount) { this.seatCount = seatCount; }

    public FloorPlanElement getParent() { return parent; }
    public void setParent(FloorPlanElement parent) { this.parent = parent; }

    public BusinessTable getBusinessTable() { return businessTable; }
    public void setBusinessTable(BusinessTable businessTable) { this.businessTable = businessTable; }

    public String getCustomStyle() { return customStyle; }
    public void setCustomStyle(String customStyle) { this.customStyle = customStyle; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public FloorPlanElementStatus getStatus() { return status; }
    public void setStatus(FloorPlanElementStatus status) { this.status = status; }
}
