package com.scanny.repository;

import com.scanny.entity.RentUnit;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RentUnitRepository extends JpaRepository<RentUnit, String> {

    List<RentUnit> findByProperty_IdOrderByUnitNumberAsc(String propertyId);

    Optional<RentUnit> findByQrToken(String qrToken);

    boolean existsByQrToken(String qrToken);

    boolean existsByProperty_IdAndUnitNumber(String propertyId, String unitNumber);
}
