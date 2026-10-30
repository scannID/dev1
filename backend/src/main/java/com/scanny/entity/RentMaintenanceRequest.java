package com.scanny.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * A maintenance or repair request submitted by a tenant or recorded by a manager.
 *
 * <h3>Status lifecycle</h3>
 * {@code OPEN} → {@code IN_PROGRESS} → {@code RESOLVED} → {@code CLOSED}
 *
 * <h3>Priority values</h3>
 * {@code LOW}, {@code NORMAL}, {@code HIGH}, {@code URGENT}
 */
@Entity
@Table(name = "rent_maintenance_requests")
public class RentMaintenanceRequest {

    @Id
    @Column(length = 36)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "property_id", nullable = false)
    private RentProperty property;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "unit_id")
    private RentUnit unit;

    /**
     * Display name of the submitting tenant.
     * Stored as a string (not a FK to RentTenant) so requests survive tenant
     * deactivation/deletion.
     */
    @Column(name = "tenant_name", length = 128)
    private String tenantName;

    @Column(name = "tenant_phone", length = 32)
    private String tenantPhone;

    @Column(nullable = false, length = 256)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    /**
     * Priority level. Allowed values: {@code LOW}, {@code NORMAL}, {@code HIGH}, {@code URGENT}.
     * Defaults to {@code NORMAL}.
     */
    @Column(length = 16)
    private String priority = "NORMAL";

    /** OPEN | IN_PROGRESS | RESOLVED | CLOSED */
    @Column(nullable = false, length = 32)
    private String status = "OPEN";

    @Column(name = "submitted_at", nullable = false)
    private Instant submittedAt;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    /** Account ID or "tenant" identifying who submitted/created this request. */
    @Column(name = "created_by", length = 255)
    private String createdBy = "system";

    @Column(name = "updated_at")
    private Instant updatedAt;

    // ── Getters & setters ──────────────────────────────────────────────────

    public String getId()                               { return id; }
    public void setId(String id)                        { this.id = id; }

    public RentProperty getProperty()                   { return property; }
    public void setProperty(RentProperty property)      { this.property = property; }

    public RentUnit getUnit()                           { return unit; }
    public void setUnit(RentUnit unit)                  { this.unit = unit; }

    public String getTenantName()                       { return tenantName; }
    public void setTenantName(String tenantName)        { this.tenantName = tenantName; }

    public String getTenantPhone()                      { return tenantPhone; }
    public void setTenantPhone(String tenantPhone)      { this.tenantPhone = tenantPhone; }

    public String getTitle()                            { return title; }
    public void setTitle(String title)                  { this.title = title; }

    public String getDescription()                      { return description; }
    public void setDescription(String description)      { this.description = description; }

    public String getPriority()                         { return priority; }
    public void setPriority(String priority)            { this.priority = priority != null ? priority : "NORMAL"; }

    public String getStatus()                           { return status; }
    public void setStatus(String status)                { this.status = status; }

    public Instant getSubmittedAt()                     { return submittedAt; }
    public void setSubmittedAt(Instant submittedAt)     { this.submittedAt = submittedAt; }

    public Instant getResolvedAt()                      { return resolvedAt; }
    public void setResolvedAt(Instant resolvedAt)       { this.resolvedAt = resolvedAt; }

    public String getCreatedBy()                        { return createdBy; }
    public void setCreatedBy(String by)                 { this.createdBy = by != null ? by : "system"; }

    public Instant getUpdatedAt()                       { return updatedAt; }
    public void setUpdatedAt(Instant t)                 { this.updatedAt = t; }
}
