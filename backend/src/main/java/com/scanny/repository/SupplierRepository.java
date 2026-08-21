package com.scanny.repository;

import com.scanny.entity.Supplier;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface SupplierRepository extends JpaRepository<Supplier, String> {
    List<Supplier> findByBusiness_IdAndActiveTrueOrderByNameAsc(String businessId);
    List<Supplier> findByBusiness_IdOrderByNameAsc(String businessId);
    boolean existsByBusiness_IdAndNameIgnoreCase(String businessId, String name);
}
