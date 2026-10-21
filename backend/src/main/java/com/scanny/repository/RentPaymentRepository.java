package com.scanny.repository;

import com.scanny.entity.RentPayment;
import com.scanny.model.enums.RentPaymentStatus;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface RentPaymentRepository extends JpaRepository<RentPayment, Long> {

    Optional<RentPayment> findByTransactionRef(String transactionRef);

    /**
     * Fetches a payment row with a pessimistic write lock (SELECT … FOR UPDATE).
     * Use this in the webhook completion path to prevent double-processing when
     * two concurrent callbacks arrive for the same transaction reference.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM RentPayment p WHERE p.transactionRef = :ref")
    Optional<RentPayment> findByTransactionRefForUpdate(@Param("ref") String ref);

    /** Finds all PENDING payments created before a given instant (for reconciliation). */
    @Query("SELECT p FROM RentPayment p WHERE p.status = 'Pending' AND p.createdAt < :before")
    List<RentPayment> findPendingCreatedBefore(@Param("before") Instant before);

    List<RentPayment> findByCharge_IdOrderByCreatedAtDesc(Long chargeId);

    List<RentPayment> findByCharge_IdAndStatus(Long chargeId, RentPaymentStatus status);

    /** Recent payments for a property — used by the dashboard recent-activity feed. */
    @Query("""
        SELECT p FROM RentPayment p
        JOIN p.charge c
        JOIN c.unit u
        WHERE u.property.id = :propertyId
          AND p.status = 'Completed'
        ORDER BY p.paidAt DESC
        """)
    List<RentPayment> findRecentCompletedByPropertyId(
            @Param("propertyId") String propertyId,
            org.springframework.data.domain.Pageable pageable);

    /** Total collected for a property in a period. */
    @Query("""
        SELECT COALESCE(SUM(p.amount), 0)
        FROM RentPayment p
        JOIN p.charge c
        JOIN c.unit u
        WHERE u.property.id = :propertyId
          AND c.periodLabel = :periodLabel
          AND p.status = 'Completed'
        """)
    long sumCollectedByPropertyIdAndPeriod(
            @Param("propertyId") String propertyId,
            @Param("periodLabel") String periodLabel);
}
