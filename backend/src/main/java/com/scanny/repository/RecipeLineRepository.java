package com.scanny.repository;

import com.scanny.entity.RecipeLine;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RecipeLineRepository extends JpaRepository<RecipeLine, Long> {

    List<RecipeLine> findByCatalogItem_IdOrderByIdAsc(String catalogItemId);

    List<RecipeLine> findByCatalogItem_BusinessId(String businessId);

    @Query("""
            SELECT r FROM RecipeLine r
            JOIN FETCH r.ingredient
            JOIN FETCH r.catalogItem
            WHERE r.catalogItem.id IN :itemIds
            """)
    List<RecipeLine> findByCatalogItemIdInWithIngredient(@Param("itemIds") Collection<String> itemIds);

    void deleteByCatalogItem_Id(String catalogItemId);
}
