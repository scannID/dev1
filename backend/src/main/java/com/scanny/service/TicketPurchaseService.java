package com.scanny.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.scanny.dto.PublicTicketDtos;
import com.scanny.dto.TicketDtos;
import com.scanny.dto.TicketResponse;
import com.scanny.entity.Ticket;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.PaymentStatus;
import com.scanny.model.enums.TicketStatus;
import com.scanny.payment.PaymentIntentStatus;
import com.scanny.entity.TicketQueueEntry;
import com.scanny.repository.TicketQueueRepository;
import com.scanny.repository.TicketRepository;import com.scanny.util.PhoneUtils;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TicketPurchaseService {

    private static final Pattern EMAIL_PATTERN = Pattern.compile(
        "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$"
    );
    private static final int SERVICE_FEE_PER_TRANSACTION = 700;

    private final TicketRepository ticketRepository;
    private final TicketQueueRepository ticketQueueRepository;
    private final WhatsAppNotificationService whatsAppNotificationService;
    private final TicketService ticketService;
    private final ObjectMapper objectMapper;
    private final Environment environment;
    private final long holdTtlMinutes;
    private final SystemBusyModeService systemBusyModeService;
    private final TicketWaitlistService ticketWaitlistService;

    /** Queue activates automatically when concurrent requests for an event exceed this. */
    private final int queueActivationThreshold;

    @Value("${scanny.scan-base-url:https://scanny.app}")
    private String customerUrl;

    public TicketPurchaseService(
            TicketRepository ticketRepository,
            TicketQueueRepository ticketQueueRepository,
            WhatsAppNotificationService whatsAppNotificationService,
            TicketService ticketService,
            ObjectMapper objectMapper,
            Environment environment,
            @Value("${scanny.tickets.hold-ttl-minutes:10}") long holdTtlMinutes,
            SystemBusyModeService systemBusyModeService,
            TicketWaitlistService ticketWaitlistService,
            @Value("${scanny.tickets.queue-activation-threshold:3}") int queueActivationThreshold) {
        this.ticketRepository = ticketRepository;
        this.ticketQueueRepository = ticketQueueRepository;
        this.whatsAppNotificationService = whatsAppNotificationService;
        this.ticketService = ticketService;
        this.objectMapper = objectMapper;
        this.environment = environment;
        this.holdTtlMinutes = Math.max(1, holdTtlMinutes);
        this.systemBusyModeService = systemBusyModeService;
        this.ticketWaitlistService = ticketWaitlistService;
        this.queueActivationThreshold = Math.max(1, queueActivationThreshold);
    }

    @Transactional
    public TicketResponse createPublicEvent(TicketDtos.CreateTicketRequest request) {
        if (request == null || request.eventName() == null || request.eventName().isBlank()) {
            throw new ApiException(400, "Event name is required");
        }
        TicketDtos.CreateTicketRequest normalized = new TicketDtos.CreateTicketRequest(
            request.ticketType() != null && !request.ticketType().isBlank() ? request.ticketType() : "EVENT",
            request.eventName().trim(),
            request.eventDate(),
            "",
            "",
            "",
            Math.max(0, request.price()),
            request.currency() != null && !request.currency().isBlank() ? request.currency() : "UGX",
            1_000_000_000,
            request.expiresAt(),
            "public-web",
            request.metadata()
        );
        return ticketService.createTicket(normalized);
    }

    @Transactional(readOnly = true)
    public PublicTicketDtos.EventInfoResponse getEventForPurchase(String masterQrToken) {
        Ticket master = requireEventTemplate(masterQrToken);
        Map<String, Object> meta = parseMetadata(master.getMetadata());
        Instant now = Instant.now();
        List<PublicTicketDtos.TicketClassOption> classes = parseClasses(
            meta, master.getTicketType(), master.getPrice(), master.getId(), now);
        List<PublicTicketDtos.TicketTableOption> tables = parseTables(meta, master.getId(), now);

        Instant saleStartsAt = master.getSaleStartsAt();
        Instant saleEndsAt = master.getSaleEndsAt();
        boolean saleOpen = (saleStartsAt == null || !now.isBefore(saleStartsAt))
            && (saleEndsAt == null || !now.isAfter(saleEndsAt));
        boolean queueEnabled = Boolean.TRUE.equals(meta.get("queueEnabled"))
            || "true".equalsIgnoreCase(String.valueOf(meta.get("queueEnabled")));

    return new PublicTicketDtos.EventInfoResponse(
            master.getId(),
            master.getEventName(),
            master.getEventDate() != null ? master.getEventDate().toString() : null,
            master.getCurrency(),
            stringMeta(meta, "template", "classic"),
            classes,
            tables,
            stringMeta(meta, "payTo", ""),
            customerUrl + "/ticket/" + master.getQrToken(),
            stringMeta(meta, "eventImageUrl", ""),
            stringMeta(meta, "host", ""),
            saleStartsAt != null ? saleStartsAt.toString() : null,
            saleEndsAt != null ? saleEndsAt.toString() : null,
            saleOpen
        );
    }

    @Transactional
    public PublicTicketDtos.PurchaseResponse startPurchase(PublicTicketDtos.PurchaseRequest request) {
        Ticket master = requireEventTemplateForUpdate(request.masterQrToken());
        Instant now = Instant.now();
        if (master.getSaleStartsAt() != null && now.isBefore(master.getSaleStartsAt())) {
            throw new ApiException(423, "Ticket sales open on " + master.getSaleStartsAt());
        }
        if (master.getSaleEndsAt() != null && now.isAfter(master.getSaleEndsAt())) {
            throw new ApiException(410, "Ticket sales for this event have closed");
        }

        String email = optionalEmail(request.holderEmail());
        String name = requireText(request.holderName(), "Your name is required");
        String phone = requirePhone(request.holderPhone());
        String ticketClass = requireText(request.ticketClass(), "Select a ticket class or table");
        int quantity = (request.quantity() == null || request.quantity() < 1) ? 1
                       : Math.min(request.quantity(), 10);

        org.slf4j.LoggerFactory.getLogger(TicketPurchaseService.class)
                .info("Ticket purchase start phone={} event={} qty={}", phone, master.getEventName(), quantity);

        // ── Auto-queue under high concurrency ──────────────────────────────────
        // Count how many requests are currently active (Waiting or Processing)
        // for this event. If we're over threshold, redirect this request into the
        // queue automatically — no merchant action required.
        long activeInQueue = ticketQueueRepository.countByMasterIdAndStatus(master.getId(), "Waiting")
            + ticketQueueRepository.countByMasterIdAndStatus(master.getId(), "Processing");

        if (activeInQueue >= queueActivationThreshold) {
            org.slf4j.LoggerFactory.getLogger(TicketPurchaseService.class)
                .info("AUTO_QUEUE event={} activeInQueue={} threshold={} phone={}",
                    master.getEventName(), activeInQueue, queueActivationThreshold, phone);
            // Delegate to joinQueue — returns a QueueStatusResponse wrapped as a 202
            // The controller checks for this and returns HTTP 202 when queueToken is set.
            throw new AutoQueueRedirectException(joinQueueInternal(request, master, name, phone, email, ticketClass, now));
        }

        // Skip duplicate-phone check for group bookings (qty>1 may be buying for friends)
        if (quantity == 1 && ticketRepository.existsByEventNameAndHolderPhoneAndPaymentStatusAndMasterTicketIdIsNotNull(
                master.getEventName(), phone, PaymentStatus.Paid)) {
            if (!h2ProfileActive()) {
                throw new ApiException(409, "This WhatsApp number already has a paid ticket for this event. Check WhatsApp or use a different number.");
            }
        }

        Map<String, Object> masterMeta = parseMetadata(master.getMetadata());
        validateClassSaleConstraints(masterMeta, ticketClass, request.presaleCode(), now);

        int basePrice = resolveSelectionPrice(masterMeta, ticketClass, master.getPrice());
        if (basePrice < 0) {
            throw new ApiException(400, "Unknown ticket class or table");
        }
        int pricePerTicket = basePrice + SERVICE_FEE_PER_TRANSACTION;

        Integer capacity = resolveSelectionCapacity(masterMeta, ticketClass);

        // Claim token bypasses the sold-out check for one ticket
        boolean hasValidClaim = request.claimToken() != null
            && ticketWaitlistService.isValidClaimToken(master.getId(), ticketClass, request.claimToken());

        if (!hasValidClaim) {
            assertInventoryAvailableForQuantity(master.getId(), ticketClass, capacity, quantity, now);
        }

        // Create all attendee tickets
        List<String> ticketIds = new ArrayList<>();
        List<String> viewUrls = new ArrayList<>();
        String paymentId = generateImmediatePaymentId();

        for (int i = 0; i < quantity; i++) {
            Ticket attendee = new Ticket();
            attendee.setId(generateUniqueTicketId());
            attendee.setQrToken(generateQrToken());
            attendee.setAccessToken(generateAccessToken());
            attendee.setMasterTicketId(master.getId());
            attendee.setTicketType(ticketClass);
            attendee.setEventName(master.getEventName());
            attendee.setEventDate(master.getEventDate());
            attendee.setHolderName(quantity > 1 && i > 0 ? name + " (guest " + (i + 1) + ")" : name);
            attendee.setHolderPhone(phone);
            attendee.setHolderEmail(email);
            attendee.setPrice(pricePerTicket);
            attendee.setCurrency(master.getCurrency());
            attendee.setUsageLimit(1);
            attendee.setUsageCount(0);
            attendee.setExpiresAt(master.getExpiresAt());
            attendee.setStatus(TicketStatus.Active);
            attendee.setPaymentStatus(PaymentStatus.Unpaid);
            attendee.setHoldExpiresAt(now.plus(holdTtlMinutes, ChronoUnit.MINUTES));
            attendee.setIssuedBy("public-purchase");
            attendee.setMetadata(serializeAttendeeMetadata(masterMeta, ticketClass));
            attendee.setCreatedAt(now);

            attendee = ticketRepository.save(attendee);

            // Instant-pay
            attendee.setPaymentStatus(PaymentStatus.Paid);
            attendee.setPaymentReference(paymentId);
            attendee.setHoldExpiresAt(null);
            attendee.setUpdatedAt(Instant.now());
            ticketRepository.save(attendee);

            ticketIds.add(attendee.getId());
            viewUrls.add(buildViewUrl(attendee.getAccessToken()));
        }

        if (hasValidClaim) {
            ticketWaitlistService.consumeClaimToken(request.claimToken());
        }

        ticketService.refreshStatsBroadcast();

        String firstId = ticketIds.get(0);
        String firstViewUrl = viewUrls.get(0);
        return new PublicTicketDtos.PurchaseResponse(
            firstId,
            shortCodeForTicketId(firstId),
            paymentId,
            PaymentIntentStatus.Paid,
            quantity > 1
                ? quantity + " tickets created and marked paid"
                : "Ticket created and marked paid",
            firstViewUrl,
            ticketIds,
            viewUrls
        );
    }

    /**
     * Internal queue entry creation — shared by joinQueue() and the auto-queue path in startPurchase().
     */
    private PublicTicketDtos.QueueStatusResponse joinQueueInternal(
            PublicTicketDtos.PurchaseRequest request,
            Ticket master,
            String name,
            String phone,
            String email,
            String ticketClass,
            Instant now) {
        String queueId = "Q-" + UUID.randomUUID().toString().replace("-", "").substring(0, 16).toUpperCase(Locale.ROOT);
        TicketQueueEntry entry = new TicketQueueEntry();
        entry.setId(queueId);
        entry.setMasterId(master.getId());
        entry.setTicketClass(ticketClass);
        entry.setHolderName(name);
        entry.setHolderPhone(phone);
        entry.setHolderEmail(email);
        entry.setPaymentPhone(request.paymentPhone());
        entry.setProvider(request.provider());
        entry.setPresaleCode(request.presaleCode());
        entry.setStatus("Waiting");
        entry.setQueuedAt(now);
        entry.setExpiresAt(now.plus(15, ChronoUnit.MINUTES));
        ticketQueueRepository.save(entry);

        long waitingAhead = ticketQueueRepository.countWaitingAhead(master.getId(), "Waiting", entry.getQueuedAt(), entry.getId());
        long totalWaiting = ticketQueueRepository.countByMasterIdAndStatus(master.getId(), "Waiting");
        int position = (int) waitingAhead + 1;
        int waitSeconds = Math.max(2, position * 2);

        return new PublicTicketDtos.QueueStatusResponse(
            queueId, "Waiting", position, totalWaiting, waitSeconds, null, null, null
        );
    }

    /**
     * Thrown internally when startPurchase() detects high concurrency and needs to
     * redirect the request into the queue. Caught by the controller which returns HTTP 202.
     */
    public static class AutoQueueRedirectException extends RuntimeException {
        private final PublicTicketDtos.QueueStatusResponse queueStatus;
        public AutoQueueRedirectException(PublicTicketDtos.QueueStatusResponse queueStatus) {
            super("Auto-queued due to high concurrency");
            this.queueStatus = queueStatus;
        }
        public PublicTicketDtos.QueueStatusResponse getQueueStatus() { return queueStatus; }
    }

    /** Waitlist delegation. */
    public PublicTicketDtos.WaitlistJoinResponse joinWaitlist(PublicTicketDtos.WaitlistJoinRequest request) {
        return ticketWaitlistService.join(request);
    }

    public void leaveWaitlist(String waitlistId) {
        ticketWaitlistService.leave(waitlistId);
    }

    @Transactional
    public void confirmPurchaseFromPayment(String attendeeTicketId, String paymentId) {
        Ticket ticket = ticketRepository.findById(attendeeTicketId)
            .orElseThrow(() -> new ApiException(404, "Ticket not found"));

        if (!ticket.isAttendeeTicket()) {
            throw new ApiException(400, "Not an attendee ticket");
        }
        if (ticket.getPaymentStatus() == PaymentStatus.Paid) {
            return;
        }

        ticket.setPaymentStatus(PaymentStatus.Paid);
        ticket.setPaymentReference(paymentId != null ? paymentId : "");
        ticket.setHoldExpiresAt(null);
        ticket.setUpdatedAt(Instant.now());
        ticketRepository.save(ticket);

        ticketService.refreshStatsBroadcast();
    }

    /** Call after purchase transaction commits (from controller). */
    public void deliverTicketWhatsApp(String attendeeTicketId, String viewUrl) {
        try {
            Ticket ticket = ticketRepository.findById(attendeeTicketId).orElse(null);
            if (ticket == null) {
                org.slf4j.LoggerFactory.getLogger(TicketPurchaseService.class)
                        .warn("WhatsApp skipped — ticket {} not found", attendeeTicketId);
                return;
            }
            whatsAppNotificationService.sendAttendeeTicket(ticket, viewUrl, buildGateQrPayload(ticket));
        } catch (Exception ex) {
            org.slf4j.LoggerFactory.getLogger(TicketPurchaseService.class)
                    .warn("WhatsApp delivery error for {}: {}", attendeeTicketId, ex.toString());
        }
    }

    @Transactional
    public PublicTicketDtos.QueueStatusResponse joinQueue(PublicTicketDtos.PurchaseRequest request) {
        Ticket master = requireEventTemplate(request.masterQrToken());
        Instant now = Instant.now();
        if (master.getSaleStartsAt() != null && now.isBefore(master.getSaleStartsAt())) {
            throw new ApiException(423, "Ticket sales open on " + master.getSaleStartsAt());
        }
        if (master.getSaleEndsAt() != null && now.isAfter(master.getSaleEndsAt())) {
            throw new ApiException(410, "Ticket sales for this event have closed");
        }

        String name = requireText(request.holderName(), "Your name is required");
        String phone = requirePhone(request.holderPhone());
        String ticketClass = requireText(request.ticketClass(), "Select a ticket class or table");
        String email = optionalEmail(request.holderEmail());

        Map<String, Object> masterMeta = parseMetadata(master.getMetadata());
        validateClassSaleConstraints(masterMeta, ticketClass, request.presaleCode(), now);

        return joinQueueInternal(request, master, name, phone, email, ticketClass, now);
    }

    @Transactional(readOnly = true)
    public PublicTicketDtos.QueueStatusResponse getQueueStatus(String queueToken) {
        if (queueToken == null || queueToken.isBlank()) {
            throw new ApiException(400, "Queue token is required");
        }
        TicketQueueEntry entry = ticketQueueRepository.findById(queueToken.trim())
            .orElseThrow(() -> new ApiException(404, "Queue entry not found"));

        if ("Waiting".equalsIgnoreCase(entry.getStatus())) {
            long waitingAhead = ticketQueueRepository.countWaitingAhead(
                entry.getMasterId(), "Waiting", entry.getQueuedAt(), entry.getId());
            long totalWaiting = ticketQueueRepository.countByMasterIdAndStatus(entry.getMasterId(), "Waiting");
            int position = (int) waitingAhead + 1;
            int waitSeconds = Math.max(2, position * 2);
            return new PublicTicketDtos.QueueStatusResponse(
                entry.getId(),
                "Waiting",
                position,
                totalWaiting,
                waitSeconds,
                null,
                null,
                null
            );
        } else if ("Processing".equalsIgnoreCase(entry.getStatus())) {
            return new PublicTicketDtos.QueueStatusResponse(
                entry.getId(),
                "Processing",
                1,
                1L,
                1,
                null,
                null,
                null
            );
        } else if ("Complete".equalsIgnoreCase(entry.getStatus())) {
            return new PublicTicketDtos.QueueStatusResponse(
                entry.getId(),
                "Complete",
                0,
                0L,
                0,
                entry.getAttendeeTicketId(),
                entry.getViewUrl(),
                null
            );
        } else if ("Expired".equalsIgnoreCase(entry.getStatus())) {
            return new PublicTicketDtos.QueueStatusResponse(
                entry.getId(),
                "Expired",
                null,
                null,
                null,
                null,
                null,
                entry.getErrorMessage() != null ? entry.getErrorMessage() : "Queue session expired"
            );
        } else {
            return new PublicTicketDtos.QueueStatusResponse(
                entry.getId(),
                "Failed",
                null,
                null,
                null,
                null,
                null,
                entry.getErrorMessage() != null ? entry.getErrorMessage() : "Purchase failed"
            );
        }
    }

    @Transactional
    public PublicTicketDtos.TransferInitiateResponse initiateTransfer(String accessToken) {
        if (accessToken == null || accessToken.isBlank()) {
            throw new ApiException(400, "Access token is required");
        }
        Ticket ticket = ticketRepository.findByAccessToken(accessToken.trim())
            .orElseThrow(() -> new ApiException(404, "Ticket not found"));

        if (ticket.getMasterTicketId() == null) {
            throw new ApiException(400, "Event templates cannot be transferred");
        }
        if (ticket.getPaymentStatus() != PaymentStatus.Paid) {
            throw new ApiException(400, "Only paid tickets can be transferred");
        }
        if (ticket.getStatus() != TicketStatus.Active) {
            throw new ApiException(400, "Ticket is " + ticket.getStatus() + " and cannot be transferred");
        }
        if (ticket.isExpired()) {
            throw new ApiException(400, "Ticket has expired and cannot be transferred");
        }

        String transferToken = "XFR-" + UUID.randomUUID().toString().replace("-", "").substring(0, 16).toUpperCase(Locale.ROOT);
        Instant expiresAt = Instant.now().plus(24, ChronoUnit.HOURS);

        ticket.setTransferToken(transferToken);
        ticket.setTransferExpiresAt(expiresAt);
        ticketRepository.save(ticket);

        String transferUrl = customerUrl + "/ticket/transfer/" + transferToken;
        return new PublicTicketDtos.TransferInitiateResponse(transferToken, transferUrl, expiresAt.toString());
    }

    @Transactional(readOnly = true)
    public PublicTicketDtos.TransferInfoResponse getTransferInfo(String transferToken) {
        if (transferToken == null || transferToken.isBlank()) {
            throw new ApiException(400, "Transfer token is required");
        }
        Ticket ticket = ticketRepository.findByTransferToken(transferToken.trim())
            .orElseThrow(() -> new ApiException(404, "Invalid or expired transfer link"));

        Instant now = Instant.now();
        if (ticket.getTransferExpiresAt() != null && now.isAfter(ticket.getTransferExpiresAt())) {
            return new PublicTicketDtos.TransferInfoResponse(
                ticket.getEventName(),
                ticket.getEventDate() != null ? ticket.getEventDate().toString() : null,
                ticket.getTicketType(),
                ticket.getHolderName(),
                null,
                false,
                "This transfer link has expired."
            );
        }

        if (ticket.getStatus() != TicketStatus.Active || ticket.getPaymentStatus() != PaymentStatus.Paid) {
            return new PublicTicketDtos.TransferInfoResponse(
                ticket.getEventName(),
                ticket.getEventDate() != null ? ticket.getEventDate().toString() : null,
                ticket.getTicketType(),
                ticket.getHolderName(),
                null,
                false,
                "This ticket is no longer eligible for transfer."
            );
        }

        return new PublicTicketDtos.TransferInfoResponse(
            ticket.getEventName(),
            ticket.getEventDate() != null ? ticket.getEventDate().toString() : null,
            ticket.getTicketType(),
            ticket.getHolderName(),
            ticket.getTransferExpiresAt() != null ? ticket.getTransferExpiresAt().toString() : null,
            true,
            null
        );
    }

    @Transactional
    public PublicTicketDtos.TransferAcceptResponse acceptTransfer(PublicTicketDtos.TransferAcceptRequest request) {
        if (request == null || request.transferToken() == null || request.transferToken().isBlank()) {
            throw new ApiException(400, "Transfer token is required");
        }
        Ticket ticket = ticketRepository.findByTransferToken(request.transferToken().trim())
            .orElseThrow(() -> new ApiException(404, "Invalid or expired transfer link"));

        Instant now = Instant.now();
        if (ticket.getTransferExpiresAt() != null && now.isAfter(ticket.getTransferExpiresAt())) {
            throw new ApiException(410, "This transfer link has expired");
        }
        if (ticket.getStatus() != TicketStatus.Active || ticket.getPaymentStatus() != PaymentStatus.Paid) {
            throw new ApiException(400, "This ticket is not active or not paid and cannot be transferred");
        }

        String newName = requireText(request.newHolderName(), "Recipient name is required");
        String newPhone = requirePhone(request.newHolderPhone());
        String newEmail = optionalEmail(request.newHolderEmail());

        String previousHolderPhone = ticket.getHolderPhone();
        String previousHolderName = ticket.getHolderName();

        ticket.setTransferredFromPhone(previousHolderPhone);
        ticket.setHolderName(newName);
        ticket.setHolderPhone(newPhone);
        ticket.setHolderEmail(newEmail);
        ticket.setTransferToken(null);
        ticket.setTransferExpiresAt(null);

        // Invalidate old link by rotating access token
        String newAccessToken = UUID.randomUUID().toString().replace("-", "");
        ticket.setAccessToken(newAccessToken);

        Ticket saved = ticketRepository.save(ticket);
        String viewUrl = customerUrl + "/ticket/view/" + saved.getAccessToken();

        // Deliver new pass to recipient
        try {
            deliverTicketWhatsApp(saved.getId(), viewUrl);
        } catch (Exception ex) {
            org.slf4j.LoggerFactory.getLogger(TicketPurchaseService.class)
                .warn("TRANSFER_RECIPIENT_WHATSAPP_FAILED err={}", ex.getMessage());
        }

        // Notify previous holder that transfer succeeded
        if (previousHolderPhone != null && !previousHolderPhone.isBlank()) {
            try {
                String transferNote = "Your ticket for " + saved.getEventName() + " (" + saved.getTicketType()
                    + ") has been successfully transferred to " + newName + ".";
                whatsAppNotificationService.sendText(previousHolderPhone, transferNote);
            } catch (Exception ex) {
                org.slf4j.LoggerFactory.getLogger(TicketPurchaseService.class)
                    .warn("TRANSFER_SENDER_WHATSAPP_FAILED err={}", ex.getMessage());
            }
        }

        return new PublicTicketDtos.TransferAcceptResponse(
            saved.getId(),
            viewUrl,
            "Ticket successfully transferred to " + newName
        );
    }

    @Transactional(readOnly = true)
    public PublicTicketDtos.AttendeeTicketView getAttendeeView(String accessToken) {
        Ticket ticket = ticketRepository.findByAccessToken(accessToken.trim())
            .orElseThrow(() -> new ApiException(404, "Ticket not found"));

        if (!ticket.isAttendeeTicket()) {
            throw new ApiException(404, "Ticket not found");
        }

        Map<String, Object> meta = parseMetadata(ticket.getMetadata());
        String purchaseUrl = "";
        if (ticket.getMasterTicketId() != null) {
            purchaseUrl = ticketRepository.findById(ticket.getMasterTicketId())
                .map(master -> customerUrl + "/ticket/" + master.getQrToken())
                .orElse("");
        }
        return new PublicTicketDtos.AttendeeTicketView(
            ticket.getId(),
            ticket.getTicketType(),
            ticket.getEventName(),
            ticket.getEventDate() != null ? ticket.getEventDate().toString() : null,
            ticket.getHolderName(),
            ticket.getHolderEmail(),
            ticket.getHolderPhone(),
            ticket.getPrice(),
            ticket.getCurrency(),
            ticket.getStatus().name(),
            ticket.getPaymentStatus().name(),
            ticket.canBeUsed(),
            stringMeta(meta, "template", "classic"),
            ticket.getMetadata(),
            buildViewUrl(ticket.getAccessToken()),
            ticket.getQrToken(),
            shortCodeForTicketId(ticket.getId()),
            buildGateQrPayload(ticket),
            buildGateUrl(ticket),
            purchaseUrl
        );
    }

    @Transactional
    public TicketDtos.ScanValidationResponse validateGatePayload(TicketDtos.ScanPayloadRequest request) {
        return ticketService.scanTicketPayload(request);
    }

    @Transactional(readOnly = true)
    public PublicTicketDtos.EventTrackingMetrics getEventTrackingMetrics(String rawTicketId) {
        String ticketId = normalizeTicketId(rawTicketId);
        Ticket seed = ticketRepository.findById(ticketId)
            .orElseThrow(() -> new ApiException(404, "No event found for that ticket ID"));

        Ticket master;
        if (seed.isEventTemplate()) {
            master = seed;
        } else if (seed.isAttendeeTicket() && seed.getMasterTicketId() != null) {
            master = ticketRepository.findById(seed.getMasterTicketId())
                .orElseThrow(() -> new ApiException(404, "No event found for that ticket ID"));
        } else {
            throw new ApiException(400, "That ticket ID is not an event tracking code");
        }
        List<Ticket> attendees = ticketRepository.findByMasterTicketIdOrderByCreatedAtDesc(master.getId());
        long ordered = attendees.size();
        long purchased = attendees.stream().filter(t -> t.getPaymentStatus() == PaymentStatus.Paid).count();
        long pending = attendees.stream().filter(t -> t.getPaymentStatus() == PaymentStatus.Unpaid).count();
        long redeemed = attendees.stream().filter(t -> t.getStatus() == TicketStatus.Redeemed).count();
        long totalCollected = attendees.stream()
            .filter(t -> t.getPaymentStatus() == PaymentStatus.Paid)
            .mapToLong(Ticket::getPrice)
            .sum();

        Map<String, Object> meta = parseMetadata(master.getMetadata());
        List<PublicTicketDtos.RecentAttendee> recent = attendees.stream()
            .limit(25)
            .map(t -> {
                boolean paid = t.getPaymentStatus() == PaymentStatus.Paid;
                String viewUrl = paid && t.getAccessToken() != null && !t.getAccessToken().isBlank()
                    ? buildViewUrl(t.getAccessToken())
                    : "";
                String qrPayload = paid ? buildGateQrPayload(t) : "";
                String gateUrl = paid ? buildGateUrl(t) : "";
                return new PublicTicketDtos.RecentAttendee(
                    t.getId(),
                    t.getHolderName(),
                    t.getHolderEmail(),
                    t.getHolderPhone(),
                    t.getTicketType(),
                    t.getPrice(),
                    t.getCurrency(),
                    t.getPaymentStatus().name(),
                    t.getStatus().name(),
                    t.getCreatedAt(),
                    viewUrl,
                    qrPayload,
                    gateUrl
                );
            })
            .toList();

        return new PublicTicketDtos.EventTrackingMetrics(
            master.getId(),
            master.getEventName(),
            master.getEventDate() != null ? master.getEventDate().toString() : null,
            stringMeta(meta, "host", ""),
            stringMeta(meta, "eventImageUrl", ""),
            master.getStatus().name(),
            ordered,
            purchased,
            pending,
            redeemed,
            totalCollected,
            master.getCurrency() != null ? master.getCurrency() : "UGX",
            customerUrl + "/ticket/" + master.getQrToken(),
            master.getCreatedAt(),
            recent
        );
    }

    @Transactional(readOnly = true)
    public List<PublicTicketDtos.RedeemedAttendee> getRedeemedAttendees(String rawEventId, String query) {
        String eventId = normalizeTicketId(rawEventId);
        Ticket seed = ticketRepository.findById(eventId)
            .orElseThrow(() -> new ApiException(404, "No event found for that ticket ID"));

        Ticket master;
        if (seed.isEventTemplate()) {
            master = seed;
        } else if (seed.isAttendeeTicket() && seed.getMasterTicketId() != null) {
            master = ticketRepository.findById(seed.getMasterTicketId())
                .orElseThrow(() -> new ApiException(404, "No event found for that ticket ID"));
        } else {
            throw new ApiException(400, "That ticket ID is not an event tracking code");
        }

        String codeQuery = query == null ? "" : query.trim().replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
        boolean hasSearch = !codeQuery.isBlank();
        if (hasSearch && codeQuery.length() != 4) {
            return List.of();
        }

        return ticketRepository.findByMasterTicketIdOrderByCreatedAtDesc(master.getId()).stream()
            .filter(Ticket::isAttendeeTicket)
            .filter(t -> t.getStatus() == TicketStatus.Redeemed)
            .filter(t -> {
                if (!hasSearch) return true;
                String ticketCode = shortCodeForTicketId(t.getId());
                return ticketCode.equalsIgnoreCase(codeQuery);
            })
            .map(t -> new PublicTicketDtos.RedeemedAttendee(
                t.getId(),
                shortCodeForTicketId(t.getId()),
                t.getHolderName(),
                t.getHolderPhone(),
                t.getTicketType(),
                t.getPaymentStatus() != null ? t.getPaymentStatus().name() : "",
                t.getStatus() != null ? t.getStatus().name() : "",
                t.getRedeemedAt() != null ? t.getRedeemedAt() : t.getUpdatedAt()
            ))
            .toList();
    }

    private String normalizeTicketId(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ApiException(400, "Ticket ID is required");
        }
        String normalized = raw.trim().toUpperCase(Locale.ROOT);
        if (normalized.startsWith("#")) {
            normalized = normalized.substring(1).trim();
        }
        if (normalized.isBlank()) {
            throw new ApiException(400, "Ticket ID is required");
        }
        return normalized;
    }

    private Ticket requireEventTemplate(String qrTokenOrId) {
        // System-wide busy mode blocks all ticket purchases.
        if (systemBusyModeService.isSystemBusy()) {
            throw new ApiException(503, systemBusyModeService.getPauseMessage());
        }
        String clean = qrTokenOrId.trim();
        Ticket ticket = ticketRepository.findByQrToken(clean)
            .or(() -> ticketRepository.findById(clean))
            .orElseThrow(() -> new ApiException(404, "Event not found"));
        if (!ticket.isEventTemplate()) {
            throw new ApiException(400, "This QR is an individual ticket, not an event purchase link");
        }
        if (ticket.getStatus() == TicketStatus.Cancelled) {
            throw new ApiException(410, "Ticket sales for this event have been stopped");
        }
        return ticket;
    }

    /** Lock the master event row so concurrent purchases cannot oversell. */
    private Ticket requireEventTemplateForUpdate(String qrToken) {
        Ticket unlocked = requireEventTemplate(qrToken);
        return ticketRepository.findByIdForUpdate(unlocked.getId())
            .orElseThrow(() -> new ApiException(404, "Event not found"));
    }

    private void assertInventoryAvailable(String masterId, String selection, Integer capacity, Instant now) {
        if (capacity == null) {
            return;
        }
        long sold = ticketRepository.countSoldByMasterAndType(masterId, selection);
        long held = ticketRepository.countActiveHoldsByMasterAndType(masterId, selection, now);
        if (sold + held >= capacity) {
            throw new ApiException(409, "Sold out — no more tickets left for " + selection);
        }
    }

    private void assertInventoryAvailableForQuantity(String masterId, String selection, Integer capacity, int quantity, Instant now) {
        if (capacity == null) {
            return;
        }
        long sold = ticketRepository.countSoldByMasterAndType(masterId, selection);
        long held = ticketRepository.countActiveHoldsByMasterAndType(masterId, selection, now);
        long available = capacity - sold - held;
        if (available <= 0) {
            throw new ApiException(409, "Sold out — no more tickets left for " + selection);
        }
        if (available < quantity) {
            throw new ApiException(409, "Only " + available + " ticket(s) left for " + selection
                + ". Reduce your quantity.");
        }
    }

    private InventorySnapshot inventoryFor(String masterId, String selection, Integer capacity, Instant now) {
        int sold = (int) ticketRepository.countSoldByMasterAndType(masterId, selection);
        int held = (int) ticketRepository.countActiveHoldsByMasterAndType(masterId, selection, now);
        if (capacity == null) {
            return new InventorySnapshot(null, sold, held, null, false);
        }
        int remaining = Math.max(0, capacity - sold - held);
        return new InventorySnapshot(capacity, sold, held, remaining, remaining == 0);
    }

    private record InventorySnapshot(
        Integer capacity,
        int sold,
        int held,
        Integer remaining,
        boolean soldOut
    ) {}

    private String buildViewUrl(String accessToken) {
        return customerUrl + "/ticket/view/" + accessToken;
    }

    private String buildGateQrPayload(Ticket ticket) {
        Map<String, String> payload = new LinkedHashMap<>();
        payload.put("v", "1");
        payload.put("ticketId", ticket.getId());
        payload.put("code", shortCodeForTicketId(ticket.getId()));
        payload.put("eventId", ticket.getMasterTicketId() != null ? ticket.getMasterTicketId() : "");
        payload.put("paymentId", ticket.getPaymentReference() != null ? ticket.getPaymentReference() : "");
        payload.put("qrToken", ticket.getQrToken());
        try {
            String json = objectMapper.writeValueAsString(payload);
            String encoded = Base64.getUrlEncoder().withoutPadding().encodeToString(json.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return "SCANNY:TICKET:" + encoded;
        } catch (Exception e) {
            return ticket.getQrToken();
        }
    }

    private String buildGateUrl(Ticket ticket) {
        String payload = buildGateQrPayload(ticket);
        try {
            return customerUrl + "/ticket/gate?p=" + java.net.URLEncoder.encode(payload, java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception e) {
            return customerUrl + "/ticket/gate?p=" + payload;
        }
    }

    private String serializeAttendeeMetadata(Map<String, Object> masterMeta, String ticketClass) {
        try {
            Map<String, Object> copy = new LinkedHashMap<>(masterMeta);
            copy.put("selectedClass", ticketClass);
            copy.put("issuedVia", "public-purchase");
            return objectMapper.writeValueAsString(copy);
        } catch (Exception e) {
            return "{}";
        }
    }

    @SuppressWarnings("unchecked")
    private List<PublicTicketDtos.TicketClassOption> parseClasses(
            Map<String, Object> meta,
            String fallbackType,
            int fallbackPrice,
            String masterId,
            Instant now) {
        Object raw = meta.get("ticketClasses");
        List<PublicTicketDtos.TicketClassOption> classes = new ArrayList<>();
        if (raw instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> map) {
                    String name = String.valueOf(map.get("name"));
                    int price = parsePrice(map.get("fee"), fallbackPrice);
                    if (!name.isBlank() && !"null".equalsIgnoreCase(name)) {
                        Integer capacity = parseOptionalCapacity(map.get("capacity"));
                        InventorySnapshot inv = inventoryFor(masterId, name, capacity, now);
                        String saleEndsAt = parseOptionalString(map.get("saleEndsAt"));
                        boolean presaleRequired = parsePresaleRequired(map);
                        classes.add(new PublicTicketDtos.TicketClassOption(
                            name,
                            price,
                            inv.capacity(),
                            inv.sold(),
                            inv.held(),
                            inv.remaining(),
                            inv.soldOut(),
                            saleEndsAt,
                            presaleRequired
                        ));
                    }
                }
            }
        }
        if (classes.isEmpty()) {
            InventorySnapshot inv = inventoryFor(masterId, fallbackType, null, now);
            classes.add(new PublicTicketDtos.TicketClassOption(
                fallbackType,
                fallbackPrice,
                inv.capacity(),
                inv.sold(),
                inv.held(),
                inv.remaining(),
                inv.soldOut(),
                null,
                false
            ));
        }
        return classes;
    }

    @SuppressWarnings("unchecked")
    private List<PublicTicketDtos.TicketTableOption> parseTables(
            Map<String, Object> meta,
            String masterId,
            Instant now) {
        Object raw = meta.get("tables");
        List<PublicTicketDtos.TicketTableOption> tables = new ArrayList<>();
        if (!(raw instanceof List<?> list)) {
            return tables;
        }
        for (Object item : list) {
            if (item instanceof Map<?, ?> map) {
                String name = String.valueOf(map.get("name"));
                if (name.isBlank() || "null".equalsIgnoreCase(name)) {
                    continue;
                }
                int seats = parsePrice(map.get("seats"), 0);
                int price = parsePrice(map.get("price"), 0);
                Integer capacity = parseOptionalCapacity(map.get("capacity"));
                InventorySnapshot inv = inventoryFor(masterId, name, capacity, now);
                String saleEndsAt = parseOptionalString(map.get("saleEndsAt"));
                tables.add(new PublicTicketDtos.TicketTableOption(
                    name,
                    seats,
                    price,
                    inv.capacity(),
                    inv.sold(),
                    inv.held(),
                    inv.remaining(),
                    inv.soldOut(),
                    saleEndsAt
                ));
            }
        }
        return tables;
    }

    private int resolveSelectionPrice(Map<String, Object> meta, String selection, int fallbackPrice) {
        Object rawClasses = meta.get("ticketClasses");
        boolean hasClasses = false;
        if (rawClasses instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> map) {
                    String name = String.valueOf(map.get("name"));
                    if (name.isBlank() || "null".equalsIgnoreCase(name)) {
                        continue;
                    }
                    hasClasses = true;
                    if (name.equalsIgnoreCase(selection)) {
                        return parsePrice(map.get("fee"), fallbackPrice);
                    }
                }
            }
        }
        Object rawTables = meta.get("tables");
        if (rawTables instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> map) {
                    String name = String.valueOf(map.get("name"));
                    if (name.equalsIgnoreCase(selection)) {
                        return parsePrice(map.get("price"), 0);
                    }
                }
            }
        }
        if (!hasClasses) {
            return fallbackPrice;
        }
        return -1;
    }

    private Integer resolveSelectionCapacity(Map<String, Object> meta, String selection) {
        Object rawClasses = meta.get("ticketClasses");
        if (rawClasses instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> map) {
                    String name = String.valueOf(map.get("name"));
                    if (name.equalsIgnoreCase(selection)) {
                        return parseOptionalCapacity(map.get("capacity"));
                    }
                }
            }
        }
        Object rawTables = meta.get("tables");
        if (rawTables instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> map) {
                    String name = String.valueOf(map.get("name"));
                    if (name.equalsIgnoreCase(selection)) {
                        return parseOptionalCapacity(map.get("capacity"));
                    }
                }
            }
        }
        return null;
    }

    private void validateClassSaleConstraints(Map<String, Object> meta, String selection, String providedCode, Instant now) {
        Object rawClasses = meta.get("ticketClasses");
        if (rawClasses instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> map) {
                    String name = String.valueOf(map.get("name"));
                    if (name.equalsIgnoreCase(selection)) {
                        String saleEndsAtStr = parseOptionalString(map.get("saleEndsAt"));
                        if (saleEndsAtStr != null) {
                            Instant classEnd = null;
                            try {
                                classEnd = Instant.parse(saleEndsAtStr);
                            } catch (Exception ignored) {
                            }
                            if (classEnd != null && now.isAfter(classEnd)) {
                                throw new ApiException(410, "Sales for ticket class " + selection + " have ended");
                            }
                        }
                        String presaleCode = parseOptionalString(map.get("presaleCode"));
                        boolean presaleReq = parsePresaleRequired(map);
                        if (presaleReq && presaleCode != null && !presaleCode.isBlank()) {
                            if (providedCode == null || !presaleCode.trim().equalsIgnoreCase(providedCode.trim())) {
                                throw new ApiException(403, "Invalid presale code for " + selection);
                            }
                        }
                        return;
                    }
                }
            }
        }
        Object rawTables = meta.get("tables");
        if (rawTables instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> map) {
                    String name = String.valueOf(map.get("name"));
                    if (name.equalsIgnoreCase(selection)) {
                        String saleEndsAtStr = parseOptionalString(map.get("saleEndsAt"));
                        if (saleEndsAtStr != null) {
                            Instant tableEnd = null;
                            try {
                                tableEnd = Instant.parse(saleEndsAtStr);
                            } catch (Exception ignored) {
                            }
                            if (tableEnd != null && now.isAfter(tableEnd)) {
                                throw new ApiException(410, "Sales for table " + selection + " have ended");
                            }
                        }
                        return;
                    }
                }
            }
        }
    }

    private Integer parseOptionalCapacity(Object value) {
        if (value == null) {
            return null;
        }
        String digits = String.valueOf(value).replaceAll("[^0-9]", "").trim();
        if (digits.isBlank()) {
            return null;
        }
        int capacity = Integer.parseInt(digits);
        return capacity > 0 ? capacity : null;
    }

    private int parsePrice(Object fee, int fallback) {
        if (fee == null) {
            return fallback;
        }
        String digits = String.valueOf(fee).replaceAll("[^0-9]", "");
        if (digits.isBlank()) {
            return fallback;
        }
        return Integer.parseInt(digits);
    }

    private static String parseOptionalString(Object value) {
        if (value == null) {
            return null;
        }
        String str = String.valueOf(value).trim();
        return str.isBlank() || "null".equalsIgnoreCase(str) ? null : str;
    }

    private static boolean parsePresaleRequired(Map<?, ?> map) {
        Object req = map.get("presaleRequired");
        if (req instanceof Boolean b) {
            return b;
        }
        if (req != null && "true".equalsIgnoreCase(String.valueOf(req).trim())) {
            return true;
        }
        Object code = map.get("presaleCode");
        return code != null && !String.valueOf(code).trim().isBlank() && !"null".equalsIgnoreCase(String.valueOf(code).trim());
    }

    private Map<String, Object> parseMetadata(String metadata) {
        if (metadata == null || metadata.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(metadata, new TypeReference<>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }

    private static String stringMeta(Map<String, Object> meta, String key, String fallback) {
        Object value = meta.get(key);
        return value == null ? fallback : String.valueOf(value);
    }

    private static String optionalEmail(String email) {
        if (email == null || email.isBlank()) {
            return "";
        }
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        if (!EMAIL_PATTERN.matcher(normalized).matches()) {
            throw new ApiException(400, "Enter a valid email address");
        }
        return normalized;
    }

    private static String requirePhone(String phone) {
        String normalized = PhoneUtils.normalize(phone);
        if (normalized.isBlank() || normalized.length() < 9) {
            throw new ApiException(400, "WhatsApp number is required");
        }
        return normalized;
    }

    private static String requireText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new ApiException(400, message);
        }
        return value.trim();
    }

    private boolean h2ProfileActive() {
        for (String profile : environment.getActiveProfiles()) {
            if ("h2".equalsIgnoreCase(profile)) {
                return true;
            }
        }
        return false;
    }

    private String generateUniqueTicketId() {
        for (int i = 0; i < 12; i++) {
            String candidate = generateTicketId();
            if (!ticketRepository.existsById(candidate)) {
                return candidate;
            }
        }
        throw new ApiException(500, "Could not generate a unique ticket code");
    }

    private static String generateTicketId() {
        final char[] alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".toCharArray();
        ThreadLocalRandom random = ThreadLocalRandom.current();
        char[] out = new char[4];
        for (int i = 0; i < out.length; i++) {
            out[i] = alphabet[random.nextInt(alphabet.length)];
        }
        return new String(out);
    }

    private static String generateQrToken() {
        return UUID.randomUUID().toString().replace("-", "");
    }

    private static String generateAccessToken() {
        return UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    }

    private static String generateImmediatePaymentId() {
        return "PAY-LOCAL-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
    }

    private static String shortCodeForTicketId(String ticketId) {
        if (ticketId == null || ticketId.isBlank()) {
            return "";
        }
        String normalized = ticketId.replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
        if (normalized.length() <= 4) {
            return normalized;
        }
        return normalized.substring(normalized.length() - 4);
    }
}
