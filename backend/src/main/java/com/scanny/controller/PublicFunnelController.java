package com.scanny.controller;

import com.scanny.dto.FunnelDtos;
import com.scanny.service.FunnelDropService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public (no-auth) endpoints for customer-side funnel drop-off tracking.
 *
 * <p>All three endpoints are under {@code /api/public/businesses/{businessId}/funnel}
 * which is already permitted by the SecurityConfig wildcard
 * {@code GET/POST /api/public/**}.
 *
 * <h3>Endpoints</h3>
 * <ul>
 *   <li>{@code POST /api/public/businesses/{id}/funnel/drop}
 *       — record a drop-off step (fired by sendBeacon on page-hide)</li>
 *   <li>{@code GET  /api/public/businesses/{id}/funnel/nudge?deviceId=...}
 *       — check for a pending nudge on next scan; marks it as notified</li>
 *   <li>{@code POST /api/public/businesses/{id}/funnel/feedback}
 *       — save feedback reason from the nudge banner</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/public/businesses/{businessId}/funnel")
public class PublicFunnelController {

    private final FunnelDropService funnelDropService;

    public PublicFunnelController(FunnelDropService funnelDropService) {
        this.funnelDropService = funnelDropService;
    }

    /**
     * Record a funnel drop-off.
     *
     * <p>The frontend fires this via {@code navigator.sendBeacon()} on the
     * {@code visibilitychange / pagehide} events so it survives tab close.
     * Also called via normal fetch when the step changes (debounced).
     *
     * <p>Idempotent — upserts a single un-notified row per (deviceId, businessId).
     */
    @PostMapping("/drop")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void recordDrop(
            @PathVariable String businessId,
            @Valid @RequestBody FunnelDtos.RecordDropRequest request
    ) {
        funnelDropService.recordDrop(businessId, request);
    }

    /**
     * Get the pending nudge for a device.
     *
     * <p>Called once when CustomerApp mounts after a scan, before the menu renders.
     * If a pending drop exists it is immediately marked as notified (shown exactly once).
     *
     * @param deviceId the browser-local device UUID from localStorage
     */
    @GetMapping("/nudge")
    public FunnelDtos.NudgeResponse getNudge(
            @PathVariable String businessId,
            @RequestParam String deviceId
    ) {
        return funnelDropService.getNudgeAndMarkNotified(businessId, deviceId);
    }

    /**
     * Submit feedback from the nudge banner.
     *
     * <p>Called when the customer taps one of the quick-tap reason chips
     * (and optionally adds free text). Saves the reason on the most recent
     * notified drop row for this device.
     */
    @PostMapping("/feedback")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void submitFeedback(
            @PathVariable String businessId,
            @Valid @RequestBody FunnelDtos.SubmitFeedbackRequest request
    ) {
        funnelDropService.submitFeedback(businessId, request);
    }
}
