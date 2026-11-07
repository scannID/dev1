package com.scanny.accounting.repository;

import com.scanny.accounting.entity.JournalEntry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface JournalEntryRepository extends JpaRepository<JournalEntry, Long> {

    /** Idempotency check — has this event already been posted? */
    Optional<JournalEntry> findBySourceModuleAndSourceEventId(
            String sourceModule, String sourceEventId);

    /** Most recent entry by ID — used to get prev_entry_hash for chain continuation. */
    @Query("SELECT e FROM JournalEntry e ORDER BY e.id DESC")
    java.util.List<JournalEntry> findLatest(Pageable pageable);

    /** Entries for a given period, ordered oldest first (for reports). */
    Page<JournalEntry> findByPeriodLabelOrderByEntryDateAscIdAsc(
            String periodLabel, Pageable pageable);

    /** All entries in a date range. */
    Page<JournalEntry> findByEntryDateBetweenOrderByEntryDateAscIdAsc(
            LocalDate from, LocalDate to, Pageable pageable);

    /** Module-scoped entries. */
    Page<JournalEntry> findBySourceModuleAndEntryDateBetweenOrderByEntryDateAscIdAsc(
            String sourceModule, LocalDate from, LocalDate to, Pageable pageable);

    /** Trial balance: net balance per account across all posted entries. */
    @Query("""
        SELECT l.account.code, l.account.name, l.account.accountType, l.account.normalBalance,
               SUM(CASE WHEN l.side = 'DEBIT'  THEN l.amount ELSE 0 END),
               SUM(CASE WHEN l.side = 'CREDIT' THEN l.amount ELSE 0 END)
        FROM   JournalLine l
        JOIN   JournalEntry e ON l.entryId = e.id
        WHERE  e.periodLabel = :periodLabel
          AND  e.status IN ('POSTED','REVERSAL')
        GROUP BY l.account.code, l.account.name, l.account.accountType, l.account.normalBalance
        ORDER BY l.account.code
        """)
    java.util.List<Object[]> trialBalance(@Param("periodLabel") String periodLabel);

    /** Revenue by module for a date range — used by the accounting dashboard. */
    @Query("""
        SELECT e.sourceModule,
               SUM(CASE WHEN l.side = 'CREDIT' AND l.account.accountType = 'REVENUE' THEN l.amount ELSE 0 END)
        FROM   JournalLine l
        JOIN   JournalEntry e ON l.entryId = e.id
        WHERE  e.entryDate BETWEEN :from AND :to
          AND  e.status IN ('POSTED','REVERSAL')
        GROUP BY e.sourceModule
        """)
    java.util.List<Object[]> revenueByModule(
            @Param("from") LocalDate from, @Param("to") LocalDate to);
}
