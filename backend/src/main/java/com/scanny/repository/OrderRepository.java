package com.scanny.repository;

import com.scanny.entity.Order;
import com.scanny.model.enums.OrderStatus;
import com.scanny.model.enums.PaymentStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderRepository extends JpaRepository<Order, String> {

    @EntityGraph(attributePaths = "items")
    List<Order> findByBusinessIdOrderByCreatedAtDesc(String businessId);

    @EntityGraph(attributePaths = "items")
    @Query("""
            SELECT o FROM Order o
            WHERE o.business.id = :businessId
              AND (:status IS NULL OR o.status = :status)
              AND (:paymentStatus IS NULL OR o.paymentStatus = :paymentStatus)
              AND (
                :search IS NULL OR :search = ''
                OR LOWER(o.id) LIKE LOWER(CONCAT('%', :search, '%'))
                OR LOWER(o.customerName) LIKE LOWER(CONCAT('%', :search, '%'))
                OR LOWER(COALESCE(o.customerPhone, '')) LIKE LOWER(CONCAT('%', :search, '%'))
              )
            """)
    Page<Order> searchByBusiness(
            @Param("businessId") String businessId,
            @Param("search") String search,
            @Param("status") OrderStatus status,
            @Param("paymentStatus") PaymentStatus paymentStatus,
            Pageable pageable
    );

    @EntityGraph(attributePaths = "items")
    Optional<Order> findWithItemsById(String id);

    @EntityGraph(attributePaths = "items")
    Optional<Order> findWithItemsByPublicId(UUID publicId);
}
