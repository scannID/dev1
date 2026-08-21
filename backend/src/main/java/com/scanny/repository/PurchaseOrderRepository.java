package com.scanny.repository;

import com.scanny.entity.PurchaseOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, String> {

    List<PurchaseOrder> findByBusiness_IdOrderByCreatedAtDesc(String businessId);

    List<PurchaseOrder> findByBusiness_IdAndStatusOrderByCreatedAtDesc(String businessId, String status);

    @Query("SELECT po FROM PurchaseOrder po LEFT JOIN FETCH po.lines WHERE po.id = :id")
    Optional<PurchaseOrder> findWithLinesById(@Param("id") String id);
}
