-- ============================================================
-- Samantha Restaurant — demo floor plan seed (idempotent)
-- Business ID: samantha-restaurant
-- Layout: Main dining room + Bar area + Patio zone
-- 12 real tables linked to business_tables rows
-- ============================================================

-- ─── Business tables (the real trackable entities) ───────────────────────────

INSERT INTO business_tables (id, business_id, label, qr_token, active)
SELECT 'sam-tbl-01', 'samantha-restaurant', 'T1',  'samqr01', TRUE WHERE NOT EXISTS (SELECT 1 FROM business_tables WHERE id='sam-tbl-01');
INSERT INTO business_tables (id, business_id, label, qr_token, active)
SELECT 'sam-tbl-02', 'samantha-restaurant', 'T2',  'samqr02', TRUE WHERE NOT EXISTS (SELECT 1 FROM business_tables WHERE id='sam-tbl-02');
INSERT INTO business_tables (id, business_id, label, qr_token, active)
SELECT 'sam-tbl-03', 'samantha-restaurant', 'T3',  'samqr03', TRUE WHERE NOT EXISTS (SELECT 1 FROM business_tables WHERE id='sam-tbl-03');
INSERT INTO business_tables (id, business_id, label, qr_token, active)
SELECT 'sam-tbl-04', 'samantha-restaurant', 'T4',  'samqr04', TRUE WHERE NOT EXISTS (SELECT 1 FROM business_tables WHERE id='sam-tbl-04');
INSERT INTO business_tables (id, business_id, label, qr_token, active)
SELECT 'sam-tbl-05', 'samantha-restaurant', 'T5',  'samqr05', TRUE WHERE NOT EXISTS (SELECT 1 FROM business_tables WHERE id='sam-tbl-05');
INSERT INTO business_tables (id, business_id, label, qr_token, active)
SELECT 'sam-tbl-06', 'samantha-restaurant', 'T6',  'samqr06', TRUE WHERE NOT EXISTS (SELECT 1 FROM business_tables WHERE id='sam-tbl-06');
INSERT INTO business_tables (id, business_id, label, qr_token, active)
SELECT 'sam-tbl-07', 'samantha-restaurant', 'T7',  'samqr07', TRUE WHERE NOT EXISTS (SELECT 1 FROM business_tables WHERE id='sam-tbl-07');
INSERT INTO business_tables (id, business_id, label, qr_token, active)
SELECT 'sam-tbl-08', 'samantha-restaurant', 'T8',  'samqr08', TRUE WHERE NOT EXISTS (SELECT 1 FROM business_tables WHERE id='sam-tbl-08');
INSERT INTO business_tables (id, business_id, label, qr_token, active)
SELECT 'sam-tbl-09', 'samantha-restaurant', 'T9',  'samqr09', TRUE WHERE NOT EXISTS (SELECT 1 FROM business_tables WHERE id='sam-tbl-09');
INSERT INTO business_tables (id, business_id, label, qr_token, active)
SELECT 'sam-tbl-10', 'samantha-restaurant', 'T10', 'samqr10', TRUE WHERE NOT EXISTS (SELECT 1 FROM business_tables WHERE id='sam-tbl-10');
INSERT INTO business_tables (id, business_id, label, qr_token, active)
SELECT 'sam-tbl-11', 'samantha-restaurant', 'T11 Bar', 'samqr11', TRUE WHERE NOT EXISTS (SELECT 1 FROM business_tables WHERE id='sam-tbl-11');
INSERT INTO business_tables (id, business_id, label, qr_token, active)
SELECT 'sam-tbl-12', 'samantha-restaurant', 'T12 Patio', 'samqr12', TRUE WHERE NOT EXISTS (SELECT 1 FROM business_tables WHERE id='sam-tbl-12');

-- ─── Floor plan ───────────────────────────────────────────────────────────────

INSERT INTO floor_plans (id, business_id, name, canvas_width, canvas_height, grid_size)
SELECT 'sam-fp-main', 'samantha-restaurant', 'Main Floor', 1200, 800, 20
WHERE NOT EXISTS (SELECT 1 FROM floor_plans WHERE id='sam-fp-main');

-- ─── Structural elements: walls, doors, windows ───────────────────────────────
-- Bottom wall
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-el-wall-bottom', 'sam-fp-main', 'rect', 0, 760, 1200, 20, 0, 1, '#9ca3af', 'WALL', NULL, 0
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-wall-bottom');

-- Top wall
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-el-wall-top', 'sam-fp-main', 'rect', 0, 20, 1200, 20, 0, 1, '#9ca3af', 'WALL', NULL, 0
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-wall-top');

-- Left wall
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-el-wall-left', 'sam-fp-main', 'rect', 0, 20, 20, 740, 0, 1, '#9ca3af', 'WALL', NULL, 0
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-wall-left');

-- Right wall
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-el-wall-right', 'sam-fp-main', 'rect', 1180, 20, 20, 740, 0, 1, '#9ca3af', 'WALL', NULL, 0
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-wall-right');

-- Internal wall separating dining room from bar (vertical)
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-el-wall-bar-sep', 'sam-fp-main', 'rect', 840, 20, 20, 480, 0, 1, '#9ca3af', 'WALL', NULL, 0
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-wall-bar-sep');

-- Internal wall separating patio from dining (horizontal)
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-el-wall-patio-sep', 'sam-fp-main', 'rect', 20, 520, 820, 20, 0, 1, '#9ca3af', 'WALL', NULL, 0
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-wall-patio-sep');

-- Front entrance door
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-el-door-front', 'sam-fp-main', 'rect', 560, 760, 80, 16, 0, 2, '#60a5fa', 'DOOR', 'Entrance', 0
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-door-front');

-- Patio door (gap in horizontal wall)
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-el-door-patio', 'sam-fp-main', 'rect', 380, 520, 60, 16, 0, 2, '#60a5fa', 'DOOR', 'Patio', 0
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-door-patio');

-- Bar door
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-el-door-bar', 'sam-fp-main', 'rect', 840, 560, 16, 60, 0, 2, '#60a5fa', 'DOOR', 'Bar', 0
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-door-bar');

-- Windows (top wall)
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-el-win-1', 'sam-fp-main', 'rect', 80, 20, 100, 12, 0, 2, '#93c5fd', 'WINDOW', NULL, 0
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-win-1');
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-el-win-2', 'sam-fp-main', 'rect', 240, 20, 100, 12, 0, 2, '#93c5fd', 'WINDOW', NULL, 0
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-win-2');
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-el-win-3', 'sam-fp-main', 'rect', 420, 20, 100, 12, 0, 2, '#93c5fd', 'WINDOW', NULL, 0
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-win-3');

-- ─── Zone overlays ────────────────────────────────────────────────────────────

-- Main dining zone
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-el-zone-dining', 'sam-fp-main', 'rect', 20, 40, 820, 480, 0, 0, '#fef9f0', 'ZONE', 'Main Dining', 0
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-zone-dining');

-- Bar zone
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-el-zone-bar', 'sam-fp-main', 'rect', 860, 40, 320, 720, 0, 0, '#fef3e2', 'ZONE', 'Bar & Lounge', 0
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-zone-bar');

-- Patio zone
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-el-zone-patio', 'sam-fp-main', 'rect', 20, 540, 820, 220, 0, 0, '#f0fdf4', 'ZONE', 'Patio / Terrace', 0
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-zone-patio');

-- ─── Bar counter ──────────────────────────────────────────────────────────────

INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-el-bar-counter', 'sam-fp-main', 'rect', 880, 60, 280, 55, 0, 3, '#6b4226', 'BAR', 'Bar Counter', 0
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-bar-counter');

-- ─── Main dining tables (T1-T8, rect 4-seat and round 2-seat) ─────────────────

-- Row 1: four 4-seat rectangular tables
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count, business_table_id)
SELECT 'sam-el-t1', 'sam-fp-main', 'rect', 80, 100, 110, 70, 0, 3, '#d4a373', 'TABLE', 'T1', 4, 'sam-tbl-01'
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-t1');
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count, business_table_id)
SELECT 'sam-el-t2', 'sam-fp-main', 'rect', 260, 100, 110, 70, 0, 3, '#d4a373', 'TABLE', 'T2', 4, 'sam-tbl-02'
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-t2');
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count, business_table_id)
SELECT 'sam-el-t3', 'sam-fp-main', 'rect', 440, 100, 110, 70, 0, 3, '#d4a373', 'TABLE', 'T3', 4, 'sam-tbl-03'
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-t3');
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count, business_table_id)
SELECT 'sam-el-t4', 'sam-fp-main', 'rect', 620, 100, 110, 70, 0, 3, '#d4a373', 'TABLE', 'T4', 4, 'sam-tbl-04'
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-t4');

-- Row 2: two 6-seat large rectangular tables
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count, business_table_id)
SELECT 'sam-el-t5', 'sam-fp-main', 'rect', 80, 260, 160, 80, 0, 3, '#c49a6c', 'TABLE', 'T5', 6, 'sam-tbl-05'
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-t5');
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count, business_table_id)
SELECT 'sam-el-t6', 'sam-fp-main', 'rect', 340, 260, 160, 80, 0, 3, '#c49a6c', 'TABLE', 'T6', 6, 'sam-tbl-06'
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-t6');

-- Row 3: two round 2-seat intimate tables
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count, business_table_id)
SELECT 'sam-el-t7', 'sam-fp-main', 'circle', 580, 260, 80, 80, 0, 3, '#e8c49a', 'TABLE', 'T7', 2, 'sam-tbl-07'
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-t7');
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count, business_table_id)
SELECT 'sam-el-t8', 'sam-fp-main', 'circle', 700, 260, 80, 80, 0, 3, '#e8c49a', 'TABLE', 'T8', 2, 'sam-tbl-08'
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-t8');

-- Row 4: three 4-seat tables near center
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count, business_table_id)
SELECT 'sam-el-t9', 'sam-fp-main', 'rect', 80, 420, 110, 70, 0, 3, '#d4a373', 'TABLE', 'T9', 4, 'sam-tbl-09'
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-t9');
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count, business_table_id)
SELECT 'sam-el-t10', 'sam-fp-main', 'rect', 350, 420, 110, 70, 0, 3, '#d4a373', 'TABLE', 'T10', 4, 'sam-tbl-10'
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-t10');

-- ─── Bar lounge tables (T11) + patio table (T12) ──────────────────────────────

-- Bar high-top round table
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count, business_table_id)
SELECT 'sam-el-t11', 'sam-fp-main', 'circle', 900, 200, 80, 80, 0, 3, '#a0785a', 'TABLE', 'T11', 4, 'sam-tbl-11'
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-t11');
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count, business_table_id)
SELECT 'sam-el-t11b', 'sam-fp-main', 'circle', 1040, 200, 80, 80, 0, 3, '#a0785a', 'TABLE', 'T11B', 4, NULL
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-t11b');

-- Patio round table
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count, business_table_id)
SELECT 'sam-el-t12', 'sam-fp-main', 'circle', 140, 620, 90, 90, 0, 3, '#86efac', 'TABLE', 'T12', 4, 'sam-tbl-12'
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-t12');
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count, business_table_id)
SELECT 'sam-el-t13', 'sam-fp-main', 'circle', 320, 620, 90, 90, 0, 3, '#86efac', 'TABLE', 'T13', 4, NULL
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-t13');
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count, business_table_id)
SELECT 'sam-el-t14', 'sam-fp-main', 'circle', 500, 620, 90, 90, 0, 3, '#86efac', 'TABLE', 'T14', 4, NULL
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-t14');

-- ─── Chairs (sampled set — not exhaustive to keep migration lean) ─────────────

-- Chairs around T1
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-c-t1-n', 'sam-fp-main', 'circle', 122, 74, 26, 26, 0, 4, '#b5838d', 'CHAIR', NULL, 1 WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-c-t1-n');
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-c-t1-s', 'sam-fp-main', 'circle', 122, 176, 26, 26, 0, 4, '#b5838d', 'CHAIR', NULL, 1 WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-c-t1-s');
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-c-t1-w', 'sam-fp-main', 'circle', 50, 125, 26, 26, 0, 4, '#b5838d', 'CHAIR', NULL, 1 WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-c-t1-w');
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-c-t1-e', 'sam-fp-main', 'circle', 196, 125, 26, 26, 0, 4, '#b5838d', 'CHAIR', NULL, 1 WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-c-t1-e');

-- Chairs around T2
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-c-t2-n', 'sam-fp-main', 'circle', 302, 74, 26, 26, 0, 4, '#b5838d', 'CHAIR', NULL, 1 WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-c-t2-n');
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-c-t2-s', 'sam-fp-main', 'circle', 302, 176, 26, 26, 0, 4, '#b5838d', 'CHAIR', NULL, 1 WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-c-t2-s');
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-c-t2-w', 'sam-fp-main', 'circle', 228, 125, 26, 26, 0, 4, '#b5838d', 'CHAIR', NULL, 1 WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-c-t2-w');
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-c-t2-e', 'sam-fp-main', 'circle', 376, 125, 26, 26, 0, 4, '#b5838d', 'CHAIR', NULL, 1 WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-c-t2-e');

-- Bar stools at counter
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-c-bar-1', 'sam-fp-main', 'circle', 900, 120, 22, 22, 0, 4, '#a0785a', 'CHAIR', NULL, 1 WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-c-bar-1');
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-c-bar-2', 'sam-fp-main', 'circle', 940, 120, 22, 22, 0, 4, '#a0785a', 'CHAIR', NULL, 1 WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-c-bar-2');
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-c-bar-3', 'sam-fp-main', 'circle', 980, 120, 22, 22, 0, 4, '#a0785a', 'CHAIR', NULL, 1 WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-c-bar-3');
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-c-bar-4', 'sam-fp-main', 'circle', 1020, 120, 22, 22, 0, 4, '#a0785a', 'CHAIR', NULL, 1 WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-c-bar-4');
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-c-bar-5', 'sam-fp-main', 'circle', 1060, 120, 22, 22, 0, 4, '#a0785a', 'CHAIR', NULL, 1 WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-c-bar-5');
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-c-bar-6', 'sam-fp-main', 'circle', 1100, 120, 22, 22, 0, 4, '#a0785a', 'CHAIR', NULL, 1 WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-c-bar-6');

-- ─── Decor: plants and stage ──────────────────────────────────────────────────

INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-el-plant-1', 'sam-fp-main', 'circle', 42, 46, 32, 32, 0, 3, '#4ade80', 'PLANT', NULL, 0 WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-plant-1');
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-el-plant-2', 'sam-fp-main', 'circle', 790, 46, 32, 32, 0, 3, '#4ade80', 'PLANT', NULL, 0 WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-plant-2');
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-el-plant-3', 'sam-fp-main', 'circle', 42, 490, 32, 32, 0, 3, '#4ade80', 'PLANT', NULL, 0 WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-plant-3');
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-el-plant-4', 'sam-fp-main', 'circle', 860, 720, 32, 32, 0, 3, '#4ade80', 'PLANT', NULL, 0 WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-plant-4');
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-el-plant-5', 'sam-fp-main', 'circle', 660, 620, 32, 32, 0, 3, '#4ade80', 'PLANT', NULL, 0 WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-plant-5');

-- Small stage / performance area in main dining
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-el-stage', 'sam-fp-main', 'rect', 580, 390, 220, 100, 0, 3, '#fbbf24', 'STAGE', 'Stage', 0
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-stage');

-- Floor labels
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-el-lbl-bar', 'sam-fp-main', 'rect', 920, 400, 120, 28, 0, 5, '#fef3e2', 'LABEL', 'Bar & Lounge', 0
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-lbl-bar');
INSERT INTO floor_plan_elements (id, floor_plan_id, shape_type, x, y, width, height, rotation, z_index, color, element_kind, label, seat_count)
SELECT 'sam-el-lbl-patio', 'sam-fp-main', 'rect', 680, 650, 120, 28, 0, 5, '#f0fdf4', 'LABEL', 'Terrace', 0
WHERE NOT EXISTS (SELECT 1 FROM floor_plan_elements WHERE id='sam-el-lbl-patio');
