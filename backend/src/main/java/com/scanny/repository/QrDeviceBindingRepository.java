package com.scanny.repository;

import com.scanny.entity.QrDeviceBinding;
import com.scanny.model.enums.BindingStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface QrDeviceBindingRepository extends JpaRepository<QrDeviceBinding, Long> {

    /**
     * Find active binding for a QR token.
     * Due to unique constraint, there can only be one active binding per token.
     */
    Optional<QrDeviceBinding> findByQrTokenAndStatus(String qrToken, BindingStatus status);

    /**
     * Check if active binding exists for a token
     */
    boolean existsByQrTokenAndStatus(String qrToken, BindingStatus status);

    /**
     * Find all bindings for a unit (including historical revoked/expired)
     */
    List<QrDeviceBinding> findByUnitIdOrderByBoundAtDesc(String unitId);

    /**
     * Find all active bindings for a property
     */
    List<QrDeviceBinding> findByPropertyIdAndStatusOrderByBoundAtDesc(String propertyId, BindingStatus status);

    /**
     * Find all bindings for a property (for admin dashboard)
     */
    List<QrDeviceBinding> findByPropertyIdOrderByBoundAtDesc(String propertyId);

    /**
     * Find bindings by device ID (to see all units a device has accessed)
     */
    List<QrDeviceBinding> findByDeviceIdOrderByBoundAtDesc(String deviceId);

    /**
     * Find bindings by phone number (useful for tenant support)
     */
    List<QrDeviceBinding> findByPhoneNumberOrderByBoundAtDesc(String phoneNumber);

    /**
     * Find active bindings that have expired (for scheduled cleanup job)
     */
    @Query("SELECT b FROM QrDeviceBinding b WHERE b.status = :status AND b.expiresAt IS NOT NULL AND b.expiresAt < :now")
    List<QrDeviceBinding> findExpiredBindings(@Param("status") BindingStatus status, @Param("now") Instant now);

    /**
     * Count active bindings for a property
     */
    long countByPropertyIdAndStatus(String propertyId, BindingStatus status);

    /**
     * Find recent revocations for a property (security monitoring)
     */
    @Query("SELECT b FROM QrDeviceBinding b WHERE b.propertyId = :propertyId AND b.status = 'REVOKED' AND b.revokedAt > :since ORDER BY b.revokedAt DESC")
    List<QrDeviceBinding> findRecentRevocations(@Param("propertyId") String propertyId, @Param("since") Instant since);

    /**
     * Find units with multiple revocations (potential security issue)
     */
    @Query(value = """
        SELECT unit_id 
        FROM qr_device_bindings 
        WHERE status = 'REVOKED' 
          AND revoked_at > :since 
        GROUP BY unit_id 
        HAVING COUNT(*) >= :threshold
        """, nativeQuery = true)
    List<String> findUnitsWithMultipleRevocationsSince(@Param("since") Instant since, @Param("threshold") int threshold);

    /**
     * Get binding statistics for a property
     */
    @Query("""
        SELECT new map(
            COUNT(*) AS total,
            SUM(CASE WHEN b.status = 'ACTIVE' THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN b.status = 'REVOKED' THEN 1 ELSE 0 END) AS revoked,
            SUM(CASE WHEN b.status = 'EXPIRED' THEN 1 ELSE 0 END) AS expired,
            AVG(CASE WHEN b.status = 'ACTIVE' THEN b.useCount ELSE NULL END) AS avgUseCount
        )
        FROM QrDeviceBinding b 
        WHERE b.propertyId = :propertyId
        """)
    java.util.Map<String, Object> getPropertyStatistics(@Param("propertyId") String propertyId);

    /**
     * Delete old revoked/expired bindings for cleanup (keeps audit for N days)
     */
    @Query("DELETE FROM QrDeviceBinding b WHERE b.status IN ('REVOKED', 'EXPIRED') AND b.revokedAt < :cutoffDate")
    int deleteOldBindings(@Param("cutoffDate") Instant cutoffDate);
}
