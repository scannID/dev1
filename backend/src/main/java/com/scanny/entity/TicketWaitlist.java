package com.scanny.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "ticket_waitlist")
public class TicketWaitlist {

    @Id
    private String id;

    @Column(name = "master_id", nullable = false)
    private String masterId;

    @Column(name = "ticket_class", nullable = false)
    private String ticketClass;

    @Column(name = "holder_name", nullable = false)
    private String holderName = "";

    @Column(name = "holder_phone", nullable = false)
    private String holderPhone = "";

    @Column(nullable = false)
    private boolean notified = false;

    @Column(name = "notified_at")
    private Instant notifiedAt;

    /** One-time token sent in the WhatsApp notification link. */
    @Column(name = "claim_token", unique = true)
    private String claimToken;

    /** When the claim token expires (30 min after notification). */
    @Column(name = "claim_expires_at")
    private Instant claimExpiresAt;

    @Column(name = "joined_at", nullable = false)
    private Instant joinedAt = Instant.now();

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getMasterId() { return masterId; }
    public void setMasterId(String masterId) { this.masterId = masterId; }

    public String getTicketClass() { return ticketClass; }
    public void setTicketClass(String ticketClass) { this.ticketClass = ticketClass; }

    public String getHolderName() { return holderName; }
    public void setHolderName(String holderName) { this.holderName = holderName; }

    public String getHolderPhone() { return holderPhone; }
    public void setHolderPhone(String holderPhone) { this.holderPhone = holderPhone; }

    public boolean isNotified() { return notified; }
    public void setNotified(boolean notified) { this.notified = notified; }

    public Instant getNotifiedAt() { return notifiedAt; }
    public void setNotifiedAt(Instant notifiedAt) { this.notifiedAt = notifiedAt; }

    public String getClaimToken() { return claimToken; }
    public void setClaimToken(String claimToken) { this.claimToken = claimToken; }

    public Instant getClaimExpiresAt() { return claimExpiresAt; }
    public void setClaimExpiresAt(Instant claimExpiresAt) { this.claimExpiresAt = claimExpiresAt; }

    public Instant getJoinedAt() { return joinedAt; }
    public void setJoinedAt(Instant joinedAt) { this.joinedAt = joinedAt; }
}
