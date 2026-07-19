package com.scanny.repository;

import com.scanny.entity.Business;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BusinessRepository extends JpaRepository<Business, String> {

    @EntityGraph(attributePaths = "items")
    List<Business> findAll();

    @EntityGraph(attributePaths = "items")
    Optional<Business> findWithItemsById(String id);

    @EntityGraph(attributePaths = "items")
    Optional<Business> findWithItemsByQrToken(String qrToken);

    @EntityGraph(attributePaths = "items")
    Optional<Business> findWithItemsByMerchantId(String merchantId);

    Optional<Business> findByMerchantId(String merchantId);

    boolean existsById(String id);
}
