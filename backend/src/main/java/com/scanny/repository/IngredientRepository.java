package com.scanny.repository;

import com.scanny.entity.Ingredient;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IngredientRepository extends JpaRepository<Ingredient, String> {

    List<Ingredient> findByBusiness_IdAndActiveTrueOrderByNameAsc(String businessId);

    List<Ingredient> findByBusiness_IdOrderByNameAsc(String businessId);

    Optional<Ingredient> findByIdAndBusiness_Id(String id, String businessId);

    boolean existsByBusiness_IdAndNameIgnoreCase(String businessId, String name);

    Optional<Ingredient> findByBusiness_IdAndNameIgnoreCase(String businessId, String name);
}
