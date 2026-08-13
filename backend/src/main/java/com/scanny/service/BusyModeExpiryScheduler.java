package com.scanny.service;

import com.scanny.entity.Business;
import com.scanny.repository.BusinessRepository;
import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Runs every minute and clears busy mode for any business whose
 * {@code busyModeExpiresAt} timestamp has passed.
 *
 * <p>This is the server-side safety net for the client-side countdown in
 * {@code OperationsHub.tsx}. If a merchant sets a busy-mode ETA and then
 * closes their browser, the business would otherwise stay paused indefinitely.
 * This scheduler guarantees that never happens.
 */
@Component
public class BusyModeExpiryScheduler {

    private static final Logger log = LoggerFactory.getLogger(BusyModeExpiryScheduler.class);

    private final BusinessRepository businessRepository;

    public BusyModeExpiryScheduler(BusinessRepository businessRepository) {
        this.businessRepository = businessRepository;
    }

    @Scheduled(fixedDelayString = "${scanny.busy-mode.expiry-check-ms:60000}")
    @Transactional
    public void clearExpiredBusyModes() {
        List<Business> expired = businessRepository.findExpiredBusyModeBusinesses(Instant.now());
        if (expired.isEmpty()) {
            return;
        }

        for (Business business : expired) {
            log.info(
                "Busy mode expired for business '{}' ({}), auto-resuming orders.",
                business.getName(), business.getId()
            );
            business.setBusyMode(false);
            business.setAcceptingOrders(true);
            business.setBusyEtaMinutes(0);
            business.setBusyModeExpiresAt(null);
            businessRepository.save(business);
        }

        log.info("Busy mode expiry sweep: cleared {} business(es).", expired.size());
    }
}
