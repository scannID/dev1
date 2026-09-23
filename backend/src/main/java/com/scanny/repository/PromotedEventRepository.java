package com.scanny.repository;

import com.scanny.entity.PromotedEvent;
import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface PromotedEventRepository extends JpaRepository<PromotedEvent, String> {

    /**
     * Find active promoted events whose venue is within {@code radiusKm} of
     * the supplied restaurant coordinates using the Haversine approximation.
     * <p>
     * The formula works in degrees; 111.045 km ≈ 1 degree of latitude.
     * Restaurants don't store lat/lng yet, so callers pass the best available
     * approximation (e.g. extracted from the venue_address geocode on the
     * client side, or a rough central coordinate for the city).
     * </p>
     *
     * @param lat       latitude of the querying restaurant
     * @param lng       longitude of the querying restaurant
     * @param nowParam  "now" to filter promotedUntil and eventDate
     */
    @Query("""
            SELECT p FROM PromotedEvent p
            WHERE p.status = 'ACTIVE'
              AND p.promotedUntil > :now
              AND (p.eventDate IS NULL OR p.eventDate > :now)
              AND p.venueLat IS NOT NULL
              AND p.venueLng IS NOT NULL
              AND (
                  111.045 * DEGREES(ACOS(LEAST(1.0, COS(RADIANS(:lat))
                    * COS(RADIANS(p.venueLat))
                    * COS(RADIANS(p.venueLng) - RADIANS(:lng))
                    + SIN(RADIANS(:lat))
                    * SIN(RADIANS(p.venueLat))
                  )))
              ) <= p.radiusKm
            ORDER BY p.eventDate ASC NULLS LAST
            """)
    List<PromotedEvent> findActiveNearby(
            @Param("lat") double lat,
            @Param("lng") double lng,
            @Param("now") Instant now);

    /**
     * Fallback: return all ACTIVE events (no coords supplied by caller).
     * Used when the restaurant has no known coordinates.
     */
    @Query("""
            SELECT p FROM PromotedEvent p
            WHERE p.status = 'ACTIVE'
              AND p.promotedUntil > :now
              AND (p.eventDate IS NULL OR p.eventDate > :now)
            ORDER BY p.eventDate ASC NULLS LAST
            """)
    List<PromotedEvent> findAllActive(@Param("now") Instant now);

    /** All promotions for a given master ticket id (for organiser dashboard). */
    List<PromotedEvent> findByMasterTicketIdOrderByCreatedAtDesc(String masterTicketId);

    /** Find by payment id (for webhook confirmation). */
    List<PromotedEvent> findByPaymentId(String paymentId);

    /** Expire promotions whose window has passed (called by scheduler). */
    @Modifying
    @Query("""
            UPDATE PromotedEvent p
            SET p.status = 'EXPIRED', p.updatedAt = :now
            WHERE p.status = 'ACTIVE'
              AND p.promotedUntil <= :now
            """)
    int expireStale(@Param("now") Instant now);

    /** Count active promotions by organiser phone (rate-limiting). */
    long countByOrganiserPhoneAndStatus(String organiserPhone, String status);
}
