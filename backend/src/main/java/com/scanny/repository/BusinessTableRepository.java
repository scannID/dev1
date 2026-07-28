package com.scanny.repository;

import com.scanny.entity.BusinessTable;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BusinessTableRepository extends JpaRepository<BusinessTable, String> {

    List<BusinessTable> findByBusinessIdOrderByLabelAsc(String businessId);

    Optional<BusinessTable> findByQrToken(String qrToken);

    Optional<BusinessTable> findByBusinessIdAndId(String businessId, String id);
}
