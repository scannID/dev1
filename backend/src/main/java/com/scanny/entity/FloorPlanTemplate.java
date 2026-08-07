package com.scanny.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;

@Entity
@Table(name = "floor_plan_templates")
public class FloorPlanTemplate {

    @Id
    private String id;

    /** Null = global platform preset available to all businesses */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "business_id")
    private Business business;

    @Column(nullable = false)
    private String name;

    @Column(name = "shape_type", nullable = false)
    private String shapeType = "rect";

    @Column(name = "element_kind", nullable = false)
    private String elementKind = "TABLE";

    @Column(name = "default_width", nullable = false, precision = 10, scale = 2)
    private BigDecimal defaultWidth = BigDecimal.valueOf(80);

    @Column(name = "default_height", nullable = false, precision = 10, scale = 2)
    private BigDecimal defaultHeight = BigDecimal.valueOf(80);

    @Column(name = "default_color", nullable = false)
    private String defaultColor = "#d4a373";

    @Column(name = "default_seat_count", nullable = false)
    private int defaultSeatCount = 0;

    @Column(name = "thumbnail_svg", columnDefinition = "text")
    private String thumbnailSvg;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    // --- getters / setters ---

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Business getBusiness() { return business; }
    public void setBusiness(Business business) { this.business = business; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getShapeType() { return shapeType; }
    public void setShapeType(String shapeType) { this.shapeType = shapeType; }

    public String getElementKind() { return elementKind; }
    public void setElementKind(String elementKind) { this.elementKind = elementKind; }

    public BigDecimal getDefaultWidth() { return defaultWidth; }
    public void setDefaultWidth(BigDecimal defaultWidth) { this.defaultWidth = defaultWidth; }

    public BigDecimal getDefaultHeight() { return defaultHeight; }
    public void setDefaultHeight(BigDecimal defaultHeight) { this.defaultHeight = defaultHeight; }

    public String getDefaultColor() { return defaultColor; }
    public void setDefaultColor(String defaultColor) { this.defaultColor = defaultColor; }

    public int getDefaultSeatCount() { return defaultSeatCount; }
    public void setDefaultSeatCount(int defaultSeatCount) { this.defaultSeatCount = defaultSeatCount; }

    public String getThumbnailSvg() { return thumbnailSvg; }
    public void setThumbnailSvg(String thumbnailSvg) { this.thumbnailSvg = thumbnailSvg; }

    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
}
