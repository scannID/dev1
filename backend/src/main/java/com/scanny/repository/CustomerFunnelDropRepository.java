package com.scanny.repository;

import com.scanny.entity.CustomerFunnelDrop;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface CustomerFunnelDropRepository extends JpaRepository<CustomerFunnelDrop, Long> {

    /**
     * Finds the un-notified drop for a device at a specific business.
     * Used on scan to decide whether to show the nudge banner.
     */
    Optional<CustomerFunnelDrop> findByDeviceIdAndBusinessIdAndNotifiedFalse(
            String deviceId, String businessId);

    /**
     * Finds any existing drop for a device at a business, regardless of notified state.
     * Used when deciding whether to upsert or insert a new drop row.
     */
    Optional<CustomerFunnelDrop> findTopByDeviceIdAndBusinessIdOrderByDroppedAtDesc(
            String deviceId, String businessId);

    /**
     * Aggregate drop-off counts per step for a business within a time window.
     * Returns Object[] rows: [lastStep (String), count (Long)].
     */
    @Query("""
        SELECT d.lastStep, COUNT(d)
        FROM CustomerFunnelDrop d
        WHERE d.businessId = :businessId
          AND d.droppedAt >= :from
          AND d.droppedAt < :to
        GROUP BY d.lastStep
        ORDER BY COUNT(d) DESC
        """)
    List<Object[]> countByStepForBusiness(
            @Param("businessId") String businessId,
            @Param("from") Instant from,
            @Param("to") Instant to);

    /**
     * Aggregate feedback reason counts for a business within a time window.
     * Returns Object[] rows: [feedbackReason (String), count (Long)].
     * Excludes rows without feedback.
     */
    @Query("""
        SELECT d.feedbackReason, COUNT(d)
        FROM CustomerFunnelDrop d
        WHERE d.businessId = :businessId
          AND d.feedbackGiven = TRUE
          AND d.feedbackAt >= :from
          AND d.feedbackAt < :to
        GROUP BY d.feedbackReason
        ORDER BY COUNT(d) DESC
        """)
    List<Object[]> countFeedbackReasonForBusiness(
            @Param("businessId") String businessId,
            @Param("from") Instant from,
            @Param("to") Instant to);

    /** Total drop count for a business in a window — used for conversion-rate display. */
    long countByBusinessIdAndDroppedAtBetween(
            String businessId, Instant from, Instant to);
}
