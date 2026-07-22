package com.scanny.service;

import com.scanny.entity.Business;
import com.scanny.entity.QrScanEvent;
import com.scanny.exception.ApiException;
import com.scanny.repository.BusinessRepository;
import com.scanny.repository.QrScanEventRepository;
import com.scanny.websocket.RealtimeEventPublisher;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class QrScanService {
    /** Collapse duplicate hits from StrictMode remounts, prefetch, and double GETs. */
    private static final Duration DEDUPE_WINDOW = Duration.ofSeconds(45);

    private final QrScanEventRepository qrScanEventRepository;
    private final BusinessRepository businessRepository;
    private final BusinessService businessService;
    private final RealtimeEventPublisher realtimeEventPublisher;
    private final ConcurrentHashMap<String, Object> dedupeLocks = new ConcurrentHashMap<>();

    public QrScanService(
            QrScanEventRepository qrScanEventRepository,
            BusinessRepository businessRepository,
            BusinessService businessService,
            RealtimeEventPublisher realtimeEventPublisher
    ) {
        this.qrScanEventRepository = qrScanEventRepository;
        this.businessRepository = businessRepository;
        this.businessService = businessService;
        this.realtimeEventPublisher = realtimeEventPublisher;
    }

    @Transactional
    public boolean recordMenuScan(String businessId, String qrToken, String userAgent) {
        Business business = businessService.requireBusiness(businessId);
        return saveScan(business.getId(), qrToken != null ? qrToken.trim() : business.getQrToken(), userAgent);
    }

    @Transactional
    public boolean recordScanByQrToken(String qrToken, String userAgent) {
        Business business = businessRepository.findWithItemsByQrToken(qrToken)
                .orElseThrow(() -> new ApiException(404, "QR code was not found."));
        return saveScan(business.getId(), qrToken, userAgent);
    }

    private boolean saveScan(String businessId, String qrToken, String userAgent) {
        String normalizedToken = qrToken != null ? qrToken.trim() : "";
        String normalizedAgent = trimUserAgent(userAgent);
        String lockKey = businessId + "|" + normalizedAgent;
        Object lock = dedupeLocks.computeIfAbsent(lockKey, key -> new Object());

        synchronized (lock) {
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
                return false;
            }

            // Collapse same-device hits when qr query param is missing/different.
            boolean recentSameDevice = qrScanEventRepository
                    .findTopByBusinessIdAndUserAgentOrderByScannedAtDesc(businessId, normalizedAgent)
                    .map(existing -> Duration.between(existing.getScannedAt(), now).abs().compareTo(DEDUPE_WINDOW) < 0)
                    .orElse(false);
            if (recentSameDevice) {
                return false;
            }

            QrScanEvent event = new QrScanEvent();
            event.setBusinessId(businessId);
            event.setQrToken(normalizedToken);
            event.setScannedAt(now);
            event.setUserAgent(normalizedAgent);
            QrScanEvent saved = qrScanEventRepository.save(event);

            realtimeEventPublisher.publishAdminMetrics(
                    "QR_SCAN_RECORDED",
                    Map.of(
                            "businessId", businessId,
                            "qrToken", normalizedToken,
                            "scannedAt", saved.getScannedAt().toString()
                    )
            );
            return true;
        }
    }

    private static String trimUserAgent(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return "";
        }
        return userAgent.length() > 512 ? userAgent.substring(0, 512) : userAgent.trim();
    }
}
