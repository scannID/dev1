package com.scanny.repository;

import com.scanny.entity.FloorPlanElement;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FloorPlanElementRepository extends JpaRepository<FloorPlanElement, String> {

    @Query("SELECT e FROM FloorPlanElement e WHERE e.floorPlan.id = :planId ORDER BY e.zIndex ASC, e.createdAt ASC")
    List<FloorPlanElement> findByFloorPlanIdOrdered(@Param("planId") String planId);

    @Modifying
    @Query("DELETE FROM FloorPlanElement e WHERE e.floorPlan.id = :planId")
    void deleteByFloorPlanId(@Param("planId") String planId);

    /** Find the element linked to a specific BusinessTable within a floor plan */
    Optional<FloorPlanElement> findByFloorPlanIdAndBusinessTableId(String floorPlanId, String businessTableId);

    /**
     * Find all elements across all floor plans for a business that are linked
     * to a given BusinessTable — used when a session opens/closes to update status.
     */
    @Query("""
        SELECT e FROM FloorPlanElement e
        JOIN e.floorPlan fp
        WHERE fp.business.id = :businessId
          AND e.businessTable.id = :tableId
        """)
    List<FloorPlanElement> findByBusinessIdAndTableId(
            @Param("businessId") String businessId,
            @Param("tableId") String tableId);
}
