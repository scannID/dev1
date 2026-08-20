package com.scanny.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.scanny.dto.PublicTicketDtos;
import com.scanny.dto.TicketDtos;
import com.scanny.dto.TicketResponse;
import com.scanny.exception.ApiException;
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
class TicketPurchaseSaleWindowTest {

    @Autowired
    private TicketPurchaseService ticketPurchaseService;

    @Test
    void futureSaleStartsAtBlocksPurchaseWith423() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Instant futureStart = Instant.now().plus(2, ChronoUnit.DAYS);
        String metadata = """
            {
              "template":"classic",
              "saleStartsAt":"%s",
              "ticketClasses":[{"name":"General","fee":5000,"capacity":100}],
              "tables":[]
            }
            """.formatted(futureStart.toString());

        TicketResponse event = ticketPurchaseService.createPublicEvent(new TicketDtos.CreateTicketRequest(
            "General",
            "Future Event " + suffix,
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

        PublicTicketDtos.EventInfoResponse info = ticketPurchaseService.getEventForPurchase(event.qrToken());
        assertThat(info.saleOpen()).isFalse();
        assertThat(info.saleStartsAt()).isNotNull();

        assertThatThrownBy(() -> ticketPurchaseService.startPurchase(new PublicTicketDtos.PurchaseRequest(
            event.qrToken(),
            "General",
            "Alice",
            "alice@test.local",
            "+256700000002",
            "stub"
        )))
            .isInstanceOf(ApiException.class)
            .satisfies(ex -> assertThat(((ApiException) ex).getStatus()).isEqualTo(423));
    }

    @Test
    void pastSaleEndsAtBlocksPurchaseWith410() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Instant pastEnd = Instant.now().minus(2, ChronoUnit.HOURS);
        String metadata = """
            {
              "template":"classic",
              "saleEndsAt":"%s",
              "ticketClasses":[{"name":"General","fee":5000,"capacity":100}],
              "tables":[]
            }
            """.formatted(pastEnd.toString());

        TicketResponse event = ticketPurchaseService.createPublicEvent(new TicketDtos.CreateTicketRequest(
            "General",
            "Closed Event " + suffix,
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

        PublicTicketDtos.EventInfoResponse info = ticketPurchaseService.getEventForPurchase(event.qrToken());
        assertThat(info.saleOpen()).isFalse();

        assertThatThrownBy(() -> ticketPurchaseService.startPurchase(new PublicTicketDtos.PurchaseRequest(
            event.qrToken(),
            "General",
            "Bob",
            "bob@test.local",
            "+256700000003",
            "stub"
        )))
            .isInstanceOf(ApiException.class)
            .satisfies(ex -> assertThat(((ApiException) ex).getStatus()).isEqualTo(410));
    }

    @Test
    void earlyBirdExpiryBlocksOnlyEarlyBirdClass() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Instant pastCutoff = Instant.now().minus(1, ChronoUnit.HOURS);
        String metadata = """
            {
              "template":"classic",
              "ticketClasses":[
                {"name":"Early Bird","fee":3000,"capacity":50,"saleEndsAt":"%s"},
                {"name":"Standard","fee":6000,"capacity":50}
              ],
              "tables":[]
            }
            """.formatted(pastCutoff.toString());

        TicketResponse event = ticketPurchaseService.createPublicEvent(new TicketDtos.CreateTicketRequest(
            "General",
            "Tiered Event " + suffix,
            Instant.now().plus(5, ChronoUnit.DAYS),
            "Host",
            "+256700000001",
            "host@test.local",
            6000,
            "UGX",
            1_000_000_000,
            Instant.now().plus(6, ChronoUnit.DAYS),
            "test",
            metadata
        ));

        assertThatThrownBy(() -> ticketPurchaseService.startPurchase(new PublicTicketDtos.PurchaseRequest(
            event.qrToken(),
            "Early Bird",
            "Charlie",
            "charlie@test.local",
            "+256700000004",
            "stub"
        )))
            .isInstanceOf(ApiException.class)
            .satisfies(ex -> assertThat(((ApiException) ex).getStatus()).isEqualTo(410));

        PublicTicketDtos.PurchaseResponse standardPurchase = ticketPurchaseService.startPurchase(new PublicTicketDtos.PurchaseRequest(
            event.qrToken(),
            "Standard",
            "Charlie",
            "charlie@test.local",
            "+256700000004",
            "stub"
        ));
        assertThat(standardPurchase.attendeeTicketId()).isNotBlank();
    }

    @Test
    void presaleCodeValidation() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String metadata = """
            {
              "template":"classic",
              "ticketClasses":[
                {"name":"VIP Presale","fee":10000,"capacity":20,"presaleCode":"SECRET25","presaleRequired":true}
              ],
              "tables":[]
            }
            """;

        TicketResponse event = ticketPurchaseService.createPublicEvent(new TicketDtos.CreateTicketRequest(
            "VIP Presale",
            "Presale Event " + suffix,
            Instant.now().plus(5, ChronoUnit.DAYS),
            "Host",
            "+256700000001",
            "host@test.local",
            10000,
            "UGX",
            1_000_000_000,
            Instant.now().plus(6, ChronoUnit.DAYS),
            "test",
            metadata
        ));

        PublicTicketDtos.EventInfoResponse info = ticketPurchaseService.getEventForPurchase(event.qrToken());
        assertThat(info.ticketClasses().get(0).presaleRequired()).isTrue();

        // Missing or incorrect code -> 403
        assertThatThrownBy(() -> ticketPurchaseService.startPurchase(new PublicTicketDtos.PurchaseRequest(
            event.qrToken(),
            "VIP Presale",
            "David",
            "david@test.local",
            "+256700000005",
            "stub",
            "WRONG"
        )))
            .isInstanceOf(ApiException.class)
            .satisfies(ex -> assertThat(((ApiException) ex).getStatus()).isEqualTo(403));

        // Correct code -> success
        PublicTicketDtos.PurchaseResponse bought = ticketPurchaseService.startPurchase(new PublicTicketDtos.PurchaseRequest(
            event.qrToken(),
            "VIP Presale",
            "David",
            "david@test.local",
            "+256700000005",
            "stub",
            "secret25"
        ));
        assertThat(bought.attendeeTicketId()).isNotBlank();
    }
}
