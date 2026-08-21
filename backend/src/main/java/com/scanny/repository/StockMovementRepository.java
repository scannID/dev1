package com.scanny.repository;

import com.scanny.entity.StockMovement;
import com.scanny.model.enums.StockMovementType;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StockMovementRepository extends JpaRepository<StockMovement, Long> {

    List<StockMovement> findByBusiness_IdOrderByCreatedAtDesc(String businessId, Pageable pageable);

    List<StockMovement> findByIngredient_IdOrderByCreatedAtDesc(String ingredientId, Pageable pageable);

    boolean existsByOrderId(String orderId);

    List<StockMovement> findByBusiness_IdAndMovementTypeAndCreatedAtBetween(
        String businessId, StockMovementType movementType,
        Instant from, Instant to
    );
}
