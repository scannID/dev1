package com.scanit.repository;

import com.scanit.entity.DeviceTransaction;
import com.scanit.model.enums.TransactionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface DeviceTransactionRepository extends JpaRepository<DeviceTransaction, Long> {
    
    List<DeviceTransaction> findByDeviceId(String deviceId);
    
    List<DeviceTransaction> findByDeviceIdOrderByCreatedAtDesc(String deviceId);
    
    List<DeviceTransaction> findByReferenceIdAndReferenceType(String referenceId, String referenceType);
    
    List<DeviceTransaction> findByPhoneNumber(String phoneNumber);
    
    List<DeviceTransaction> findByStatus(TransactionStatus status);
    
    long countByDeviceIdAndStatus(String deviceId, TransactionStatus status);
}
