package com.scanny.repository;

import com.scanny.entity.TicketScan;
import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface TicketScanRepository extends JpaRepository<TicketScan, Long> {

    List<TicketScan> findByTicketId(String ticketId);

    List<TicketScan> findByTicketIdOrderByScannedAtDesc(String ticketId);

    long countByScannedAtAfter(Instant cutoff);

    long countByScannedAtGreaterThanEqualAndScannedAtBefore(Instant start, Instant end);

    List<TicketScan> findByScannedAtAfter(Instant cutoff);

    @Query("SELECT s.scannedAt FROM TicketScan s WHERE s.scannedAt >= :cutoff")
    List<Instant> findScannedAtsAfter(@Param("cutoff") Instant cutoff);

    @Query("""
            SELECT COUNT(s) FROM TicketScan s
            WHERE s.scannedAt >= :start AND s.scannedAt < :end
            """)
    long countBetween(@Param("start") Instant start, @Param("end") Instant end);
}
