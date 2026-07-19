package com.scanny.repository;

import com.scanny.entity.RegisteredDevice;
import com.scanny.model.enums.DeviceStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface RegisteredDeviceRepository extends JpaRepository<RegisteredDevice, String> {
    
    Optional<RegisteredDevice> findByDeviceId(String deviceId);
    
    List<RegisteredDevice> findByPrimaryPhone(String primaryPhone);
    
    List<RegisteredDevice> findBySecondaryPhone(String secondaryPhone);
    
    List<RegisteredDevice> findByStatus(DeviceStatus status);
    
    boolean existsByDeviceId(String deviceId);
}
