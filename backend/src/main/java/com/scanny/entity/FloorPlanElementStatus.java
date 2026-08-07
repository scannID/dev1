package com.scanny.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "floor_plan_element_status")
public class FloorPlanElementStatus {

    @Id
    @Column(name = "element_id")
    private String elementId;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "element_id", nullable = false, insertable = false, updatable = false)
    private FloorPlanElement element;

    /** FREE | OCCUPIED | RESERVED | OUT_OF_SERVICE */
    @Column(nullable = false)
    private String status = "FREE";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id")
    private TableSession session;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reservation_id")
    private Reservation reservation;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "updated_by")
    private String updatedBy;

    // --- getters / setters ---

    public String getElementId() { return elementId; }
    public void setElementId(String elementId) { this.elementId = elementId; }

    public FloorPlanElement getElement() { return element; }
    public void setElement(FloorPlanElement element) { this.element = element; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public TableSession getSession() { return session; }
    public void setSession(TableSession session) { this.session = session; }

    public Reservation getReservation() { return reservation; }
    public void setReservation(Reservation reservation) { this.reservation = reservation; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }
}
