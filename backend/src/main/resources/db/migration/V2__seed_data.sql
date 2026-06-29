INSERT INTO businesses (id, merchant_id, qr_token, name, owner_name, phone, type, table_label, payment_reference, accent)
VALUES
    ('kampala-grill', 'MER-KGL-1001', 'SIT-KGL-1001', 'Kampala Grill', 'Owner', '', 'Bar', 'Location', 'PAY-KGL-1001', '#2563eb'),
    ('city-lounge', 'MER-CLG-1002', 'SIT-CLG-1002', 'City Lounge', 'Owner', '', 'Bar', 'Seat or area', 'PAY-CLG-1002', '#7c3aed');

INSERT INTO catalog_items (id, business_id, name, category, price, description, available) VALUES
    ('beef-plate', 'kampala-grill', 'Beef Plate', 'Meals', 18000, 'Grilled beef, rice, greens, and house sauce.', TRUE),
    ('chicken-wrap', 'kampala-grill', 'Chicken Wrap', 'Meals', 14500, 'Soft wrap with chicken, salad, and garlic sauce.', TRUE),
    ('passion-juice', 'kampala-grill', 'Passion Juice', 'Drinks', 6000, 'Fresh passion fruit juice served cold.', TRUE),
    ('family-platter', 'kampala-grill', 'Family Platter', 'Meals', 42000, 'Mixed grill, fries, salad, and two sauces.', FALSE),
    ('mocktail', 'city-lounge', 'House Mocktail', 'Drinks', 12000, 'Citrus, mint, soda, and crushed ice.', TRUE),
    ('wings', 'city-lounge', 'Spicy Wings', 'Bites', 22000, 'Six wings with chilli glaze and dip.', TRUE),
    ('vip-ticket', 'city-lounge', 'Friday VIP Ticket', 'Tickets', 30000, 'Entry ticket for Friday night live DJ event.', TRUE);
