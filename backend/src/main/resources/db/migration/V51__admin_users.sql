-- Admin users table — sub-admins invited by the super admin.
-- superAdmin flag is only set on the initial platform owner; invited admins never get it.
CREATE TABLE admin_users (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    keycloak_user_id  UUID         NOT NULL UNIQUE,
    email             VARCHAR(255) NOT NULL UNIQUE,
    display_name      VARCHAR(200) NOT NULL,
    super_admin       BOOLEAN      NOT NULL DEFAULT FALSE,
    active            BOOLEAN      NOT NULL DEFAULT FALSE,
    pending           BOOLEAN      NOT NULL DEFAULT TRUE,
    invited_by_email  VARCHAR(255),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Per-admin granted permissions (one row per permission string).
CREATE TABLE admin_user_permissions (
    admin_user_id UUID         NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    permission    VARCHAR(60)  NOT NULL,
    PRIMARY KEY (admin_user_id, permission)
);

CREATE INDEX idx_admin_users_keycloak ON admin_users(keycloak_user_id);
CREATE INDEX idx_admin_users_email    ON admin_users(email);
CREATE INDEX idx_admin_perms_user     ON admin_user_permissions(admin_user_id);
