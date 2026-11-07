package com.scanny.accounting.repository;

import com.scanny.accounting.entity.JournalLine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JournalLineRepository extends JpaRepository<JournalLine, Long> {

    List<JournalLine> findByEntryIdOrderById(Long entryId);

    /** Balance check — used by PostingService to verify before commit. */
    @Query("""
        SELECT COALESCE(SUM(CASE WHEN l.side = 'DEBIT' THEN l.amount ELSE -l.amount END), 0)
        FROM   JournalLine l
        WHERE  l.entryId = :entryId
        """)
    Long netBalance(@Param("entryId") Long entryId);
}
