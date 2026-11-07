package com.scanny.accounting.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * A single debit or credit line within a {@link JournalEntry}.
 *
 * <p>Rules:
 * <ul>
 *   <li>{@code amount} is always positive. Side (DEBIT/CREDIT) determines the direction.</li>
 *   <li>For every entry, SUM(debit amounts) must equal SUM(credit amounts).
 *       This is enforced at commit-time by a deferred DB trigger.</li>
 *   <li>Like journal entries, lines are immutable once posted.</li>
 * </ul>
 */
@Entity
@Table(name = "journal_lines", schema = "accounting")
public class JournalLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** FK to journal_entries.id — stored as plain Long, not a JPA join,
     *  to avoid accidentally loading the full entry graph. */
    @Column(name = "entry_id", nullable = false)
    private Long entryId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    /** DEBIT or CREDIT */
    @Column(nullable = false, length = 6)
    private String side;

    /** Always positive, in UGX minor units. */
    @Column(nullable = false)
    private long amount;

    @Column(nullable = false, length = 3)
    private String currency = "UGX";

    @Column(length = 255)
    private String memo;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    // ── Getters / setters ─────────────────────────────────────────────────────

    public Long    getId()        { return id; }
    public Long    getEntryId()   { return entryId; }
    public void    setEntryId(Long v)  { this.entryId = v; }
    public Account getAccount()   { return account; }
    public void    setAccount(Account v){ this.account = v; }
    public String  getSide()      { return side; }
    public void    setSide(String v)   { this.side = v; }
    public long    getAmount()    { return amount; }
    public void    setAmount(long v)   { this.amount = v; }
    public String  getCurrency()  { return currency; }
    public String  getMemo()      { return memo; }
    public void    setMemo(String v)   { this.memo = v; }
    public Instant getCreatedAt() { return createdAt; }
}
