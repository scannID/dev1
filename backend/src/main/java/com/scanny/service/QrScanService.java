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
import java.util.concurrent.TimeUnit;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class QrScanService {
    /** Collapse duplicate hits from StrictMode remounts, prefetch, and double GETs. */
    private static final Duration DEDUPE_WINDOW = Duration.ofSeconds(45);

    private final QrScanEventRepository qrScanEventRepository;
    private final BusinessRepository businessRepository;
    private final BusinessService businessService;
    private final OutboxService outboxService;
    private final RealtimeEventPublisher realtimeEventPublisher;
    private final StringRedisTemplate redisTemplate;

    public QrScanService(
            QrScanEventRepository qrScanEventRepository,
            BusinessRepository businessRepository,
            BusinessService businessService,
            OutboxService outboxService,
            RealtimeEventPublisher realtimeEventPublisher,
            ObjectProvider<StringRedisTemplate> redisTemplateProvider
    ) {
        this.qrScanEventRepository = qrScanEventRepository;
        this.businessRepository = businessRepository;
        this.businessService = businessService;
        this.outboxService = outboxService;
        this.realtimeEventPublisher = realtimeEventPublisher;
        this.redisTemplate = redisTemplateProvider.getIfAvailable();
    }

    @Transactional
    public boolean recordMenuScan(String businessId, String qrToken, String userAgent) {
        Business business = businessService.requireBusinessLight(businessId);
        return saveScan(business.getId(), qrToken != null ? qrToken.trim() : business.getQrToken(), userAgent);
    }

    @Transactional
    public boolean recordScanByQrToken(String qrToken, String userAgent) {
        Business business = businessRepository.findByQrToken(qrToken)
                .orElseThrow(() -> new ApiException(404, "QR code was not found."));
        return saveScan(business.getId(), qrToken, userAgent);
    }

    private boolean saveScan(String businessId, String qrToken, String userAgent) {
        String normalizedToken = qrToken != null ? qrToken.trim() : "";
        String normalizedAgent = trimUserAgent(userAgent);

        if (!tryAcquireDedupe(businessId, normalizedToken, normalizedAgent)) {
            return false;
        }

        Instant now = Instant.now();
        QrScanEvent event = new QrScanEvent();
        event.setBusinessId(businessId);
        event.setQrToken(normalizedToken);
        event.setScannedAt(now);
        event.setUserAgent(normalizedAgent);
        QrScanEvent saved = qrScanEventRepository.save(event);

        Map<String, Object> body = Map.of(
                "businessId", businessId,
                "qrToken", normalizedToken,
                "scannedAt", saved.getScannedAt().toString()
        );

        // Durable fan-out for multi-node / retry.
        outboxService.enqueueRealtime("admin:metrics", "QR_SCAN_RECORDED", businessId, body);
        outboxService.enqueueRealtime("metrics:" + businessId, "QR_SCAN_RECORDED", businessId, body);

        // Immediate push after commit so admin/merchant charts update without waiting for outbox poll.
        Runnable publishNow = () -> {
            realtimeEventPublisher.publish("admin:metrics", "QR_SCAN_RECORDED", businessId, body);
            realtimeEventPublisher.publish("metrics:" + businessId, "QR_SCAN_RECORDED", businessId, body);
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    publishNow.run();
                }
            });
        } else {
            publishNow.run();
        }
        return true;
    }

    private boolean tryAcquireDedupe(String businessId, String qrToken, String userAgent) {
        if (redisTemplate != null) {
            try {
                String key = "qrscan:dedupe:" + businessId + ":" + userAgent.hashCode() + ":" + qrToken.hashCode();
                Boolean acquired = redisTemplate.opsForValue()
                        .setIfAbsent(key, "1", DEDUPE_WINDOW.getSeconds(), TimeUnit.SECONDS);
                return Boolean.TRUE.equals(acquired);
            } catch (Exception ignored) {
                // fall through to DB dedupe
            }
        }

        Instant now = Instant.now();
        boolean duplicate = qrScanEventRepository
                .findTopByBusinessIdAndQrTokenAndUserAgentOrderByScannedAtDesc(businessId, qrToken, userAgent)
                .map(existing -> Duration.between(existing.getScannedAt(), now).abs().compareTo(DEDUPE_WINDOW) < 0)
                .orElse(false);
        if (duplicate) {
            return false;
        }
        boolean recentSameDevice = qrScanEventRepository
                .findTopByBusinessIdAndUserAgentOrderByScannedAtDesc(businessId, userAgent)
                .map(existing -> Duration.between(existing.getScannedAt(), now).abs().compareTo(DEDUPE_WINDOW) < 0)
                .orElse(false);
        return !recentSameDevice;
    }

    private static String trimUserAgent(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return "";
        }
        return userAgent.length() > 512 ? userAgent.substring(0, 512) : userAgent.trim();
    }
}
