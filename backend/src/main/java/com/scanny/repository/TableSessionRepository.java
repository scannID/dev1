package com.scanny.repository;

import com.scanny.entity.TableSession;
import com.scanny.model.enums.TableSessionStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TableSessionRepository extends JpaRepository<TableSession, UUID> {

    List<TableSession> findByBusinessIdAndStatusOrderByOpenedAtDesc(String businessId, TableSessionStatus status);

    Optional<TableSession> findByTableIdAndStatus(String tableId, TableSessionStatus status);
}
