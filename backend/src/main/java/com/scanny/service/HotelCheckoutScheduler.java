package com.scanny.service;

import com.scanny.entity.Business;
import com.scanny.model.enums.BusinessType;
import com.scanny.repository.BusinessRepository;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Nightly job that scans every hotel's rooms and marks any OCCUPIED or BOOKED
 * room whose checkout date has passed as {@code CHECKOUT_PENDING}.
 *
 * Front-desk staff then confirm checkout (→ VACANT) or extend the stay.
 * The job intentionally does NOT free rooms automatically, because a guest
 * may have verbally agreed to extend without the system being updated yet.
 *
 * Default: runs at 00:15 each night. Override with:
 * {@code scanny.hotel.checkout-cron} in application properties.
 */
@Component
public class HotelCheckoutScheduler {

    private static final Logger log = LoggerFactory.getLogger(HotelCheckoutScheduler.class);

    private final BusinessRepository businessRepository;
    private final HotelOpsService hotelOpsService;

    public HotelCheckoutScheduler(
            BusinessRepository businessRepository,
            HotelOpsService hotelOpsService
    ) {
        this.businessRepository = businessRepository;
        this.hotelOpsService = hotelOpsService;
    }

    @Scheduled(cron = "${scanny.hotel.checkout-cron:0 15 0 * * *}")
    public void markOverdueCheckouts() {
        List<Business> hotels = businessRepository.findByType(BusinessType.Hotel);
        if (hotels.isEmpty()) {
            return;
        }

        int totalMarked = 0;
        for (Business hotel : hotels) {
            try {
                int marked = hotelOpsService.markOverdueCheckouts(hotel.getId());
                if (marked > 0) {
                    log.info("Hotel checkout sweep: marked {} room(s) as CHECKOUT_PENDING for business {}",
                            marked, hotel.getId());
                    totalMarked += marked;
                }
            } catch (Exception ex) {
                // Log but don't abort — process remaining hotels.
                log.error("Hotel checkout sweep failed for business {}: {}", hotel.getId(), ex.getMessage(), ex);
            }
        }

        if (totalMarked > 0) {
            log.info("Hotel checkout sweep complete: {} room(s) flagged across {} hotel(s)",
                    totalMarked, hotels.size());
        }
    }
}
