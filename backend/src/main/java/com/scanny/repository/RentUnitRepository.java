package com.scanny.repository;

import com.scanny.entity.RentUnit;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface RentUnitRepository extends JpaRepository<RentUnit, String> {

    List<RentUnit> findByProperty_IdOrderByUnitNumberAsc(String propertyId);

    /** Units with tenants + property loaded — safe for DTO mapping when OSIV is off. */
    @Query("""
        SELECT DISTINCT u FROM RentUnit u
        LEFT JOIN FETCH u.tenants
        JOIN FETCH u.property
        WHERE u.property.id = :propertyId
        """)
    List<RentUnit> findByPropertyIdWithTenants(@Param("propertyId") String propertyId);

    Optional<RentUnit> findByQrToken(String qrToken);

    boolean existsByQrToken(String qrToken);

    boolean existsByProperty_IdAndUnitNumber(String propertyId, String unitNumber);
}
