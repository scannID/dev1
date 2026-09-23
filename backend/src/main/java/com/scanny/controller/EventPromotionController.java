package com.scanny.controller;

import com.scanny.dto.PublicTicketDtos;
import com.scanny.service.PromotionService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public endpoints for the event promotion (ticketing ads) feature.
 *
 * All routes are unauthenticated — organiser identity is established
 * by their MoMo payment phone number.
 *
 * Endpoints:
 *   POST /api/promotions/initiate              — pay 40k UGX to promote an event
 *   GET  /api/promotions/{id}/status           — poll payment + promo status
 *   GET  /api/promotions/nearby                — customer feed (lat/lng or city-wide fallback)
 *   POST /api/promotions/{id}/impression       — record an impression (fire-and-forget)
 *   POST /api/promotions/{id}/click            — record a click-through
 *   GET  /api/promotions/event/{masterTicketId} — list all promos for one event (organiser view)
 */
@RestController
@RequestMapping("/api/promotions")
public class EventPromotionController {

    private final PromotionService promotionService;

    public EventPromotionController(PromotionService promotionService) {
        this.promotionService = promotionService;
    }

    /**
     * Initiate a 40,000 UGX MoMo promotion payment.
     * Returns immediately with a promotionId + paymentId for polling.
     */
    @PostMapping("/initiate")
    public ResponseEntity<PublicTicketDtos.PromotionInitiateResponse> initiate(
            @RequestBody PublicTicketDtos.PromoteEventRequest request) {
        PublicTicketDtos.PromotionInitiateResponse response = promotionService.initiate(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Poll promotion + payment status.
     * Frontend polls every 3 s until promoStatus == "ACTIVE" or paymentStatus == "FAILED".
     */
    @GetMapping("/{promotionId}/status")
    public ResponseEntity<PublicTicketDtos.PromotionStatusResponse> status(
            @PathVariable String promotionId) {
        return ResponseEntity.ok(promotionService.getStatus(promotionId));
    }

    /**
     * Customer feed: returns promoted events near the given coordinates.
     * lat/lng are optional — if omitted, returns all active city-wide promos.
     *
     * Used by the "What's Happening" panel in CustomerApp and by the
     * post-order card on the DoneStep.
     */
    @GetMapping("/nearby")
    public ResponseEntity<PublicTicketDtos.NearbyEventsResponse> nearby(
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lng) {
        return ResponseEntity.ok(promotionService.findNearby(lat, lng));
    }

    /**
     * Record that a customer saw this promotion card.
     * Best-effort — never errors the client even if the promo id is wrong.
     */
    @PostMapping("/{promotionId}/impression")
    public ResponseEntity<Void> impression(@PathVariable String promotionId) {
        try { promotionService.recordImpression(promotionId); } catch (Exception ignored) { }
        return ResponseEntity.noContent().build();
    }

    /**
     * Record that a customer tapped "Buy Tickets" on this card.
     */
    @PostMapping("/{promotionId}/click")
    public ResponseEntity<Void> click(@PathVariable String promotionId) {
        try { promotionService.recordClick(promotionId); } catch (Exception ignored) { }
        return ResponseEntity.noContent().build();
    }

    /**
     * Organiser view: all promotions for a specific event.
     * Keyed by the master ticket id (ERI-XXXXXX).
     */
    @GetMapping("/event/{masterTicketId}")
    public ResponseEntity<List<PublicTicketDtos.PromotionStatusResponse>> listForEvent(
            @PathVariable String masterTicketId) {
        return ResponseEntity.ok(promotionService.listForEvent(masterTicketId));
    }
}
