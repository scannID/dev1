package com.scanny.accounting.repository;

import com.scanny.accounting.entity.AccountingPeriod;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface AccountingPeriodRepository extends JpaRepository<AccountingPeriod, Long> {

    Optional<AccountingPeriod> findByPeriodLabel(String periodLabel);

    /** Returns the single OPEN period for today — used to resolve "current period". */
    @Query("SELECT p FROM AccountingPeriod p WHERE p.status = 'OPEN' ORDER BY p.periodLabel DESC")
    java.util.List<AccountingPeriod> findOpenPeriods();
}
