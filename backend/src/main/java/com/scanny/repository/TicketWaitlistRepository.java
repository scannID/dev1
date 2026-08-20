package com.scanny.repository;

import com.scanny.entity.TicketWaitlist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface TicketWaitlistRepository extends JpaRepository<TicketWaitlist, String> {

    boolean existsByMasterIdAndHolderPhone(String masterId, String holderPhone);

    Optional<TicketWaitlist> findByClaimToken(String claimToken);

    /** Next un-notified entries for a class, oldest first — used by the release hook. */
    @Query("""
        SELECT w FROM TicketWaitlist w
        WHERE w.masterId = :masterId
          AND LOWER(w.ticketClass) = LOWER(:ticketClass)
          AND w.notified = false
        ORDER BY w.joinedAt ASC
        """)
    List<TicketWaitlist> findPendingByMasterAndClass(
        @Param("masterId") String masterId,
        @Param("ticketClass") String ticketClass
    );

    /** Count how many are waiting for a given class. */
    @Query("""
        SELECT COUNT(w) FROM TicketWaitlist w
        WHERE w.masterId = :masterId
          AND LOWER(w.ticketClass) = LOWER(:ticketClass)
          AND w.notified = false
        """)
    long countWaiting(
        @Param("masterId") String masterId,
        @Param("ticketClass") String ticketClass
    );

    /** All entries for a master event, newest first — for admin view. */
    List<TicketWaitlist> findByMasterIdOrderByJoinedAtAsc(String masterId);
}
