package com.scanny.service;

import com.scanny.entity.Ticket;
import com.scanny.repository.TicketRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Deletes event tickets from the DB once {@code eventDate + retention} has passed
 * (default 24 hours after the event).
 */
@Component
public class TicketCleanupScheduler {

    private static final Logger log = LoggerFactory.getLogger(TicketCleanupScheduler.class);

    private final TicketRepository ticketRepository;
    private final long retentionHours;

    public TicketCleanupScheduler(
            TicketRepository ticketRepository,
            @Value("${scanny.tickets.auto-delete-hours-after-event:24}") long retentionHours
    ) {
        this.ticketRepository = ticketRepository;
        this.retentionHours = Math.max(1, retentionHours);
    }

    @Scheduled(cron = "${scanny.tickets.cleanup-cron:0 15 * * * *}")
    @Transactional
    public void deleteExpiredEventTickets() {
        Instant cutoff = Instant.now().minus(retentionHours, ChronoUnit.HOURS);
        List<Ticket> expired = ticketRepository.findPastEventDateCutoff(cutoff);
        if (expired.isEmpty()) {
            return;
        }

        Set<String> masterIds = new HashSet<>();
        Set<String> orphanIds = new HashSet<>();
        for (Ticket ticket : expired) {
            if (ticket.isEventTemplate()) {
                masterIds.add(ticket.getId());
            } else if (ticket.getMasterTicketId() != null && !ticket.getMasterTicketId().isBlank()) {
                masterIds.add(ticket.getMasterTicketId());
            } else {
                orphanIds.add(ticket.getId());
            }
        }

        int deleted = 0;
        for (String masterId : masterIds) {
            List<Ticket> attendees = ticketRepository.findByMasterTicketIdOrderByCreatedAtDesc(masterId);
            if (!attendees.isEmpty()) {
                deleted += attendees.size();
                ticketRepository.deleteAll(attendees);
            }
            var master = ticketRepository.findById(masterId);
            if (master.isPresent()) {
                ticketRepository.delete(master.get());
                deleted += 1;
            }
        }

        if (!orphanIds.isEmpty()) {
            List<Ticket> orphans = ticketRepository.findAllById(orphanIds).stream()
                    .filter(t -> ticketRepository.existsById(t.getId()))
                    .toList();
            if (!orphans.isEmpty()) {
                deleted += orphans.size();
                ticketRepository.deleteAll(orphans);
            }
        }

        if (deleted > 0) {
            log.info(
                "Auto-deleted {} ticket(s) past eventDate + {}h (cutoff {})",
                deleted,
                retentionHours,
                cutoff
            );
        }
    }
}
