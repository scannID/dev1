# Scanny / Koddly — Full System Reference

> **Koddly** is the brand name. The codebase is `scanny`. A QR-based ordering, payment, ticketing, and fiscal platform for Ugandan SMEs — restaurants, hotels, bars, salons, events.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Project Root & Tooling](#2-project-root--tooling)
3. [Infrastructure — Docker Compose](#3-infrastructure--docker-compose)
4. [Backend — Package Structure](#4-backend--package-structure)
5. [Configuration — application.yml](#5-configuration--applicationyml)
6. [Database Schema — Entities & Tables](#6-database-schema--entities--tables)
7. [Flyway Migrations (V1–V56)](#7-flyway-migrations-v1v56)
8. [Repositories & Custom Queries](#8-repositories--custom-queries)
9. [Services — Business Logic](#9-services--business-logic)
10. [REST API — Controllers](#10-rest-api--controllers)
11. [Payment Subsystem](#11-payment-subsystem)
12. [EFRIS Fiscal Integration](#12-efris-fiscal-integration)
13. [Outbox Pattern](#13-outbox-pattern)
14. [Financial Ledger](#14-financial-ledger)
15. [Security & Auth](#15-security--auth)
16. [WebSocket & Realtime](#16-websocket--realtime)
17. [Frontend — Merchant Portal](#17-frontend--merchant-portal)
18. [Frontend — Admin Console](#18-frontend--admin-console)
19. [Frontend — Customer SPA](#19-frontend--customer-spa)
20. [Tickets Subsystem](#20-tickets-subsystem)
21. [Inventory & COGS](#21-inventory--cogs)
22. [Floor Plan](#22-floor-plan)
23. [Key Data Flows (End-to-End)](#23-key-data-flows-end-to-end)
24. [Environment Variables Reference](#24-environment-variables-reference)
25. [Known Gaps & Production Readiness Notes](#25-known-gaps--production-readiness-notes)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser                                                            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  Merchant Portal │  │  Admin Console   │  │  Customer SPA    │  │
│  │  Vite/React 19   │  │  Vite/React 19   │  │  (same bundle)   │  │
│  │  Port 5173       │  │  Port 5174       │  │  /c/ routes      │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
└───────────┼──────────────────────┼──────────────────────┼───────────┘
            │  HTTPS + JWT         │                      │
            ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Spring Boot Backend (Java 21)  Port 4000                           │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ REST API    │  │ WebSocket    │  │ Outbox       │               │
│  │ 37 Ctrls   │  │ /ws/realtime │  │ Dispatcher   │               │
│  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘               │
│         │                │                  │                        │
│  ┌──────▼──────────────────────────────────▼───────────────────┐   │
│  │  Services: Order, Payment, Ledger, EFRIS, Ticket, Inventory  │   │
│  └──────────────────────────────┬──────────────────────────────┘   │
└─────────────────────────────────┼───────────────────────────────────┘
                                  │
          ┌───────────────────────┼────────────────────┐
          ▼                       ▼                     ▼
    ┌──────────┐           ┌──────────┐          ┌──────────┐
    │PostgreSQL│           │  Redis   │          │ Keycloak │
    │  Port    │           │  Port    │          │  Port    │
    │  5432    │           │  6379    │          │  8080    │
    └──────────┘           └──────────┘          └──────────┘
```

**Technology Stack:**

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 4, shadcn/ui, Radix UI |
| Auth (client) | Keycloak JS 26 (OIDC/OAuth2 PKCE) |
| Backend | Spring Boot 3.x, Java 21, Spring Security (OAuth2 Resource Server) |
| Database | PostgreSQL 16, Flyway 10, Spring Data JPA / Hibernate 6 |
| Cache / Pub-Sub | Redis 7 (optional, falls back gracefully) |
| Identity | Keycloak 26 (realm: `scanny`) |
| Payments | MTN MoMo, Airtel Money (both skeletal), Stub (fully working) |
| Fiscal | URA EFRIS v3 (AES-256-ECB, Uganda VAT 18%) |
| QR | ZXing (generation + scanning) |

---

## 2. Project Root & Tooling

### package.json
- **name:** `scanny` | **version:** `0.0.0` | **type:** `module`
- **Scripts:**

  | Script | Purpose |
  |---|---|
  | `dev` | Merchant portal dev server on port 5173 |
  | `dev:admin` | Admin console on port 5174 |
  | `build` | Production merchant portal bundle |
  | `build:admin` | Admin console production build |
  | `lint` | ESLint |
  | `typecheck` | Type checking only (`tsc --noEmit`) |
  | `test` | Vitest (`--run`, non-watch) |
  | `preview` | Preview production build |

- **Key runtime dependencies:**

  | Package | Version | Purpose |
  |---|---|---|
  | `react` | 19.2.6 | UI framework |
  | `keycloak-js` | 26.2.4 | OIDC client |
  | `tailwindcss` | 4.3.1 | Styling |
  | `shadcn` | 4.11.0 | Component library |
  | `lucide-react` | 1.18.0 | Icons |
  | `sonner` | 2.0.7 | Toast notifications |
  | `qrcode` | 1.5.4 | QR generation |
  | `jsqr` | 1.4.0 | QR scanning |
  | `jsbarcode` | 3.12.3 | Barcode rendering |
  | `konva` + `react-konva` | 9.3.22 / 19.2.5 | Canvas floor plan editor |
  | `date-fns` | 4.4.0 | Date utilities |
  | `next-themes` | 0.4.6 | Dark/light theme |
  | `@radix-ui` | 1.5.0 | Accessible primitives |

### vite.config.ts
- Proxy: `/api` and `/ws` → `VITE_DEV_BACKEND` or `http://localhost:4000`
- `@` alias → `./src`
- `buildSourcemap: 'hidden'` (Sentry-compatible)
- Manual chunks: `vendor-react`, `vendor-keycloak`, `vendor-ui`, `vendor-canvas`, `vendor-qr`
- Optional HTTPS via `VITE_DEV_HTTPS=1` + `@vitejs/plugin-basic-ssl`

### tsconfig.app.json
- `target: ES2022`, `moduleResolution: Bundler`, `jsx: react-jsx`
- `strict: false`, `noImplicitAny: false`
- Path alias: `@/*` → `./src/*`

---

## 3. Infrastructure — Docker Compose

| Service | Image | Port | Notes |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | 5432 | Volume `scanny_pg_data`; healthcheck: `pg_isready` |
| `redis` | `redis:7-alpine` | 6379 | AOF persistence; volume `scanny_redis_data` |
| `keycloak` | `quay.io/keycloak/keycloak:26.0.7` | 8080 | `start-dev`; backed by postgres |
| `adminer` | `adminer:latest` | 8888 | DB admin UI |

All on `scanny-network` bridge network.

---

## 4. Backend — Package Structure

**Base:** `com.scanny` | **Entry:** `ScannyApplication.java`

| Package | Description |
|---|---|
| `api` | Error writers, response envelope helpers |
| `config` | Spring Security, CORS, JWT, Redis, WebSocket, async executor, rate-limit filter, dev data seeder |
| `controller` | 37 `@RestController` classes |
| `dto` | Request/response records aligned to each controller |
| `efris` | Uganda Revenue Authority EFRIS fiscal receipting (9 files) |
| `entity` | 46 JPA entity classes mapped to PostgreSQL |
| `exception` | `ApiException(int code, String message)` + global `@ControllerAdvice` |
| `model/enums` | `OrderStatus`, `PaymentStatus`, `BusinessType`, `ItemKind`, `RoomStatus`, `LedgerEntryType`, `TicketStatus`, `TransactionStatus`, `AdminPermission` |
| `payment` | Provider abstraction, registry, context/status enums, config |
| `payment/model` | `FeeSplit`, `PaymentCommand`, `PaymentProviderResult` records |
| `payment/provider` | `StubPaymentProvider`, `MtnMomoPaymentProvider`, `AirtelMoneyPaymentProvider` |
| `payment/service` | `PaymentGatewayService`, `PaymentIntentService` |
| `repository` | 44 Spring Data JPA repository interfaces |
| `security` | `MerchantAccessService`, `AdminPermissionFilter`, `StaffSessionAuthFilter`, `RateLimitService`, `ClientIpResolver` |
| `service` | 55 service classes |
| `util` | `CodeUtils`, `CatalogPricing`, `CatalogCategories`, `JsonLists`, `WaitEstimate`, `PhoneUtils` |
| `websocket` | `RealtimeWebSocketHandler`, `TicketStatsWebSocketHandler`, `RealtimeEventPublisher` |

### `WaitEstimate` utility
```java
BASE_MINUTES = 10
PER_OPEN_ORDER_MINUTES = 3
MAX_MINUTES = 45
RANGE_PAD_MINUTES = 3

estimateMinutes(openOrders) = clamp(10 + openOrders × 3, 10, 45)
rangeHigh(estimate)         = min(45, estimate + 3)
```
Used in `OrderService.getCustomerOrderTracking` when status is Pending or Preparing.

---

## 5. Configuration — application.yml

### Server
```yaml
server.port: ${SERVER_PORT:4000}
server.forward-headers-strategy: none  # override in prod behind proxy
```

### Database
```yaml
spring.jpa.hibernate.ddl-auto: validate   # Flyway owns the schema
spring.jpa.open-in-view: false
spring.jpa.properties.hibernate.jdbc.time_zone: UTC
spring.flyway.enabled: true
```

### Fee Configuration (`scanny.fees`)
```yaml
service-fee-ugx: ${SCANNY_SERVICE_FEE_UGX:700}   # flat UGX fee per order
pso-percent: ${SCANNY_PSO_PERCENT:0.30}            # 30% of fee to MoMo provider
```

**Formula:**
```
subtotal    = orderItems total
grossCharged = subtotal + 700
psoFee      = round(700 × 0.30) = 210
platformFee  = 490
merchantPayout = subtotal  (+ any merchant fee commission)
```

### Rate Limits (`scanny.rate-limit`)
| Endpoint | Default |
|---|---|
| Registration | 5/min |
| Orders | 30/min |
| Menu | 120/min |
| Ticket purchase | 20/min |
| Ticket scan | 60/min |
| Payments initiate | 20/min |
| Payments status | 60/min |
| WebSocket | 30/min |

### EFRIS (`scanny.efris`)
```yaml
enabled: false                  # false = stub mode (default for dev)
api-url: https://efris.ura.go.ug/efrisws/ws/tapin/getInformation
connect-timeout-ms: 5000
read-timeout-ms: 10000
max-retries: 3                  # total attempts (1 initial + 2 retries)
vat-rate: 0.18                  # 18% Uganda standard VAT
```

### Payments (`scanny.payments`)
```yaml
default-provider: stub
fallback-to-stub: true
stub.auto-complete-seconds: 0   # 0 = manual; > 0 auto-completes in dev
mtn-momo: { enabled: false, api-url, api-key, api-secret, subscription-key, callback-url }
airtel-money: (same fields)
```

### Tickets (`scanny.tickets`)
```yaml
auto-delete-hours-after-event: 24
hold-ttl-minutes: 10
queue-activation-threshold: 3
```

---

## 6. Database Schema — Entities & Tables

### `businesses`
| Column | Type | Notes |
|---|---|---|
| `id` | VARCHAR PK | Slugified name e.g. `kampala-grill` |
| `merchant_id` | VARCHAR(64) | Soft FK → merchants.id |
| `branch_label` | VARCHAR | Default `"Main"` |
| `is_primary` | BOOLEAN | |
| `name`, `owner_name`, `phone` | VARCHAR | |
| `type` | VARCHAR | `BusinessType` enum |
| `qr_token` | VARCHAR UNIQUE | Customer-facing QR value |
| `payment_reference` | VARCHAR | MoMo payer reference |
| `accent` | VARCHAR | Hex color default `#2563eb` |
| `currency` | VARCHAR(8) | Default `UGX` |
| `accepting_orders` | BOOLEAN | |
| `busy_mode` | BOOLEAN | Kitchen busy flag |
| `busy_mode_expires_at` | TIMESTAMPTZ | Auto-lift busy mode |
| `pause_message` | TEXT | Shown to customers when paused |
| `whatsapp_notifications_enabled` | BOOLEAN | |
| `whatsapp_business_phone` | VARCHAR | |
| `latitude`, `longitude` | DOUBLE | Geolocation |
| `geo_query` | VARCHAR | Pre-formatted Nominatim query |
| `custom_categories` | JSONB | Ordered list of category names |

### `orders`
| Column | Type | Notes |
|---|---|---|
| `id` | VARCHAR PK | Format `ORD-XXXXXXXX` |
| `public_id` | UUID UNIQUE | Customer-facing tracking ID |
| `business_id` | VARCHAR FK | |
| `merchant_id` | VARCHAR(64) | Denormalized at creation |
| `customer_name`, `customer_phone`, `customer_location`, `customer_note` | VARCHAR | |
| `total` | INT | Gross (subtotal + serviceFee) in UGX |
| `subtotal` | INT | Pre-fee amount |
| `service_fee` | INT | Platform service fee (default 700 UGX) |
| `pso_fee` | INT | MoMo provider share (~210 UGX) |
| `platform_fee` | INT | Scanny share (~490 UGX) |
| `merchant_payout` | INT | Amount sent to merchant |
| `merchant_momo_destination` | VARCHAR | Merchant's MoMo number |
| `payment_method` | VARCHAR | `MOMO` or `CASH` |
| `payment_status` | VARCHAR | `Unpaid/Paid/Refunded` |
| `status` | VARCHAR | `Pending/Preparing/Ready/Completed/Cancelled` |
| `cogs_total` | INT | Recipe cost locked at payment time |
| `inventory_consumed` | BOOLEAN | Prevents double-deduction |
| `inventory_under_stock` | BOOLEAN | Flagged if ingredient below threshold |
| `table_id`, `table_session_id`, `split_group_id` | VARCHAR/UUID | Table billing feature |
| `created_at`, `updated_at` | TIMESTAMPTZ | |

### `merchants`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK auto | |
| `keycloak_user_id` | UUID UNIQUE | Links to Keycloak realm user |
| `email` | VARCHAR UNIQUE | |
| `business_type` | VARCHAR | `RESTAURANT/HOTEL/BAR/PARKING/EVENT/SALON/RETAIL/OTHER` |
| `status` | VARCHAR | `PENDING_VERIFICATION/ACTIVE/SUSPENDED/CLOSED` |
| `plan` | VARCHAR | `FREE/BASIC/PRO/ENTERPRISE` |
| `service_fee_merchant_percent` | INT(0–100) | Merchant's commission share of service fee |
| `onboarding_completed` | BOOLEAN | |
| `settings`, `metadata` | JSONB | |
| `created_at`, `updated_at`, `last_login_at` | TIMESTAMPTZ | |

### `receipts`
| Column | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `receipt_number` | VARCHAR(50) UNIQUE | `RCT-YYYYMMDD-XXXX` (PG trigger) |
| `order_id` | VARCHAR | FK to orders |
| `amount`, `subtotal`, `tax_amount`, `service_fee`, `total_amount` | DECIMAL | |
| `items` | JSONB | Array of line items |
| `status` | VARCHAR | `GENERATED/SENT/FAILED/VIEWED` |
| `efris_fdn` | VARCHAR(100) | URA Fiscal Document Number |
| `efris_qr_url` | TEXT | URA verification URL |
| `efris_status` | VARCHAR(20) | `PENDING/SUBMITTED/FAILED/EXEMPT` |
| `metadata` | JSONB | |

### `payment_intents`
| Column | Type | Notes |
|---|---|---|
| `id` | VARCHAR PK | Format `PAY-XXXXXXXXXXXX` |
| `context` | VARCHAR | `ORDER/ORDER_SPLIT/QUICK_PAY/TICKET/EVENT_PROMOTION` |
| `reference_id` | VARCHAR | FK to relevant entity |
| `provider_id` | VARCHAR | `stub/mtn-momo/airtel-money` |
| `amount`, `subtotal`, `service_fee`, `pso_fee`, `platform_fee`, `merchant_payout` | INT | Fee split snapshot |
| `merchant_momo_destination`, `scanny_fee_destination` | VARCHAR | Payout routing |
| `idempotency_key` | VARCHAR UNIQUE (partial) | Replay protection |
| `status` | VARCHAR | `Pending/Processing/Paid/Failed/Cancelled` |
| `provider_reference` | VARCHAR | External transaction ID |
| `created_at`, `updated_at`, `completed_at`, `failed_at` | TIMESTAMPTZ | |

### `outbox_events`
| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT IDENTITY | |
| `event_type` | VARCHAR(64) | See Outbox section |
| `channel` | VARCHAR(128) | WebSocket channel |
| `business_id` | VARCHAR(64) | |
| `payload_json` | TEXT | JSON payload |
| `created_at` | TIMESTAMPTZ | |
| `processed_at` | TIMESTAMPTZ | NULL = pending |

Index: `idx_outbox_events_pending` on `created_at WHERE processed_at IS NULL`

### `financial_ledger_entries`
| Column | Type | Notes |
|---|---|---|
| `id` | VARCHAR(64) PK | UUID string |
| `order_id` | VARCHAR(64) | For audit / dedup |
| `business_id` | VARCHAR(64) | |
| `entry_type` | VARCHAR(16) | `PAYMENT` or `REFUND` |
| `gross_amount` | BIGINT | Customer-paid total; **negative for REFUND** |
| `net_amount` | BIGINT | Merchant payout; **negative for REFUND** |
| `service_fee` | BIGINT | **negative for REFUND** |
| `pso_fee` | BIGINT | **negative for REFUND** |
| `platform_fee` | BIGINT | **negative for REFUND** |
| `cogs_amount` | BIGINT | Recipe cost; **negative for REFUND** |
| `payment_method` | VARCHAR(16) | `MOMO` or `CASH` |
| `settled_at` | TIMESTAMPTZ | Financial event time; all range queries use this |
| `created_at` | TIMESTAMPTZ | Row written time |

Indexes: `idx_fle_business_settled (business_id, settled_at)`, `idx_fle_order_id`

### Other Tables (summary)

| Table | Entity | Notes |
|---|---|---|
| `catalog_items` | `CatalogItem` | Menu items; `item_kind` (FOOD/ROOM/SUITE), discounts, image array, ingredients |
| `order_line_items` | `OrderLineItem` | Snapshot at order time; `check_in_date/check_out_date/nights` for lodging |
| `tickets` | `Ticket` | Master + attendee tickets; `access_token`, `gate_token`, `transfer_token` |
| `business_tables` | `BusinessTable` | Physical tables with QR tokens |
| `table_sessions` | `TableSession` | Groups orders by dining session |
| `business_staff` | `BusinessStaff` | Staff with Keycloak user ID, role, password hash |
| `ingredients` | `Ingredient` | `qty_on_hand`, `avg_unit_cost`, `low_stock_threshold` |
| `recipe_lines` | `RecipeLine` | Versioned ingredient→item mapping |
| `stock_movements` | `StockMovement` | Every stock change with reason codes |
| `suppliers` | `Supplier` | Per-business supplier list |
| `purchase_orders` | `PurchaseOrder` | DRAFT/SENT/RECEIVED lifecycle |
| `floor_plans` | `FloorPlan` | Konva canvas metadata |
| `floor_plan_elements` | `FloorPlanElement` | TABLE/WALL/LABEL/WINDOW/DOOR shapes |
| `efris_merchant_configs` | `EfrisMerchantConfig` | URA credentials per merchant |
| `efris_submissions` | `EfrisSubmission` | Immutable audit of every URA attempt |
| `admin_users` | `AdminUser` | Platform admin accounts |
| `platform_broadcasts` | `PlatformBroadcast` | Admin-to-merchant announcements |
| `promoted_events` | `PromotedEvent` | Ticketed event promotions with tier/radius |
| `qr_scan_events` | `QrScanEvent` | QR scan analytics |
| `cookie_consents` | `CookieConsent` | GDPR consent records |
| `quick_payment_codes` | `QuickPaymentCode` | Reusable payment QR codes |
| `audit_events` | `AuditEvent` | Admin action audit trail |

---

## 7. Flyway Migrations (V1–V56)

| Version | Description |
|---|---|
| V1 | Base schema: `businesses`, `catalog_items`, `orders`, `order_line_items` |
| V2 | Demo seed: Kampala Grill + City Lounge |
| V3 | `tickets`, `ticket_scans` |
| V4 | `quick_payment_codes`, `quick_payment_transactions` |
| V5 | `registered_devices`, `device_payment_methods`, `device_transactions` |
| V6 | `receipts`, `receipt_delivery_attempts`, `receipt_templates`; receipt number PG trigger |
| V7 | `merchants`, QR code tables; referral code trigger |
| V8 | Widen `businesses.merchant_id` VARCHAR(32) → VARCHAR(64) |
| V9 | `platform_configs` JSON KV store; seeds platform/auth/payments sections |
| V10a | `audit_events` table |
| V10b ⚠️ | `busy_mode_expires_at` to businesses — **duplicate V10 number** |
| V11 | `owner_email`, `tracking_number` to quick_payment_codes |
| V12 | `payment_intents` table |
| V13 | `master_ticket_id`, `access_token` to tickets |
| V14 | `gate_token` to tickets |
| V15 | Samantha Restaurant catalog seed |
| V16 | `qr_scan_events` table |
| V17 | Demo orders seed |
| V18 | `custom_categories JSONB` to businesses |
| V19 | `idempotency_key` + unique partial indexes to payment_intents |
| V20 | Hot-path indexes; creates `outbox_events` table |
| V21 | `image_url`, `ingredients_json` to catalog_items; `removed_ingredients_json` to order_line_items |
| V22 | `discount_percent INT DEFAULT 0` to catalog_items |
| V23 | Fee split columns to orders + payment_intents; `scanny_fee_destination` |
| V24 | Hotel/lodging: `item_kind`, `image_urls`, `units_available` to catalog_items; `check_in_date`, `nights` to order_line_items |
| V25 | `cookie_consents` table |
| V26 | Branch/staff/table feature: `branch_label`, `busy_mode`, `whatsapp_*` to businesses; creates `business_tables`, `table_sessions`, `business_staff` |
| V27 | `password_hash`, `invite_token` to business_staff |
| V28 | `keycloak_user_id` UUID to business_staff |
| V29 | `hold_expires_at` to tickets (inventory hold TTL) |
| V30 | `ingredients`, `recipe_lines`, `stock_movements`; `cogs_total`, `inventory_consumed` to orders |
| V31 | Inter-branch stock transfers: `transfer_group_id` to stock_movements |
| V32 | `platform_broadcasts`, `platform_broadcast_acks` |
| V33 | Samantha extended menu seed |
| V34 | `floor_plans`, `floor_plan_elements`, `floor_plan_element_statuses` |
| V35 | Samantha floor plan seed (12 tables, walls, doors) |
| V36 | `announcements` table |
| V37 | `room_status` to catalog_items; `item_kind` snapshot to order_line_items |
| V38 | `service_fee_merchant_percent` to merchants |
| V39 | `sale_starts_at`, `sale_ends_at` to tickets |
| V40 | `ticket_queue_entries` (virtual waiting room) |
| V41 | `transfer_token`, `transfer_expires_at` to tickets |
| V42 | `ticket_waitlist` with `claim_token` |
| V43 | `suppliers`; `supplier_id`, `par_level`, `reorder_qty` to ingredients |
| V44 | `purchase_orders`, `purchase_order_lines` |
| V45 | `ingredient_batches` (FIFO lot/expiry tracking) |
| V46 | `variance_snapshots` (theoretical vs. actual reconciliation) |
| V47 | Recipe versioning: `effective_from/to`, `recipe_version`; `inventory_under_stock` to orders |
| V48 | `unit_conversions`; seed kg↔g, L↔ml |
| V49 | `business_id` FK to unit_conversions (per-merchant overrides) |
| V50 | `currency VARCHAR(8) DEFAULT 'UGX'` to businesses |
| V51 | `admin_users`, `admin_user_permissions` |
| V52 | `promoted_events` |
| V53 | Seeds promotion tiers (LOCAL 40k/5km, CITY 80k/20km, BOOST 150k/global); `tier` column |
| V54 | `latitude`, `longitude`, `geo_query` to businesses; Kampala coords for demo venues |
| V55 | `efris_merchant_configs`, `efris_submissions`; EFRIS columns to receipts |
| V56 | `financial_ledger_entries` *(missing migration — was created by Hibernate DDL)* |

> ⚠️ **V10 duplicate:** Both `V10__add_busy_mode_expires_at.sql` and `V10__audit_events.sql` exist. Flyway will throw a checksum conflict on a fresh database. One must be renumbered before first production deployment.

---

## 8. Repositories & Custom Queries

### `OrderRepository`
- `findWithItemsById(id)` — EntityGraph fetch
- `findWithItemsByPublicId(UUID)` — by `public_id`
- `findByIdForUpdate(id)` — `SELECT ... FOR UPDATE`
- `searchByBusiness(businessId, search, status, paymentStatus, pageable)` — filtered paginated
- `sumOverlappingLodgingUnits(itemId, checkIn, checkOut, ...)` — lodging availability
- `accountingOutstandingRevenue(businessId, from, to)` — SUM(merchantPayout) for unpaid
- `countUnpaidNonCancelledForBusiness(businessId, from, to)`
- `aggregateCashOrdersByMerchant()` — [merchantId, businessName, count, sumTotal, sumPlatformFee]

### `FinancialLedgerRepository`
- `existsByOrderIdAndEntryType(orderId, entryType)` — dedup guard
- `aggregateSummary(businessId, from, to)` — 9-column: [sumGross, sumNet, sumServiceFee, sumPsoFee, sumPlatformFee, sumCogs, paymentCount, refundCount, totalCount]
- `paymentMethodBreakdown(businessId, from, to)` — [method, count, sumNet, sumGross]
- `ledgerPage(businessId, from, to, entryType, pageable)` — paginated DESC
- `streamForExport(businessId, from, to)` — `Stream<>` with `HINT_FETCH_SIZE=1000` for O(1) CSV
- `rawPairsForDailySeries(businessId, since)` — [settledAt, netAmount] pairs

### `OutboxEventRepository`
- `findPending(Pageable)` — `WHERE processed_at IS NULL ORDER BY created_at ASC`

### `EfrisSubmissionRepository`
- `existsSuccessfulSubmission(orderId)` — checks SUCCESS or STUB status
- `countFailedAttempts(orderId)` — determines next attempt number

### `PaymentIntentRepository`
- `findByIdempotencyKey(key)`
- `findTopByContextAndReferenceIdAndStatusInOrderByCreatedAtDesc(...)` — reuse check
- `findByProviderReference(reference)` — webhook correlation

### `TicketRepository`
- `findByIdForUpdate(id)` — pessimistic lock for concurrency
- `countSoldByMasterAndType(masterId, ticketType)` — capacity check
- `countActiveHoldsByMasterAndType(masterId, ticketType, now)` — includes unpaid holds
- `findExpiredHolds(...)` — cleanup scheduler target

---

## 9. Services — Business Logic

### `OrderService`

**`createOrder(businessId, request)`**
1. `SystemBusyModeService.isSystemBusy()` → 503 if true
2. Check `business.acceptingOrders` and `business.busyMode` → 503 if blocked
3. Load + validate `CatalogItem` records
4. Build `OrderLineItem` list:
   - Food: `effectivePrice(price, discountPercent)`, validate `removedIngredients`
   - Lodging (ROOM/SUITE): validate checkIn < checkOut, `sumOverlappingLodgingUnits`, `lineTotal = price × nights × qty`
5. `FeeService.split(subtotal, merchantId)` → `FeeSplit`
6. Optionally link `BusinessTable` + open `TableSession`
7. **Cash path:** immediately `PaymentStatus.Paid` → inventory → outbox receipt → ledger
8. Publish `ORDER_CREATED` realtime events

**`applyPaymentStatus(order, paymentStatus)`**
- `→ Paid`: `ledgerWriterService.recordPayment` (REQUIRES_NEW) → inventory consume → enqueueReceipt
- `→ Refunded`: `ledgerWriterService.recordRefund` (REQUIRES_NEW) → inventory reverse

**`autoGenerateReceipt(order)`**
1. `receiptService.generateReceipt(request)` → Receipt row
2. `outboxService.enqueueEfrisSubmit(orderId)` → EFRIS pipeline

### `PaymentIntentService`

**`createIntent`** — ORDER context copies all fee fields from `Order`; ORDER_SPLIT zeroes all fees

**`applyStatusChange → Paid`** → `outboxService.enqueuePaymentPaid(intentId)`

**`applyPaidSideEffects`** (called via outbox):
| Context | Handler |
|---|---|
| ORDER | `orderService.confirmPaymentFromGateway(refId, Paid)` |
| ORDER_SPLIT | `tableService.confirmSplitFromGateway(refId)` |
| QUICK_PAY | `completeQuickPay(refId, Completed, null)` |
| TICKET | `ticketPurchaseService.confirmPurchaseFromPayment(refId, intentId)` |
| EVENT_PROMOTION | `promotionService.handlePaymentPaid(intentId)` |

### `LedgerWriterService`

Both methods: `@Transactional(REQUIRES_NEW)` — commit independently of caller.

**`recordPayment(order)`** — dedup via `existsByOrderIdAndEntryType`. Net resolution: `merchantPayout > 0` → use it; else `subtotal > 0`; else `total`.

**`recordRefund(order)`** — writes REFUND row with all money fields negated.

### `FeeService`
```
grossCharged    = subtotal + serviceFeeUgx
merchantFeeShare = round(serviceFeeUgx × merchantCommissionPct / 100)
remainingFee    = serviceFeeUgx - merchantFeeShare
psoFee          = round(remainingFee × psoPercent)
platformFee     = remainingFee - psoFee
merchantPayout  = subtotal + merchantFeeShare
```

---

## 10. REST API — Controllers

| Controller | Base Path | Key Endpoints |
|---|---|---|
| `MerchantAuthController` | `/api/auth/merchant` | `POST /register`, `GET /me`, `PATCH /profile`, `GET/POST /onboarding`, `GET/POST /qr-code` |
| `EfrisMerchantConfigController` | `/api/auth/merchant/efris-config` | `GET` (key masked), `PUT` (upsert) |
| `BusinessController` | `/api` | `GET/POST /businesses`, `GET /qr/{token}`, `GET /businesses/{id}/menu`, `POST /businesses/{id}/orders` |
| `CatalogController` | `/api/businesses/{id}/catalog` | Full CRUD for categories and items |
| `OrderUpdateController` | `/api` | `PATCH /orders/{id}/status`, `PATCH /orders/{id}/payment`, `DELETE /businesses/{id}/orders/completed` |
| `PublicOrderController` | `/api/orders/public` | `GET /{publicId}?phone=` (customer tracking, no auth) |
| `PaymentController` | `/api/payments` | `GET /providers`, `POST /initiate`, `GET /{id}/status`, `POST /webhooks/{providerId}` |
| `FeeController` | `/api/fees` | `GET` (returns serviceFeeUgx, psoPercent, currency) |
| `ReceiptController` | `/api/receipts` | Generate, send email, get by number/order/business/customer |
| `TicketController` | `/api/tickets` | Create, list, stats, scan |
| `PublicTicketController` | `/api/tickets/public` | Event page, purchase, queue, view, transfer, waitlist, validate |
| `QuickPaymentController` | `/api/quick-payments` | Codes CRUD, QR payment |
| `OperationsController` | `/api/businesses/{id}/operations` | Branches, staff, tables, sessions, busy mode, hotel ops, catalog CSV |
| `FloorPlanController` | `/api/businesses/{id}/floor-plans` | Plan + element CRUD, live status |
| `InventoryController` | `/api/businesses/{id}/inventory` | Ingredients, recipes, movements, adjustments, transfers, variance |
| `MerchantAccountingController` | `/api/businesses/{id}/accounting` | `GET /summary`, `GET /ledger`, `GET /daily-revenue`, `GET /export` (streaming CSV) |
| `EventPromotionController` | `/api/promotions` | Tiers, initiate, nearby, impression/click |
| `AdminDashboardController` | `/api/admin/dashboard` | Metrics, activity, top-merchants |
| `AdminMerchantsController` | `/api/admin/merchants` | List, approve, suspend |
| `AdminConfigController` | `/api/admin/configs` | Per-section CRUD, system-busy toggle |
| `AdminUserController` | `/api/admin/admins` | Invite, permissions, revoke |
| `HealthController` | `/health`, `/api/health` | Liveness probe |

---

## 11. Payment Subsystem

### `PaymentProvider` Interface
```java
String id()
String displayName()
boolean isAvailable()
PaymentProviderResult initiate(PaymentCommand command)
PaymentProviderResult queryStatus(PaymentCommand command, PaymentIntent intent)
Optional<PaymentProviderResult> handleWebhook(String rawBody, Map<String,String> headers)
```

### Provider Registry
Aliases: `"mtn"/"mtn-momo"` → `"mtn-momo"`, `"airtel"` → `"airtel-money"`, `"stub"/"manual"/"dev"` → `"stub"`. Falls back to stub if `fallbackToStub=true`.

### Provider Status
| Provider | Status |
|---|---|
| `StubPaymentProvider` | ✅ Fully working; `autoCompleteSeconds > 0` auto-completes in dev |
| `MtnMomoPaymentProvider` | ⚠️ Skeleton — `initiate()` / `queryStatus()` throw 501 |
| `AirtelMoneyPaymentProvider` | ⚠️ Skeleton — same |

### Payment Flow
```
POST /api/payments/initiate
  → PaymentGatewayService.initiate()
    → resolve/reuse idempotency key
    → PaymentIntentService.createIntent()
    → provider.initiate(command)
    → applyProviderResult()
      → if Paid: outboxService.enqueuePaymentPaid(intentId)

OutboxDispatcher → PAYMENT_PAID
  → paymentIntentService.applyPaidSideEffects()
    → orderService.confirmPaymentFromGateway()
      → ledgerWriterService.recordPayment() [REQUIRES_NEW]
      → inventoryService.consumeForPaidOrder()
      → outboxService.enqueueReceipt()

OutboxDispatcher → RECEIPT
  → orderService.generateReceiptForOrderId()
    → receiptService.generateReceipt()
    → outboxService.enqueueEfrisSubmit()

OutboxDispatcher → EFRIS_SUBMIT
  → efrisSubmissionService.submitForOrder()
```

---

## 12. EFRIS Fiscal Integration

Uganda Revenue Authority EFRIS v3 — issues Fiscal Document Numbers (FDN) for all paid orders.

### Endpoint
`GET /api/auth/merchant/efris-config` — read config (device key always masked as `••••••••`)
`PUT /api/auth/merchant/efris-config` — create or update (validates TIN+deviceNumber+deviceKey before enabling)

### `EfrisApiClient` — Live Mode
1. Build URA v3 invoice JSON:
   - `basicInformation`: TIN, currency `UGX`, invoiceType `"1"`, issuedDate in `Africa/Kampala`, paymentMode `101`=MoMo / `102`=Cash
   - `goodsDetails`: per line — `taxRate="18"`, `taxAmount = lineTotal × 0.18/1.18`, `goodsServiceFlag="2"`, `taxCategory="A"`
   - `summary`: net/tax/gross totals
2. AES-256-ECB encrypt content using merchant `deviceKey` (Base64 → 32 bytes)
3. Build request envelope with `dataExchangeId = SHA-256(orderId + ":" + attempt)` first 9 bytes → 18 hex chars (stable idempotency hint)
4. POST to `apiUrl`; parse `returnStateInfo.returnCode == "00"` → decrypt → extract FDN + QR URL

### Transaction Safety
| Risk | Mitigation |
|---|---|
| REQUIRES_NEW self-invocation | `EfrisAuditWriter` is a separate Spring bean — proxy always in call path |
| Audit row lost on retry exception | `auditWriter.save(REQUIRES_NEW)` commits before exception thrown |
| Duplicate FDN on lost response | `existsSuccessfulSubmission` dedup guard; stable `dataExchangeId` hint |
| Retry count semantics | `attemptNumber < maxRetries` = max **total** attempts (default 3) |

### Submission Decision Tree
```
submitForOrder(orderId)
  ├── existsSuccessfulSubmission? → no-op
  ├── enabled=false AND config=null → runStub() [dev]
  ├── enabled=true  AND config=null → markReceiptExempt()
  └── config exists
        ├── apiClient.submit() succeeds
        │     ├── auditWriter.save(SUCCESS) [REQUIRES_NEW]
        │     └── updateReceipt(fdn, qrUrl, SUBMITTED)
        └── apiClient.submit() fails
              ├── auditWriter.save(FAILED) [REQUIRES_NEW]
              ├── attemptNumber < maxRetries → throw EfrisRetryableException
              └── exhausted → updateReceipt(null, null, FAILED)
```

---

## 13. Outbox Pattern

All async side-effects go through a transactional outbox for at-least-once delivery.

### Event Types
| Type | Payload | Handler |
|---|---|---|
| `REALTIME` | `{type, channel, businessId, payload}` | `RealtimeEventPublisher.publishDirect` |
| `PAYMENT_PAID` | `{paymentIntentId}` | `paymentIntentService.applyPaidSideEffects` |
| `RECEIPT` | `{orderId}` | `orderService.generateReceiptForOrderId` |
| `AUDIT` | `{action, resourceType, resourceId, details}` | `auditService.success` |
| `WHATSAPP` | `{to, message}` | *Intentionally skipped in dispatcher* |
| `EFRIS_SUBMIT` | `{orderId}` | `efrisSubmissionService.submitForOrder` |

### `OutboxDispatcher` Design
- `@Scheduled(fixedDelay = 500ms)` — polls 100 events per cycle
- No `@Transactional` on `dispatchPending` — each handler opens its own transaction
- `self.stampProcessed(event)` called via `@Autowired @Lazy` self-reference so `REQUIRES_NEW` on `stampProcessed` commits each stamp independently
- On exception: logs warn, event stays `processed_at = NULL` → retried next poll

---

## 14. Financial Ledger

### Accounting vs Sales

| | Sales (`SalesPage`) | Accounting (`AccountingPage`) |
|---|---|---|
| Data source | Live orders array (in-memory) | `financial_ledger_entries` (immutable DB) |
| Includes unpaid | Yes | No |
| Survives order deletion | No | Yes — rows never deleted |
| Date range | 4 fixed options | 7 options + custom date picker |
| Fee breakdown | No | PSO fee, platform fee, COGS |
| Daily sparkline | No | 30-day timezone-aware series |
| Export | Client-side CSV blob | Server-side streaming CSV (O(1) memory) |

### Write Points
1. Cash order created: `ledgerWriterService.recordPayment`
2. MoMo payment confirmed: `ledgerWriterService.recordPayment`
3. Refund: `ledgerWriterService.recordRefund` (negative row)

### REFUND Row Design
All money fields are negated. `SUM(net_amount)` over any window yields the correct net-settled figure without special-casing in queries.

---

## 15. Security & Auth

### JWT Validation
1. Keycloak issues JWT (OIDC/PKCE)
2. Spring Security validates: signature via JWKS, issuer (CSV list or LAN regex), optional audience/AZP
3. Roles extracted from `realm_access.roles` → `ROLE_{ROLE_NAME}`

### Permission Matrix
| Role | Accessible Paths |
|---|---|
| Public | `/health`, `/api/orders/public/**`, `/api/businesses/*/menu`, `/api/payments/**`, `/api/tickets/public/**`, `/api/devices/**`, `/api/quick-payments/public/**`, `/api/fees`, `/api/public/**`, `/ws/**` |
| `ROLE_MERCHANT` | `/api/auth/merchant/**`, `/api/businesses/**` |
| `ROLE_STAFF` | `/api/auth/staff/**`, limited business operations |
| `ROLE_ADMIN` | `/api/admin/**` + all merchant paths |

### `MerchantAccessService`
- `requireCurrentMerchant()` — Keycloak user ID → merchant lookup; blocks admin principal
- `assertOwnsBusiness(Business)` — admins pass through; staff via `StaffSessionHolder.get()`; merchants by `merchantId` comparison
- `ownsBusinessBySubject(keycloakUserId, businessId)` — non-SecurityContext check for WebSocket auth

---

## 16. WebSocket & Realtime

### Endpoints
| Path | Auth | Purpose |
|---|---|---|
| `/ws/realtime` | JWT AUTH message | Merchant live updates |
| `/ws/tickets/stats` | None | Ticket event stats broadcast |

### `RealtimeWebSocketHandler` Protocol
```json
// Client authenticates
{"type":"AUTH","token":"<jwt>"}
{"type":"AUTH_OK"}

// Client subscribes
{"type":"SUBSCRIBE","channel":"orders:business-id"}

// Server pushes event
{"type":"ORDER_CREATED","channel":"orders:business-id","businessId":"...","payload":{...}}
```

### Fan-Out Architecture
```
Event → outboxService.enqueueRealtime()
  → OutboxDispatcher → RealtimeEventPublisher.publishDirect()
    ├── Redis enabled: publish to "scanny:realtime" pub/sub
    │     → all server instances → fanOutLocal()
    └── Redis disabled: direct fanOutLocal()
          → send to all subscribed WebSocket sessions
```

---

## 17. Frontend — Merchant Portal

**Entry:** `src/main.tsx` → Keycloak init → `App.tsx`

### Views
| View | Notes |
|---|---|
| Overview | Metrics cards |
| Catalog | Food items, lodging rooms, booked rooms |
| Dashboard | Live orders grid |
| Kitchen | Preparing/Ready filter |
| Sales | `SalesPage` — client-side analytics from loaded orders |
| Accounting | `AccountingPage` — server-side ledger data |
| Inventory | Stock, recipes, movements, POs, suppliers, variance |
| Operations | Roles, settings, branches, tables |
| Floor Plan | Live view + Konva canvas editor |
| Quick Pay | QR payment codes |

### `ReceiptPage`
- Path: `/receipt/:orderId`
- Data from localStorage only (`CustomerReceipt` objects)
- On load: re-checks backend for `Completed` status
- Shows EFRIS badge when `receipt.efrisFdn` is set (FDN in monospace + "Verify with URA ↗" link)

---

## 18. Frontend — Admin Console

**Port:** 5174 | Separate Vite app

### Pages
Overview · Merchants (approve/suspend) · Orders · Ticketing · Users · Revenue & Payments · Cash Collections · QR Activity · Reports · System Health · Audit Log · Configs · Communications · Admins

---

## 19. Frontend — Customer SPA

Same bundle as merchant portal, activated by URL path.

### Routes
| Path | Component |
|---|---|
| `/c/:qrToken` | Catalog + order creation |
| `/receipt/:orderId` | `ReceiptPage` |
| `/track/:publicId` | Order tracking |
| `/tickets/view/:accessToken` | `TicketViewPage` |
| `/tickets/purchase/:masterQrToken` | `TicketPurchasePage` |

### `CustomerReceipt` Type
```typescript
interface CustomerReceipt {
  id: string
  orderId: string
  businessId: string
  businessName: string
  businessLogoUrl?: string | null
  customerName: string
  customerPhone: string
  items: CustomerReceiptItem[]
  subtotal: number
  serviceFee: number
  total: number
  currency: 'UGX'
  paymentMethod: string
  paymentProvider: PaymentProvider
  paymentReference?: string | null
  paidAt: string                // ISO-8601
  orderStatus?: OrderStatus
  orderPublicId?: string | null
  orderPhone?: string | null
  efrisFdn?: string | null      // URA Fiscal Document Number
  efrisQrUrl?: string | null    // URA verification URL
}
```

Storage: `localStorage` key `scanny-receipts`, max 100 entries.

---

## 20. Tickets Subsystem

### Ticket Types
- **Master** — one per event; holds capacity, price, sale window (`sale_starts_at`, `sale_ends_at`)
- **Attendee** — issued per purchase; has `accessToken` (QR display), `gateToken` (gate scan), `transferToken`
- **Queue entry** — virtual position when concurrency ≥ `queue-activation-threshold`
- **Waitlist** — signup for sold-out events; `claimToken` for WhatsApp notification

### Purchase Flow
```
POST /api/tickets/public/purchase
  ├── Concurrent ≥ threshold → 202 + queue token
  └── Normal → 200 → PaymentContext.TICKET
        → ticketPurchaseService.confirmPurchaseFromPayment()
          → create attendee ticket(s)
          → WhatsApp delivery (if enabled)
```

### Gate Scan (`GateScanPage.tsx`)
- `jsQR` camera scan → `POST /api/tickets/scan` with `gateToken`
- Validates: event match, not redeemed, sale window
- Returns green ✓ or red ✗

---

## 21. Inventory & COGS

### Tables
- `ingredients` — `qty_on_hand` (running balance), `avg_unit_cost`, `low_stock_threshold`
- `recipe_lines` — versioned; `effective_from/to`, `recipe_version`
- `stock_movements` — every debit/credit with reason code
- `ingredient_batches` — FIFO lot tracking with expiry
- `variance_snapshots` — theoretical vs. actual reconciliation
- `unit_conversions` — kg↔g, L↔ml; per-business overrides

### COGS Flow
1. On payment: `inventoryService.consumeForPaidOrder(order)` → deducts recipe quantities, writes `StockMovement` rows
2. `order.cogs_total` locked at payment time
3. On refund: `inventoryService.reverseConsumeForOrder(order)` → reverse movements

---

## 22. Floor Plan

- **Editor:** `FloorPlanPage.tsx` with `react-konva` — drag, resize, rotate on canvas
- **Element kinds:** TABLE, WALL, LABEL, WINDOW, DOOR
- **Live view:** real-time table occupancy from `TableSession` records
- **Backend:** `FloorPlanController` at `/api/businesses/{id}/floor-plans`

---

## 23. Key Data Flows (End-to-End)

### Customer Places MoMo Order
```
Scan QR → GET /api/businesses/{id}/menu
Submit order → POST /api/businesses/{id}/orders
  → createOrder() → FeeSplit → Order saved (Unpaid)
  → ORDER_CREATED realtime event

POST /api/payments/initiate
  → PaymentIntentService.createIntent() [fees from Order]
  → StubProvider → Processing

GET /api/payments/{id}/status → Paid
  → outboxService.enqueuePaymentPaid()

OutboxDispatcher 500ms → PAYMENT_PAID
  → applyPaidSideEffects() → confirmPaymentFromGateway(Paid)
    → ledgerWriterService.recordPayment() [REQUIRES_NEW]
    → inventoryService.consumeForPaidOrder()
    → outboxService.enqueueReceipt()

OutboxDispatcher → RECEIPT
  → generateReceiptForOrderId()
    → receiptService.generateReceipt() → receipts row (efris_status=PENDING)
    → outboxService.enqueueEfrisSubmit()

OutboxDispatcher → EFRIS_SUBMIT
  → submitForOrder()
    → [stub] EfrisApiClient returns STUB-FDN
    → EfrisAuditWriter.save() [REQUIRES_NEW] → efris_submissions row
    → updateReceipt(fdn, qrUrl, SUBMITTED)

Customer opens /receipt/{orderId}
  → Loads from localStorage
  → Shows EFRIS badge with FDN
```

### Merchant Views Accounting
```
AccountingPage mounts
  → GET /accounting/summary
      → aggregateSummary() [indexed (business_id, settled_at)]
      → paymentMethodBreakdown()
      → accountingOutstandingRevenue() [live orders table]

  → GET /accounting/ledger?page=0&size=50
      → ledgerPage() [DESC by settled_at]

  → GET /accounting/daily-revenue?days=30&timezone=Africa/Kampala
      → rawPairsForDailySeries() → bucket by local calendar day

Click Export CSV
  → window.location.href = /accounting/export
    → streamCsvExport()
      → streamForExport() [JDBC server cursor, 1000 rows/fetch]
      → streams directly to HttpServletResponse
```

---

## 24. Environment Variables Reference

### Frontend (VITE_*)
| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Backend base URL |
| `VITE_SCAN_BASE_URL` | Base URL for QR scan links |
| `VITE_WS_BASE_URL` | WebSocket base URL |
| `VITE_KEYCLOAK_URL` | Keycloak server URL |
| `VITE_KEYCLOAK_REALM` | Keycloak realm name |
| `VITE_KEYCLOAK_CLIENT_ID` | OIDC client ID |
| `VITE_DEV_BACKEND` | Dev proxy target (default `http://localhost:4000`) |
| `VITE_DEV_HTTPS` | Set `1` for HTTPS in dev |

### Backend
| Variable | Default | Purpose |
|---|---|---|
| `SERVER_PORT` | `4000` | HTTP port |
| `KEYCLOAK_JWK_SET_URI` | localhost:8080/realms/scanny/... | JWT validation |
| `KEYCLOAK_SERVER_URL` | `http://localhost:8080` | Admin client |
| `KEYCLOAK_REALM` | `scanny` | |
| `KEYCLOAK_ADMIN_USERNAME` / `_PASSWORD` | | User provisioning |
| `KEYCLOAK_CLIENT_ID` / `_CLIENT_SECRET` | | Resource server |
| `SCANNY_JWT_ACCEPTED_ISSUERS` | localhost URLs | JWT issuer allow-list |
| `SCANNY_CORS_ORIGIN_PATTERNS` | `http://localhost:*,...` | CORS origins |
| `REDIS_ENABLED` | `false` | Enable Redis |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | `localhost/6379` | |
| `SCANNY_SERVICE_FEE_UGX` | `700` | Flat service fee per order |
| `SCANNY_PSO_PERCENT` | `0.30` | MoMo provider fee share |
| `EFRIS_ENABLED` | `false` | URA EFRIS live mode |
| `EFRIS_API_URL` | URA production URL | |
| `EFRIS_MAX_RETRIES` | `3` | Total EFRIS submission attempts |
| `EFRIS_VAT_RATE` | `0.18` | Uganda VAT rate |
| `MTN_MOMO_ENABLED` | `false` | |
| `MTN_MOMO_API_URL` / `_API_KEY` / `_API_SECRET` / `_SUBSCRIPTION_KEY` / `_CALLBACK_URL` | | |
| `AIRTEL_MONEY_ENABLED` | `false` | |
| `AIRTEL_MONEY_*` | | Same pattern as MTN |
| `WHATSAPP_ENABLED` | `false` | |
| `WHATSAPP_API_URL` / `_API_TOKEN` / `_FROM_NUMBER` / `_TICKET_TEMPLATE` | | |
| `MAIL_HOST` / `MAIL_PORT` / `MAIL_USERNAME` / `MAIL_PASSWORD` | `localhost/1025` | SMTP |
| `PEXELS_API_KEY` | | Image search |
| `SCAN_BASE_URL` | `http://localhost:5173` | QR link base |
| `DAILY_DIGEST_CRON` | `0 0 21 * * *` | 9pm daily digest |
| `RATE_LIMIT_ENABLED` | `true` | |
| `SCANNY_TRUST_FORWARDED_HEADERS` | `false` | Enable behind reverse proxy |
| `SCANNY_HSTS_ENABLED` | `false` | HSTS header |

---

## 25. Known Gaps & Production Readiness Notes

| Area | Status | Notes |
|---|---|---|
| **MTN MoMo** | ⚠️ Skeleton | `initiate()` / `queryStatus()` throw 501; awaiting API credentials |
| **Airtel Money** | ⚠️ Skeleton | Same as MTN |
| **EFRIS live mode** | ⚠️ Requires sandbox verification | URA `dataExchangeId` idempotency not guaranteed by public spec; verify before go-live |
| **EFRIS device key at rest** | ⚠️ TODO | Stored plaintext; encrypt via KMS/Vault before production |
| **V10 migration duplicate** | 🐛 Bug | Two files both named `V10__*.sql`; Flyway throws checksum conflict on fresh DB; one must be renumbered |
| **Financial ledger migration** | ✅ Fixed (V56) | `financial_ledger_entries` was previously missing a migration; V56 adds it |
| **Redis** | Optional | Disabled by default; degrades gracefully to in-process pub/sub and no cache |
| **WhatsApp** | Optional | Disabled by default; outbox events enqueued but intentionally skipped in dispatcher |
| **Customer names in ledger** | ⚠️ Gap | `LedgerEntry.customerName` always empty — no join to orders in accounting queries |
| **TypeScript strict mode** | Off | `strict: false`, `noImplicitAny: false` |
| **Admin console auth** | Via Keycloak | Requires `ROLE_ADMIN` in realm; separate Vite app on port 5174 |
| **OG / SEO** | Client-side only | No SSR; `ReceiptPage` uses `robots: noindex, nofollow` |
| **MoMo auto-complete** | Dev only | `stub.auto-complete-seconds > 0` auto-completes — ensure this is `0` in staging/prod |
