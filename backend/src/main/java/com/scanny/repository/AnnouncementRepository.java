package com.scanny.repository;

import com.scanny.entity.Announcement;
import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AnnouncementRepository extends JpaRepository<Announcement, String> {

    /** All announcements for a business, newest first (merchant view). */
    List<Announcement> findByBusiness_IdOrderByCreatedAtDesc(String businessId);

    /**
     * Active announcements visible to customers right now:
     * active = true AND (startsAt IS NULL OR startsAt <= now)
     *                AND (endsAt   IS NULL OR endsAt   >= now)
     */
    @Query("""
        SELECT a FROM Announcement a
        WHERE a.business.id = :businessId
          AND a.active = true
          AND (a.startsAt IS NULL OR a.startsAt <= :now)
          AND (a.endsAt   IS NULL OR a.endsAt   >= :now)
        ORDER BY a.createdAt DESC
        """)
    List<Announcement> findActiveForBusiness(
        @Param("businessId") String businessId,
        @Param("now") Instant now
    );
}
