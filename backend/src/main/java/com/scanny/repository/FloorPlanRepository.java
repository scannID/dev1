package com.scanny.repository;

import com.scanny.entity.FloorPlan;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FloorPlanRepository extends JpaRepository<FloorPlan, String> {

    List<FloorPlan> findByBusinessIdOrderByCreatedAtAsc(String businessId);

    @Query("SELECT fp FROM FloorPlan fp LEFT JOIN FETCH fp.elements WHERE fp.id = :id")
    Optional<FloorPlan> findWithElementsById(@Param("id") String id);

    boolean existsByIdAndBusinessId(String id, String businessId);
}
