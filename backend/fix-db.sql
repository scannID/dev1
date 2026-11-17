-- Fix corrupt outbox events
DELETE FROM outbox_events WHERE id IN (41778, 41781, 41784);

-- Also delete any other failed outbox events
DELETE FROM outbox_events WHERE status = 'FAILED' OR attempts > 5;
