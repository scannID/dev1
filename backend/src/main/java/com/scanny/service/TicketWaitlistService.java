package com.scanny.service;

import com.scanny.dto.PublicTicketDtos;
import com.scanny.entity.Ticket;
import com.scanny.entity.TicketWaitlist;
import com.scanny.exception.ApiException;
import com.scanny.repository.TicketRepository;
import com.scanny.repository.TicketWaitlistRepository;
import com.scanny.util.PhoneUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class TicketWaitlistService {

    private static final Logger log = LoggerFactory.getLogger(TicketWaitlistService.class);
    /** How long the one-time purchase link is valid once sent. */
    private static final int CLAIM_TTL_MINUTES = 30;

    private final TicketWaitlistRepository waitlistRepository;
    private final TicketRepository ticketRepository;
    private final WhatsAppNotificationService whatsAppNotificationService;

    public TicketWaitlistService(
            TicketWaitlistRepository waitlistRepository,
            TicketRepository ticketRepository,
            WhatsAppNotificationService whatsAppNotificationService) {
        this.waitlistRepository = waitlistRepository;
        this.ticketRepository = ticketRepository;
        this.whatsAppNotificationService = whatsAppNotificationService;
    }

    // ── Join ─────────────────────────────────────────────────────────────────

    @Transactional
    public PublicTicketDtos.WaitlistJoinResponse join(PublicTicketDtos.WaitlistJoinRequest request) {
        String masterId = requireText(request.masterTicketId(), "Event ID is required");
        String ticketClass = requireText(request.ticketClass(), "Ticket class is required");
        String name = requireText(request.holderName(), "Your name is required");
        String phone = PhoneUtils.normalize(request.holderPhone());
        if (phone.isBlank() || phone.length() < 9) {
            throw new ApiException(400, "A valid WhatsApp number is required");
        }

        // Verify the master event exists
        Ticket master = ticketRepository.findById(masterId)
            .orElseThrow(() -> new ApiException(404, "Event not found"));
        if (!master.isEventTemplate()) {
            throw new ApiException(400, "Invalid event ID");
        }

        // Idempotent — one entry per phone per event
        if (waitlistRepository.existsByMasterIdAndHolderPhone(masterId, phone)) {
            long position = waitlistRepository.countWaiting(masterId, ticketClass) + 1;
            return new PublicTicketDtos.WaitlistJoinResponse(
                true,
                "You're already on the waitlist.",
                (int) position,
                null
            );
        }

        String id = "WL-" + UUID.randomUUID().toString().replace("-", "").substring(0, 16).toUpperCase(Locale.ROOT);
        TicketWaitlist entry = new TicketWaitlist();
        entry.setId(id);
        entry.setMasterId(masterId);
        entry.setTicketClass(ticketClass);
        entry.setHolderName(name);
        entry.setHolderPhone(phone);
        entry.setNotified(false);
        entry.setJoinedAt(Instant.now());
        waitlistRepository.save(entry);

        long position = waitlistRepository.countWaiting(masterId, ticketClass);
        log.info("WAITLIST_JOIN id={} master={} class={} phone={} pos={}",
            id, masterId, ticketClass, phone, position);

        return new PublicTicketDtos.WaitlistJoinResponse(
            true,
            "You're on the waitlist! We'll WhatsApp you when a ticket becomes available.",
            (int) position,
            id
        );
    }

    // ── Leave ────────────────────────────────────────────────────────────────

    @Transactional
    public void leave(String waitlistId) {
        TicketWaitlist entry = waitlistRepository.findById(waitlistId)
            .orElseThrow(() -> new ApiException(404, "Waitlist entry not found"));
        waitlistRepository.delete(entry);
        log.info("WAITLIST_LEAVE id={}", waitlistId);
    }

    // ── Notify next person when a slot opens ─────────────────────────────────
    //
    // Called from:
    //  - TicketHoldExpiryScheduler  (when an unpaid hold expires)
    //  - acceptTransfer             (when a ticket is transferred away — frees a conceptual slot
    //                                only if the class was truly sold out before)
    //
    // Notifies at most `slots` people. Each person gets a unique 30-min claim token.

    @Transactional
    public void notifyNext(String masterId, String ticketClass, int slots) {
        if (slots <= 0) return;
        List<TicketWaitlist> pending =
            waitlistRepository.findPendingByMasterAndClass(masterId, ticketClass);
        int toNotify = Math.min(slots, pending.size());
        for (int i = 0; i < toNotify; i++) {
            TicketWaitlist entry = pending.get(i);
            String claimToken = "CLM-" + UUID.randomUUID().toString().replace("-", "")
                .substring(0, 16).toUpperCase(Locale.ROOT);
            Instant claimExpires = Instant.now().plus(CLAIM_TTL_MINUTES, ChronoUnit.MINUTES);
            entry.setClaimToken(claimToken);
            entry.setClaimExpiresAt(claimExpires);
            entry.setNotified(true);
            entry.setNotifiedAt(Instant.now());
            waitlistRepository.save(entry);

            // Build the purchase URL with the claim token pre-filled
            Ticket master = ticketRepository.findById(masterId).orElse(null);
            if (master != null) {
                String purchaseUrl = buildClaimUrl(master, entry.getTicketClass(), claimToken);
                String message = "Good news " + entry.getHolderName() + "! A " + entry.getTicketClass()
                    + " ticket for " + master.getEventName() + " just opened up.\n\n"
                    + "Claim it in the next " + CLAIM_TTL_MINUTES + " minutes: " + purchaseUrl
                    + "\n\nThis link expires soon.";
                try {
                    whatsAppNotificationService.sendText(entry.getHolderPhone(), message);
                    log.info("WAITLIST_NOTIFIED id={} phone={} event={}",
                        entry.getId(), entry.getHolderPhone(), master.getEventName());
                } catch (Exception ex) {
                    log.warn("WAITLIST_NOTIFY_FAILED id={} err={}", entry.getId(), ex.getMessage());
                }
            }
        }
    }

    // ── Validate a claim token (called during purchase to skip sold-out check) ──

    @Transactional(readOnly = true)
    public boolean isValidClaimToken(String masterId, String ticketClass, String claimToken) {
        if (claimToken == null || claimToken.isBlank()) return false;
        return waitlistRepository.findByClaimToken(claimToken.trim())
            .map(entry ->
                entry.getMasterId().equals(masterId)
                && entry.getTicketClass().equalsIgnoreCase(ticketClass)
                && entry.getClaimExpiresAt() != null
                && Instant.now().isBefore(entry.getClaimExpiresAt())
            )
            .orElse(false);
    }

    /** Mark the claim token as used (consumed at purchase). */
    @Transactional
    public void consumeClaimToken(String claimToken) {
        if (claimToken == null || claimToken.isBlank()) return;
        waitlistRepository.findByClaimToken(claimToken.trim()).ifPresent(entry -> {
            entry.setClaimToken(null);
            entry.setClaimExpiresAt(null);
            waitlistRepository.save(entry);
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String buildClaimUrl(Ticket master, String ticketClass, String claimToken) {
        // The frontend reads ?claim= from the purchase page URL
        try {
            return "https://kode.ug/ticket/" + master.getQrToken()
                + "?class=" + java.net.URLEncoder.encode(ticketClass, "UTF-8")
                + "&claim=" + claimToken;
        } catch (Exception e) {
            return "https://kode.ug/ticket/" + master.getQrToken();
        }
    }

    private static String requireText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new ApiException(400, message);
        }
        return value.trim();
    }
}
