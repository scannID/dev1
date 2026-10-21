package com.scanny.repository;

import com.scanny.entity.RentTenant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RentTenantRepository extends JpaRepository<RentTenant, String> {

    Optional<RentTenant> findByPayToken(String payToken);

    /** Active tenant for a unit (at most one). */
    Optional<RentTenant> findByUnit_IdAndActiveTrue(String unitId);

    /** All tenants (active + past) for a unit. */
    List<RentTenant> findByUnit_IdOrderByCreatedAtDesc(String unitId);

    /** All active tenants across the platform — used by the charge scheduler. */
    List<RentTenant> findByActiveTrue();

    boolean existsByPayToken(String payToken);
}
