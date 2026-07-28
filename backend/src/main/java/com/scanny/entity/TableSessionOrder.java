package com.scanny.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "table_session_orders")
@IdClass(TableSessionOrder.Pk.class)
public class TableSessionOrder {

    @Id
    @Column(name = "session_id", nullable = false)
    private UUID sessionId;

    @Id
    @Column(name = "order_id", nullable = false)
    private String orderId;

    public TableSessionOrder() {}

    public TableSessionOrder(UUID sessionId, String orderId) {
        this.sessionId = sessionId;
        this.orderId = orderId;
    }

    public UUID getSessionId() {
        return sessionId;
    }

    public void setSessionId(UUID sessionId) {
        this.sessionId = sessionId;
    }

    public String getOrderId() {
        return orderId;
    }

    public void setOrderId(String orderId) {
        this.orderId = orderId;
    }

    public static class Pk implements Serializable {
        private UUID sessionId;
        private String orderId;

        public Pk() {}

        public Pk(UUID sessionId, String orderId) {
            this.sessionId = sessionId;
            this.orderId = orderId;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof Pk pk)) return false;
            return Objects.equals(sessionId, pk.sessionId) && Objects.equals(orderId, pk.orderId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(sessionId, orderId);
        }
    }
}
