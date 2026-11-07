package com.scanny.accounting.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** Dead-letter queue row for accounting events that failed to post. */
@Entity
@Table(name = "posting_failures", schema = "accounting")
public class PostingFailure {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "source_module",      nullable = false, length = 16)  private String sourceModule;
    @Column(name = "source_event_type",  nullable = false, length = 80)  private String sourceEventType;
    @Column(name = "source_event_id",    nullable = false, length = 120) private String sourceEventId;
    @Column(name = "payload_json",       nullable = false, columnDefinition = "jsonb") private String payloadJson;
    @Column(name = "last_error",         columnDefinition = "TEXT")      private String lastError;
    @Column(name = "retry_count",        nullable = false)               private int retryCount = 0;
    @Column(nullable = false, length = 10) private String status = "PENDING"; // PENDING | RESOLVED | IGNORED
    @Column(name = "created_at",         nullable = false)               private Instant createdAt = Instant.now();
    @Column(name = "updated_at")                                         private Instant updatedAt;

    public Long    getId()             { return id; }
    public String  getSourceModule()   { return sourceModule; }
    public void    setSourceModule(String v)   { this.sourceModule = v; }
    public String  getSourceEventType(){ return sourceEventType; }
    public void    setSourceEventType(String v){ this.sourceEventType = v; }
    public String  getSourceEventId()  { return sourceEventId; }
    public void    setSourceEventId(String v)  { this.sourceEventId = v; }
    public String  getPayloadJson()    { return payloadJson; }
    public void    setPayloadJson(String v)    { this.payloadJson = v; }
    public String  getLastError()      { return lastError; }
    public void    setLastError(String v)      { this.lastError = v; }
    public int     getRetryCount()     { return retryCount; }
    public void    setRetryCount(int v)        { this.retryCount = v; }
    public String  getStatus()         { return status; }
    public void    setStatus(String v) { this.status = v; }
    public Instant getCreatedAt()      { return createdAt; }
    public Instant getUpdatedAt()      { return updatedAt; }
    public void    setUpdatedAt(Instant v)     { this.updatedAt = v; }
}
