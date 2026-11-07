package com.scanny.accounting.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * A posting rule maps a domain event type to a set of journal line templates.
 *
 * <p>{@code ruleJson} is a JSON array of line templates:
 * <pre>
 * [
 *   {"account_code":"1300","side":"DEBIT", "amount_field":"platform_commission_ugx","memo":"..."},
 *   {"account_code":"3000","side":"CREDIT","amount_field":"platform_commission_ugx","memo":"..."}
 * ]
 * </pre>
 * The {@code amount_field} names map to {@link com.scanny.accounting.AccountingEvent#getAmountField(String)}.
 * Lines with an amount of 0 are skipped (no zero-amount lines in the ledger).
 */
@Entity
@Table(name = "posting_rules", schema = "accounting")
public class PostingRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "source_module", nullable = false, length = 16)
    private String sourceModule;

    @Column(name = "event_type", nullable = false, length = 80)
    private String eventType;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "rule_json", nullable = false, columnDefinition = "jsonb")
    private String ruleJson;

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt;

    // ── Getters ──────────────────────────────────────────────────────────────

    public Integer getId()           { return id; }
    public String  getSourceModule() { return sourceModule; }
    public String  getEventType()    { return eventType; }
    public String  getDescription()  { return description; }
    public String  getRuleJson()     { return ruleJson; }
    public boolean isActive()        { return isActive; }
}
