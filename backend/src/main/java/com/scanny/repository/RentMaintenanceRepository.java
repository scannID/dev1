package com.scanny.repository;

import com.scanny.entity.RentMaintenanceRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface RentMaintenanceRepository extends JpaRepository<RentMaintenanceRequest, String> {

    @Query("SELECT r FROM RentMaintenanceRequest r WHERE r.property.id = :propertyId ORDER BY r.submittedAt DESC")
    List<RentMaintenanceRequest> findByPropertyIdOrderBySubmittedAtDesc(@Param("propertyId") String propertyId);

    @Query("SELECT r FROM RentMaintenanceRequest r WHERE r.unit.id = :unitId ORDER BY r.submittedAt DESC")
    List<RentMaintenanceRequest> findByUnitIdOrderBySubmittedAtDesc(@Param("unitId") String unitId);
}
