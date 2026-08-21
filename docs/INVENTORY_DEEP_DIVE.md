# Inventory System — Deep Dive

> How the ingredient-level stock tracking system works, end to end.

---

## Overview

The inventory system tracks raw ingredient stock for food businesses. It is completely separate from two other stock-related features:

- **`unitsAvailable` on `catalog_items`** — a simple integer counter for hotel rooms, boutique products etc. Untouched by this system.
- **`ingredients_json` on `catalog_items`** — display-only allergy tags shown to customers (e.g. "contains: nuts"). No stock effect.

The ingredient inventory system sits in three tightly linked layers:

```
Ingredients (stock ledger)
      ↕
Recipe lines (what a dish costs to make)
      ↕
Stock movements (immutable audit log of every change)
```

---

## The Three Core Tables

### `ingredients`

One row per ingredient per branch. This is the live stock ledger.

```sql
id                   VARCHAR(64)  -- ING-XXXXXXXX
business_id          VARCHAR(64)  -- FK to businesses (one branch)
name                 VARCHAR(255) -- unique per branch, case-insensitive
unit                 VARCHAR(16)  -- kg / g / L / ml / pcs / portion
category             VARCHAR(64)  -- free-form grouping label
qty_on_hand          NUMERIC(18,4)-- current stock, 4 decimal places
avg_unit_cost        INTEGER      -- UGX, weighted moving average
low_stock_threshold  NUMERIC(18,4)-- alert threshold
par_level            NUMERIC(18,4)-- target on-hand level
reorder_qty          NUMERIC(18,4)-- suggested order quantity
supplier_id          VARCHAR(64)  -- preferred supplier (nullable)
sku                  VARCHAR(64)  -- optional stock-keeping unit label
active               BOOLEAN      -- soft-delete flag
```

Key computed properties on the entity:
- `isLowStock()` — true when `qty_on_hand <= low_stock_threshold` (and threshold > 0)
- `needsReorder()` — true when `isLowStock() && reorder_qty > 0`
- `stockValue()` — `qty_on_hand × avg_unit_cost`, rounded to UGX integer

### `recipe_lines`

Links catalog items to ingredients. One row per ingredient per dish. Every set-recipe operation creates a **new version** — old lines are never deleted, just time-stamped.

```sql
id               BIGSERIAL
catalog_item_id  VARCHAR(64)  -- FK to catalog_items (food items only)
ingredient_id    VARCHAR(64)  -- FK to ingredients
qty_per_sale     NUMERIC(18,4)-- how much of this ingredient per portion sold
line_unit        VARCHAR(16)  -- unit for this recipe line (may differ from ingredient unit)
effective_from   TIMESTAMPTZ  -- when this version was created
effective_to     TIMESTAMPTZ  -- NULL = currently active; set when superseded
recipe_version   INTEGER      -- monotonically increasing per catalog item
```

**Why versioning matters:** If a chef changes a recipe (reduces oil from 50ml to 30ml), the old recipe lines are NOT deleted. They are stamped with `effective_to = NOW()`. New lines are inserted with `effective_from = NOW()`. When the system calculates COGS for an old order, it uses the recipe version that was active at `order.paid_at`, not the current recipe. This means COGS figures never silently change retroactively.

### `stock_movements`

Immutable audit log. Every stock quantity change writes exactly one row here. Rows are **never updated or deleted**.

```sql
id                  BIGSERIAL
business_id         VARCHAR(64)
ingredient_id       VARCHAR(64)
movement_type       VARCHAR(24)  -- see Movement Types below
qty_delta           NUMERIC(18,4)-- positive = stock added, negative = removed
unit_cost           INTEGER      -- UGX at time of movement
order_id            VARCHAR(32)  -- set for CONSUME / CONSUME_REVERSE
transfer_group_id   VARCHAR(64)  -- XFR-XXXX — links TRANSFER_OUT + TRANSFER_IN pair
related_business_id VARCHAR(64)  -- the other branch in a transfer
related_ingredient_id VARCHAR(64)-- matching ingredient on other branch
supplier_ref        VARCHAR(128) -- invoice / delivery note reference
po_number           VARCHAR(128) -- purchase order number
note                TEXT
actor               VARCHAR(255) -- "merchant" / "system"
created_at          TIMESTAMPTZ
```

**Movement types:**

| Type | Direction | When |
|---|---|---|
| `RECEIVE` | + | Stock delivered from supplier |
| `ADJUST` | +/− | Manual correction (stocktake, counting error) |
| `WASTE` | − | Spoilage, damage, expiry |
| `CONSUME` | − | Automatic deduction when order is paid |
| `CONSUME_REVERSE` | + | Automatic credit when order is refunded/cancelled |
| `TRANSFER_OUT` | − | Sent to another branch |
| `TRANSFER_IN` | + | Received from another branch |
| `RETURN` | + | Supplier return |

---

## How Each Stock Operation Works

### Receive

When a delivery arrives:

1. Merchant enters: quantity, unit cost, optional supplier_ref, optional PO number, optional note.
2. Backend adds `qty` to `ingredient.qty_on_hand`.
3. **Weighted moving average** recalculates `avg_unit_cost`:
   ```
   new_avg = ((old_qty × old_avg) + (received_qty × received_unit_cost))
              / (old_qty + received_qty)
   ```
   This means the average cost per unit drifts gradually as you restock at different prices — it never jumps suddenly.
4. A `RECEIVE` movement row is written with the `supplier_ref` and `po_number` captured.
5. If `qty_on_hand` is still below `low_stock_threshold` after receiving, a `INGREDIENT_LOW_STOCK` realtime event fires to the merchant's orders channel.

### Adjust

For counting corrections — a stocktake reveals 2.3kg of chicken when the system says 2.8kg:

1. Merchant enters a `qtyDelta` (positive or negative) and a required note.
2. Backend rejects if `qty_on_hand + delta < 0` — prevents accidental negative stock from manual adjustments.
3. Writes an `ADJUST` movement.

### Waste

For spoilage or damage:

1. Merchant enters a quantity and a note.
2. Backend rejects if `qty_on_hand < qty` — can't waste more than you have.
3. Writes a `WASTE` movement with `qty_delta = −qty`.

### Transfer (cross-branch)

When the main kitchen has surplus flour and a sister branch needs some:

1. Merchant picks a destination branch and quantity.
2. Backend validates: same merchant, same unit family, sufficient source stock.
3. **If the destination branch doesn't have a matching ingredient** (matched by name, case-insensitive), it is auto-created with zero stock, same name and unit, before crediting.
4. **Wrapped in one transaction:**
   - Source: `qty_on_hand -= qty`, writes `TRANSFER_OUT` movement
   - Destination: `qty_on_hand += qty` with weighted avg cost update, writes `TRANSFER_IN` movement
   - Both movements share one `XFR-XXXXXXXXXXXX` transfer_group_id so both sides can be traced.
5. Low-stock alerts fire on both branches if applicable.

### Set Recipe (versioned)

When a chef changes a recipe:

1. Backend calls `recipeLineRepository.expireActiveLines(catalogItemId, NOW())` — this `UPDATE`s all active lines for that item to set `effective_to = NOW()`. **No lines are deleted.**
2. Increments `recipe_version` (reads `MAX(recipe_version)` for this item, adds 1).
3. Inserts new lines with `effective_from = NOW()`, `effective_to = NULL`, `recipe_version = N`.
4. Validates unit compatibility for each line (see Unit Conversions section below).

The result: you can see the full recipe history and the system knows which ingredients were in a dish on any given date.

### Consume for Paid Order (automatic)

When a customer's order is marked paid, the system automatically deducts ingredients:

1. **Idempotency guard:** checks if `CONSUME` movements already exist for this `order_id`. If yes, no-op — the operation is idempotent so double-calling is safe.
2. **Version resolution:** uses `order.updated_at` (the payment timestamp) to look up the recipe lines active at that exact moment — `findActiveAtTime(itemId, paidAt)`. This ensures COGS reflects what the recipe was when the customer ordered, not what it is today.
3. For each order line × each recipe ingredient:
   - Converts `line_unit` → `ingredient_unit` using `UnitConversionService`
   - Deducts `qty_per_sale × line_quantity` from `ingredient.qty_on_hand`
   - **If this takes `qty_on_hand` below zero: allowed** — the order is not blocked. Stock goes negative and the order is flagged (see Under-Stock Flagging below).
   - Writes a `CONSUME` movement tagged with `order_id`
   - Locks `cost_amount = qty × avg_unit_cost` onto the order line
4. Sums all line costs into `order.cogs_total`.
5. Sets `order.inventory_consumed = true`.

### CONSUME_REVERSE (on refund or cancellation)

When a paid order is refunded or cancelled:

1. **Idempotency guard:** checks for existing `CONSUME_REVERSE` movements for this `order_id`. If found, no-op.
2. Loads all original `CONSUME` movements for the order.
3. For each original movement:
   - Credits back the **exact quantity from the original row** (not from current recipe state)
   - Uses the **original unit cost** from the movement row (not current `avg_unit_cost`)
   - Writes a `CONSUME_REVERSE` movement
4. Resets `order.cogs_total = 0`.

This means CONSUME_REVERSE is always exact even if the recipe has since changed or the ingredient has been removed.

---

## Unit Conversions

A recipe line can use a different unit than the ingredient is stocked in. For example:

- Ingredient stocked in: `kg`
- Recipe line: `50g of flour per portion`

The system resolves this via `UnitConversionService`:

**Allowed unit families (conversions only within a family):**

| Family | Units | Conversion |
|---|---|---|
| Mass | `kg`, `g` | 1 kg = 1000 g |
| Volume | `L`, `ml` | 1 L = 1000 ml |
| Count | `pcs`, `portion` | Must match exactly — no conversion |

**What gets rejected:** a recipe line in `kg` for an ingredient stocked in `L` — these are different families, the system throws HTTP 400.

When `setRecipe()` saves a line with a `lineUnit`, it calls `validateCompatible(lineUnit, ingredientUnit)`. When `consumeForPaidOrder()` deducts stock, it calls `toIngredientUnit(lineQty, lineUnit, ingredientUnit)` before subtracting.

---

## Under-Stock Flagging

Rather than blocking a paid order when stock runs out (which would leave a customer stuck mid-payment), the system uses a "flag and continue" policy:

1. During `consumeForPaidOrder()`, if any ingredient's `qty_on_hand` goes below zero after deduction, `anyUnderStock = true`.
2. After processing all lines: `order.inventory_under_stock = true`.
3. A `INVENTORY_UNDER_STOCK` realtime event fires to the merchant's orders WebSocket channel.
4. The order appears with an amber **⚠ Stock–** badge in the orders table.

The merchant sees the flag and investigates — typically by either receiving more stock or running an Adjust to correct the count.

---

## Par Levels and Reorder Suggestions

Each ingredient can have two optional threshold values:

- **`low_stock_threshold`** — when `qty_on_hand` drops at or below this, the `lowStock` flag activates and a badge appears in the Stock tab.
- **`par_level`** — the target on-hand level (e.g. "we always want 5kg of chicken").
- **`reorder_qty`** — how much to order to restore stock from `low_stock_threshold` back to `par_level`.

When `qty_on_hand <= low_stock_threshold` AND `reorder_qty > 0`, `needsReorder()` returns true. The **Reorder Alerts** tab in Purchase Orders shows all such ingredients and can auto-generate a draft PO from them in one click.

---

## Purchase Orders

The purchase order system connects suppliers to stock receives:

### Lifecycle

```
DRAFT → SENT → PARTIALLY_RECEIVED → RECEIVED
                                   ↘ CANCELLED (from DRAFT or SENT only)
```

### Receiving a PO

When stock arrives against a PO:

1. Merchant marks which lines were received and how much, with optional `batchNumber` and `expiryDate` per line.
2. For each received line:
   - Calls `inventoryService.receiveStockInternal()` — same weighted average logic as a manual receive, but skips the merchant access re-check since the PO already verified it.
   - Creates an `ingredient_batches` row (see Batch Tracking below).
3. Updates `line.qty_received`.
4. If all lines are fully received: PO status → `RECEIVED`.
5. If partial: PO status → `PARTIALLY_RECEIVED`.

---

## Batch and Expiry Tracking

When stock is received (either via a PO or manually), an optional `IngredientBatch` record can be created:

```sql
ingredient_batches
  ingredient_id    -- which ingredient
  batch_number     -- supplier lot number or merchant label
  qty_original     -- how much was received
  qty_remaining    -- how much is left (decremented by future FIFO logic)
  unit_cost        -- cost at time of receipt
  expiry_date      -- DATE, nullable
  received_at      -- when it was received
  po_id            -- which PO it came from (nullable)
```

The **Batches & Expiry** sub-tab in Purchase Orders shows all active batches. Batches expiring within 7 days show an amber "Soon" label; expired batches show red "EXPIRED".

---

## Variance Report

The variance report helps a manager understand whether actual ingredient consumption matches what the recipes say it should be.

**How it's calculated (for a given date range):**

1. Loads all `CONSUME` movements in the period → **actual consumption** per ingredient.
2. Loads all `RECEIVE` movements → **received** per ingredient.
3. Loads all `WASTE` movements → **recorded waste** per ingredient.
4. Computes `variance = actual_consumption − theoretical_consumption`.

**Interpreting the variance:**

| Variance | Likely cause |
|---|---|
| Positive (amber) | Used more than recipes expect — over-portioning, unrecorded waste, or theft |
| Negative (blue) | Used less than expected — over-recording, recipe hasn't been updated, or stock counting error |
| Near zero (green) | Kitchen is operating to recipe |

The report sorts by `variance_cost` descending so the most expensive discrepancies appear first.

---

## How It Connects to Catalog Items

There are **three separate code paths** involving ingredients and catalog items. They share no logic or tables.

```
catalog_items.ingredients_json  →  display tags for customers (allergy info)
                                   NO stock effect
                                   Customers can request removal at order time
                                   That removal is cosmetic only

catalog_items ← recipe_lines → ingredients
                                   REAL inventory link
                                   Drives automatic CONSUME on paid orders
                                   Drives COGS calculation

catalog_items.units_available  →  simple integer counter
                                   Used for hotel rooms, boutique products
                                   COMPLETELY SEPARATE — not touched by this system
```

---

## Cost of Goods Sold (COGS)

COGS is locked onto orders at payment time:

- `order_line_items.cost_amount` — ingredient cost for that line (UGX)
- `orders.cogs_total` — sum of all line costs for the order

These are locked at payment and only cleared by `CONSUME_REVERSE` on refund/cancel. Editing a recipe after an order is paid does **not** change the COGS on that order — this is exactly what recipe versioning protects.

Gross profit per order:
```
gross_profit = order.merchant_payout - order.cogs_total
gross_margin = gross_profit / order.merchant_payout × 100
```

---

## Navigation in the Merchant App

The Inventory section is **merchant-only** (blocked for all staff roles):

```
Inventory (sidebar group)
  ├── Stock          — ingredient table, receive stock, add ingredients
  ├── Transfer       — move stock between branches
  ├── Adjust         — manual corrections
  ├── Waste          — write off spoilage
  ├── Purchase Orders— create POs, reorder alerts, batch/expiry tracker
  ├── Suppliers      — supplier directory
  └── Variance       — theoretical vs actual consumption report
```

---

## API Endpoints

All under `/api/businesses/{businessId}/inventory` (merchant-auth required):

| Method | Path | Action |
|---|---|---|
| GET | `/summary` | Ingredient count, total stock value, low-stock count + list |
| GET | `/ingredients` | All active ingredients (pass `?includeInactive=true` for all) |
| POST | `/ingredients` | Create ingredient (optionally with opening stock) |
| PATCH | `/ingredients/:id` | Update metadata (name, unit, category, cost, threshold, sku, active) |
| PATCH | `/ingredients/:id/par-level` | Update par level, reorder qty, preferred supplier |
| POST | `/ingredients/:id/receive` | Add stock + recalculate weighted avg cost |
| POST | `/ingredients/:id/adjust` | Positive/negative correction |
| POST | `/ingredients/:id/waste` | Write off stock |
| POST | `/ingredients/:id/transfer` | Cross-branch stock move |
| GET | `/catalog/:id/recipe` | Get active recipe lines for a catalog item |
| PUT | `/catalog/:id/recipe` | Set recipe (versioned — does not delete old lines) |
| GET | `/movements` | Recent stock movement log (up to 200 rows) |
| GET | `/variance` | Variance report for a date range (`?from=ISO&to=ISO`) |

Supplier endpoints under `/api/businesses/{businessId}/suppliers`.

Purchase order endpoints under `/api/businesses/{businessId}/purchase-orders`.

---

## Key Design Decisions

**Why allow negative stock?** Blocking a customer payment because an ingredient ran out creates a terrible customer experience. The system logs the under-stock event and flags the order for the merchant to investigate. In practice, stock going negative usually means someone forgot to record a receive — not that the kitchen is actually out.

**Why immutable movement rows?** Any financial audit requires a complete, unaltered history. If rows could be edited or deleted, the movement log would be meaningless. Every balance can always be reconstructed from scratch by replaying movements.

**Why version recipes instead of deleting?** COGS on a paid order must reflect the recipe at the time of sale. If you could hard-delete recipe lines, historical cost figures would silently become wrong whenever a recipe was edited.

**Why weighted moving average cost?** Simple FIFO would require tracking which batch of stock was used for each order — complex and slow at query time. Weighted average gives a reasonable cost estimate with minimal complexity and works well for high-volume ingredients that are restocked regularly at similar prices.
