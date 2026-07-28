package com.scanny.repository;

import com.scanny.entity.OrderFeedback;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderFeedbackRepository extends JpaRepository<OrderFeedback, Long> {

    boolean existsByOrderId(String orderId);

    List<OrderFeedback> findByBusinessIdOrderByCreatedAtDesc(String businessId);
}
