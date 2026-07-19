-- Durable audit trail for admin and sensitive merchant actions
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_id VARCHAR(100),
    actor_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(80),
    resource_id VARCHAR(120),
    outcome VARCHAR(40) NOT NULL DEFAULT 'SUCCESS',
    client_ip VARCHAR(64),
    correlation_id VARCHAR(100),
    metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_events_occurred_at ON audit_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor_id ON audit_events (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_action ON audit_events (action);
