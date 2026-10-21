package com.scanny.repository;

import com.scanny.entity.RentProperty;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface RentPropertyRepository extends JpaRepository<RentProperty, String> {

    Optional<RentProperty> findByQrToken(String qrToken);

    boolean existsByQrToken(String qrToken);

    /** All properties where the given account has ANY access role. */
    @Query("""
        SELECT p FROM RentProperty p
        JOIN RentPropertyAccess a ON a.property = p
        WHERE a.account.id = :accountId
        ORDER BY p.name ASC
        """)
    List<RentProperty> findAllByAccountId(@Param("accountId") String accountId);

    /** Properties where the given account is the registered owner account. */
    List<RentProperty> findByOwnerAccount_IdOrderByNameAsc(String ownerAccountId);
}
