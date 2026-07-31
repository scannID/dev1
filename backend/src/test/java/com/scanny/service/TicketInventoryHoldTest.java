package com.scanny.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.scanny.dto.PublicTicketDtos;
import com.scanny.dto.TicketDtos;
import com.scanny.dto.TicketResponse;
import com.scanny.entity.Ticket;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.PaymentStatus;
import com.scanny.model.enums.TicketStatus;
import com.scanny.repository.TicketRepository;
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
class TicketInventoryHoldTest {

    @Autowired
    private TicketPurchaseService ticketPurchaseService;

    @Autowired
    private TicketHoldExpiryScheduler holdExpiryScheduler;

    @Autowired
    private TicketRepository ticketRepository;

    @Test
    void activeHoldBlocksPurchaseAndExpiryReleasesStock() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String metadata = """
            {"template":"classes","ticketClasses":[{"name":"GA","fee":1000,"capacity":1}],"tables":[]}
            """;
        TicketResponse event = ticketPurchaseService.createPublicEvent(new TicketDtos.CreateTicketRequest(
            "Event",
            "Hold Test " + suffix,
            Instant.now().plus(3, ChronoUnit.DAYS),
            "Host",
            "+256700000010",
            "host-" + suffix + "@test.local",
            1000,
            "UGX",
            1,
            Instant.now().plus(4, ChronoUnit.DAYS),
            "test",
            metadata
        ));

        Ticket hold = new Ticket();
        hold.setId("TKT-H" + suffix.toUpperCase());
        hold.setQrToken("hold-qr-" + suffix);
        hold.setAccessToken("hold-access-" + suffix);
        hold.setMasterTicketId(event.id());
        hold.setTicketType("GA");
        hold.setEventName(event.eventName());
        hold.setHolderName("Held");
        hold.setHolderPhone("+256711100001");
        hold.setPrice(1000);
        hold.setCurrency("UGX");
        hold.setUsageLimit(1);
        hold.setUsageCount(0);
        hold.setStatus(TicketStatus.Active);
        hold.setPaymentStatus(PaymentStatus.Unpaid);
        hold.setHoldExpiresAt(Instant.now().plus(10, ChronoUnit.MINUTES));
        hold.setIssuedBy("test-hold");
        hold.setCreatedAt(Instant.now());
        ticketRepository.saveAndFlush(hold);

        PublicTicketDtos.EventInfoResponse info =
            ticketPurchaseService.getEventForPurchase(event.qrToken());
        PublicTicketDtos.TicketClassOption ga = info.ticketClasses().get(0);
        assertThat(ga.capacity()).isEqualTo(1);
        assertThat(ga.held()).isEqualTo(1);
        assertThat(ga.remaining()).isZero();
        assertThat(ga.soldOut()).isTrue();

        assertThatThrownBy(() -> ticketPurchaseService.startPurchase(new PublicTicketDtos.PurchaseRequest(
            event.qrToken(),
            "GA",
            "Buyer",
            "buyer-" + suffix + "@test.local",
            "+256722200002",
            "stub"
        )))
            .isInstanceOf(ApiException.class)
            .satisfies(ex -> assertThat(((ApiException) ex).getStatus()).isEqualTo(409));

        hold.setHoldExpiresAt(Instant.now().minus(1, ChronoUnit.MINUTES));
        ticketRepository.saveAndFlush(hold);
        holdExpiryScheduler.releaseExpiredHolds();

        PublicTicketDtos.EventInfoResponse after =
            ticketPurchaseService.getEventForPurchase(event.qrToken());
        assertThat(after.ticketClasses().get(0).held()).isZero();
        assertThat(after.ticketClasses().get(0).remaining()).isEqualTo(1);
        assertThat(after.ticketClasses().get(0).soldOut()).isFalse();

        PublicTicketDtos.PurchaseResponse bought = ticketPurchaseService.startPurchase(
            new PublicTicketDtos.PurchaseRequest(
                event.qrToken(),
                "GA",
                "Buyer",
                "buyer-" + suffix + "@test.local",
                "+256722200002",
                "stub"
            )
        );
        assertThat(bought.attendeeTicketId()).isNotBlank();
    }
}
