package com.scanny.repository;

import com.scanny.entity.RecipeLine;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RecipeLineRepository extends JpaRepository<RecipeLine, Long> {

    /** Currently active lines for a catalog item (effectiveTo IS NULL). */
    @Query("SELECT r FROM RecipeLine r JOIN FETCH r.ingredient WHERE r.catalogItem.id = :itemId AND r.effectiveTo IS NULL ORDER BY r.id ASC")
    List<RecipeLine> findActiveByItemId(@Param("itemId") String itemId);

    /** Lines active at a specific point in time — used for historical COGS. */
    @Query("""
        SELECT r FROM RecipeLine r JOIN FETCH r.ingredient
        WHERE r.catalogItem.id = :itemId
          AND r.effectiveFrom <= :asOf
          AND (r.effectiveTo IS NULL OR r.effectiveTo > :asOf)
        ORDER BY r.id ASC
        """)
    List<RecipeLine> findActiveAtTime(@Param("itemId") String itemId, @Param("asOf") Instant asOf);

    /** All lines (all versions) for a catalog item — for version history display. */
    List<RecipeLine> findByCatalogItem_IdOrderByIdAsc(String catalogItemId);

    /** All active lines for a business — used by variance report. */
    @Query("SELECT r FROM RecipeLine r JOIN FETCH r.ingredient WHERE r.catalogItem.business.id = :businessId AND r.effectiveTo IS NULL")
    List<RecipeLine> findActiveByCatalogItem_BusinessId(@Param("businessId") String businessId);

    /** Keep for backward compatibility — delegates to active lines. */
    default List<RecipeLine> findByCatalogItem_BusinessId(String businessId) {
        return findActiveByCatalogItem_BusinessId(businessId);
    }

    /** Bulk fetch active lines for a set of catalog item ids — used by consumeForPaidOrder. */
    @Query("""
        SELECT r FROM RecipeLine r
        JOIN FETCH r.ingredient
        JOIN FETCH r.catalogItem
        WHERE r.catalogItem.id IN :itemIds
          AND r.effectiveTo IS NULL
        """)
    List<RecipeLine> findByCatalogItemIdInWithIngredient(@Param("itemIds") Collection<String> itemIds);

    /** Stamp effectiveTo on all currently active lines for a catalog item — called before inserting new version. */
    @Modifying
    @Query("UPDATE RecipeLine r SET r.effectiveTo = :now WHERE r.catalogItem.id = :itemId AND r.effectiveTo IS NULL")
    void expireActiveLines(@Param("itemId") String itemId, @Param("now") Instant now);

    /** Max recipe_version for a catalog item — used to increment on save. */
    @Query("SELECT COALESCE(MAX(r.recipeVersion), 0) FROM RecipeLine r WHERE r.catalogItem.id = :itemId")
    int maxVersionForItem(@Param("itemId") String itemId);

    /** Legacy hard-delete — kept for test/seed code only. DO NOT call from production paths. */
    void deleteByCatalogItem_Id(String catalogItemId);
}
