-- Admin → merchant in-app broadcasts
CREATE TABLE IF NOT EXISTS platform_broadcasts (
    id UUID PRIMARY KEY,
    title VARCHAR(120) NOT NULL,
    body TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'INFO',
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    created_by VARCHAR(100),
    created_by_email VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_platform_broadcasts_status_published
    ON platform_broadcasts (status, published_at DESC);

CREATE TABLE IF NOT EXISTS platform_broadcast_acks (
    broadcast_id UUID NOT NULL REFERENCES platform_broadcasts (id) ON DELETE CASCADE,
    user_id VARCHAR(100) NOT NULL,
    read_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ,
    PRIMARY KEY (broadcast_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_platform_broadcast_acks_user
    ON platform_broadcast_acks (user_id);
