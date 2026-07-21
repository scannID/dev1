-- Demo completed orders for admin dashboard (Postgres / Flyway environments).
-- Skips if demo orders already exist.

INSERT INTO orders (
    id, business_id, merchant_id, qr_token, payment_reference, business_name,
    customer_name, customer_phone, total, status, payment_status, created_at, updated_at
)
SELECT * FROM (VALUES
    ('demo-ord-001', 'kampala-grill', 'MER-KGL-1001', 'SIT-KGL-1001', 'PAY-KGL-1001', 'Kampala Grill', 'Amina K.', '', 18000, 'Completed', 'Paid', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
    ('demo-ord-002', 'kampala-grill', 'MER-KGL-1001', 'SIT-KGL-1001', 'PAY-KGL-1001', 'Kampala Grill', 'Brian M.', '', 20500, 'Completed', 'Paid', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
    ('demo-ord-003', 'kampala-grill', 'MER-KGL-1001', 'SIT-KGL-1001', 'PAY-KGL-1001', 'Kampala Grill', 'Carol W.', '', 36000, 'Completed', 'Paid', NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days'),
    ('demo-ord-004', 'kampala-grill', 'MER-KGL-1001', 'SIT-KGL-1001', 'PAY-KGL-1001', 'Kampala Grill', 'David O.', '', 14500, 'Completed', 'Paid', NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days'),
    ('demo-ord-005', 'kampala-grill', 'MER-KGL-1001', 'SIT-KGL-1001', 'PAY-KGL-1001', 'Kampala Grill', 'Esther N.', '', 24000, 'Completed', 'Paid', NOW() - INTERVAL '18 days', NOW() - INTERVAL '18 days'),
    ('demo-ord-006', 'kampala-grill', 'MER-KGL-1001', 'SIT-KGL-1001', 'PAY-KGL-1001', 'Kampala Grill', 'Frank T.', '', 18000, 'Completed', 'Paid', NOW() - INTERVAL '24 days', NOW() - INTERVAL '24 days'),
    ('demo-ord-007', 'kampala-grill', 'MER-KGL-1001', 'SIT-KGL-1001', 'PAY-KGL-1001', 'Kampala Grill', 'Grace L.', '', 29000, 'Completed', 'Paid', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
    ('demo-ord-008', 'kampala-grill', 'MER-KGL-1001', 'SIT-KGL-1001', 'PAY-KGL-1001', 'Kampala Grill', 'Henry P.', '', 6000, 'Completed', 'Paid', NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days'),
    ('demo-ord-009', 'kampala-grill', 'MER-KGL-1001', 'SIT-KGL-1001', 'PAY-KGL-1001', 'Kampala Grill', 'Irene S.', '', 32500, 'Completed', 'Paid', NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days'),
    ('demo-ord-010', 'kampala-grill', 'MER-KGL-1001', 'SIT-KGL-1001', 'PAY-KGL-1001', 'Kampala Grill', 'Joel R.', '', 18000, 'Completed', 'Paid', NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),
    ('demo-ord-011', 'city-lounge', 'MER-CLG-1002', 'SIT-CLG-1002', 'PAY-CLG-1002', 'City Lounge', 'Kevin A.', '', 22000, 'Completed', 'Paid', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),
    ('demo-ord-012', 'city-lounge', 'MER-CLG-1002', 'SIT-CLG-1002', 'PAY-CLG-1002', 'City Lounge', 'Lydia B.', '', 30000, 'Completed', 'Paid', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
    ('demo-ord-013', 'city-lounge', 'MER-CLG-1002', 'SIT-CLG-1002', 'PAY-CLG-1002', 'City Lounge', 'Martin C.', '', 34000, 'Completed', 'Paid', NOW() - INTERVAL '16 days', NOW() - INTERVAL '16 days'),
    ('demo-ord-014', 'city-lounge', 'MER-CLG-1002', 'SIT-CLG-1002', 'PAY-CLG-1002', 'City Lounge', 'Nora D.', '', 12000, 'Completed', 'Paid', NOW() - INTERVAL '22 days', NOW() - INTERVAL '22 days'),
    ('demo-ord-015', 'city-lounge', 'MER-CLG-1002', 'SIT-CLG-1002', 'PAY-CLG-1002', 'City Lounge', 'Oscar E.', '', 52000, 'Completed', 'Paid', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'),
    ('demo-ord-016', 'city-lounge', 'MER-CLG-1002', 'SIT-CLG-1002', 'PAY-CLG-1002', 'City Lounge', 'Patricia F.', '', 22000, 'Completed', 'Paid', NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'),
    ('demo-ord-017', 'city-lounge', 'MER-CLG-1002', 'SIT-CLG-1002', 'PAY-CLG-1002', 'City Lounge', 'Quincy G.', '', 12000, 'Completed', 'Paid', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day')
) AS seed(id, business_id, merchant_id, qr_token, payment_reference, business_name, customer_name, customer_phone, total, status, payment_status, created_at, updated_at)
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE id LIKE 'demo-ord-%')
  AND EXISTS (SELECT 1 FROM businesses WHERE id = 'kampala-grill')
  AND EXISTS (SELECT 1 FROM businesses WHERE id = 'city-lounge');

INSERT INTO order_line_items (order_id, item_id, name, price, quantity, line_total)
SELECT * FROM (VALUES
    ('demo-ord-001', 'beef-plate', 'Beef Plate', 18000, 1, 18000),
    ('demo-ord-002', 'chicken-wrap', 'Chicken Wrap', 14500, 1, 14500),
    ('demo-ord-003', 'beef-plate', 'Beef Plate', 18000, 2, 36000),
    ('demo-ord-011', 'wings', 'Spicy Wings', 22000, 1, 22000),
    ('demo-ord-012', 'vip-ticket', 'Friday VIP Ticket', 30000, 1, 30000)
) AS lines(order_id, item_id, name, price, quantity, line_total)
WHERE EXISTS (SELECT 1 FROM orders WHERE id = lines.order_id)
  AND NOT EXISTS (SELECT 1 FROM order_line_items WHERE order_id = lines.order_id);
