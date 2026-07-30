package com.scanny.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Local H2 uses ddl-auto=update (Flyway off). This entity ensures cookie_consents exists
 * for JDBC inserts in CookieConsentService / analytics.
 */
@Entity
@Table(
        name = "cookie_consents",
        indexes = {
                @Index(name = "idx_cookie_consents_consented_at", columnList = "consented_at"),
                @Index(name = "idx_cookie_consents_actor_subject", columnList = "actor_subject"),
                @Index(name = "idx_cookie_consents_client_id", columnList = "client_id")
        }
)
public class CookieConsent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "choice", nullable = false, length = 16)
    private String choice;

    @Column(name = "client_id", length = 120)
    private String clientId;

    @Column(name = "source", length = 255)
    private String source;

    @Column(name = "path", length = 255)
    private String path;

    @Column(name = "actor_subject", length = 255)
    private String actorSubject;

    @Column(name = "actor_email", length = 255)
    private String actorEmail;

    @Column(name = "user_agent", length = 512)
    private String userAgent;

    @Column(name = "ip_address", length = 64)
    private String ipAddress;

    @Column(name = "consented_at", nullable = false)
    private Instant consentedAt = Instant.now();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getChoice() {
        return choice;
    }

    public void setChoice(String choice) {
        this.choice = choice;
    }

    public String getClientId() {
        return clientId;
    }

    public void setClientId(String clientId) {
        this.clientId = clientId;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }

    public String getActorSubject() {
        return actorSubject;
    }

    public void setActorSubject(String actorSubject) {
        this.actorSubject = actorSubject;
    }

    public String getActorEmail() {
        return actorEmail;
    }

    public void setActorEmail(String actorEmail) {
        this.actorEmail = actorEmail;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public void setUserAgent(String userAgent) {
        this.userAgent = userAgent;
    }

    public String getIpAddress() {
        return ipAddress;
    }

    public void setIpAddress(String ipAddress) {
        this.ipAddress = ipAddress;
    }

    public Instant getConsentedAt() {
        return consentedAt;
    }

    public void setConsentedAt(Instant consentedAt) {
        this.consentedAt = consentedAt;
    }
}
