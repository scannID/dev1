package com.scanny.repository;

import com.scanny.entity.FinancialLedgerEntry;
import com.scanny.model.enums.LedgerEntryType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.QueryHint;
import java.time.Instant;
import java.util.List;
import java.util.stream.Stream;

public interface FinancialLedgerRepository extends JpaRepository<FinancialLedgerEntry, String> {

    /** Deduplication guard — true if a PAYMENT row already exists for this order. */
    boolean existsByOrderIdAndEntryType(String orderId, LedgerEntryType entryType);

    // ── Aggregate summary ─────────────────────────────────────────────────────
    //
    // All money fields use SUM() directly — REFUND rows carry negative values so the
    // totals are always correct with no special-casing.
    // COUNT(CASE WHEN ...) is used instead of SUM(CASE WHEN ... THEN 1) to stay
    // type-safe across H2 and PostgreSQL.
    // The composite index on (business_id, settled_at) makes these O(range) not O(table).

    /**
     * Single-row aggregate for the accounting summary card.
     * Returns Object[] with columns:
     *   [0] sumGross       long
     *   [1] sumNet         long
     *   [2] sumServiceFee  long
     *   [3] sumPsoFee      long
     *   [4] sumPlatformFee long
     *   [5] sumCogs        long
     *   [6] paymentCount   long  (PAYMENT rows only)
     *   [7] refundCount    long  (REFUND rows only)
     *   [8] totalCount     long  (all rows)
     */
    @Query("""
            SELECT
              COALESCE(SUM(e.grossAmount),   0L),
              COALESCE(SUM(e.netAmount),     0L),
              COALESCE(SUM(e.serviceFee),    0L),
              COALESCE(SUM(e.psoFee),        0L),
              COALESCE(SUM(e.platformFee),   0L),
              COALESCE(SUM(e.cogsAmount),    0L),
              COUNT(CASE WHEN e.entryType = com.scanny.model.enums.LedgerEntryType.PAYMENT THEN e.id END),
              COUNT(CASE WHEN e.entryType = com.scanny.model.enums.LedgerEntryType.REFUND  THEN e.id END),
              COUNT(e)
            FROM FinancialLedgerEntry e
            WHERE e.businessId = :businessId
              AND (:from IS NULL OR e.settledAt >= :from)
              AND (:to   IS NULL OR e.settledAt <  :to)
            """)
    List<Object[]> aggregateSummary(
            @Param("businessId") String businessId,
            @Param("from") Instant from,
            @Param("to")   Instant to
    );

    /**
     * Payment-method breakdown — returns rows of
     * [paymentMethod (String), count (long), sumNet (long), sumGross (long)].
     * Only PAYMENT entries so cash/MoMo split reflects actual collections.
     */
    @Query("""
            SELECT e.paymentMethod,
                   COUNT(e),
                   COALESCE(SUM(e.netAmount),   0L),
                   COALESCE(SUM(e.grossAmount), 0L)
            FROM FinancialLedgerEntry e
            WHERE e.businessId  = :businessId
              AND e.entryType   = com.scanny.model.enums.LedgerEntryType.PAYMENT
              AND (:from IS NULL OR e.settledAt >= :from)
              AND (:to   IS NULL OR e.settledAt <  :to)
            GROUP BY e.paymentMethod
            """)
    List<Object[]> paymentMethodBreakdown(
            @Param("businessId") String businessId,
            @Param("from") Instant from,
            @Param("to")   Instant to
    );

    // ── Paginated ledger ──────────────────────────────────────────────────────

    /**
     * Paginated ledger — all entry types, newest first.
     * Optional date window and entry-type filter.
     */
    @Query("""
            SELECT e FROM FinancialLedgerEntry e
            WHERE e.businessId = :businessId
              AND (:from      IS NULL OR e.settledAt >= :from)
              AND (:to        IS NULL OR e.settledAt <  :to)
              AND (:entryType IS NULL OR e.entryType  = :entryType)
            ORDER BY e.settledAt DESC
            """)
    Page<FinancialLedgerEntry> ledgerPage(
            @Param("businessId") String businessId,
            @Param("from")       Instant from,
            @Param("to")         Instant to,
            @Param("entryType")  LedgerEntryType entryType,
            Pageable pageable
    );

    // ── Streaming export ──────────────────────────────────────────────────────

    /**
     * Streaming cursor for CSV export — MUST be called inside a read-only transaction.
     *
     * <p>Spring Data JPA wraps this in a forward-only, read-only JDBC cursor so the
     * entire result set is never materialised in heap memory. The caller must consume
     * and close the stream inside the transaction boundary.
     *
     * <p>{@code FETCH_SIZE} hint tells Hibernate to use server-side cursor pagination
     * (1 000 rows per round-trip) instead of loading everything in a single fetch.
     */
    @QueryHints(value = {
        @QueryHint(name = org.hibernate.jpa.HibernateHints.HINT_FETCH_SIZE, value = "1000"),
        @QueryHint(name = org.hibernate.jpa.HibernateHints.HINT_READ_ONLY,  value = "true")
    })
    @Query("""
            SELECT e FROM FinancialLedgerEntry e
            WHERE e.businessId = :businessId
              AND (:from IS NULL OR e.settledAt >= :from)
              AND (:to   IS NULL OR e.settledAt <  :to)
            ORDER BY e.settledAt ASC
            """)
    Stream<FinancialLedgerEntry> streamForExport(
            @Param("businessId") String businessId,
            @Param("from") Instant from,
            @Param("to")   Instant to
    );

    // ── Daily series ──────────────────────────────────────────────────────────

    /**
     * Raw (settledAt, netAmount) pairs for the daily sparkline.
     * Grouping into calendar buckets is done in Java using the merchant's ZoneId.
     */
    @Query("""
            SELECT e.settledAt, e.netAmount
            FROM FinancialLedgerEntry e
            WHERE e.businessId = :businessId
              AND e.settledAt >= :since
            ORDER BY e.settledAt ASC
            """)
    List<Object[]> rawPairsForDailySeries(
            @Param("businessId") String businessId,
            @Param("since")      Instant since
    );
}
