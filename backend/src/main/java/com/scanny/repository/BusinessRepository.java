package com.scanny.repository;

import com.scanny.entity.Business;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BusinessRepository extends JpaRepository<Business, String> {

    @EntityGraph(attributePaths = "items")
    List<Business> findAll();

    @EntityGraph(attributePaths = "items")
    Optional<Business> findWithItemsById(String id);

    @EntityGraph(attributePaths = "items")
    Optional<Business> findWithItemsByQrToken(String qrToken);

    Optional<Business> findByQrToken(String qrToken);

    @EntityGraph(attributePaths = "items")
    Optional<Business> findWithItemsByMerchantId(String merchantId);

    Optional<Business> findByMerchantId(String merchantId);

    List<Business> findByMerchantIdOrderByPrimaryDescBranchLabelAsc(String merchantId);

    long countByMerchantId(String merchantId);

    boolean existsById(String id);

    long countByCreatedAtAfter(Instant cutoff);

    long countByCreatedAtGreaterThanEqualAndCreatedAtBefore(Instant start, Instant end);

    long countByCreatedAtLessThanEqual(Instant cutoff);

    List<Business> findByCreatedAtAfterOrderByCreatedAtDesc(Instant cutoff, Pageable pageable);

    List<Business> findByCreatedAtGreaterThanEqual(Instant cutoff);

    @Query("SELECT COUNT(b) FROM Business b WHERE b.createdAt <= :dayEnd")
    long countCreatedOnOrBefore(@Param("dayEnd") Instant dayEnd);

    @Query("SELECT b FROM Business b WHERE b.merchantId IN :merchantIds OR b.id IN :merchantIds")
    List<Business> findByMerchantIdInOrIdIn(@Param("merchantIds") List<String> merchantIds);
}
