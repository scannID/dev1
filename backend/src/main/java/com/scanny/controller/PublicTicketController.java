package com.scanny.controller;

import com.scanny.dto.PublicTicketDtos;
import com.scanny.dto.TicketDtos;
import com.scanny.dto.TicketResponse;
import com.scanny.service.TicketPurchaseService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tickets/public")
public class PublicTicketController {

    private final TicketPurchaseService ticketPurchaseService;

    public PublicTicketController(TicketPurchaseService ticketPurchaseService) {
        this.ticketPurchaseService = ticketPurchaseService;
    }

    @GetMapping("/event/{masterQrToken}")
    public ResponseEntity<PublicTicketDtos.EventInfoResponse> getEvent(@PathVariable String masterQrToken) {
        return ResponseEntity.ok(ticketPurchaseService.getEventForPurchase(masterQrToken));
    }

    @PostMapping("/purchase")
    public ResponseEntity<PublicTicketDtos.PurchaseResponse> purchase(@Valid @RequestBody PublicTicketDtos.PurchaseRequest request) {
        PublicTicketDtos.PurchaseResponse response = ticketPurchaseService.startPurchase(request);
        // Outside the purchase transaction so Meta I/O cannot block/rollback the ticket.
        ticketPurchaseService.deliverTicketWhatsApp(response.attendeeTicketId(), response.viewUrl());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/queue")
    public ResponseEntity<PublicTicketDtos.QueueStatusResponse> queue(@Valid @RequestBody PublicTicketDtos.PurchaseRequest request) {
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(ticketPurchaseService.joinQueue(request));
    }

    @GetMapping("/queue/{queueToken}")
    public ResponseEntity<PublicTicketDtos.QueueStatusResponse> queueStatus(@PathVariable String queueToken) {
        return ResponseEntity.ok(ticketPurchaseService.getQueueStatus(queueToken));
    }

    @GetMapping("/view/{accessToken}")
    public ResponseEntity<PublicTicketDtos.AttendeeTicketView> view(@PathVariable String accessToken) {
        return ResponseEntity.ok(ticketPurchaseService.getAttendeeView(accessToken));
    }

    @PostMapping("/view/{accessToken}/transfer")
    public ResponseEntity<PublicTicketDtos.TransferInitiateResponse> initiateTransfer(@PathVariable String accessToken) {
        return ResponseEntity.ok(ticketPurchaseService.initiateTransfer(accessToken));
    }

    @GetMapping("/transfer/{transferToken}")
    public ResponseEntity<PublicTicketDtos.TransferInfoResponse> getTransferInfo(@PathVariable String transferToken) {
        return ResponseEntity.ok(ticketPurchaseService.getTransferInfo(transferToken));
    }

    @PostMapping("/transfer/accept")
    public ResponseEntity<PublicTicketDtos.TransferAcceptResponse> acceptTransfer(@RequestBody PublicTicketDtos.TransferAcceptRequest request) {
        return ResponseEntity.ok(ticketPurchaseService.acceptTransfer(request));
    }

    @PostMapping("/waitlist")
    public ResponseEntity<PublicTicketDtos.WaitlistJoinResponse> joinWaitlist(
            @RequestBody PublicTicketDtos.WaitlistJoinRequest request) {
        return ResponseEntity.ok(ticketPurchaseService.joinWaitlist(request));
    }

    @org.springframework.web.bind.annotation.DeleteMapping("/waitlist/{waitlistId}")
    public ResponseEntity<Void> leaveWaitlist(@PathVariable String waitlistId) {
        ticketPurchaseService.leaveWaitlist(waitlistId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/events")
    public ResponseEntity<TicketResponse> createEvent(@RequestBody TicketDtos.CreateTicketRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ticketPurchaseService.createPublicEvent(request));
    }

    /** Public sales progress by master event id (e.g. ERI-FA255B03 or #ERI-FA255B03). */
    @GetMapping("/track/{ticketId}")
    public ResponseEntity<PublicTicketDtos.EventTrackingMetrics> track(@PathVariable String ticketId) {
        return ResponseEntity.ok(ticketPurchaseService.getEventTrackingMetrics(ticketId));
    }

    /** Redeemed attendees for an event (supports local gate search by id/name/phone/code). */
    @GetMapping("/redeemed/{eventId}")
    public ResponseEntity<java.util.List<PublicTicketDtos.RedeemedAttendee>> redeemed(
            @PathVariable String eventId,
            @RequestParam(required = false) String q) {
        return ResponseEntity.ok(ticketPurchaseService.getRedeemedAttendees(eventId, q));
    }

    /** Gate knock-off using the paid ticket QR payload (one-phone manage flow). */
    @PostMapping("/validate")
    public ResponseEntity<TicketDtos.ScanValidationResponse> validate(
            @RequestBody TicketDtos.ScanPayloadRequest request) {
        String payload = request != null && request.payload() != null ? request.payload().trim() : "";
        String preview = payload.length() > 96 ? payload.substring(0, 96) + "…" : payload;
        org.slf4j.LoggerFactory.getLogger(PublicTicketController.class)
            .info("GATE_VALIDATE eventId={} payloadPreview={}",
                request != null ? request.eventId() : null, preview);
        try {
            TicketDtos.ScanValidationResponse response = ticketPurchaseService.validateGatePayload(request);
            org.slf4j.LoggerFactory.getLogger(PublicTicketController.class)
                .info("GATE_VALIDATE result valid={} result={} message={} ticket={}",
                    response.valid(),
                    response.result(),
                    response.message(),
                    response.ticket() != null ? response.ticket().id() : null);
            appendGateScanLog(
                "OK eventId=" + (request != null ? request.eventId() : "")
                    + " valid=" + response.valid()
                    + " result=" + response.result()
                    + " message=" + response.message()
                    + " preview=" + preview
            );
            return ResponseEntity.ok(response);
        } catch (RuntimeException ex) {
            org.slf4j.LoggerFactory.getLogger(PublicTicketController.class)
                .warn("GATE_VALIDATE failed eventId={} preview={} err={}",
                    request != null ? request.eventId() : null, preview, ex.toString());
            appendGateScanLog(
                "FAIL eventId=" + (request != null ? request.eventId() : "")
                    + " preview=" + preview
                    + " err=" + ex.getMessage()
            );
            throw ex;
        }
    }

    private static void appendGateScanLog(String line) {
        try {
            java.nio.file.Path path = java.nio.file.Path.of(
                System.getProperty("user.dir"), "..", ".dev", "gate-scan.log"
            ).normalize();
            java.nio.file.Files.createDirectories(path.getParent());
            String stamped = java.time.Instant.now() + " " + line + System.lineSeparator();
            java.nio.file.Files.writeString(
                path,
                stamped,
                java.nio.file.StandardOpenOption.CREATE,
                java.nio.file.StandardOpenOption.APPEND
            );
        } catch (Exception ignored) {
            // debug aid only
        }
    }
}
