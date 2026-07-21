package com.scanny.service;

import com.scanny.entity.Business;
import com.scanny.entity.QrScanEvent;
import com.scanny.exception.ApiException;
import com.scanny.repository.BusinessRepository;
import com.scanny.repository.QrScanEventRepository;
import java.time.Duration;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class QrScanService {
    private static final Duration DEDUPE_WINDOW = Duration.ofSeconds(15);

    private final QrScanEventRepository qrScanEventRepository;
    private final BusinessRepository businessRepository;
    private final BusinessService businessService;

    public QrScanService(
            QrScanEventRepository qrScanEventRepository,
            BusinessRepository businessRepository,
            BusinessService businessService
    ) {
        this.qrScanEventRepository = qrScanEventRepository;
        this.businessRepository = businessRepository;
        this.businessService = businessService;
    }

    @Transactional
    public void recordMenuScan(String businessId, String qrToken, String userAgent) {
        Business business = businessService.requireBusiness(businessId);
        saveScan(business.getId(), qrToken != null ? qrToken.trim() : business.getQrToken(), userAgent);
    }

    @Transactional
    public void recordScanByQrToken(String qrToken, String userAgent) {
        Business business = businessRepository.findWithItemsByQrToken(qrToken)
                .orElseThrow(() -> new ApiException(404, "QR code was not found."));
        saveScan(business.getId(), qrToken, userAgent);
    }

    private void saveScan(String businessId, String qrToken, String userAgent) {
        String normalizedToken = qrToken != null ? qrToken.trim() : "";
        String normalizedAgent = trimUserAgent(userAgent);
        Instant now = Instant.now();

        boolean duplicate = qrScanEventRepository
                .findTopByBusinessIdAndQrTokenAndUserAgentOrderByScannedAtDesc(
                        businessId,
                        normalizedToken,
                        normalizedAgent
                )
                .map(existing -> Duration.between(existing.getScannedAt(), now).abs().compareTo(DEDUPE_WINDOW) < 0)
                .orElse(false);
        if (duplicate) {
            return;
        }

        QrScanEvent event = new QrScanEvent();
        event.setBusinessId(businessId);
        event.setQrToken(normalizedToken);
        event.setScannedAt(now);
        event.setUserAgent(normalizedAgent);
        qrScanEventRepository.save(event);
    }

    private static String trimUserAgent(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return "";
        }
        return userAgent.length() > 512 ? userAgent.substring(0, 512) : userAgent.trim();
    }
}
