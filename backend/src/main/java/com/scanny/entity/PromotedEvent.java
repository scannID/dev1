package com.scanny.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Represents an event organiser's paid promotion slot.
 *
 * Lifecycle:
 *   PENDING_PAYMENT  →  organiser initiated but MoMo not yet confirmed
 *   ACTIVE           →  payment confirmed; event appears in nearby restaurant feeds
 *   EXPIRED          →  promoted_until has passed (scheduler sets this)
 *   CANCELLED        →  manually cancelled before event date
 */
@Entity
@Table(name = "promoted_events")
public class PromotedEvent {

    @Id
    private String id;

    @Column(name = "master_ticket_id", nullable = false)
    private String masterTicketId;

    @Column(name = "event_name", nullable = false)
    private String eventName;

    @Column(name = "event_date")
    private Instant eventDate;

    @Column(name = "event_image_url", nullable = false)
    private String eventImageUrl = "";

    @Column(name = "purchase_url", nullable = false)
    private String purchaseUrl = "";

    @Column(nullable = false)
    private String host = "";

    @Column(nullable = false)
    private String category = "Other";

    /** Latitude of the event venue — used for proximity matching. */
    @Column(name = "venue_lat")
    private Double venueLat;

    /** Longitude of the event venue — used for proximity matching. */
    @Column(name = "venue_lng")
    private Double venueLng;

    @Column(name = "venue_address", nullable = false)
    private String venueAddress = "";

    /** Promotion radius in km — default 5 (single tier for now). */
    @Column(name = "radius_km", nullable = false)
    private int radiusKm = 5;

    /**
     * PENDING_PAYMENT | ACTIVE | EXPIRED | CANCELLED
     */
    @Column(nullable = false)
    private String status = "PENDING_PAYMENT";

    @Column(name = "payment_id", nullable = false)
    private String paymentId = "";

    @Column(name = "payment_phone", nullable = false)
    private String paymentPhone = "";

    /** UNPAID | PAID | FAILED */
    @Column(name = "payment_status", nullable = false)
    private String paymentStatus = "UNPAID";

    @Column(name = "promotion_fee", nullable = false)
    private int promotionFee = 40_000;

    @Column(nullable = false)
    private String currency = "UGX";

    @Column(name = "organiser_phone", nullable = false)
    private String organiserPhone = "";

    @Column(name = "organiser_name", nullable = false)
    private String organiserName = "";

    /** Set to now() when payment confirmed. */
    @Column(name = "promoted_from")
    private Instant promotedFrom;

    /** Set to min(eventDate, now+30days) when payment confirmed. */
    @Column(name = "promoted_until")
    private Instant promotedUntil;

    @Column(nullable = false)
    private long impressions = 0;

    @Column(nullable = false)
    private long clicks = 0;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt;

    // ── Getters / setters ─────────────────────────────────────────────

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getMasterTicketId() { return masterTicketId; }
    public void setMasterTicketId(String masterTicketId) { this.masterTicketId = masterTicketId; }

    public String getEventName() { return eventName; }
    public void setEventName(String eventName) { this.eventName = eventName; }

    public Instant getEventDate() { return eventDate; }
    public void setEventDate(Instant eventDate) { this.eventDate = eventDate; }

    public String getEventImageUrl() { return eventImageUrl; }
    public void setEventImageUrl(String eventImageUrl) { this.eventImageUrl = eventImageUrl != null ? eventImageUrl : ""; }

    public String getPurchaseUrl() { return purchaseUrl; }
    public void setPurchaseUrl(String purchaseUrl) { this.purchaseUrl = purchaseUrl != null ? purchaseUrl : ""; }

    public String getHost() { return host; }
    public void setHost(String host) { this.host = host != null ? host : ""; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category != null ? category : "Other"; }

    public Double getVenueLat() { return venueLat; }
    public void setVenueLat(Double venueLat) { this.venueLat = venueLat; }

    public Double getVenueLng() { return venueLng; }
    public void setVenueLng(Double venueLng) { this.venueLng = venueLng; }

    public String getVenueAddress() { return venueAddress; }
    public void setVenueAddress(String venueAddress) { this.venueAddress = venueAddress != null ? venueAddress : ""; }

    public int getRadiusKm() { return radiusKm; }
    public void setRadiusKm(int radiusKm) { this.radiusKm = Math.max(1, radiusKm); }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getPaymentId() { return paymentId; }
    public void setPaymentId(String paymentId) { this.paymentId = paymentId != null ? paymentId : ""; }

    public String getPaymentPhone() { return paymentPhone; }
    public void setPaymentPhone(String paymentPhone) { this.paymentPhone = paymentPhone != null ? paymentPhone : ""; }

    public String getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; }

    public int getPromotionFee() { return promotionFee; }
    public void setPromotionFee(int promotionFee) { this.promotionFee = promotionFee; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency != null ? currency : "UGX"; }

    public String getOrganiserPhone() { return organiserPhone; }
    public void setOrganiserPhone(String organiserPhone) { this.organiserPhone = organiserPhone != null ? organiserPhone : ""; }

    public String getOrganiserName() { return organiserName; }
    public void setOrganiserName(String organiserName) { this.organiserName = organiserName != null ? organiserName : ""; }

    public Instant getPromotedFrom() { return promotedFrom; }
    public void setPromotedFrom(Instant promotedFrom) { this.promotedFrom = promotedFrom; }

    public Instant getPromotedUntil() { return promotedUntil; }
    public void setPromotedUntil(Instant promotedUntil) { this.promotedUntil = promotedUntil; }

    public long getImpressions() { return impressions; }
    public void setImpressions(long impressions) { this.impressions = impressions; }

    public long getClicks() { return clicks; }
    public void setClicks(long clicks) { this.clicks = clicks; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
