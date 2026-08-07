package com.scanny.repository;

import com.scanny.entity.FloorPlanTemplate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FloorPlanTemplateRepository extends JpaRepository<FloorPlanTemplate, String> {

    /**
     * Returns global templates (business_id IS NULL) plus any custom templates
     * belonging to the given business, ordered by sort_order.
     */
    @Query("""
        SELECT t FROM FloorPlanTemplate t
        WHERE t.business IS NULL OR t.business.id = :businessId
        ORDER BY t.sortOrder ASC, t.name ASC
        """)
    List<FloorPlanTemplate> findGlobalAndByBusinessId(@Param("businessId") String businessId);
}
