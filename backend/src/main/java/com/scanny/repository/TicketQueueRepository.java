package com.scanny.repository;

import com.scanny.entity.TicketQueueEntry;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface TicketQueueRepository extends JpaRepository<TicketQueueEntry, String> {

    @Query("""
            SELECT COUNT(q) FROM TicketQueueEntry q
            WHERE q.masterId = :masterId
              AND q.status = :status
              AND (q.queuedAt < :queuedAt OR (q.queuedAt = :queuedAt AND q.id < :id))
            """)
    long countWaitingAhead(
            @Param("masterId") String masterId,
            @Param("status") String status,
            @Param("queuedAt") Instant queuedAt,
            @Param("id") String id
    );

    long countByMasterIdAndStatus(String masterId, String status);

    @Query("SELECT q FROM TicketQueueEntry q WHERE q.status = :status ORDER BY q.queuedAt ASC")
    List<TicketQueueEntry> findNextBatchByStatus(@Param("status") String status, Pageable pageable);

    List<TicketQueueEntry> findByExpiresAtBeforeAndStatus(Instant expiresAt, String status);
}
