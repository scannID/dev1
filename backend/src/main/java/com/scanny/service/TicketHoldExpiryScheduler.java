package com.scanny.service;

import com.scanny.entity.Ticket;
import com.scanny.model.enums.PaymentStatus;
import com.scanny.model.enums.TicketStatus;
import com.scanny.repository.TicketRepository;
import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Releases expired unpaid class/table inventory holds. */
@Component
public class TicketHoldExpiryScheduler {

    private static final Logger log = LoggerFactory.getLogger(TicketHoldExpiryScheduler.class);

    private final TicketRepository ticketRepository;
    private final TicketService ticketService;

    public TicketHoldExpiryScheduler(TicketRepository ticketRepository, TicketService ticketService) {
        this.ticketRepository = ticketRepository;
        this.ticketService = ticketService;
    }

    @Scheduled(cron = "${scanny.tickets.hold-expiry-cron:0 */1 * * * *}")
    @Transactional
    public void releaseExpiredHolds() {
        Instant now = Instant.now();
        List<Ticket> expired = ticketRepository.findExpiredHolds(
            PaymentStatus.Unpaid,
            TicketStatus.Active,
            now
        );
        if (expired.isEmpty()) {
            return;
        }

        for (Ticket ticket : expired) {
            ticket.setStatus(TicketStatus.Cancelled);
            ticket.setHoldExpiresAt(null);
            ticket.setUpdatedAt(now);
        }
        ticketRepository.saveAll(expired);
        ticketService.refreshStatsBroadcast();
        log.info("Released {} expired ticket inventory hold(s)", expired.size());
    }
}
