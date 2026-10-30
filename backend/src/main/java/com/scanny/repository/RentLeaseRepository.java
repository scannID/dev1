package com.scanny.repository;

import com.scanny.entity.RentLease;
import com.scanny.model.enums.RentLeaseStatus;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface RentLeaseRepository extends JpaRepository<RentLease, String> {

    /** Active lease for a given unit, if any. */
    Optional<RentLease> findByUnit_IdAndStatus(String unitId, RentLeaseStatus status);

    /** All leases for a tenant, newest first. */
    List<RentLease> findByTenant_IdOrderByActivationDateDesc(String tenantId);

    /** Leases that are ACTIVE and whose leaseEnd date is before or on today — candidates for expiry. */
    @Query("SELECT l FROM RentLease l WHERE l.status = 'ACTIVE' AND l.leaseEnd <= :today")
    List<RentLease> findExpiredActive(@Param("today") LocalDate today);

    /** Leases that are PENDING and whose activationDate is today or earlier — candidates for activation. */
    @Query("SELECT l FROM RentLease l WHERE l.status = 'PENDING' AND l.activationDate <= :today")
    List<RentLease> findPendingDueForActivation(@Param("today") LocalDate today);
}
