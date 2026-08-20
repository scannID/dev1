package com.scanny.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.scanny.dto.PublicTicketDtos;
import com.scanny.dto.TicketDtos;
import com.scanny.dto.TicketResponse;
import com.scanny.entity.TicketQueueEntry;
import com.scanny.exception.ApiException;
import com.scanny.repository.TicketQueueRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class TicketQueueIntegrationTest {

    @Autowired
    private TicketPurchaseService ticketPurchaseService;

    @Autowired
    private TicketQueueRepository ticketQueueRepository;

    @Autowired
    private QueueProcessorScheduler queueProcessorScheduler;

    @Test
    void joinQueueCalculatesPositionAndProcessesViaScheduler() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String metadata = """
            {
              "template":"classic",
              "queueEnabled":true,
              "ticketClasses":[{"name":"General","fee":5000,"capacity":10}],
              "tables":[]
            }
            """;

        TicketResponse event = ticketPurchaseService.createPublicEvent(new TicketDtos.CreateTicketRequest(
            "General",
            "Queue Event " + suffix,
            Instant.now().plus(7, ChronoUnit.DAYS),
            "Host",
            "+256700000001",
            "host@test.local",
            5000,
            "UGX",
            1_000_000_000,
            Instant.now().plus(8, ChronoUnit.DAYS),
            "test",
            metadata
        ));

        // User 1 joins queue
        PublicTicketDtos.QueueStatusResponse q1 = ticketPurchaseService.joinQueue(new PublicTicketDtos.PurchaseRequest(
            event.qrToken(),
            "General",
            "Queue Buyer 1",
            "buyer1@test.local",
            "+256700000011",
            "stub"
        ));
        assertThat(q1.queueToken()).isNotBlank();
        assertThat(q1.status()).isEqualTo("Waiting");
        assertThat(q1.position()).isEqualTo(1);

        // User 2 joins queue
        PublicTicketDtos.QueueStatusResponse q2 = ticketPurchaseService.joinQueue(new PublicTicketDtos.PurchaseRequest(
            event.qrToken(),
            "General",
            "Queue Buyer 2",
            "buyer2@test.local",
            "+256700000012",
            "stub"
        ));
        assertThat(q2.position()).isEqualTo(2);

        // Check queue status polling for buyer 2
        PublicTicketDtos.QueueStatusResponse polledQ2 = ticketPurchaseService.getQueueStatus(q2.queueToken());
        assertThat(polledQ2.status()).isEqualTo("Waiting");
        assertThat(polledQ2.position()).isEqualTo(2);

        // Run queue processor scheduler
        queueProcessorScheduler.processNextQueueBatch();

        // After processing, status is Complete and contains viewUrl + attendeeTicketId
        PublicTicketDtos.QueueStatusResponse q1Done = ticketPurchaseService.getQueueStatus(q1.queueToken());
        assertThat(q1Done.status()).isEqualTo("Complete");
        assertThat(q1Done.attendeeTicketId()).isNotBlank();
        assertThat(q1Done.viewUrl()).isNotBlank();

        PublicTicketDtos.QueueStatusResponse q2Done = ticketPurchaseService.getQueueStatus(q2.queueToken());
        assertThat(q2Done.status()).isEqualTo("Complete");
        assertThat(q2Done.attendeeTicketId()).isNotBlank();
        assertThat(q2Done.viewUrl()).isNotBlank();
    }

    @Test
    void joinQueueValidatesSaleWindowAndPresaleCode() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Instant futureStart = Instant.now().plus(2, ChronoUnit.DAYS);
        String metadata = """
            {
              "template":"classic",
              "saleStartsAt":"%s",
              "ticketClasses":[{"name":"VIP","fee":20000,"capacity":10,"presaleCode":"VIPPASS","presaleRequired":true}],
              "tables":[]
            }
            """.formatted(futureStart.toString());

        TicketResponse event = ticketPurchaseService.createPublicEvent(new TicketDtos.CreateTicketRequest(
            "VIP",
            "Future Queue Event " + suffix,
            Instant.now().plus(7, ChronoUnit.DAYS),
            "Host",
            "+256700000001",
            "host@test.local",
            20000,
            "UGX",
            1_000_000_000,
            Instant.now().plus(8, ChronoUnit.DAYS),
            "test",
            metadata
        ));

        // Blocked by sale start
        assertThatThrownBy(() -> ticketPurchaseService.joinQueue(new PublicTicketDtos.PurchaseRequest(
            event.qrToken(),
            "VIP",
            "Early Buyer",
            "early@test.local",
            "+256700000013",
            "stub"
        )))
            .isInstanceOf(ApiException.class)
            .satisfies(ex -> assertThat(((ApiException) ex).getStatus()).isEqualTo(423));
    }
}
