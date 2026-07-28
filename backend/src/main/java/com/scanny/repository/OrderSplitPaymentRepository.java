package com.scanny.repository;

import com.scanny.entity.OrderSplitPayment;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderSplitPaymentRepository extends JpaRepository<OrderSplitPayment, UUID> {

    List<OrderSplitPayment> findBySplitGroupIdOrderByCreatedAtAsc(UUID splitGroupId);

    List<OrderSplitPayment> findByOrderId(String orderId);

    List<OrderSplitPayment> findByOrderIdOrderByCreatedAtAsc(String orderId);
}
