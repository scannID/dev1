package com.scanny.repository;

import com.scanny.entity.Order;
import com.scanny.model.enums.OrderStatus;
import com.scanny.model.enums.PaymentStatus;
import java.time.Instant;
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

    long countByCreatedAtAfter(Instant cutoff);

    long countByCreatedAtGreaterThanEqualAndCreatedAtBefore(Instant start, Instant end);

    @Query("""
            SELECT COALESCE(SUM(o.total), 0) FROM Order o
            WHERE o.createdAt >= :start AND o.createdAt < :end AND o.status = :status
            """)
    long sumTotalByCreatedAtBetweenAndStatus(
            @Param("start") Instant start,
            @Param("end") Instant end,
            @Param("status") OrderStatus status
    );

    @Query("""
            SELECT COALESCE(SUM(o.total), 0) FROM Order o
            WHERE o.createdAt >= :cutoff AND o.status = :status
            """)
    long sumTotalByCreatedAtAfterAndStatus(
            @Param("cutoff") Instant cutoff,
            @Param("status") OrderStatus status
    );

    @EntityGraph(attributePaths = {"items", "business"})
    List<Order> findByCreatedAtAfterAndStatusNot(Instant cutoff, OrderStatus status);

    @Query("""
            SELECT COUNT(DISTINCT o.merchantId) FROM Order o
            WHERE o.createdAt >= :cutoff
            """)
    long countDistinctMerchantsWithOrdersSince(@Param("cutoff") Instant cutoff);

    List<Order> findByCreatedAtAfterOrderByCreatedAtDesc(Instant cutoff);

    @Query("""
            SELECT o.merchantId, COUNT(o), COALESCE(SUM(o.total), 0)
            FROM Order o
            WHERE o.status = :status
            GROUP BY o.merchantId
            """)
    List<Object[]> aggregateCompletedByMerchant(@Param("status") OrderStatus status);

    long countByStatus(OrderStatus status);

    @Query("""
            SELECT COUNT(o) FROM Order o
            WHERE o.status IN :statuses
            """)
    long countByStatusIn(@Param("statuses") List<OrderStatus> statuses);
}
