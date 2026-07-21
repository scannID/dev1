package com.scanny.repository;

import com.scanny.entity.QrScanEvent;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface QrScanEventRepository extends JpaRepository<QrScanEvent, Long> {

    List<QrScanEvent> findAllByOrderByScannedAtDesc();
    Optional<QrScanEvent> findTopByBusinessIdAndQrTokenAndUserAgentOrderByScannedAtDesc(
            String businessId,
            String qrToken,
            String userAgent
    );
}
