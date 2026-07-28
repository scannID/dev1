package com.scanny.repository;

import com.scanny.entity.TableSessionOrder;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TableSessionOrderRepository extends JpaRepository<TableSessionOrder, TableSessionOrder.Pk> {

    List<TableSessionOrder> findBySessionId(UUID sessionId);

    List<TableSessionOrder> findBySessionIdIn(List<UUID> sessionIds);

    boolean existsBySessionIdAndOrderId(UUID sessionId, String orderId);
}
