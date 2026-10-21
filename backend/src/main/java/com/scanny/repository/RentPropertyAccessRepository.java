package com.scanny.repository;

import com.scanny.entity.RentPropertyAccess;
import com.scanny.model.enums.PropertyAccessRole;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RentPropertyAccessRepository extends JpaRepository<RentPropertyAccess, Long> {

    Optional<RentPropertyAccess> findByAccount_IdAndProperty_Id(String accountId, String propertyId);

    List<RentPropertyAccess> findByAccount_Id(String accountId);

    List<RentPropertyAccess> findByProperty_Id(String propertyId);

    boolean existsByAccount_IdAndProperty_Id(String accountId, String propertyId);

    boolean existsByAccount_IdAndProperty_IdAndRoleIn(
            String accountId, String propertyId, List<PropertyAccessRole> roles);
}
