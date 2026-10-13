package com.scanny.entity;

import com.scanny.model.enums.LedgerEntryType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * Immutable financial ledger entry — one row per payment or refund event.
 *
 * <h3>Immutability contract</h3>
 * <p>Rows are written once by {@code LedgerWriterService} and never updated.
 * Refunds create a new {@code REFUND} row with negated money fields rather than
 * mutating the original {@code PAYMENT} row, preserving a complete audit trail.
 *
 * <h3>Money</h3>
 * <p>All monetary fields are in UGX (integer, 1 UGX = smallest unit).
 * REFUND rows carry negative values so that {@code SUM(net_amount)} over any window
 * yields the correct net-settled figure without special-casing in queries.
 *
 * <h3>Indexes</h3>
 * <ul>
 *   <li>Primary: {@code id} (UUID)</li>
 *   <li>{@code business_id, settled_at} — covering index for all merchant summary
 *       and ledger queries (range scans by date within a business).</li>
 *   <li>{@code order_id} — lookup by order for deduplication guard.</li>
 * </ul>
 */
@Entity
@Table(
    name = "financial_ledger_entries",
    indexes = {
        @Index(name = "idx_fle_business_settled", columnList = "business_id, settled_at"),
        @Index(name = "idx_fle_order_id",         columnList = "order_id"),
    }
)
public class FinancialLedgerEntry {

    @Id
    @Column(nullable = false, updatable = false)
    private String id;

    /** Foreign key to orders.id — retained for join / audit, never used for aggregation. */
    @Column(name = "order_id", nullable = false, updatable = false)
    private String orderId;

    @Column(name = "business_id", nullable = false, updatable = false)
    private String businessId;

    /**
     * Discriminates between a positive PAYMENT row and a negative REFUND row.
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false)
    private LedgerEntryType entryType;

    // ── Frozen fee split ──────────────────────────────────────────────────────

    /** Customer-paid gross (subtotal + serviceFee). Negative for REFUND rows. */
    @Column(name = "gross_amount", nullable = false, updatable = false)
    private long grossAmount;

    /** Amount credited to merchant MoMo. Negative for REFUND rows. */
    @Column(name = "net_amount", nullable = false, updatable = false)
    private long netAmount;

    /** Service fee charged on this transaction. Negative for REFUND rows. */
    @Column(name = "service_fee", nullable = false, updatable = false)
    private long serviceFee;

    /** PSO (MoMo provider) share. Negative for REFUND rows. */
    @Column(name = "pso_fee", nullable = false, updatable = false)
    private long psoFee;

    /** Scanny platform share. Negative for REFUND rows. */
    @Column(name = "platform_fee", nullable = false, updatable = false)
    private long platformFee;

    /** Recipe / ingredient COGS locked at payment time. Negative for REFUND rows. */
    @Column(name = "cogs_amount", nullable = false, updatable = false)
    private long cogsAmount;

    // ── Context ───────────────────────────────────────────────────────────────

    /** "MOMO" or "CASH". */
    @Column(name = "payment_method", nullable = false, updatable = false, length = 16)
    private String paymentMethod;

    /**
     * UTC instant at which the financial event occurred (payment confirmed or
     * refund processed). Used for all date-range queries. Immutable.
     */
    @Column(name = "settled_at", nullable = false, updatable = false)
    private Instant settledAt;

    /** When this ledger row was written. */
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    // ── Constructors ──────────────────────────────────────────────────────────

    protected FinancialLedgerEntry() {}

    /**
     * Factory for a PAYMENT row — called when an order transitions to Paid.
     */
    public static FinancialLedgerEntry payment(
            String orderId,
            String businessId,
            long grossAmount,
            long netAmount,
            long serviceFee,
            long psoFee,
            long platformFee,
            long cogsAmount,
            String paymentMethod,
            Instant settledAt
    ) {
        FinancialLedgerEntry e = new FinancialLedgerEntry();
        e.id            = UUID.randomUUID().toString();
        e.orderId       = orderId;
        e.businessId    = businessId;
        e.entryType     = LedgerEntryType.PAYMENT;
        e.grossAmount   = grossAmount;
        e.netAmount     = netAmount;
        e.serviceFee    = serviceFee;
        e.psoFee        = psoFee;
        e.platformFee   = platformFee;
        e.cogsAmount    = cogsAmount;
        e.paymentMethod = paymentMethod;
        e.settledAt     = settledAt;
        return e;
    }

    /**
     * Factory for a REFUND row — negates all money fields to preserve the audit trail.
     * Does NOT mutate the original PAYMENT row.
     */
    public static FinancialLedgerEntry refund(
            String orderId,
            String businessId,
            long grossAmount,
            long netAmount,
            long serviceFee,
            long psoFee,
            long platformFee,
            long cogsAmount,
            String paymentMethod,
            Instant settledAt
    ) {
        FinancialLedgerEntry e = new FinancialLedgerEntry();
        e.id            = UUID.randomUUID().toString();
        e.orderId       = orderId;
        e.businessId    = businessId;
        e.entryType     = LedgerEntryType.REFUND;
        e.grossAmount   = -grossAmount;
        e.netAmount     = -netAmount;
        e.serviceFee    = -serviceFee;
        e.psoFee        = -psoFee;
        e.platformFee   = -platformFee;
        e.cogsAmount    = -cogsAmount;
        e.paymentMethod = paymentMethod;
        e.settledAt     = settledAt;
        return e;
    }

    // ── Getters (no setters — immutable after construction) ───────────────────

    public String getId()            { return id; }
    public String getOrderId()       { return orderId; }
    public String getBusinessId()    { return businessId; }
    public LedgerEntryType getEntryType() { return entryType; }
    public long getGrossAmount()     { return grossAmount; }
    public long getNetAmount()       { return netAmount; }
    public long getServiceFee()      { return serviceFee; }
    public long getPsoFee()          { return psoFee; }
    public long getPlatformFee()     { return platformFee; }
    public long getCogsAmount()      { return cogsAmount; }
    public String getPaymentMethod() { return paymentMethod; }
    public Instant getSettledAt()    { return settledAt; }
    public Instant getCreatedAt()    { return createdAt; }
}
