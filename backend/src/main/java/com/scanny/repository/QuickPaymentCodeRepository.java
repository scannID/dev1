package com.scanny.repository;

import com.scanny.entity.QuickPaymentCode;
import com.scanny.model.enums.QuickPaymentCodeStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface QuickPaymentCodeRepository extends JpaRepository<QuickPaymentCode, String> {
    
    Optional<QuickPaymentCode> findByQrToken(String qrToken);
    
    List<QuickPaymentCode> findByStatus(QuickPaymentCodeStatus status);
    
    List<QuickPaymentCode> findByMerchantId(String merchantId);
    
    List<QuickPaymentCode> findByBusinessId(String businessId);
    
    List<QuickPaymentCode> findByOwnerPhone(String ownerPhone);
}
