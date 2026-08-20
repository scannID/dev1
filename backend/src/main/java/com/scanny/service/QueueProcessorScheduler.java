package com.scanny.service;

import com.scanny.dto.PublicTicketDtos;
import com.scanny.entity.TicketQueueEntry;
import com.scanny.exception.ApiException;
import com.scanny.repository.TicketQueueRepository;
import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class QueueProcessorScheduler {

    private static final Logger log = LoggerFactory.getLogger(QueueProcessorScheduler.class);
    private static final int BATCH_SIZE = 5;

    private final TicketQueueRepository ticketQueueRepository;
    private final TicketPurchaseService ticketPurchaseService;

    public QueueProcessorScheduler(
            TicketQueueRepository ticketQueueRepository,
            TicketPurchaseService ticketPurchaseService) {
        this.ticketQueueRepository = ticketQueueRepository;
        this.ticketPurchaseService = ticketPurchaseService;
    }

    @Scheduled(fixedDelay = 2000)
    public void processNextQueueBatch() {
        List<TicketQueueEntry> batch = ticketQueueRepository.findNextBatchByStatus(
                "Waiting", PageRequest.of(0, BATCH_SIZE));
        if (batch.isEmpty()) {
            return;
        }

        for (TicketQueueEntry entry : batch) {
            entry.setStatus("Processing");
            ticketQueueRepository.save(entry);

            PublicTicketDtos.PurchaseResponse result = null;
            try {
                PublicTicketDtos.PurchaseRequest purchaseRequest = new PublicTicketDtos.PurchaseRequest(
                        entry.getMasterId(),
                        entry.getTicketClass(),
                        entry.getHolderName(),
                        entry.getHolderEmail(),
                        entry.getHolderPhone(),
                        entry.getPaymentPhone(),
                        entry.getProvider(),
                        entry.getPresaleCode(),
                        1,
                        null
                );

                result = ticketPurchaseService.startPurchase(purchaseRequest);
                entry.setStatus("Complete");
                entry.setAttendeeTicketId(result.attendeeTicketId());
                entry.setViewUrl(result.viewUrl());
                entry.setErrorMessage(null);
                entry.setProcessedAt(Instant.now());
                ticketQueueRepository.save(entry);

                log.info("QUEUE_ENTRY_PROCESSED queueId={} attendeeTicketId={}", entry.getId(), result.attendeeTicketId());
            } catch (ApiException ex) {
                entry.setStatus("Failed");
                entry.setErrorMessage(ex.getMessage());
                entry.setProcessedAt(Instant.now());
                ticketQueueRepository.save(entry);
                log.warn("QUEUE_ENTRY_FAILED queueId={} status={} err={}", entry.getId(), ex.getStatus(), ex.getMessage());
            } catch (Exception ex) {
                entry.setStatus("Failed");
                entry.setErrorMessage("An unexpected error occurred during purchase.");
                entry.setProcessedAt(Instant.now());
                ticketQueueRepository.save(entry);
                log.error("QUEUE_ENTRY_ERROR queueId={} err={}", entry.getId(), ex.getMessage(), ex);
            }

            if (result != null && result.attendeeTicketId() != null) {
                try {
                    ticketPurchaseService.deliverTicketWhatsApp(result.attendeeTicketId(), result.viewUrl());
                } catch (Exception ex) {
                    log.warn("QUEUE_WHATSAPP_FAILED attendeeTicketId={} err={}", result.attendeeTicketId(), ex.getMessage());
                }
            }
        }
    }

    @Scheduled(fixedDelay = 60000)
    public void cleanupExpiredQueueEntries() {
        try {
            Instant now = Instant.now();
            List<TicketQueueEntry> expired = ticketQueueRepository.findByExpiresAtBeforeAndStatus(now, "Waiting");
            for (TicketQueueEntry entry : expired) {
                entry.setStatus("Expired");
                entry.setProcessedAt(now);
                entry.setErrorMessage("Queue session expired.");
                ticketQueueRepository.save(entry);
            }
            if (!expired.isEmpty()) {
                log.info("QUEUE_EXPIRED_CLEANED count={}", expired.size());
            }
        } catch (Exception ex) {
            log.warn("QUEUE_CLEANUP_FAILED err={}", ex.getMessage());
        }
    }
}
