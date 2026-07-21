package com.scanny.config;

import com.scanny.entity.Business;
import com.scanny.entity.Order;
import com.scanny.entity.QrScanEvent;
import com.scanny.repository.BusinessRepository;
import com.scanny.repository.OrderRepository;
import com.scanny.repository.QrScanEventRepository;
import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ensures historical menu visits are represented when scan logging was added after orders existed.
 */
@Component
public class QrScanBackfillRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(QrScanBackfillRunner.class);

    private final QrScanEventRepository qrScanEventRepository;
    private final OrderRepository orderRepository;
    private final BusinessRepository businessRepository;

    public QrScanBackfillRunner(
            QrScanEventRepository qrScanEventRepository,
            OrderRepository orderRepository,
            BusinessRepository businessRepository
    ) {
        this.qrScanEventRepository = qrScanEventRepository;
        this.orderRepository = orderRepository;
        this.businessRepository = businessRepository;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        List<Order> orders = orderRepository.findAll();
        if (orders.isEmpty()) {
            return;
        }

        List<QrScanEvent> existingScans = qrScanEventRepository.findAllByOrderByScannedAtDesc();
        int backfilled = 0;

        for (Order order : orders) {
            if (order.getBusiness() == null) {
                continue;
            }
            String businessId = order.getBusiness().getId();
            Instant createdAt = order.getCreatedAt();
            boolean hasNearbyScan = existingScans.stream()
                    .anyMatch(scan ->
                            businessId.equals(scan.getBusinessId())
                                    && !scan.getScannedAt().isBefore(createdAt.minusSeconds(300))
                                    && !scan.getScannedAt().isAfter(createdAt.plusSeconds(300))
                    );
            if (hasNearbyScan) {
                continue;
            }

            Business business = businessRepository.findById(businessId).orElse(null);
            if (business == null) {
                continue;
            }

            QrScanEvent event = new QrScanEvent();
            event.setBusinessId(businessId);
            event.setQrToken(business.getQrToken());
            event.setScannedAt(createdAt);
            event.setUserAgent("backfill-order");
            QrScanEvent saved = qrScanEventRepository.save(event);
            existingScans.add(saved);
            backfilled++;
        }

        if (backfilled > 0) {
            log.info("Backfilled {} menu QR scan events from existing orders", backfilled);
        }
    }
}
