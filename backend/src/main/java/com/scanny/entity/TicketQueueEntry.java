package com.scanny.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "ticket_queue_entries")
public class TicketQueueEntry {

    @Id
    private String id;

    @Column(name = "master_id", nullable = false)
    private String masterId;

    @Column(name = "ticket_class", nullable = false)
    private String ticketClass;

    @Column(name = "holder_name", nullable = false)
    private String holderName;

    @Column(name = "holder_phone", nullable = false)
    private String holderPhone;

    @Column(name = "holder_email")
    private String holderEmail;

    @Column(name = "payment_phone")
    private String paymentPhone;

    @Column(name = "provider")
    private String provider;

    @Column(name = "presale_code")
    private String presaleCode;

    @Column(name = "status", nullable = false)
    private String status = "Waiting";

    @Column(name = "position")
    private Integer position;

    @Column(name = "attendee_ticket_id")
    private String attendeeTicketId;

    @Column(name = "view_url")
    private String viewUrl;

    @Column(name = "error_message")
    private String errorMessage;

    @Column(name = "queued_at", nullable = false)
    private Instant queuedAt = Instant.now();

    @Column(name = "processed_at")
    private Instant processedAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    public TicketQueueEntry() {}

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getMasterId() {
        return masterId;
    }

    public void setMasterId(String masterId) {
        this.masterId = masterId;
    }

    public String getTicketClass() {
        return ticketClass;
    }

    public void setTicketClass(String ticketClass) {
        this.ticketClass = ticketClass;
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

    public String getPaymentPhone() {
        return paymentPhone;
    }

    public void setPaymentPhone(String paymentPhone) {
        this.paymentPhone = paymentPhone;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getPresaleCode() {
        return presaleCode;
    }

    public void setPresaleCode(String presaleCode) {
        this.presaleCode = presaleCode;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Integer getPosition() {
        return position;
    }

    public void setPosition(Integer position) {
        this.position = position;
    }

    public String getAttendeeTicketId() {
        return attendeeTicketId;
    }

    public void setAttendeeTicketId(String attendeeTicketId) {
        this.attendeeTicketId = attendeeTicketId;
    }

    public String getViewUrl() {
        return viewUrl;
    }

    public void setViewUrl(String viewUrl) {
        this.viewUrl = viewUrl;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    public Instant getQueuedAt() {
        return queuedAt;
    }

    public void setQueuedAt(Instant queuedAt) {
        this.queuedAt = queuedAt;
    }

    public Instant getProcessedAt() {
        return processedAt;
    }

    public void setProcessedAt(Instant processedAt) {
        this.processedAt = processedAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }
}
