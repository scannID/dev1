package com.scanny.repository;

import com.scanny.entity.CatalogItem;
import java.util.Collection;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CatalogItemRepository extends JpaRepository<CatalogItem, String> {

    @Query("""
            SELECT c FROM CatalogItem c
            WHERE c.business.id = :businessId
              AND (:category IS NULL OR c.category = :category)
              AND (:available IS NULL OR c.available = :available)
              AND (
                :search IS NULL OR :search = ''
                OR LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%'))
                OR LOWER(c.category) LIKE LOWER(CONCAT('%', :search, '%'))
                OR LOWER(c.description) LIKE LOWER(CONCAT('%', :search, '%'))
              )
            """)
    Page<CatalogItem> searchByBusiness(
            @Param("businessId") String businessId,
            @Param("search") String search,
            @Param("category") String category,
            @Param("available") Boolean available,
            Pageable pageable
    );

    @Query("""
            SELECT c FROM CatalogItem c
            WHERE c.business.id = :businessId
              AND c.id IN :ids
            """)
    List<CatalogItem> findByBusinessIdAndIdIn(
            @Param("businessId") String businessId,
            @Param("ids") Collection<String> ids
    );

    List<CatalogItem> findByBusiness_IdAndAvailableTrue(String businessId);
}
