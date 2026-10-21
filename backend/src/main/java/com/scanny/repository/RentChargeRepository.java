package com.scanny.repository;

import com.scanny.entity.RentCharge;
import com.scanny.model.enums.RentChargeStatus;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface RentChargeRepository extends JpaRepository<RentCharge, Long> {

    Optional<RentCharge> findByTenant_IdAndPeriodLabel(String tenantId, String periodLabel);

    List<RentCharge> findByTenant_IdOrderByDueDateDesc(String tenantId);

    List<RentCharge> findByUnit_IdOrderByDueDateDesc(String unitId);

    List<RentCharge> findByTenant_IdAndStatus(String tenantId, RentChargeStatus status);

    /** All charges for a property in a given period — used by dashboard period summary. */
    @Query("""
        SELECT c FROM RentCharge c
        JOIN c.unit u
        WHERE u.property.id = :propertyId
          AND c.periodLabel = :periodLabel
        ORDER BY u.unitNumber ASC, c.dueDate ASC
        """)
    List<RentCharge> findByPropertyIdAndPeriodLabel(
            @Param("propertyId") String propertyId,
            @Param("periodLabel") String periodLabel);

    /** Overdue charges: status UNPAID or PARTIAL, due date in the past — scoped to one property. */
    @Query("""
        SELECT c FROM RentCharge c
        JOIN c.unit u
        WHERE u.property.id = :propertyId
          AND c.status IN ('UNPAID', 'PARTIAL')
          AND c.dueDate < :today
        ORDER BY c.dueDate ASC
        """)
    List<RentCharge> findOverdueByPropertyId(
            @Param("propertyId") String propertyId,
            @Param("today") LocalDate today);

    /**
     * Platform-wide overdue charges — UNPAID or PARTIAL with due date before today.
     * Used by the scheduler to bulk-update status to OVERDUE.
     */
    @Query("""
        SELECT c FROM RentCharge c
        WHERE c.status IN ('UNPAID', 'PARTIAL')
          AND c.dueDate < :today
        """)
    List<RentCharge> findAllOverdue(@Param("today") LocalDate today);

    /**
     * Charges due within the next N days that are still UNPAID or PARTIAL.
     * Used by the reminder scheduler to send upcoming-due reminders.
     */
    @Query("""
        SELECT c FROM RentCharge c
        WHERE c.status IN ('UNPAID', 'PARTIAL')
          AND c.dueDate >= :from
          AND c.dueDate <= :to
        """)
    List<RentCharge> findDueSoon(
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    /**
     * All charges for a given period label across all properties.
     * Used by the monthly charge auto-generator.
     */
    @Query("""
        SELECT c FROM RentCharge c
        WHERE c.periodLabel = :periodLabel
        """)
    List<RentCharge> findByPeriodLabel(@Param("periodLabel") String periodLabel);

    /**
     * All active tenant IDs that already have a charge for the given period.
     * Used by the scheduler to skip tenants already charged.
     */
    @Query("""
        SELECT c.tenant.id FROM RentCharge c
        WHERE c.periodLabel = :periodLabel
        """)
    List<String> findTenantIdsWithChargeForPeriod(@Param("periodLabel") String periodLabel);

    boolean existsByTenant_IdAndPeriodLabel(String tenantId, String periodLabel);
}
