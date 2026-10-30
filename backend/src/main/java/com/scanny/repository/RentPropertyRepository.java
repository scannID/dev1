package com.scanny.repository;

import com.scanny.entity.RentProperty;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface RentPropertyRepository extends JpaRepository<RentProperty, String> {

    Optional<RentProperty> findByQrToken(String qrToken);

    boolean existsByQrToken(String qrToken);

    /** All properties where the given account has ANY access role. */
    @Query("""
        SELECT p FROM RentProperty p
        JOIN RentPropertyAccess a ON a.property = p
        WHERE a.account.id = :accountId
        ORDER BY p.name ASC
        """)
    List<RentProperty> findAllByAccountId(@Param("accountId") String accountId);

    /**
     * Portfolio summary projections — one row per property the account can access.
     * Returns unit counts and the account's role without touching lazy collections.
     */
    @Query("""
        SELECT p.id           AS propertyId,
               p.name         AS propertyName,
               p.city         AS city,
               p.currency     AS currency,
               a.role         AS role,
               COUNT(u.id)    AS totalUnits
        FROM RentProperty p
        JOIN RentPropertyAccess a ON a.property = p AND a.account.id = :accountId
        LEFT JOIN p.units u
        GROUP BY p.id, p.name, p.city, p.currency, a.role
        ORDER BY p.name ASC
        """)
    List<com.scanny.repository.projection.PortfolioSummaryProjection> findPortfolioSummary(
            @Param("accountId") String accountId);

    /**
     * Count of active (occupied) tenants per property for the given account.
     * Returns [propertyId, occupiedCount] pairs.
     */
    @Query("""
        SELECT u.property.id AS propertyId, COUNT(t.id) AS occupiedCount
        FROM RentTenant t
        JOIN t.unit u
        WHERE t.active = true
          AND u.property.id IN (
              SELECT p2.id FROM RentProperty p2
              JOIN RentPropertyAccess a2 ON a2.property = p2 AND a2.account.id = :accountId
          )
        GROUP BY u.property.id
        """)
    List<com.scanny.repository.projection.PropertyOccupancyProjection> findOccupancyByAccountId(
            @Param("accountId") String accountId);

    /** Properties where the given account is the registered owner account. */
    List<RentProperty> findByOwnerAccount_IdOrderByNameAsc(String ownerAccountId);
}
