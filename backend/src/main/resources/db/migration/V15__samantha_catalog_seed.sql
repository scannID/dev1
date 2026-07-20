-- Samantha Restaurant demo menu (idempotent)
INSERT INTO catalog_items (id, business_id, name, category, price, description, available)
SELECT 'samantha-restaurant-3', 'samantha-restaurant', 'Grilled Chicken', 'Meals', 22000, 'Half chicken with fries and salad.', TRUE
WHERE EXISTS (SELECT 1 FROM businesses WHERE id = 'samantha-restaurant')
  AND NOT EXISTS (SELECT 1 FROM catalog_items WHERE id = 'samantha-restaurant-3');

INSERT INTO catalog_items (id, business_id, name, category, price, description, available)
SELECT 'samantha-restaurant-4', 'samantha-restaurant', 'Beef Stew & Rice', 'Meals', 18000, 'Slow-cooked beef stew with steamed rice.', TRUE
WHERE EXISTS (SELECT 1 FROM businesses WHERE id = 'samantha-restaurant')
  AND NOT EXISTS (SELECT 1 FROM catalog_items WHERE id = 'samantha-restaurant-4');

INSERT INTO catalog_items (id, business_id, name, category, price, description, available)
SELECT 'samantha-restaurant-5', 'samantha-restaurant', 'Vegetable Samosa (4pc)', 'Bites', 8000, 'Crispy samosas with chutney.', TRUE
WHERE EXISTS (SELECT 1 FROM businesses WHERE id = 'samantha-restaurant')
  AND NOT EXISTS (SELECT 1 FROM catalog_items WHERE id = 'samantha-restaurant-5');

INSERT INTO catalog_items (id, business_id, name, category, price, description, available)
SELECT 'samantha-restaurant-6', 'samantha-restaurant', 'Chapati', 'Sides', 3000, 'Fresh flatbread.', TRUE
WHERE EXISTS (SELECT 1 FROM businesses WHERE id = 'samantha-restaurant')
  AND NOT EXISTS (SELECT 1 FROM catalog_items WHERE id = 'samantha-restaurant-6');

INSERT INTO catalog_items (id, business_id, name, category, price, description, available)
SELECT 'samantha-restaurant-7', 'samantha-restaurant', 'Passion Juice', 'Drinks', 6000, 'Fresh passion fruit, served cold.', TRUE
WHERE EXISTS (SELECT 1 FROM businesses WHERE id = 'samantha-restaurant')
  AND NOT EXISTS (SELECT 1 FROM catalog_items WHERE id = 'samantha-restaurant-7');

INSERT INTO catalog_items (id, business_id, name, category, price, description, available)
SELECT 'samantha-restaurant-8', 'samantha-restaurant', 'Local Beer', 'Drinks', 8000, '500ml chilled.', TRUE
WHERE EXISTS (SELECT 1 FROM businesses WHERE id = 'samantha-restaurant')
  AND NOT EXISTS (SELECT 1 FROM catalog_items WHERE id = 'samantha-restaurant-8');

INSERT INTO catalog_items (id, business_id, name, category, price, description, available)
SELECT 'samantha-restaurant-9', 'samantha-restaurant', 'Chocolate Cake Slice', 'Desserts', 12000, 'Rich chocolate layer cake.', TRUE
WHERE EXISTS (SELECT 1 FROM businesses WHERE id = 'samantha-restaurant')
  AND NOT EXISTS (SELECT 1 FROM catalog_items WHERE id = 'samantha-restaurant-9');
