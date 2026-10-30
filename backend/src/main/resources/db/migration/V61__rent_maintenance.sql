-- Tenant maintenance requests submitted via the QR tenant app
CREATE TABLE IF NOT EXISTS rent_maintenance_requests (
    id            VARCHAR(36)   NOT NULL PRIMARY KEY,
    property_id   VARCHAR(36)   NOT NULL,
    unit_id       VARCHAR(36),
    tenant_name   VARCHAR(128),
    tenant_phone  VARCHAR(32),
    title         VARCHAR(256)  NOT NULL,
    description   CLOB,
    status        VARCHAR(32)   NOT NULL DEFAULT 'OPEN',
    submitted_at  TIMESTAMP     NOT NULL,
    resolved_at   TIMESTAMP,
    CONSTRAINT fk_maint_property FOREIGN KEY (property_id) REFERENCES rent_properties(id),
    CONSTRAINT fk_maint_unit     FOREIGN KEY (unit_id)     REFERENCES rent_units(id)
);
