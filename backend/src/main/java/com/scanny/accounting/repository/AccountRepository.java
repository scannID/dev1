package com.scanny.accounting.repository;

import com.scanny.accounting.entity.Account;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface AccountRepository extends JpaRepository<Account, Integer> {
    Optional<Account> findByCode(String code);
    Optional<Account> findByCodeAndIsActiveTrue(String code);
}
