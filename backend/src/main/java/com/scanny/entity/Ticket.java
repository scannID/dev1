package com.scanny.entity;

import com.scanny.model.enums.PaymentStatus;
import com.scanny.model.enums.TicketStatus;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "tickets")
public class Ticket {

    @Id
    private String id;

    @Column(name = "qr_token", nullable = false, unique = true)
    private String qrToken;

    @Column(name = "ticket_type", nullable = false)
    private String ticketType;

    @Column(name = "event_name", nullable = false)
    private String eventName;

    @Column(name = "event_date")
    private Instant eventDate;

    @Column(name = "holder_name", nullable = false)
    private String holderName = "";

    @Column(name = "holder_phone", nullable = false)
    private String holderPhone = "";

    @Column(name = "holder_email", nullable = false)
    private String holderEmail = "";

    @Column(nullable = false)
    private int price;

    @Column(nullable = false)
    private String currency = "UGX";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TicketStatus status = TicketStatus.Active;

    @Column(name = "usage_limit", nullable = false)
    private int usageLimit = 1;

    @Column(name = "usage_count", nullable = false)
    private int usageCount = 0;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "payment_reference", nullable = false)
    private String paymentReference = "";

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", nullable = false)
    private PaymentStatus paymentStatus = PaymentStatus.Unpaid;

    @Column(name = "issued_by", nullable = false)
    private String issuedBy = "";

    @Column(columnDefinition = "TEXT")
    private String metadata;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "redeemed_at")
    private Instant redeemedAt;

    /** Event template ticket id — null for master templates, set for each attendee ticket. */
    @Column(name = "master_ticket_id")
    private String masterTicketId;

    /** Secret link token for attendee to open their ticket without login. */
    @Column(name = "access_token")
    private String accessToken;

    /** Legacy column — gate check-in was removed; kept for existing rows. */
    @Column(name = "gate_token")
    private String gateToken;

    @OneToMany(mappedBy = "ticket", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("scannedAt DESC")
    private List<TicketScan> scans = new ArrayList<>();

    // Getters and setters

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getQrToken() {
        return qrToken;
    }

    public void setQrToken(String qrToken) {
        this.qrToken = qrToken;
    }

    public String getTicketType() {
        return ticketType;
    }

    public void setTicketType(String ticketType) {
        this.ticketType = ticketType;
    }

    public String getEventName() {
        return eventName;
    }

    public void setEventName(String eventName) {
        this.eventName = eventName;
    }

    public Instant getEventDate() {
        return eventDate;
    }

    public void setEventDate(Instant eventDate) {
        this.eventDate = eventDate;
    }

    public String getHolderName() {
        return holderName;
    }

    public void setHolderName(String holderName) {
        this.holderName = holderName;
    }

    public String getHolderPhone() {
        return holderPhone;
    }

    public void setHolderPhone(String holderPhone) {
        this.holderPhone = holderPhone;
    }

    public String getHolderEmail() {
        return holderEmail;
    }

    public void setHolderEmail(String holderEmail) {
        this.holderEmail = holderEmail;
    }

    public int getPrice() {
        return price;
    }

    public void setPrice(int price) {
        this.price = price;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public TicketStatus getStatus() {
        return status;
    }

    public void setStatus(TicketStatus status) {
        this.status = status;
    }

    public int getUsageLimit() {
        return usageLimit;
    }

    public void setUsageLimit(int usageLimit) {
        this.usageLimit = usageLimit;
    }

    public int getUsageCount() {
        return usageCount;
    }

    public void setUsageCount(int usageCount) {
        this.usageCount = usageCount;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }

    public String getPaymentReference() {
        return paymentReference;
    }

    public void setPaymentReference(String paymentReference) {
        this.paymentReference = paymentReference;
    }

    public PaymentStatus getPaymentStatus() {
        return paymentStatus;
    }

    public void setPaymentStatus(PaymentStatus paymentStatus) {
        this.paymentStatus = paymentStatus;
    }

    public String getIssuedBy() {
        return issuedBy;
    }

    public void setIssuedBy(String issuedBy) {
        this.issuedBy = issuedBy;
    }

    public String getMetadata() {
        return metadata;
    }

    public void setMetadata(String metadata) {
        this.metadata = metadata;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Instant getRedeemedAt() {
        return redeemedAt;
    }

    public void setRedeemedAt(Instant redeemedAt) {
        this.redeemedAt = redeemedAt;
    }

    public String getMasterTicketId() {
        return masterTicketId;
    }

    public void setMasterTicketId(String masterTicketId) {
        this.masterTicketId = masterTicketId;
    }

    public String getAccessToken() {
        return accessToken;
    }

    public void setAccessToken(String accessToken) {
        this.accessToken = accessToken;
    }

    public String getGateToken() {
        return gateToken;
    }

    public void setGateToken(String gateToken) {
        this.gateToken = gateToken;
    }

    public boolean isEventTemplate() {
        return masterTicketId == null && usageLimit > 1_000_000;
    }

    public boolean isAttendeeTicket() {
        return masterTicketId != null;
    }

    public List<TicketScan> getScans() {
        return scans;
    }

    public void setScans(List<TicketScan> scans) {
        this.scans = scans;
    }

    public void addScan(TicketScan scan) {
        scans.add(scan);
        scan.setTicket(this);
    }

    public boolean isExpired() {
        return expiresAt != null && Instant.now().isAfter(expiresAt);
    }

    public boolean canBeUsed() {
        return status == TicketStatus.Active 
            && !isExpired() 
            && usageCount < usageLimit
            && paymentStatus == PaymentStatus.Paid;
    }
}
