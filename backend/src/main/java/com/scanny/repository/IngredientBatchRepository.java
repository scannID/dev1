package com.scanny.repository;

import com.scanny.entity.IngredientBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface IngredientBatchRepository extends JpaRepository<IngredientBatch, Long> {

    /** All batches for an ingredient ordered FIFO (oldest first for FIFO consumption). */
    List<IngredientBatch> findByIngredient_IdOrderByReceivedAtAsc(String ingredientId);

    /** Batches with remaining stock > 0 for a business, for expiry dashboard. */
    @Query("""
        SELECT b FROM IngredientBatch b
        WHERE b.business.id = :businessId
          AND b.qtyRemaining > 0
        ORDER BY b.expiryDate ASC NULLS LAST, b.receivedAt ASC
        """)
    List<IngredientBatch> findActiveByBusiness(@Param("businessId") String businessId);

    /** Batches expiring within N days for a business. */
    @Query("""
        SELECT b FROM IngredientBatch b
        WHERE b.business.id = :businessId
          AND b.qtyRemaining > 0
          AND b.expiryDate IS NOT NULL
          AND b.expiryDate <= :cutoff
        ORDER BY b.expiryDate ASC
        """)
    List<IngredientBatch> findExpiringBefore(
        @Param("businessId") String businessId,
        @Param("cutoff") LocalDate cutoff
    );
}
