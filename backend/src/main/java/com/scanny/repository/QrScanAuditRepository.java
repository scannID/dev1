package com.scanny.repository;

import com.scanny.entity.QrScanAudit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface QrScanAuditRepository extends JpaRepository<QrScanAudit, Long> {

    /**
     * Count failed attempts from an IP in a time window (for rate limiting detection)
     */
    @Query("SELECT COUNT(q) FROM QrScanAudit q WHERE q.ipAddress = :ip " +
           "AND q.outcome IN ('DENIED', 'INVALID', 'EXPIRED', 'BLACKLISTED') " +
           "AND q.scannedAt >= :since")
    long countByIpAndFailedOutcomeSince(@Param("ip") String ipAddress, @Param("since") Instant since);

    /**
     * Count rapid scans from a device (for brute force detection)
     */
    @Query("SELECT COUNT(q) FROM QrScanAudit q WHERE q.deviceId = :deviceId " +
           "AND q.scannedAt >= :since")
    long countByDeviceIdSince(@Param("deviceId") String deviceId, @Param("since") Instant since);

    /**
     * Get recent suspicious activity
     */
    List<QrScanAudit> findTop100BySuspiciousTrueOrderByScannedAtDesc();

    /**
     * Get audit logs for a specific entity (merchant, property, etc.)
     */
    List<QrScanAudit> findTop50ByEntityIdOrderByScannedAtDesc(String entityId);

    /**
     * Count unique IPs accessing a token hash (for enumeration detection)
     */
    @Query("SELECT COUNT(DISTINCT q.ipAddress) FROM QrScanAudit q " +
           "WHERE q.tokenHash = :tokenHash AND q.scannedAt >= :since")
    long countDistinctIpsByTokenHashSince(@Param("tokenHash") String tokenHash, @Param("since") Instant since);
}
