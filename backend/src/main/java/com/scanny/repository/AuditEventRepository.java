package com.scanny.repository;

import com.scanny.entity.AuditEvent;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface AuditEventRepository extends JpaRepository<AuditEvent, UUID> {
    Page<AuditEvent> findAllByOrderByOccurredAtDesc(Pageable pageable);

    long countByOccurredAtGreaterThanEqual(Instant occurredAt);

    long countByActionStartingWith(String actionPrefix);

    @Query("""
        SELECT COUNT(e) FROM AuditEvent e
        WHERE e.actorEmail IS NULL AND e.actorId IS NULL
           OR LOWER(e.actorEmail) IN ('system', 'anonymous')
           OR LOWER(e.actorId) IN ('system', 'anonymous')
        """)
    long countSystemEvents();
}
