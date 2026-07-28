package com.scanny.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "customer_phone_sessions")
public class CustomerPhoneSession {

    @Id
    @Column(name = "phone_normalized")
    private String phoneNormalized;

    @Column(name = "verify_code")
    private String verifyCode;

    @Column(name = "verify_expires_at")
    private Instant verifyExpiresAt;

    @Column(name = "verified_at")
    private Instant verifiedAt;

    @Column(name = "session_token", unique = true)
    private String sessionToken;

    @Column(name = "session_expires_at")
    private Instant sessionExpiresAt;

    public String getPhoneNormalized() {
        return phoneNormalized;
    }

    public void setPhoneNormalized(String phoneNormalized) {
        this.phoneNormalized = phoneNormalized;
    }

    public String getVerifyCode() {
        return verifyCode;
    }

    public void setVerifyCode(String verifyCode) {
        this.verifyCode = verifyCode;
    }

    public Instant getVerifyExpiresAt() {
        return verifyExpiresAt;
    }

    public void setVerifyExpiresAt(Instant verifyExpiresAt) {
        this.verifyExpiresAt = verifyExpiresAt;
    }

    public Instant getVerifiedAt() {
        return verifiedAt;
    }

    public void setVerifiedAt(Instant verifiedAt) {
        this.verifiedAt = verifiedAt;
    }

    public String getSessionToken() {
        return sessionToken;
    }

    public void setSessionToken(String sessionToken) {
        this.sessionToken = sessionToken;
    }

    public Instant getSessionExpiresAt() {
        return sessionExpiresAt;
    }

    public void setSessionExpiresAt(Instant sessionExpiresAt) {
        this.sessionExpiresAt = sessionExpiresAt;
    }
}
