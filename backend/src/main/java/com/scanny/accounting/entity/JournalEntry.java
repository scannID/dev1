package com.scanny.accounting.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Immutable journal entry header.
 *
 * <p>NEVER update or delete rows in this table — enforced by a DB trigger.
 * To correct an error, create a REVERSAL entry that mirrors the original
 * with debits and credits swapped, then post a correcting entry.
 *
 * <p>The {@code entryHash} field links entries into a hash chain:
 * {@code SHA-256(prevEntryHash || entryDate || sourceModule || sourceEventId || totalAmount)}.
 * Running the chain verification script on any snapshot proves no entry has been
 * altered or deleted since it was posted.
 */
@Entity
@Table(name = "journal_entries", schema = "accounting")
public class JournalEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "entry_date", nullable = false)
    private LocalDate entryDate;

    @Column(name = "period_label", nullable = false, length = 7)
    private String periodLabel;

    @Column(name = "source_module", nullable = false, length = 16)
    private String sourceModule;

    @Column(name = "source_event_type", nullable = false, length = 80)
    private String sourceEventType;

    /** Idempotency key — UNIQUE(source_module, source_event_id). */
    @Column(name = "source_event_id", nullable = false, length = 120)
    private String sourceEventId;

    @Column(name = "source_record_id", length = 120)
    private String sourceRecordId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false, length = 3)
    private String currency = "UGX";

    /** POSTED | REVERSED | REVERSAL */
    @Column(nullable = false, length = 10)
    private String status = "POSTED";

    @Column(name = "reference_entry_id")
    private Long referenceEntryId;

    // ── Dimensions ────────────────────────────────────────────────────────────
    @Column(name = "dim_merchant_id",    length = 120) private String dimMerchantId;
    @Column(name = "dim_property_id",    length = 120) private String dimPropertyId;
    @Column(name = "dim_tenant_id",      length = 120) private String dimTenantId;
    @Column(name = "dim_event_id",       length = 120) private String dimEventId;
    @Column(name = "dim_payment_method", length = 32)  private String dimPaymentMethod;

    // ── Tamper evidence ───────────────────────────────────────────────────────
    @Column(name = "entry_hash", nullable = false, length = 64)
    private String entryHash;

    @Column(name = "prev_entry_hash", length = 64)
    private String prevEntryHash;

    // ── Audit ─────────────────────────────────────────────────────────────────
    @Column(name = "posted_by", nullable = false, length = 255)
    private String postedBy = "system";

    @Column(name = "posted_at", nullable = false)
    private Instant postedAt = Instant.now();

    // ── Lines (loaded lazily for list queries, eagerly for balance checks) ────
    @OneToMany(mappedBy = "entryId", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<JournalLine> lines = new ArrayList<>();

    // ── Getters / setters ─────────────────────────────────────────────────────

    public Long       getId()                { return id; }
    public LocalDate  getEntryDate()         { return entryDate; }
    public void       setEntryDate(LocalDate v)   { this.entryDate = v; }
    public String     getPeriodLabel()       { return periodLabel; }
    public void       setPeriodLabel(String v)    { this.periodLabel = v; }
    public String     getSourceModule()      { return sourceModule; }
    public void       setSourceModule(String v)   { this.sourceModule = v; }
    public String     getSourceEventType()   { return sourceEventType; }
    public void       setSourceEventType(String v){ this.sourceEventType = v; }
    public String     getSourceEventId()     { return sourceEventId; }
    public void       setSourceEventId(String v)  { this.sourceEventId = v; }
    public String     getSourceRecordId()    { return sourceRecordId; }
    public void       setSourceRecordId(String v) { this.sourceRecordId = v; }
    public String     getDescription()       { return description; }
    public void       setDescription(String v)    { this.description = v; }
    public String     getCurrency()          { return currency; }
    public String     getStatus()            { return status; }
    public void       setStatus(String v)    { this.status = v; }
    public Long       getReferenceEntryId()  { return referenceEntryId; }
    public void       setReferenceEntryId(Long v) { this.referenceEntryId = v; }
    public String     getDimMerchantId()     { return dimMerchantId; }
    public void       setDimMerchantId(String v)  { this.dimMerchantId = v; }
    public String     getDimPropertyId()     { return dimPropertyId; }
    public void       setDimPropertyId(String v)  { this.dimPropertyId = v; }
    public String     getDimTenantId()       { return dimTenantId; }
    public void       setDimTenantId(String v)    { this.dimTenantId = v; }
    public String     getDimEventId()        { return dimEventId; }
    public void       setDimEventId(String v)     { this.dimEventId = v; }
    public String     getDimPaymentMethod()  { return dimPaymentMethod; }
    public void       setDimPaymentMethod(String v){ this.dimPaymentMethod = v; }
    public String     getEntryHash()         { return entryHash; }
    public void       setEntryHash(String v) { this.entryHash = v; }
    public String     getPrevEntryHash()     { return prevEntryHash; }
    public void       setPrevEntryHash(String v)  { this.prevEntryHash = v; }
    public String     getPostedBy()          { return postedBy; }
    public void       setPostedBy(String v)  { this.postedBy = v; }
    public Instant    getPostedAt()          { return postedAt; }
    public List<JournalLine> getLines()      { return lines; }
    public void       setLines(List<JournalLine> v){ this.lines = v; }
}
