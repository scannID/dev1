-- ══════════════════════════════════════════════════════════════════════════
-- V68: Fix Restaurant Posting Rules for IFRS 15 Principal Treatment
-- ══════════════════════════════════════════════════════════════════════════
-- 
-- **Issue**: Current ORDER_PAID rule treats Koddly as an "agent" (records 
-- commission only), which understates revenue and hides cash-flow timing risk.
--
-- **Fix**: Apply IFRS 15 "principal" treatment:
--  • Record GROSS revenue (full order amount)
--  • Record merchant payable liability (amount owed to merchant)
--  • Net difference is Koddly's commission
--
-- This makes the ledger match:
--  1. What customer actually paid (1000 UGX)
--  2. What we owe merchant (2400 liability)
--  3. What we earn (commission: 1000 - 2400 = negative means we owe more)
--
-- **Impact**: 
--  - Revenue increases (shows gross, not net)
--  - Liability account 2400 (Merchant Payables) now tracks amounts owed
--  - Trial balance still balanced
--  - Historical entries unchanged (migration is forward-only)
--
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1. Deactivate old agent-treatment rules ──────────────────────────────────

UPDATE accounting.posting_rules
   SET is_active = false,
       description = '[DEPRECATED] ' || description || ' — Use principal treatment instead.'
 WHERE source_module = 'RESTAURANTS'
   AND event_type IN ('ORDER_PAID', 'ORDER_PAID_CASH')
   AND is_active = true;

-- ── 2. Add new principal-treatment rules ─────────────────────────────────────

INSERT INTO accounting.posting_rules (source_module, event_type, description, rule_json, is_active)
VALUES

-- ORDER_PAID (MoMo): Record FULL transaction per IFRS 15 principal treatment
('RESTAURANTS', 'ORDER_PAID',
 'Customer pays for restaurant order via MoMo. IFRS 15 principal treatment: record gross revenue and merchant payable.',
 '[
   {"account_code":"1000","side":"DEBIT",  "amount_field":"order_total_ugx","memo":"MoMo payment received"},
   {"account_code":"3000","side":"CREDIT", "amount_field":"order_total_ugx","memo":"Restaurant sales revenue (gross)"},
   {"account_code":"4000","side":"DEBIT",  "amount_field":"merchant_net_ugx","memo":"Cost of sale — merchant portion"},
   {"account_code":"2400","side":"CREDIT", "amount_field":"merchant_net_ugx","memo":"Merchant payable liability"}
 ]'::jsonb),

-- ORDER_PAID_CASH: Same structure for cash orders
('RESTAURANTS', 'ORDER_PAID_CASH',
 'Cash order paid. Merchant collects cash; we record gross revenue and merchant payable per IFRS 15.',
 '[
   {"account_code":"1300","side":"DEBIT",  "amount_field":"order_total_ugx","memo":"Commission receivable from merchant"},
   {"account_code":"3000","side":"CREDIT", "amount_field":"order_total_ugx","memo":"Restaurant sales revenue (gross)"},
   {"account_code":"4000","side":"DEBIT",  "amount_field":"merchant_net_ugx","memo":"Cost of sale — merchant portion"},
   {"account_code":"2400","side":"CREDIT", "amount_field":"merchant_net_ugx","memo":"Merchant payable liability"}
 ]'::jsonb),

-- MERCHANT_PAYOUT: New event to record when we pay merchants
('RESTAURANTS', 'MERCHANT_PAYOUT',
 'Koddly pays merchant their accumulated balance. Clears merchant payable liability.',
 '[
   {"account_code":"2400","side":"DEBIT",  "amount_field":"payout_amount_ugx", "memo":"Clear merchant payable"},
   {"account_code":"1000","side":"CREDIT", "amount_field":"payout_amount_ugx", "memo":"MoMo payout to merchant"}
 ]'::jsonb);

-- ── 3. Add new account for merchant payables (if not exists) ─────────────────

INSERT INTO accounting.accounts (code, name, account_type, normal_balance, description, is_active)
VALUES 
('2400', 'Merchant Payables', 'LIABILITY', 'CREDIT', 
 'Amounts owed to restaurant merchants for orders processed. Cleared on payout.', 
 true)
ON CONFLICT (code) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════
-- Notes for Backend Team:
-- ══════════════════════════════════════════════════════════════════════════
--
-- 1. **New amount fields required in AccountingEvent**:
--    - order_total_ugx: full order amount (what customer paid)
--    - merchant_net_ugx: amount owed to merchant (order_total - commission)
--    These should be added to OrderService when it publishes ORDER_PAID events.
--
-- 2. **New event type to implement**:
--    - MERCHANT_PAYOUT: trigger this when MerchantPayoutService runs.
--
-- 3. **Reconciliation impact**:
--    - Old entries used agent treatment (commission only)
--    - New entries use principal treatment (gross revenue)
--    - When comparing periods, revenue will appear to "jump" — this is expected.
--    - Create a memo in the accounting period close notes explaining the change.
--
-- 4. **No data backfill**:
--    - We do NOT restate historical entries (would break hash chain).
--    - Financial reports should add a footnote explaining the methodology change.
--
-- ══════════════════════════════════════════════════════════════════════════
