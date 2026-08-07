package com.scanny.repository;

import com.scanny.entity.FloorPlanElementStatus;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FloorPlanElementStatusRepository extends JpaRepository<FloorPlanElementStatus, String> {

    List<FloorPlanElementStatus> findByElementIdIn(Collection<String> elementIds);

    /**
     * Bulk-fetch all statuses for every element in a given floor plan.
     * Used to build the live snapshot efficiently in one query.
     */
    @Query("""
        SELECT s FROM FloorPlanElementStatus s
        JOIN s.element e
        WHERE e.floorPlan.id = :planId
        """)
    List<FloorPlanElementStatus> findByFloorPlanId(@Param("planId") String planId);
}
