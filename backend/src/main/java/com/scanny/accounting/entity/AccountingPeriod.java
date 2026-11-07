package com.scanny.accounting.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.Instant;

@Entity
@Table(name = "periods", schema = "accounting")
public class AccountingPeriod {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "period_label", nullable = false, unique = true, length = 7)
    private String periodLabel;   // 'YYYY-MM'

    @Column(nullable = false, length = 8)
    private String status = "OPEN";   // OPEN | CLOSED

    @Column(name = "opens_at", nullable = false)
    private LocalDate opensAt;

    @Column(name = "closes_at", nullable = false)
    private LocalDate closesAt;

    @Column(name = "closed_by")
    private String closedBy;

    @Column(name = "closed_at")
    private Instant closedAt;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    // ── Getters / setters ────────────────────────────────────────────────────

    public Long getId()                  { return id; }
    public String getPeriodLabel()       { return periodLabel; }
    public void   setPeriodLabel(String v) { this.periodLabel = v; }
    public String getStatus()            { return status; }
    public void   setStatus(String v)    { this.status = v; }
    public LocalDate getOpensAt()        { return opensAt; }
    public void   setOpensAt(LocalDate v){ this.opensAt = v; }
    public LocalDate getClosesAt()       { return closesAt; }
    public void   setClosesAt(LocalDate v){ this.closesAt = v; }
    public String getClosedBy()          { return closedBy; }
    public void   setClosedBy(String v)  { this.closedBy = v; }
    public Instant getClosedAt()         { return closedAt; }
    public void   setClosedAt(Instant v) { this.closedAt = v; }
    public String getNotes()             { return notes; }
    public void   setNotes(String v)     { this.notes = v; }
    public Instant getCreatedAt()        { return createdAt; }
}
