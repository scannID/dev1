package com.scanny.controller;

import com.scanny.dto.TicketDtos;
import com.scanny.dto.TicketResponse;
import com.scanny.model.enums.PaymentStatus;
import com.scanny.model.enums.TicketStatus;
import com.scanny.service.TicketService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

@RestController
@RequestMapping("/api/tickets")
public class TicketController {

    private final TicketService ticketService;

    public TicketController(TicketService ticketService) {
        this.ticketService = ticketService;
    }

    @PostMapping
    public ResponseEntity<TicketResponse> createTicket(@RequestBody TicketDtos.CreateTicketRequest request) {
        try {
            TicketResponse ticket = ticketService.createTicket(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(ticket);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }

    @GetMapping
    public ResponseEntity<List<TicketResponse>> getAllTickets(@RequestParam(required = false) String eventName) {
        try {
            List<TicketResponse> tickets = eventName != null 
                ? ticketService.getTicketsByEvent(eventName)
                : ticketService.getAllTickets();
            return ResponseEntity.ok(tickets);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/stats")
    public ResponseEntity<List<TicketDtos.TicketEventStats>> getTicketStats(
        @RequestParam(required = false) String search
    ) {
        try {
            return ResponseEntity.ok(ticketService.getTicketStats(search));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/events")
    public ResponseEntity<List<TicketDtos.CreatedEventSummary>> getCreatedEvents(
        @RequestParam(required = false) String search
    ) {
        try {
            return ResponseEntity.ok(ticketService.getCreatedEvents(search));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/{ticketId}")
    public ResponseEntity<TicketResponse> getTicket(@PathVariable String ticketId) {
        try {
            TicketResponse ticket = ticketService.getTicket(ticketId);
            return ResponseEntity.ok(ticket);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }

    @GetMapping("/qr/{qrToken}")
    public ResponseEntity<TicketResponse> getTicketByQr(@PathVariable String qrToken) {
        try {
            TicketResponse ticket = ticketService.getTicketByQrToken(qrToken);
            return ResponseEntity.ok(ticket);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }

    @PostMapping("/qr/{qrToken}/scan")
    public ResponseEntity<TicketDtos.ScanValidationResponse> scanTicket(
            @PathVariable String qrToken,
            @RequestBody TicketDtos.ScanTicketRequest request) {
        try {
            TicketDtos.ScanValidationResponse response = ticketService.scanTicket(qrToken, request);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }

    @PostMapping("/scan")
    public ResponseEntity<TicketDtos.ScanValidationResponse> scanTicketPayload(
            @RequestBody TicketDtos.ScanPayloadRequest request) {
        try {
            TicketDtos.ScanValidationResponse response = ticketService.scanTicketPayload(request);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }

    @PatchMapping("/{ticketId}/status")
    public ResponseEntity<TicketResponse> updateTicketStatus(
            @PathVariable String ticketId,
            @RequestBody TicketDtos.UpdateTicketStatusRequest request) {
        try {
            TicketResponse ticket = ticketService.updateTicketStatus(ticketId, request.status());
            return ResponseEntity.ok(ticket);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }

    @PatchMapping("/{ticketId}/payment")
    public ResponseEntity<TicketResponse> updatePaymentStatus(
            @PathVariable String ticketId,
            @RequestBody TicketDtos.UpdatePaymentStatusRequest request) {
        try {
            TicketResponse ticket = ticketService.updatePaymentStatus(
                ticketId, 
                request.paymentStatus(), 
                request.paymentReference()
            );
            return ResponseEntity.ok(ticket);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }
}
