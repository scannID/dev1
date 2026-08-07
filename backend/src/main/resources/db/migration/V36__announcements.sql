CREATE TABLE IF NOT EXISTS announcements (
    id          VARCHAR(32)  NOT NULL PRIMARY KEY,
    business_id VARCHAR(64)  NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    title       VARCHAR(120) NOT NULL,
    body        TEXT,
    image_url   TEXT,
    starts_at   TIMESTAMPTZ,
    ends_at     TIMESTAMPTZ,
    active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_announcements_business_id ON announcements(business_id);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(business_id, active, starts_at, ends_at);
