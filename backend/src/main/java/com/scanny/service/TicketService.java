package com.scanny.service;

import com.scanny.dto.TicketDtos;
import com.scanny.dto.TicketResponse;
import com.scanny.entity.Ticket;
import com.scanny.entity.TicketScan;
import com.scanny.model.enums.PaymentStatus;
import com.scanny.model.enums.ScanResult;
import com.scanny.model.enums.TicketStatus;
import com.scanny.repository.TicketRepository;
import com.scanny.repository.TicketScanRepository;
import com.scanny.websocket.RealtimeEventPublisher;
import com.scanny.websocket.TicketStatsWebSocketHandler;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
public class TicketService {

    private final TicketRepository ticketRepository;
    private final TicketScanRepository ticketScanRepository;
    private final TicketStatsWebSocketHandler ticketStatsWebSocketHandler;
    private final RealtimeEventPublisher realtimeEventPublisher;
    private final AuditService auditService;

    @Value("${scanny.scan-base-url:https://scanny.app}")
    private String customerUrl;

    public TicketService(
        TicketRepository ticketRepository,
        TicketScanRepository ticketScanRepository,
        TicketStatsWebSocketHandler ticketStatsWebSocketHandler,
        RealtimeEventPublisher realtimeEventPublisher,
        AuditService auditService
    ) {
        this.ticketRepository = ticketRepository;
        this.ticketScanRepository = ticketScanRepository;
        this.ticketStatsWebSocketHandler = ticketStatsWebSocketHandler;
        this.realtimeEventPublisher = realtimeEventPublisher;
        this.auditService = auditService;
    }

    @Transactional
    public TicketResponse createTicket(TicketDtos.CreateTicketRequest request) {
        Ticket ticket = new Ticket();
        ticket.setId(generateTicketId());
        ticket.setQrToken(generateQrToken());
        ticket.setTicketType(request.ticketType());
        ticket.setEventName(request.eventName());
        ticket.setEventDate(request.eventDate());
        ticket.setHolderName(request.holderName() != null ? request.holderName() : "");
        ticket.setHolderPhone(request.holderPhone() != null ? request.holderPhone() : "");
        ticket.setHolderEmail(request.holderEmail() != null ? request.holderEmail() : "");
        ticket.setPrice(request.price());
        ticket.setCurrency(request.currency() != null ? request.currency() : "UGX");
        ticket.setUsageLimit(request.usageLimit() > 0 ? request.usageLimit() : 1);
        ticket.setExpiresAt(request.expiresAt());
        ticket.setIssuedBy(request.issuedBy() != null ? request.issuedBy() : "");
        ticket.setMetadata(request.metadata());
        ticket.setStatus(TicketStatus.Active);
        ticket.setPaymentStatus(PaymentStatus.Unpaid);

        ticket = ticketRepository.save(ticket);
        auditService.success(
            "TICKET_CREATED",
            "ticket",
            ticket.getId(),
            Map.of(
                "eventName", ticket.getEventName() != null ? ticket.getEventName() : "",
                "ticketType", ticket.getTicketType() != null ? ticket.getTicketType() : ""
            )
        );
        broadcastStatsUpdate();
        return TicketResponse.from(ticket, customerUrl);
    }

    @Transactional(readOnly = true)
    public TicketResponse getTicket(String ticketId) {
        Ticket ticket = ticketRepository.findById(ticketId)
            .orElseThrow(() -> new RuntimeException("Ticket not found: " + ticketId));
        return TicketResponse.from(ticket, customerUrl);
    }

    @Transactional(readOnly = true)
    public TicketResponse getTicketByQrToken(String qrToken) {
        Ticket ticket = ticketRepository.findByQrToken(qrToken)
            .orElseThrow(() -> new RuntimeException("Ticket not found with QR token: " + qrToken));
        return TicketResponse.from(ticket, customerUrl);
    }

    @Transactional(readOnly = true)
    public List<TicketResponse> getAllTickets() {
        return ticketRepository.findAll().stream()
            .map(ticket -> TicketResponse.from(ticket, customerUrl))
            .toList();
    }

    @Transactional(readOnly = true)
    public List<TicketResponse> getTicketsByEvent(String eventName) {
        return ticketRepository.findByEventName(eventName).stream()
            .map(ticket -> TicketResponse.from(ticket, customerUrl))
            .toList();
    }

    @Transactional(readOnly = true)
    public List<TicketDtos.TicketEventStats> getTicketStats(String search) {
        String normalizedSearch = search == null ? "" : search.trim().toLowerCase();
        return ticketRepository.aggregateAttendeeEventStats(normalizedSearch).stream()
            .map(row -> new TicketDtos.TicketEventStats(
                row[0] == null ? "Untitled Event" : String.valueOf(row[0]),
                row[1] == null ? 0L : ((Number) row[1]).longValue(),
                row[2] == null ? 0L : ((Number) row[2]).longValue()
            ))
            .sorted(Comparator.comparing(TicketDtos.TicketEventStats::eventName))
            .toList();
    }

    @Transactional
    public TicketDtos.ScanValidationResponse scanTicket(String qrToken, TicketDtos.ScanTicketRequest request) {
        Ticket ticket = ticketRepository.findByQrToken(qrToken)
            .orElseThrow(() -> new RuntimeException("Invalid QR code"));

        // Create scan record
        TicketScan scan = new TicketScan();
        scan.setTicket(ticket);
        scan.setScannedBy(request.scannedBy() != null ? request.scannedBy() : "");
        scan.setScanLocation(request.scanLocation() != null ? request.scanLocation() : "");
        scan.setDeviceInfo(request.deviceInfo());

        // Validate ticket
        ScanResult result;
        String message;
        boolean valid = false;

        if (ticket.getPaymentStatus() != PaymentStatus.Paid) {
            result = ScanResult.PaymentRequired;
            message = "Payment required for this ticket";
        } else if (ticket.isExpired()) {
            result = ScanResult.Expired;
            message = "Ticket has expired";
            ticket.setStatus(TicketStatus.Expired);
        } else if (ticket.getStatus() == TicketStatus.Cancelled) {
            result = ScanResult.Invalid;
            message = "Ticket has been cancelled";
        } else if (ticket.getUsageCount() >= ticket.getUsageLimit()) {
            result = ScanResult.UsageLimitReached;
            message = "Ticket has already been used";
            if (ticket.getStatus() == TicketStatus.Active) {
                ticket.setStatus(TicketStatus.Redeemed);
            }
        } else if (ticket.canBeUsed()) {
            result = ScanResult.Success;
            message = "Ticket is valid";
            valid = true;
            
            // Increment usage count
            ticket.setUsageCount(ticket.getUsageCount() + 1);
            ticket.setUpdatedAt(Instant.now());
            
            // Mark as redeemed if usage limit reached
            if (ticket.getUsageCount() >= ticket.getUsageLimit()) {
                ticket.setStatus(TicketStatus.Redeemed);
                ticket.setRedeemedAt(Instant.now());
            }
        } else {
            result = ScanResult.Invalid;
            message = "Ticket is not valid";
        }

        scan.setScanResult(result);
        ticketScanRepository.save(scan);
        ticketRepository.save(ticket);
        broadcastStatsUpdate();

        return new TicketDtos.ScanValidationResponse(
            valid,
            result,
            message,
            TicketResponse.from(ticket, customerUrl)
        );
    }

    @Transactional
    public TicketResponse updateTicketStatus(String ticketId, TicketStatus status) {
        Ticket ticket = ticketRepository.findById(ticketId)
            .orElseThrow(() -> new RuntimeException("Ticket not found: " + ticketId));
        
        ticket.setStatus(status);
        ticket.setUpdatedAt(Instant.now());
        
        if (status == TicketStatus.Cancelled) {
            ticket.setRedeemedAt(Instant.now());
        }
        
        ticket = ticketRepository.save(ticket);
        broadcastStatsUpdate();
        return TicketResponse.from(ticket, customerUrl);
    }

    @Transactional
    public TicketResponse updatePaymentStatus(String ticketId, PaymentStatus paymentStatus, String paymentReference) {
        Ticket ticket = ticketRepository.findById(ticketId)
            .orElseThrow(() -> new RuntimeException("Ticket not found: " + ticketId));
        
        ticket.setPaymentStatus(paymentStatus);
        if (paymentReference != null) {
            ticket.setPaymentReference(paymentReference);
        }
        ticket.setUpdatedAt(Instant.now());
        
        ticket = ticketRepository.save(ticket);
        broadcastStatsUpdate();
        return TicketResponse.from(ticket, customerUrl);
    }

    private void broadcastStatsUpdate() {
        List<TicketDtos.TicketEventStats> stats = getTicketStats(null);
        ticketStatsWebSocketHandler.broadcastTicketStats(stats);
        realtimeEventPublisher.publishTicketStats(stats);
    }

    public void refreshStatsBroadcast() {
        broadcastStatsUpdate();
    }

    private String generateTicketId() {
        return "TKT-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    private String generateQrToken() {
        return UUID.randomUUID().toString().replace("-", "");
    }
}
