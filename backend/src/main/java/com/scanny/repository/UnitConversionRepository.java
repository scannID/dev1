package com.scanny.repository;

import com.scanny.entity.UnitConversion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface UnitConversionRepository extends JpaRepository<UnitConversion, Long> {

    /**
     * Find conversion factor for a unit pair, preferring business-specific over global.
     * Returns at most 2 rows (one business-specific, one global) ordered so the
     * business-specific row comes first.
     */
    @Query("""
        SELECT c FROM UnitConversion c
        WHERE c.fromUnit = :fromUnit
          AND c.toUnit   = :toUnit
          AND (c.businessId = :businessId OR c.businessId IS NULL)
        ORDER BY c.businessId NULLS LAST
        """)
    List<UnitConversion> findForPair(
        @Param("fromUnit")    String fromUnit,
        @Param("toUnit")      String toUnit,
        @Param("businessId")  String businessId
    );

    /** All conversions for a business (including global ones). */
    @Query("""
        SELECT c FROM UnitConversion c
        WHERE c.businessId = :businessId OR c.businessId IS NULL
        ORDER BY c.businessId NULLS LAST, c.fromUnit ASC
        """)
    List<UnitConversion> findAllForBusiness(@Param("businessId") String businessId);

    Optional<UnitConversion> findByBusinessIdAndFromUnitAndToUnit(
        String businessId, String fromUnit, String toUnit);

    Optional<UnitConversion> findByBusinessIdIsNullAndFromUnitAndToUnit(
        String fromUnit, String toUnit);
}
