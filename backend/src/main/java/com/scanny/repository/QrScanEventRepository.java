package com.scanny.repository;

import com.scanny.entity.QrScanEvent;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface QrScanEventRepository extends JpaRepository<QrScanEvent, Long> {

    List<QrScanEvent> findAllByOrderByScannedAtDesc();

    Optional<QrScanEvent> findTopByBusinessIdAndQrTokenAndUserAgentOrderByScannedAtDesc(
            String businessId,
            String qrToken,
            String userAgent
    );

    Optional<QrScanEvent> findTopByBusinessIdAndUserAgentOrderByScannedAtDesc(
            String businessId,
            String userAgent
    );

    long countByScannedAtAfter(Instant cutoff);

    long countByScannedAtGreaterThanEqualAndScannedAtBefore(Instant start, Instant end);

    List<QrScanEvent> findByScannedAtAfterOrderByScannedAtDesc(Instant cutoff);

    @Query("""
            SELECT COUNT(e) FROM QrScanEvent e
            WHERE e.scannedAt >= :start AND e.scannedAt < :end
            """)
    long countBetween(@Param("start") Instant start, @Param("end") Instant end);
}
