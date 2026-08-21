# Ticketing System Roadmap

> Current state, missing features, and implementation plan for the Kodte ticketing system.

---

## Current State

The ticketing system uses a single `Ticket` entity that doubles as both an event template (master) and individual attendee tickets, distinguished by a `masterTicketId` foreign key and a `usageLimit > 1,000,000` sentinel on master rows.

### What already works

| Feature | Notes |
|---|---|
| Event creation | Merchant creates a master ticket with ticket classes, capacity, and price |
| Public purchase | Customer buys via `/ticket/:qrToken`, no account required |
| Inventory holds | `hold_expires_at` on unpaid tickets, cleaned up by scheduler |
| Capacity enforcement | `countSold + countActiveHolds >= capacity` check with `SELECT FOR UPDATE` on master row |
| Sold-out indicators | Live `remaining` count returned on `EventInfoResponse` |
| Gate scanning | Camera or HID scanner, validates `SCANNY:TICKET:` QR payload, marks Redeemed |
| WhatsApp delivery | Ticket + QR link sent to holder's WhatsApp after purchase |
| Ticket view page | `/ticket/view/:accessToken` — shows entry pass QR once payment is confirmed |
| Ticket classes | Multiple tiers (General, VIP, etc.) with individual prices and capacities |
| Table bookings | Separate table packages (name, seats, price, capacity) |
| Multi-use tickets | `usageLimit > 1` for multi-day festival passes |
| Complimentary tickets | Merchant issues free tickets (price 0) directly from the dashboard |

### Known gaps

| Gap | Impact |
|---|---|
| No sale start / end dates | Merchant cannot schedule when sales open or close |
| No presale | No early access, no discount windows, no presale codes |
| No waitlist | Sold-out customers have nowhere to go |
| No queue | High-traffic launches crash or oversell without a virtual waiting room |
| No transfer | Ticket holder cannot pass their ticket to someone else |
| No refunds | `PaymentStatus.Refunded` exists but no MoMo reverse flow is wired |
| No rate limit on `/purchase` | The purchase endpoint has no IP-level throttle |
| No group bookings | One ticket per transaction; buying 4 tickets requires 4 separate purchases |
| No check-in export | No CSV download of attendees for door staff offline use |

---

## Data Model

### `tickets` table (current columns)

```
id                  VARCHAR(32) PK           — ERI-XXXXXXXX (master) / TKT-XXXXXXXX (attendee)
qr_token            VARCHAR(64) UNIQUE       — customer-facing scan code
master_ticket_id    VARCHAR(32)              — NULL = master, set = attendee ticket
ticket_type         VARCHAR(64)              — class name, e.g. "VIP"
event_name          VARCHAR(255)
event_date          TIMESTAMPTZ
holder_name         VARCHAR(255)
holder_phone        VARCHAR(32)
holder_email        VARCHAR(255)
price               INTEGER                  — base + 700 UGX service fee
currency            VARCHAR(8)               — default UGX
status              VARCHAR(32)              — Active / Redeemed / Expired / Cancelled / Invalid
usage_limit         INTEGER                  — >1,000,000 on master = event template sentinel
usage_count         INTEGER
expires_at          TIMESTAMPTZ              — ticket validity cutoff
payment_reference   VARCHAR(64)
payment_status      VARCHAR(32)              — Unpaid / Paid / Refunded
issued_by           VARCHAR(255)
metadata            TEXT (JSON)              — all event config lives here
access_token        VARCHAR(64) UNIQUE       — secret link for attendee view
hold_expires_at     TIMESTAMPTZ              — soft inventory hold expiry while Unpaid
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
redeemed_at         TIMESTAMPTZ
```

### `metadata` JSON blob (on master ticket)

```json
{
  "ticketClasses": [{ "name": "VIP", "fee": 120000, "capacity": 50 }],
  "tables":        [{ "name": "VIP Table", "seats": 6, "price": 300000, "capacity": 10 }],
  "template":      "classic",
  "payTo":         "+256700111222",
  "location":      "Kampala Serena Hotel",
  "time":          "8:00 PM",
  "host":          "Jane Okello",
  "hostContact":   "+256700000000",
  "eventImageUrl": "https://...",
  "queueEnabled":  false
}
```

### Purchase flow (current)

```
POST /api/tickets/public/purchase
  ↓
  systemBusyModeService.isSystemBusy()          — kill switch check
  ↓
  ticketRepository.findByIdForUpdate()           — SELECT … FOR UPDATE on master
  ↓
  validate inputs (name, phone, class)
  ↓
  duplicate phone check (one paid ticket per phone per event)
  ↓
  resolveSelectionPrice() + assertInventoryAvailable()
  ↓
  INSERT attendee ticket (paymentStatus = Unpaid, holdExpiresAt = now + 10 min)
  ↓
  flip to Paid in same transaction (instant-pay path, no gateway)
  ↓
  refreshStatsBroadcast() via WebSocket / Redis
  ↓
  [outside tx] deliverTicketWhatsApp()
```

---

## Roadmap

Priority order — lowest effort and highest immediate value first.

---

### 1. Rate limiting on `/purchase`

**Effort:** 1 line  
**Why now:** The purchase endpoint is completely unthrottled. A single IP can hammer it.

**Change:** `RateLimitService.resolveBucket()` — add:

```java
if ("POST".equalsIgnoreCase(method) && path.equals("/api/tickets/public/purchase")) {
    return "ticket-purchase:" + ticketPurchasePerMin; // e.g. 20/min
}
```

Also add to `application.yml`:
```yaml
scanny:
  rate-limit:
    ticket-purchase-per-min: 20
```

---

### 2. Sale start and end dates

**Effort:** Small — 2 DB columns, a few lines in `requireEventTemplate()`  
**Why now:** Without this, sales have no schedule. Merchant must manually cancel the event to stop sales.

#### DB migration

```sql
-- V30__ticket_sale_window.sql
ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS sale_starts_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sale_ends_at   TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tickets_sale_window
    ON tickets (sale_starts_at, sale_ends_at)
    WHERE master_ticket_id IS NULL;
```

#### Backend — `Ticket.java`

Add fields:
```java
@Column(name = "sale_starts_at")
private Instant saleStartsAt;

@Column(name = "sale_ends_at")
private Instant saleEndsAt;
```

#### Backend — `TicketPurchaseService.requireEventTemplate()`

```java
Instant now = Instant.now();
if (ticket.getSaleStartsAt() != null && now.isBefore(ticket.getSaleStartsAt())) {
    throw new ApiException(423, "Ticket sales open on "
        + ticket.getSaleStartsAt().toString());
}
if (ticket.getSaleEndsAt() != null && now.isAfter(ticket.getSaleEndsAt())) {
    throw new ApiException(410, "Ticket sales for this event have closed.");
}
```

#### Frontend — `EventTicket.tsx` (create event form)

Add two date/time pickers: "Sales open" and "Sales close". Pass as `saleStartsAt` and `saleEndsAt` in the create request. Show a countdown on `TicketPurchasePage` if sales haven't opened yet.

#### `EventInfoResponse` additions

```java
String saleStartsAt,    // ISO-8601 or null
String saleEndsAt,      // ISO-8601 or null
boolean saleOpen        // computed: now is within [saleStartsAt, saleEndsAt]
```

---

### 3. Presale

**Effort:** Medium — metadata extension, one new form field, one backend check  
**Why now:** Every major event in Uganda has a presale window. Without it merchants work around the system manually.

#### Three presale types

| Type | How it works |
|---|---|
| **Early bird** | A ticket class with a lower price and its own `saleEndsAt` — goes unavailable at cutoff |
| **Presale code** | A class gated by a secret code the buyer enters at checkout |
| **Allowlist** | Only phone numbers on a merchant-uploaded list can buy a specific class |

#### A. Early bird — metadata extension

```json
{
  "ticketClasses": [
    { "name": "Early Bird", "fee": 30000, "capacity": 100, "saleEndsAt": "2025-10-01T00:00:00Z" },
    { "name": "General",    "fee": 40000, "capacity": 400 }
  ]
}
```

Backend change in `resolveSelectionPrice()` — add per-class window check:
```java
if (cls.saleEndsAt() != null && now.isAfter(cls.saleEndsAt())) {
    // treat as unavailable — skip this class
    continue;
}
```

#### B. Presale code — metadata + purchase request

```json
{ "name": "VIP Presale", "fee": 80000, "capacity": 50, "presaleCode": "VIPKODE25", "saleEndsAt": "2025-10-05T00:00:00Z" }
```

`PurchaseRequest` gains an optional field:
```java
public record PurchaseRequest(
    String masterQrToken,
    String ticketClass,
    String holderName,
    String holderEmail,
    String holderPhone,
    String provider,
    String presaleCode    // NEW — optional
) {}
```

Backend check before price resolution:
```java
if (classMeta.presaleCode() != null
        && !classMeta.presaleCode().equalsIgnoreCase(request.presaleCode())) {
    throw new ApiException(403, "Invalid presale code.");
}
```

Frontend — `TicketPurchasePage.tsx`: show "Have a presale code?" expandable field when the selected class has `presaleRequired: true` in the response.

#### C. Allowlist (new table)

```sql
-- V31__ticket_allowlist.sql
CREATE TABLE ticket_allowlist (
    id         BIGSERIAL PRIMARY KEY,
    master_id  VARCHAR(32) NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    phone      VARCHAR(32) NOT NULL,
    tier       VARCHAR(64),            -- which class they're allowed; NULL = any
    used       BOOLEAN NOT NULL DEFAULT FALSE,
    added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (master_id, phone)
);

CREATE INDEX idx_ticket_allowlist_master ON ticket_allowlist(master_id, phone);
```

In `TicketEventInfo`, add `allowlistEnabled: boolean` per class. When true, backend checks before purchase and marks `used = true` after.

---

### 4. Virtual queue (high-traffic launches)

**Effort:** Large — new table, new endpoints, background worker, frontend waiting screen  
**When:** Before any event expecting more than a few hundred concurrent buyers

#### Architecture

```
Customer hits /purchase
       ↓
   queue entry created (Redis sorted set + DB row)
       ↓
   HTTP 202 + { queueToken, position }
       ↓
   Customer polls GET /queue/{queueToken} every 4 seconds
       ↓
   Background worker pops N entries/sec, calls startPurchase()
       ↓
   status = Complete → view_url returned to customer
```

#### New DB table

```sql
-- V32__ticket_queue.sql
CREATE TABLE ticket_queue_entries (
    id              VARCHAR(64) PRIMARY KEY,   -- queueToken (UUID)
    master_id       VARCHAR(32) NOT NULL,
    ticket_class    VARCHAR(64) NOT NULL,
    holder_name     VARCHAR(255) NOT NULL,
    holder_phone    VARCHAR(32) NOT NULL,
    holder_email    VARCHAR(255),
    provider        VARCHAR(32),
    presale_code    VARCHAR(128),
    status          VARCHAR(32) NOT NULL DEFAULT 'Waiting',
    -- Waiting / Processing / Complete / Failed / Expired
    position        INTEGER,
    attendee_ticket_id VARCHAR(32),
    view_url        TEXT,
    error_message   TEXT,
    queued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_ticket_queue_status  ON ticket_queue_entries(master_id, status, queued_at);
CREATE INDEX idx_ticket_queue_expires ON ticket_queue_entries(expires_at) WHERE status = 'Waiting';
```

#### New endpoints

| Method | Path | What it does |
|---|---|---|
| `POST` | `/api/tickets/public/queue` | Joins queue; returns `queueToken`, `position`, `estimatedWaitSeconds` |
| `GET`  | `/api/tickets/public/queue/{token}` | Polls status: `Waiting / Processing / Complete / Failed / Expired` |

#### Backend — `QueueProcessorScheduler`

```java
@Scheduled(fixedDelay = 2000)  // every 2 seconds
@Transactional
public void processQueue() {
    List<TicketQueueEntry> batch = queueRepository.findNextBatch(BATCH_SIZE);
    for (TicketQueueEntry entry : batch) {
        entry.setStatus("Processing");
        queueRepository.save(entry);
        try {
            PurchaseResponse result = ticketPurchaseService.startPurchase(toRequest(entry));
            entry.setStatus("Complete");
            entry.setAttendeeTicketId(result.attendeeTicketId());
            entry.setViewUrl(result.viewUrl());
        } catch (ApiException ex) {
            entry.setStatus("Failed");
            entry.setErrorMessage(ex.getMessage());
        }
        entry.setProcessedAt(Instant.now());
        queueRepository.save(entry);
    }
}
```

`BATCH_SIZE` should be tunable via config — start at 5, raise based on DB throughput.

#### Redis position tracking (optional enhancement)

```
ZADD  ticket:queue:{masterId}  {timestamp}   {queueToken}
ZRANK ticket:queue:{masterId}  {queueToken}  → returns 0-based position
```

When Redis is unavailable, fall back to `SELECT COUNT(*) FROM ticket_queue_entries WHERE master_id = ? AND status = 'Waiting' AND queued_at < ?`.

#### Frontend — `QueueWaitingStep` component

After form submit returns 202:

```
┌─────────────────────────────────┐
│  🎟  You're in line             │
│                                 │
│  Position  47                   │
│  Est. wait  ~3 min              │
│                                 │
│  ████████░░░░░░░  47 / 500     │
│                                 │
│  Don't close this tab.          │
│  Your spot is saved.            │
└─────────────────────────────────┘
```

Poll interval: 4 seconds. When `status == Complete`, auto-redirect to `viewUrl`.

#### Enabling the queue per event

Add `"queueEnabled": true` to the master ticket metadata. When `false` (default), the existing direct-purchase flow runs as-is — no change for low-traffic events.

---

### 5. Waitlist

**Effort:** Small  
**When:** First time a meaningful event sells out

```sql
-- V33__ticket_waitlist.sql
CREATE TABLE ticket_waitlist (
    id           BIGSERIAL PRIMARY KEY,
    master_id    VARCHAR(32) NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    ticket_class VARCHAR(64) NOT NULL,
    holder_name  VARCHAR(255) NOT NULL,
    holder_phone VARCHAR(32) NOT NULL,
    notified     BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (master_id, holder_phone)
);
```

**Flow:**
1. `assertInventoryAvailable()` throws 409 → frontend shows "Sold out — join the waitlist" button
2. `POST /api/tickets/public/waitlist` — saves entry
3. When a ticket is refunded or a hold expires → `TicketHoldExpiryScheduler` checks waitlist, sends WhatsApp to the next person with a time-limited purchase link
4. Link uses a one-time `waitlist_token` that pre-fills the purchase form and bypasses the sold-out check for that person for 30 minutes

---

### 6. Ticket transfer

**Effort:** Medium

```sql
ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS transfer_token    VARCHAR(64) UNIQUE,
    ADD COLUMN IF NOT EXISTS transfer_expires  TIMESTAMPTZ;
```

**Flow:**
1. `POST /api/tickets/public/{accessToken}/transfer` — generates `transfer_token`, sets 24h expiry, returns a transfer URL
2. Holder shares the URL with the new person
3. `POST /api/tickets/public/transfer/accept` — new person provides their name + phone + `transfer_token`, ticket `holderName/holderPhone` is updated
4. Old holder gets a WhatsApp confirmation that their ticket was transferred

---

### 7. Group bookings

**Effort:** Small — add `quantity` field to `PurchaseRequest`

Backend: loop `startPurchase()` N times in one transaction (max quantity = 10). Return array of `viewUrl` links.

Frontend: add a quantity stepper (1–10) before the buy button. Show price × quantity in the total strip.

---

### 8. Refunds

**Effort:** Medium — MoMo reverse API needs to be wired

`confirmPurchaseFromPayment()` already exists. Need a matching `initiateRefund()`:

1. Merchant clicks "Refund" in the dashboard against a specific attendee ticket
2. Backend calls MoMo reverse/refund API with the original `paymentReference`
3. On success: `ticket.paymentStatus = Refunded`, `ticket.status = Cancelled`
4. WhatsApp sent to holder confirming refund
5. Inventory count decreases → waitlist notified if applicable

---

### 9. Check-in export

**Effort:** Trivial

```
GET /api/tickets/public/track/{eventId}/export?format=csv
```

Returns CSV: `TicketCode, HolderName, HolderPhone, TicketClass, PaymentStatus, Status, RedeemedAt`

Used by door staff as offline backup when phone camera / network fails.

---

## Summary

| # | Feature | Effort | Priority |
|---|---|---|---|
| 1 | Rate limit on `/purchase` | 1 line | Now |
| 2 | Sale start / end dates | Small | Now |
| 3a | Early bird pricing | Small | Now |
| 3b | Presale codes | Small | High |
| 3c | Allowlist | Medium | Medium |
| 4 | Virtual queue | Large | Before big launches |
| 5 | Waitlist | Small | High |
| 6 | Ticket transfer | Medium | Medium |
| 7 | Group bookings | Small | Medium |
| 8 | Refunds | Medium | High |
| 9 | Check-in CSV export | Trivial | Low |

---

## Files to change (by feature)

### Sale windows + presale codes
- `backend/src/main/resources/db/migration/V30__ticket_sale_window.sql` — new
- `backend/src/main/java/com/scanny/entity/Ticket.java` — add `saleStartsAt`, `saleEndsAt`
- `backend/src/main/java/com/scanny/service/TicketPurchaseService.java` — window checks
- `backend/src/main/java/com/scanny/dto/PublicTicketDtos.java` — extend `EventInfoResponse`, `PurchaseRequest`
- `src/tickets/TicketPurchasePage.tsx` — sale countdown, presale code field
- `src/EventTicket.tsx` — sale date pickers in create form
- `src/api/types.ts` — `TicketEventInfo`, `TicketPurchaseRequest`

### Queue
- `backend/src/main/resources/db/migration/V32__ticket_queue.sql` — new
- `backend/src/main/java/com/scanny/entity/TicketQueueEntry.java` — new
- `backend/src/main/java/com/scanny/repository/TicketQueueRepository.java` — new
- `backend/src/main/java/com/scanny/service/QueueProcessorScheduler.java` — new
- `backend/src/main/java/com/scanny/controller/PublicTicketController.java` — 2 new endpoints
- `src/tickets/TicketPurchasePage.tsx` — queue waiting step
- `src/api/types.ts` — queue response types
- `src/api/services.ts` — `publicTicketsApi.joinQueue`, `publicTicketsApi.queueStatus`
