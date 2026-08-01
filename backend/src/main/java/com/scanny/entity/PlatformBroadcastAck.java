package com.scanny.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(
        name = "platform_broadcast_acks",
        indexes = {
                @Index(name = "idx_platform_broadcast_acks_user", columnList = "user_id")
        }
)
@IdClass(PlatformBroadcastAck.AckId.class)
public class PlatformBroadcastAck {

    @Id
    @Column(name = "broadcast_id", nullable = false)
    private UUID broadcastId;

    @Id
    @Column(name = "user_id", nullable = false, length = 100)
    private String userId;

    @Column(name = "read_at")
    private Instant readAt;

    @Column(name = "dismissed_at")
    private Instant dismissedAt;

    public UUID getBroadcastId() {
        return broadcastId;
    }

    public void setBroadcastId(UUID broadcastId) {
        this.broadcastId = broadcastId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public Instant getReadAt() {
        return readAt;
    }

    public void setReadAt(Instant readAt) {
        this.readAt = readAt;
    }

    public Instant getDismissedAt() {
        return dismissedAt;
    }

    public void setDismissedAt(Instant dismissedAt) {
        this.dismissedAt = dismissedAt;
    }

    public static class AckId implements Serializable {
        private UUID broadcastId;
        private String userId;

        public AckId() {}

        public AckId(UUID broadcastId, String userId) {
            this.broadcastId = broadcastId;
            this.userId = userId;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof AckId ackId)) return false;
            return Objects.equals(broadcastId, ackId.broadcastId) && Objects.equals(userId, ackId.userId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(broadcastId, userId);
        }
    }
}
