-- Layout Studio: floor plans, elements, live status, shape templates

CREATE TABLE floor_plans (
    id               VARCHAR(64) PRIMARY KEY,
    business_id      VARCHAR(64) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name             VARCHAR(128) NOT NULL DEFAULT 'Main Floor',
    canvas_width     INTEGER NOT NULL DEFAULT 1200,
    canvas_height    INTEGER NOT NULL DEFAULT 800,
    grid_size        INTEGER NOT NULL DEFAULT 20,
    background_image TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ
);

CREATE INDEX idx_floor_plans_business ON floor_plans (business_id);

CREATE TABLE floor_plan_elements (
    id                  VARCHAR(64) PRIMARY KEY,
    floor_plan_id       VARCHAR(64) NOT NULL REFERENCES floor_plans(id) ON DELETE CASCADE,
    shape_type          VARCHAR(32)  NOT NULL DEFAULT 'rect',
    x                   NUMERIC(10,2) NOT NULL DEFAULT 0,
    y                   NUMERIC(10,2) NOT NULL DEFAULT 0,
    width               NUMERIC(10,2) NOT NULL DEFAULT 80,
    height              NUMERIC(10,2) NOT NULL DEFAULT 80,
    rotation            NUMERIC(6,2)  NOT NULL DEFAULT 0,
    z_index             INTEGER       NOT NULL DEFAULT 1,
    color               VARCHAR(32)   NOT NULL DEFAULT '#d4a373',
    element_kind        VARCHAR(32)   NOT NULL DEFAULT 'TABLE',
    label               VARCHAR(128),
    seat_count          INTEGER       NOT NULL DEFAULT 0,
    parent_element_id   VARCHAR(64) REFERENCES floor_plan_elements(id) ON DELETE SET NULL,
    business_table_id   VARCHAR(64) REFERENCES business_tables(id) ON DELETE SET NULL,
    custom_style        JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_floor_plan_elements_plan   ON floor_plan_elements (floor_plan_id);
CREATE INDEX idx_floor_plan_elements_table  ON floor_plan_elements (business_table_id);
CREATE INDEX idx_floor_plan_elements_parent ON floor_plan_elements (parent_element_id);

CREATE TABLE floor_plan_element_status (
    element_id      VARCHAR(64) PRIMARY KEY REFERENCES floor_plan_elements(id) ON DELETE CASCADE,
    status          VARCHAR(32) NOT NULL DEFAULT 'FREE',
    session_id      UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
    reservation_id  UUID REFERENCES reservations(id) ON DELETE SET NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by      VARCHAR(255)
);

-- Global (business_id NULL) and per-business shape presets
CREATE TABLE floor_plan_templates (
    id                  VARCHAR(64) PRIMARY KEY,
    business_id         VARCHAR(64) REFERENCES businesses(id) ON DELETE CASCADE,
    name                VARCHAR(128) NOT NULL,
    shape_type          VARCHAR(32)  NOT NULL DEFAULT 'rect',
    element_kind        VARCHAR(32)  NOT NULL DEFAULT 'TABLE',
    default_width       NUMERIC(10,2) NOT NULL DEFAULT 80,
    default_height      NUMERIC(10,2) NOT NULL DEFAULT 80,
    default_color       VARCHAR(32)   NOT NULL DEFAULT '#d4a373',
    default_seat_count  INTEGER       NOT NULL DEFAULT 0,
    thumbnail_svg       TEXT,
    sort_order          INTEGER       NOT NULL DEFAULT 0
);

CREATE INDEX idx_floor_plan_templates_business ON floor_plan_templates (business_id);

-- Seed global templates
INSERT INTO floor_plan_templates (id, business_id, name, shape_type, element_kind, default_width, default_height, default_color, default_seat_count, sort_order) VALUES
('tpl-table-round-2',  NULL, '2-Seat Round Table',  'circle', 'TABLE', 70,  70,  '#d4a373', 2,  1),
('tpl-table-round-4',  NULL, '4-Seat Round Table',  'circle', 'TABLE', 90,  90,  '#d4a373', 4,  2),
('tpl-table-rect-4',   NULL, '4-Seat Table',        'rect',   'TABLE', 100, 70,  '#d4a373', 4,  3),
('tpl-table-rect-6',   NULL, '6-Seat Table',        'rect',   'TABLE', 130, 70,  '#d4a373', 6,  4),
('tpl-table-rect-8',   NULL, '8-Seat Table',        'rect',   'TABLE', 160, 70,  '#d4a373', 8,  5),
('tpl-chair',          NULL, 'Chair',               'circle', 'CHAIR', 28,  28,  '#b5838d', 1,  6),
('tpl-bar-stool',      NULL, 'Bar Stool',           'circle', 'CHAIR', 22,  22,  '#a0785a', 1,  7),
('tpl-bar-counter',    NULL, 'Bar Counter',         'rect',   'BAR',   200, 50,  '#6b4226', 0,  8),
('tpl-wall',           NULL, 'Wall',                'rect',   'WALL',  160, 20,  '#9ca3af', 0,  9),
('tpl-door',           NULL, 'Door',                'rect',   'DOOR',  50,  12,  '#60a5fa', 0,  10),
('tpl-stage',          NULL, 'Stage',               'rect',   'STAGE', 200, 100, '#fbbf24', 0,  11),
('tpl-plant',          NULL, 'Plant / Decor',       'circle', 'PLANT', 30,  30,  '#4ade80', 0,  12),
('tpl-zone',           NULL, 'Zone / Area',         'rect',   'ZONE',  220, 160, '#e0f2fe', 0,  13),
('tpl-label',          NULL, 'Label',               'rect',   'LABEL', 80,  30,  '#f3f4f6', 0,  14),
('tpl-hotel-room',     NULL, 'Hotel Room',          'rect',   'HOTEL_ROOM', 120, 90, '#a5b4fc', 1, 15);
