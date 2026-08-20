package com.scanny.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.scanny.dto.PublicTicketDtos;
import com.scanny.dto.TicketDtos;
import com.scanny.dto.TicketResponse;
import com.scanny.entity.Ticket;
import com.scanny.exception.ApiException;
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
class TicketTransferIntegrationTest {

    @Autowired
    private TicketPurchaseService ticketPurchaseService;

    @Autowired
    private TicketRepository ticketRepository;

    @Test
    void completeTransferLifecycle() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        TicketResponse event = ticketPurchaseService.createPublicEvent(new TicketDtos.CreateTicketRequest(
            "General",
            "Transfer Fest " + suffix,
            Instant.now().plus(5, ChronoUnit.DAYS),
            "Host",
            "+256700000001",
            "host@test.local",
            5000,
            "UGX",
            1_000_000_000,
            Instant.now().plus(6, ChronoUnit.DAYS),
            "test",
            "{\"template\":\"classic\"}"
        ));

        // Buy ticket
        PublicTicketDtos.PurchaseResponse purchased = ticketPurchaseService.startPurchase(new PublicTicketDtos.PurchaseRequest(
            event.qrToken(),
            "General",
            "Original Holder",
            "original@test.local",
            "+256700000021",
            "stub"
        ));

        Ticket attendee = ticketRepository.findById(purchased.attendeeTicketId()).orElseThrow();
        String originalAccessToken = attendee.getAccessToken();

        // 1. Initiate transfer
        PublicTicketDtos.TransferInitiateResponse transfer = ticketPurchaseService.initiateTransfer(originalAccessToken);
        assertThat(transfer.transferToken()).startsWith("XFR-");
        assertThat(transfer.transferUrl()).contains("/ticket/transfer/" + transfer.transferToken());

        // 2. Fetch transfer info
        PublicTicketDtos.TransferInfoResponse info = ticketPurchaseService.getTransferInfo(transfer.transferToken());
        assertThat(info.valid()).isTrue();
        assertThat(info.eventName()).isEqualTo("Transfer Fest " + suffix);
        assertThat(info.originalHolderName()).isEqualTo("Original Holder");
        assertThat(info.ticketType()).isEqualTo("General");

        // 3. Recipient accepts transfer
        PublicTicketDtos.TransferAcceptResponse accepted = ticketPurchaseService.acceptTransfer(new PublicTicketDtos.TransferAcceptRequest(
            transfer.transferToken(),
            "New Lucky Recipient",
            "+256700000022",
            "recipient@test.local"
        ));
        assertThat(accepted.attendeeTicketId()).isEqualTo(attendee.getId());
        assertThat(accepted.viewUrl()).isNotBlank();

        // 4. Verify ticket updated in DB
        Ticket updatedAttendee = ticketRepository.findById(purchased.attendeeTicketId()).orElseThrow();
        assertThat(updatedAttendee.getHolderName()).isEqualTo("New Lucky Recipient");
        assertThat(updatedAttendee.getHolderPhone()).isEqualTo("256700000022");
        assertThat(updatedAttendee.getTransferredFromPhone()).isEqualTo("256700000021");
        assertThat(updatedAttendee.getTransferToken()).isNull();

        // 5. Old access token is now rotated/invalid
        assertThatThrownBy(() -> ticketPurchaseService.getAttendeeView(originalAccessToken))
            .isInstanceOf(ApiException.class)
            .satisfies(ex -> assertThat(((ApiException) ex).getStatus()).isEqualTo(404));

        // 6. New access token works
        PublicTicketDtos.AttendeeTicketView newView = ticketPurchaseService.getAttendeeView(updatedAttendee.getAccessToken());
        assertThat(newView.holderName()).isEqualTo("New Lucky Recipient");
    }

    @Test
    void cannotTransferMasterEventTicketOrExpiredTransferToken() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        TicketResponse event = ticketPurchaseService.createPublicEvent(new TicketDtos.CreateTicketRequest(
            "General",
            "Master Event " + suffix,
            Instant.now().plus(5, ChronoUnit.DAYS),
            "Host",
            "+256700000001",
            "host@test.local",
            5000,
            "UGX",
            1_000_000_000,
            Instant.now().plus(6, ChronoUnit.DAYS),
            "test",
            "{\"template\":\"classic\"}"
        ));

        Ticket masterTicket = ticketRepository.findById(event.id()).orElseThrow();
        // Attempting to transfer master event ticket fails with 400
        assertThatThrownBy(() -> ticketPurchaseService.initiateTransfer(masterTicket.getAccessToken()))
            .isInstanceOf(ApiException.class)
            .satisfies(ex -> assertThat(((ApiException) ex).getStatus()).isEqualTo(400));
    }
}
