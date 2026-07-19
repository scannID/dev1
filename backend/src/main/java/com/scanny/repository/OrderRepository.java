package com.scanny.repository;

import com.scanny.entity.Order;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderRepository extends JpaRepository<Order, String> {

    @EntityGraph(attributePaths = "items")
    List<Order> findByBusinessIdOrderByCreatedAtDesc(String businessId);

    @EntityGraph(attributePaths = "items")
    Optional<Order> findWithItemsById(String id);

    @EntityGraph(attributePaths = "items")
    Optional<Order> findWithItemsByPublicId(UUID publicId);
}
