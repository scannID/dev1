package com.scanny.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;

/**
 * Request / response DTOs for the customer funnel drop-off feature.
 */
public final class FunnelDtos {

    private FunnelDtos() {}

    // ── Requests ─────────────────────────────────────────────────────────────

    /**
     * Sent by the frontend (via sendBeacon or fetch) when a customer leaves
     * without placing an order.
     */
    public record RecordDropRequest(
            /** Stable browser-local device UUID. */
            @NotBlank @Size(max = 128)
            String deviceId,

            /**
             * Last step the customer was on.
             * Valid values: menu | cart | details | pay
             */
            @NotBlank @Size(max = 32)
            String lastStep,

            /** QR token that was scanned (may be blank for business-level tokens). */
            @Size(max = 128)
            String qrToken,

            /**
             * Phone number — only present when the customer reached the pay step
             * and typed their number before leaving.
             */
            @Size(max = 32)
            String phone
    ) {}

    /**
     * Sent when the customer submits feedback from the nudge banner.
     */
    public record SubmitFeedbackRequest(
            @NotBlank @Size(max = 128)
            String deviceId,

            /**
             * Short reason code chosen from the quick-tap chips, e.g.:
             * too_expensive | long_wait | just_browsing | changed_mind |
             * payment_issue | menu_limited | other
             */
            @NotBlank @Size(max = 64)
            String reason,

            /** Optional free-text elaboration from the customer. */
            @Size(max = 1000)
            String text
    ) {}

    // ── Responses ────────────────────────────────────────────────────────────

    /**
     * Returned by GET /api/public/businesses/{id}/funnel-nudge?deviceId=...
     * Tells the frontend whether to show the nudge banner and what step
     * the customer dropped off at last time.
     */
    public record NudgeResponse(
            /** True when there is a pending (un-notified) drop for this device. */
            boolean hasPendingNudge,

            /**
             * The step they dropped at — only present when hasPendingNudge = true.
             * Values: menu | cart | details | pay
             */
            String lastStep
    ) {
        public static NudgeResponse none() {
            return new NudgeResponse(false, null);
        }

        public static NudgeResponse pending(String lastStep) {
            return new NudgeResponse(true, lastStep);
        }
    }

    /**
     * Per-step drop count — used in admin analytics.
     */
    public record StepDropCount(String step, long count) {}

    /**
     * Per-reason feedback count — used in admin analytics.
     */
    public record FeedbackReasonCount(String reason, long count) {}

    /**
     * Full funnel analytics summary for the admin console.
     */
    public record FunnelAnalyticsResponse(
            long totalDrops,
            List<StepDropCount> byStep,
            List<FeedbackReasonCount> byFeedbackReason
    ) {}
}
