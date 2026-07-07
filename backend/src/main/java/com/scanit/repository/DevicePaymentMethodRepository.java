package com.scanit.repository;

import com.scanit.entity.DevicePaymentMethod;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface DevicePaymentMethodRepository extends JpaRepository<DevicePaymentMethod, Long> {
    
    List<DevicePaymentMethod> findByDeviceId(String deviceId);
    
    List<DevicePaymentMethod> findByDeviceIdAndIsVerifiedTrue(String deviceId);
    
    Optional<DevicePaymentMethod> findByDeviceIdAndIsDefaultTrue(String deviceId);
    
    List<DevicePaymentMethod> findByPhoneNumber(String phoneNumber);
    
    boolean existsByDeviceIdAndPhoneNumber(String deviceId, String phoneNumber);
}
