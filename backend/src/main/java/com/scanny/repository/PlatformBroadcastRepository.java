package com.scanny.repository;

import com.scanny.entity.PlatformBroadcast;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PlatformBroadcastRepository extends JpaRepository<PlatformBroadcast, UUID> {

    List<PlatformBroadcast> findAllByOrderByCreatedAtDesc();

    @Query("""
        SELECT b FROM PlatformBroadcast b
        WHERE b.status = 'PUBLISHED'
          AND (b.expiresAt IS NULL OR b.expiresAt > :now)
        ORDER BY b.publishedAt DESC
        """)
    List<PlatformBroadcast> findActivePublished(@Param("now") Instant now);
}
