package com.scanit.repository;

import com.scanit.entity.QuickPaymentTransaction;
import com.scanit.model.enums.TransactionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface QuickPaymentTransactionRepository extends JpaRepository<QuickPaymentTransaction, Long> {
    
    Optional<QuickPaymentTransaction> findByTransactionRef(String transactionRef);
    
    List<QuickPaymentTransaction> findByCodeId(String codeId);
    
    List<QuickPaymentTransaction> findByCodeIdOrderByCreatedAtDesc(String codeId);
    
    List<QuickPaymentTransaction> findByStatus(TransactionStatus status);
    
    List<QuickPaymentTransaction> findByCustomerPhone(String customerPhone);
}
