package com.scanny.repository;

import com.scanny.entity.Order;
import com.scanny.model.enums.OrderStatus;
import com.scanny.model.enums.PaymentStatus;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderRepository extends JpaRepository<Order, String> {

    /** Serialize share-paid webhooks so "order fully paid?" checks see a consistent balance. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT o FROM Order o WHERE o.id = :id")
    Optional<Order> findByIdForUpdate(@Param("id") String id);

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

    @EntityGraph(attributePaths = "items")
    List<Order> findByBusinessIdAndStatusInOrderByCreatedAtAsc(String businessId, List<OrderStatus> statuses);

    List<Order> findByTableSessionIdIn(List<UUID> tableSessionIds);

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
            SELECT o.merchantId,
                   COUNT(o),
                   COALESCE(SUM(CASE WHEN o.status = :completed THEN o.total ELSE 0 END), 0),
                   MAX(o.businessName)
            FROM Order o
            WHERE o.createdAt >= :cutoff AND o.status <> :cancelled
            GROUP BY o.merchantId
            """)
    List<Object[]> aggregateMerchantStatsSince(
            @Param("cutoff") Instant cutoff,
            @Param("cancelled") OrderStatus cancelled,
            @Param("completed") OrderStatus completed
    );

    @Query("""
            SELECT COUNT(DISTINCT o.merchantId) FROM Order o
            WHERE o.createdAt >= :cutoff
            """)
    long countDistinctMerchantsWithOrdersSince(@Param("cutoff") Instant cutoff);

    List<Order> findByCreatedAtAfterOrderByCreatedAtDesc(Instant cutoff);

    @Query("SELECT o.createdAt FROM Order o WHERE o.createdAt >= :cutoff")
    List<Instant> findCreatedAtsAfter(@Param("cutoff") Instant cutoff);

    @Query("""
            SELECT o.createdAt FROM Order o
            WHERE o.business.id = :businessId AND o.createdAt >= :cutoff
            """)
    List<Instant> findCreatedAtsByBusinessIdAfter(
            @Param("businessId") String businessId,
            @Param("cutoff") Instant cutoff
    );

    @Query("""
            SELECT o.createdAt, o.total, o.status
            FROM Order o
            WHERE o.createdAt >= :cutoff
            """)
    List<Object[]> findCreatedAtTotalStatusAfter(@Param("cutoff") Instant cutoff);

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

    @Query("""
            SELECT COUNT(o) FROM Order o
            WHERE o.business.id = :businessId
              AND o.status IN :statuses
            """)
    long countByBusinessIdAndStatusIn(
            @Param("businessId") String businessId,
            @Param("statuses") List<OrderStatus> statuses
    );

    @Query("""
            SELECT li.itemId, SUM(li.quantity)
            FROM OrderLineItem li
            WHERE li.order.business.id = :businessId
              AND li.order.status <> :cancelled
              AND li.order.createdAt >= :since
            GROUP BY li.itemId
            ORDER BY SUM(li.quantity) DESC
            """)
    List<Object[]> findPopularItemCounts(
            @Param("businessId") String businessId,
            @Param("cancelled") OrderStatus cancelled,
            @Param("since") Instant since,
            Pageable pageable
    );

    @Query("""
            SELECT COALESCE(SUM(li.quantity), 0)
            FROM OrderLineItem li
            WHERE li.itemId = :itemId
              AND li.checkInDate IS NOT NULL
              AND li.checkOutDate IS NOT NULL
              AND li.order.status <> :cancelled
              AND li.order.paymentStatus <> :refunded
              AND li.checkInDate < :checkOut
              AND li.checkOutDate > :checkIn
            """)
    long sumOverlappingLodgingUnits(
            @Param("itemId") String itemId,
            @Param("checkIn") java.time.LocalDate checkIn,
            @Param("checkOut") java.time.LocalDate checkOut,
            @Param("cancelled") OrderStatus cancelled,
            @Param("refunded") PaymentStatus refunded
    );

    /**
     * Returns all active (non-cancelled, non-refunded) lodging line items for a given
     * catalog item whose stay window overlaps today, used to surface the current guest
     * on the Booked Rooms tab.
     */
    @EntityGraph(attributePaths = "order")
    @Query("""
            SELECT li FROM OrderLineItem li
            WHERE li.itemId = :itemId
              AND li.checkInDate IS NOT NULL
              AND li.checkOutDate IS NOT NULL
              AND li.order.status <> :cancelled
              AND li.order.paymentStatus <> :refunded
              AND li.checkInDate <= :today
              AND li.checkOutDate > :today
            ORDER BY li.checkInDate ASC
            """)
    List<com.scanny.entity.OrderLineItem> findActiveBookingLinesForItem(
            @Param("itemId") String itemId,
            @Param("today") java.time.LocalDate today,
            @Param("cancelled") OrderStatus cancelled,
            @Param("refunded") PaymentStatus refunded
    );

    /**
     * Returns all non-cancelled lodging lines for a business where checkout date
     * is on or before today and the room is not yet freed (OCCUPIED or BOOKED status
     * rooms will be found by the scheduler).
     */
    @EntityGraph(attributePaths = "order")
    @Query("""
            SELECT li FROM OrderLineItem li
            WHERE li.order.business.id = :businessId
              AND li.checkOutDate IS NOT NULL
              AND li.checkOutDate <= :today
              AND li.order.status <> :cancelled
              AND li.order.paymentStatus <> :refunded
            ORDER BY li.checkOutDate ASC
            """)
    List<com.scanny.entity.OrderLineItem> findOverdueCheckoutLines(
            @Param("businessId") String businessId,
            @Param("today") java.time.LocalDate today,
            @Param("cancelled") OrderStatus cancelled,
            @Param("refunded") PaymentStatus refunded
    );

    /**
     * Finds the nearest upcoming booking line for a room item (checkIn > today).
     * Used for BOOKED rooms where the guest has not yet arrived.
     */
    @EntityGraph(attributePaths = "order")
    @Query("""
            SELECT li FROM OrderLineItem li
            WHERE li.itemId = :itemId
              AND li.checkInDate IS NOT NULL
              AND li.checkInDate > :today
              AND li.order.status <> :cancelled
              AND li.order.paymentStatus <> :refunded
            ORDER BY li.checkInDate ASC
            """)
    List<com.scanny.entity.OrderLineItem> findUpcomingBookingLinesForItem(
            @Param("itemId") String itemId,
            @Param("today") java.time.LocalDate today,
            @Param("cancelled") OrderStatus cancelled,
            @Param("refunded") PaymentStatus refunded
    );
}
