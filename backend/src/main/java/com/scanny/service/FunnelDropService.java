package com.scanny.service;

import com.scanny.dto.FunnelDtos;
import com.scanny.entity.CustomerFunnelDrop;
import com.scanny.repository.CustomerFunnelDropRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Manages customer funnel drop-off recording, nudge querying, and feedback collection.
 *
 * <p>Logic overview:
 * <ol>
 *   <li><b>Record drop</b> — called via POST when the customer leaves without ordering.
 *       Upserts a single un-notified row per (deviceId, businessId): updates the existing
 *       open row if one exists, otherwise inserts a new one. Rows from completed orders are
 *       never overwritten (those have notified=true from the order-placed flow).</li>
 *   <li><b>Get nudge</b> — called on the customer's <em>next</em> scan. Returns the pending
 *       drop info if one exists, then marks it as notified so the banner appears exactly once.
 *       If no pending drop exists, returns {@link FunnelDtos.NudgeResponse#none()}.</li>
 *   <li><b>Submit feedback</b> — saves the reason/text chosen from the nudge banner.</li>
 *   <li><b>Analytics</b> — returns step and reason breakdowns for the admin console.</li>
 * </ol>
 */
@Service
public class FunnelDropService {

    private static final Logger log = LoggerFactory.getLogger(FunnelDropService.class);

    /** Steps that are valid for recording. Anything else is ignored. */
    private static final Set<String> VALID_STEPS = Set.of("menu", "cart", "details", "pay");

    /**
     * Valid reason codes for feedback.
     * The frontend sends these as short snake_case keys matching the chip labels.
     */
    private static final Set<String> VALID_REASONS = Set.of(
            "too_expensive", "long_wait", "just_browsing",
            "changed_mind", "payment_issue", "menu_limited", "other"
    );

    private final CustomerFunnelDropRepository funnelDropRepository;

    public FunnelDropService(CustomerFunnelDropRepository funnelDropRepository) {
        this.funnelDropRepository = funnelDropRepository;
    }

    // ── Record drop ───────────────────────────────────────────────────────────

    /**
     * Upserts a funnel drop for the given device + business.
     * <p>
     * If an un-notified row already exists for this (deviceId, businessId), it is updated
     * in place (step, phone, qrToken, droppedAt). Otherwise a new row is inserted.
     * Rows with notified=true (nudge already shown) are left untouched — those represent
     * completed nudge cycles. A fresh insert starts the next cycle.
     * <p>
     * No-ops silently if deviceId is blank or lastStep is not a recognised step.
     */
    @Transactional
    public void recordDrop(String businessId, FunnelDtos.RecordDropRequest req) {
        if (isBlank(req.deviceId())) return;
        if (!VALID_STEPS.contains(req.lastStep())) {
            log.debug("[Funnel] Ignoring unknown step '{}' for device {}", req.lastStep(), req.deviceId());
            return;
        }

        Optional<CustomerFunnelDrop> existing =
                funnelDropRepository.findByDeviceIdAndBusinessIdAndNotifiedFalse(
                        req.deviceId(), businessId);

        CustomerFunnelDrop drop = existing.orElseGet(() -> {
            CustomerFunnelDrop d = new CustomerFunnelDrop();
            d.setDeviceId(req.deviceId());
            d.setBusinessId(businessId);
            return d;
        });

        drop.setLastStep(req.lastStep());
        drop.setQrToken(req.qrToken() != null ? req.qrToken() : "");
        drop.setDroppedAt(Instant.now());
        if (req.phone() != null && !req.phone().isBlank()) {
            drop.setPhone(req.phone().trim());
        }

        funnelDropRepository.save(drop);
    }

    // ── Get nudge ─────────────────────────────────────────────────────────────

    /**
     * Returns the pending nudge for a device at a business, then immediately
     * marks it as notified so the banner is shown only once.
     * <p>
     * This is called when the customer scans and the menu page loads.
     */
    @Transactional
    public FunnelDtos.NudgeResponse getNudgeAndMarkNotified(String businessId, String deviceId) {
        if (isBlank(deviceId)) return FunnelDtos.NudgeResponse.none();

        Optional<CustomerFunnelDrop> opt =
                funnelDropRepository.findByDeviceIdAndBusinessIdAndNotifiedFalse(deviceId, businessId);

        if (opt.isEmpty()) return FunnelDtos.NudgeResponse.none();

        CustomerFunnelDrop drop = opt.get();
        String lastStep = drop.getLastStep();

        // Mark notified so the nudge won't show again on next scan
        drop.setNotified(true);
        funnelDropRepository.save(drop);

        return FunnelDtos.NudgeResponse.pending(lastStep);
    }

    // ── Submit feedback ───────────────────────────────────────────────────────

    /**
     * Saves feedback from the nudge banner.
     * Finds the most recent notified (but not yet feedback-given) row for the device,
     * updates it with the reason and optional text.
     */
    @Transactional
    public void submitFeedback(String businessId, FunnelDtos.SubmitFeedbackRequest req) {
        if (isBlank(req.deviceId())) return;

        String safeReason = VALID_REASONS.contains(req.reason()) ? req.reason() : "other";

        // Look for the most recently notified-but-no-feedback-yet row
        funnelDropRepository
                .findTopByDeviceIdAndBusinessIdOrderByDroppedAtDesc(req.deviceId(), businessId)
                .ifPresent(drop -> {
                    if (drop.isFeedbackGiven()) return; // already submitted
                    drop.setFeedbackGiven(true);
                    drop.setFeedbackReason(safeReason);
                    if (req.text() != null && !req.text().isBlank()) {
                        drop.setFeedbackText(req.text().trim());
                    }
                    drop.setFeedbackAt(Instant.now());
                    funnelDropRepository.save(drop);
                });
    }

    // ── Analytics ─────────────────────────────────────────────────────────────

    /**
     * Returns funnel drop-off analytics for the admin console.
     *
     * @param businessId target business
     * @param days       look-back window in days (e.g. 7, 30)
     */
    @Transactional(readOnly = true)
    public FunnelDtos.FunnelAnalyticsResponse getAnalytics(String businessId, int days) {
        Instant to   = Instant.now();
        Instant from = to.minus(Math.max(1, days), ChronoUnit.DAYS);

        long total = funnelDropRepository.countByBusinessIdAndDroppedAtBetween(businessId, from, to);

        List<FunnelDtos.StepDropCount> byStep =
                funnelDropRepository.countByStepForBusiness(businessId, from, to).stream()
                        .map(row -> new FunnelDtos.StepDropCount((String) row[0], (Long) row[1]))
                        .toList();

        List<FunnelDtos.FeedbackReasonCount> byReason =
                funnelDropRepository.countFeedbackReasonForBusiness(businessId, from, to).stream()
                        .map(row -> new FunnelDtos.FeedbackReasonCount((String) row[0], (Long) row[1]))
                        .toList();

        return new FunnelDtos.FunnelAnalyticsResponse(total, byStep, byReason);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
