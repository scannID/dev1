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
        return ResponseEntity.ok(ticketPurchaseService.startPurchase(request));
    }

    @GetMapping("/view/{accessToken}")
    public ResponseEntity<PublicTicketDtos.AttendeeTicketView> view(@PathVariable String accessToken) {
        return ResponseEntity.ok(ticketPurchaseService.getAttendeeView(accessToken));
    }

    @PostMapping("/events")
    public ResponseEntity<TicketResponse> createEvent(@RequestBody TicketDtos.CreateTicketRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ticketPurchaseService.createPublicEvent(request));
    }

    /** Public sales progress by master ticket id (e.g. TKT-FA255B03 or #TKT-FA255B03). */
    @GetMapping("/track/{ticketId}")
    public ResponseEntity<PublicTicketDtos.EventTrackingMetrics> track(@PathVariable String ticketId) {
        return ResponseEntity.ok(ticketPurchaseService.getEventTrackingMetrics(ticketId));
    }

    /** Gate knock-off using the paid ticket QR payload (one-phone manage flow). */
    @PostMapping("/validate")
    public ResponseEntity<TicketDtos.ScanValidationResponse> validate(
            @RequestBody TicketDtos.ScanPayloadRequest request) {
        return ResponseEntity.ok(ticketPurchaseService.validateGatePayload(request));
    }
}
