-- V8: Widen businesses.merchant_id to hold a full merchant UUID (36 chars).
-- The merchant->business bridge stores merchant.getId().toString() (a UUID),
-- which overflows the original varchar(32).
ALTER TABLE businesses ALTER COLUMN merchant_id TYPE VARCHAR(64);
