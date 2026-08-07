# Floor Plan / Layout Studio Feature

**Product Name:** Layout Studio  
**Target Users:** Restaurant owners, hotel operators (multi-tenant merchant portal)  
**Access Level:** Merchant-only (not available to staff roles initially)

---

## Overview

The Layout Studio enables merchants to design a 2D/2.5D top-down floor plan of their venue using a drag-and-drop canvas editor. Each floor plan contains visual elements (tables, zones, walls, decor) that link to real business entities (BusinessTable, future hotel rooms). The feature provides **real-time occupancy visualization** — tables blink or change color based on session status (free, occupied, reserved), powered by WebSocket updates.

### Why 2D/2.5D, not 3D?

True 3D (Three.js, WebGL) is:
- Too complex for non-technical staff to draw
- Heavy to render on tablets/older devices
- Overkill for the actual job (showing which table is occupied)

The entire restaurant POS industry (Toast, OpenTable, Square) uses 2D top-down editors with subtle depth effects (shadows, gradients). We follow that proven pattern.

---

## Feature Naming

| Term | Definition |
|------|------------|
| **Layout Studio** | Product name for the feature (shown in merchant sidebar) |
| **Floor Plan** | The drawable canvas (one per physical floor/zone) |
| **Element** | A visual shape on the canvas (table, chair, wall, bar, room, decor) |
| **Bookable Unit** | The business entity that has occupancy status (links Element → BusinessTable or future HotelRoom) |

**Why separate Element from Bookable Unit?**  
Flexibility. A round table for 6 is one Element but could represent:
- 1 Bookable Unit (the table itself)
- 7 Bookable Units (table + 6 individual seats)
- 0 Bookable Units (a decorative prop table)

This separation enables "configurable in 100 ways" without hand-coding every scenario.

---

## Architecture

### Database Schema (PostgreSQL)

**New tables to be created in migration `V34__floor_plan_feature.sql`:**

```sql
-- One floor plan per physical floor/zone
CREATE TABLE floor_plans (
    id                  VARCHAR(64) PRIMARY KEY,
    business_id         VARCHAR(64) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name                VARCHAR(128) NOT NULL DEFAULT 'Main Floor',
    canvas_width        INTEGER NOT NULL DEFAULT 1200,
    canvas_height       INTEGER NOT NULL DEFAULT 800,
    grid_size           INTEGER NOT NULL DEFAULT 20,
    background_image    TEXT,  -- Optional floor plan trace image (data URL or external URL)
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ
);

CREATE INDEX idx_floor_plans_business ON floor_plans (business_id);

-- One shape drawn on the canvas
-- element_kind drives behavior, shape_type drives rendering
CREATE TABLE floor_plan_elements (
    id                  VARCHAR(64) PRIMARY KEY,
    floor_plan_id       VARCHAR(64) NOT NULL REFERENCES floor_plans(id) ON DELETE CASCADE,
    -- Visual / geometry
    shape_type          VARCHAR(32) NOT NULL DEFAULT 'rect',
    -- 'rect' | 'circle' | 'polygon' | 'custom-path'
    x                   NUMERIC(10,2) NOT NULL DEFAULT 0,
    y                   NUMERIC(10,2) NOT NULL DEFAULT 0,
    width               NUMERIC(10,2) NOT NULL DEFAULT 60,
    height              NUMERIC(10,2) NOT NULL DEFAULT 60,
    rotation            NUMERIC(6,2) NOT NULL DEFAULT 0,
    z_index             INTEGER NOT NULL DEFAULT 1,
    color               VARCHAR(32) NOT NULL DEFAULT '#d4a373',
    -- Business
    element_kind        VARCHAR(32) NOT NULL DEFAULT 'TABLE',
    -- 'TABLE' | 'CHAIR' | 'WALL' | 'BAR' | 'DOOR' | 'WINDOW' |
    -- 'STAGE' | 'PLANT' | 'DECOR' | 'HOTEL_ROOM' | 'ZONE' | 'LABEL'
    label               VARCHAR(128),
    seat_count          INTEGER NOT NULL DEFAULT 0,
    parent_element_id   VARCHAR(64) REFERENCES floor_plan_elements(id) ON DELETE SET NULL,
    -- Linking to real business entities
    business_table_id   VARCHAR(64) REFERENCES business_tables(id) ON DELETE SET NULL,
    -- null if decorative; non-null if this shape IS a trackable table/room
    custom_style        JSONB,  -- reserved for future per-element overrides
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_floor_plan_elements_plan    ON floor_plan_elements (floor_plan_id);
CREATE INDEX idx_floor_plan_elements_table   ON floor_plan_elements (business_table_id);
CREATE INDEX idx_floor_plan_elements_parent  ON floor_plan_elements (parent_element_id);

-- Reusable shape presets (seed data + user-created templates)
CREATE TABLE floor_plan_templates (
    id                  VARCHAR(64) PRIMARY KEY,
    business_id         VARCHAR(64) REFERENCES businesses(id) ON DELETE CASCADE,
    -- NULL = global preset shipped by platform
    name                VARCHAR(128) NOT NULL,
    shape_type          VARCHAR(32) NOT NULL,
    element_kind        VARCHAR(32) NOT NULL,
    default_width       NUMERIC(10,2) NOT NULL DEFAULT 60,
    default_height      NUMERIC(10,2) NOT NULL DEFAULT 60,
    default_color       VARCHAR(32) NOT NULL DEFAULT '#d4a373',
    default_seat_count  INTEGER NOT NULL DEFAULT 0,
    thumbnail_svg       TEXT,  -- Inline SVG for the palette icon
    sort_order          INTEGER NOT NULL DEFAULT 0
);

-- Occupancy status per bookable element (current state)
-- This is the row that changes color on the canvas
CREATE TABLE floor_plan_element_status (
    element_id          VARCHAR(64) PRIMARY KEY REFERENCES floor_plan_elements(id) ON DELETE CASCADE,
    status              VARCHAR(32) NOT NULL DEFAULT 'FREE',
    -- 'FREE' | 'OCCUPIED' | 'RESERVED' | 'OUT_OF_SERVICE'
    session_id          UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
    reservation_id      UUID REFERENCES reservations(id) ON DELETE SET NULL,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by          VARCHAR(255)
);
```

> **No changes to existing tables** — `business_tables` is linked from `floor_plan_elements.business_table_id`. The existing `table_sessions` and `reservations` tables are the source of truth for occupancy.

---

### Backend (Spring Boot — Java 21)

**New packages:**

```
com.scanny.floorplan/
  entity/
    FloorPlan.java               -- JPA entity, @ManyToOne to Business
    FloorPlanElement.java        -- JPA entity, @ManyToOne to FloorPlan
    FloorPlanElementStatus.java  -- JPA entity, @OneToOne to FloorPlanElement
    FloorPlanTemplate.java       -- JPA entity, nullable business_id for globals
  repository/
    FloorPlanRepository.java
    FloorPlanElementRepository.java
    FloorPlanElementStatusRepository.java
    FloorPlanTemplateRepository.java
  service/
    FloorPlanService.java        -- CRUD for plans and elements (full canvas save/load)
    FloorPlanStatusService.java  -- Status transitions (FREE ↔ OCCUPIED ↔ RESERVED)
    FloorPlanLiveService.java    -- Builds full live snapshot (canvas + statuses) for viewer
  dto/
    FloorPlanDtos.java           -- All request/response records (nested in one file, project style)
  controller/
    FloorPlanController.java     -- REST endpoints (see below)
```

**REST Endpoints** — all under `/api/businesses/{businessId}/floor-plans`:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | Merchant or Staff | List all floor plans for this business |
| `POST` | `/` | Merchant | Create a new floor plan |
| `GET` | `/{planId}` | Merchant or Staff | Get a single plan (with elements) |
| `PUT` | `/{planId}` | Merchant | Save full canvas (replaces all elements atomically) |
| `PATCH` | `/{planId}` | Merchant | Update plan metadata (name, dimensions, grid) |
| `DELETE` | `/{planId}` | Merchant | Delete a plan |
| `GET` | `/{planId}/live` | Merchant or Staff | Full snapshot — elements + current statuses |
| `PATCH` | `/{planId}/elements/{elementId}/status` | Merchant or Staff | Manually set element status |
| `GET` | `/templates` | Merchant or Staff | List shape library presets |
| `POST` | `/templates` | Merchant | Save a custom template |

**Status lifecycle in `FloorPlanStatusService`:**

```
FREE  ──────────────────────── OCCUPIED   (table_session opens → status auto-set)
FREE  ──────────────────────── RESERVED   (reservation confirmed → status auto-set)
OCCUPIED ─────────────────── FREE         (table_session closes → status auto-set)
RESERVED ─────────────────── OCCUPIED     (party seated → session opens)
ANY ──────────────────────── OUT_OF_SERVICE (manual staff override)
OUT_OF_SERVICE ───────────── FREE          (manual staff override)
```

Status is written:
1. Automatically when a `TableSession` opens or closes — hook into `TableService`
2. Automatically when a `Reservation` status changes — hook into the existing reservation update service
3. Manually via `PATCH .../status` (manager or merchant)

**WebSocket event** — publish on every status change via `RealtimeEventPublisher`:

```java
// New method in RealtimeEventPublisher
public void publishFloorEvent(String businessId, String type, Object payload) {
    publish("floor:" + businessId, type, businessId, payload);
}
```

Event types: `FLOOR_ELEMENT_STATUS_CHANGED`, `FLOOR_PLAN_UPDATED`

---

### Frontend (React 19, Vite, TypeScript, Tailwind)

**Canvas library: [Konva.js + react-konva](https://konvajs.org/docs/react/)**

Konva is the industry-standard canvas library for this exact use case — drag, resize, rotate, snap-to-grid, layering — built on HTML5 Canvas. Saves weeks vs hand-rolling SVG drag logic.

**New files:**

```
src/
  floor-plan/
    FloorPlanPage.tsx          -- Top-level view, switches between Editor and Viewer modes
    FloorPlanEditor.tsx        -- Drag-and-drop editor (Konva Stage + design toolbar)
    FloorPlanViewer.tsx        -- Read-only live occupancy view (same canvas, status colors)
    FloorPlanCanvas.tsx        -- Konva Stage wrapper (shared by editor + viewer)
    ShapePalette.tsx           -- Left sidebar of draggable element templates
    ElementControls.tsx        -- Right sidebar showing selected element properties
    FloorPlanSelector.tsx      -- Dropdown to switch between floor plans (multi-floor)
    hooks/
      useFloorPlan.ts          -- Load/save floor plan data
      useFloorPlanLive.ts      -- WebSocket subscription for live status updates
      useFloorPlanEditor.ts    -- Editor state (selection, drag, undo/redo stack)
    elements/
      TableElement.tsx         -- Renders a TABLE element with status color
      ChairElement.tsx         -- Renders a CHAIR element (child of table)
      WallElement.tsx          -- Renders WALL, DOOR, WINDOW as non-interactive shapes
      ZoneElement.tsx          -- Renders a ZONE/ROOM area (hotel rooms, private dining)
      LabelElement.tsx         -- Text labels (room numbers, zone names)
    lib/
      elementDefaults.ts       -- Default dimensions per element_kind
      statusColors.ts          -- Color/animation definitions per status
      snapToGrid.ts            -- Grid snapping logic
      layoutSerializer.ts      -- Converts canvas state ↔ API payload
  api/
    floorPlan.ts               -- API client functions (follows pattern of operations.ts)
```

**Adding the sidebar nav item** in `src/App.tsx`:

```typescript
// In the nav items array (after 'kitchen', before 'operations')
{
  id: 'floor-plan',
  label: 'Layout Studio',
  icon: LayoutDashboard,   // from lucide-react
  merchantOnly: true,
}
```

Because the app uses `view` string state (no React Router), the render switch case needs:
```typescript
{view === 'floor-plan' && (
  <FloorPlanPage businessId={business.id} businessType={business.type} />
)}
```

---

## Status Colors & Animations

| Status | Display | Behavior |
|--------|---------|---------|
| `FREE` | Green (`#22c55e`) | Solid fill, no animation |
| `OCCUPIED` | Red (`#ef4444`) | Solid fill + slow pulse animation (2s cycle, not a distracting blink) |
| `RESERVED` | Amber (`#f59e0b`) | Solid fill + subtle glow |
| `OUT_OF_SERVICE` | Gray (`#6b7280`) | Solid fill, hatched pattern overlay |

> Design note: the pulse is achieved via Konva Tween (opacity 1 → 0.6 → 1) on the status fill layer only — the table shape stays visible. A literal `blink` (fully on/off) is harder to read during a busy service. We can expose the animation style as a merchant preference later.

---

## Two Modes

### Editor Mode (design time)

Used by the restaurant/hotel owner when configuring their venue layout. Only accessible to merchants, not staff.

- Left palette: element templates (2-seat round, 4-seat rect, 6-seat rect, bar stool, wall, door, hotel room, plant, label…)
- Drag element from palette → drops on canvas at pointer position
- Click to select → resize handles appear (drag corners), rotation handle appears
- Snap-to-grid (toggleable, default ON, configurable grid size 10–40px)
- Group: select a TABLE, then draw/drag CHAIRs onto it → chairs become children of the table (grouped drag/rotate)
- Link: when an element with `element_kind = TABLE` is placed, a dropdown lets merchant associate it with an existing `BusinessTable` (for session/order tracking) OR create a new `BusinessTable` inline
- Properties panel (right sidebar): label, seat count, color override, element kind, linked business table
- Save: one "Save Layout" button → PUT `/{planId}` → serializes all elements to array, replaces atomically in DB transaction
- Multi-floor: "Add Floor" button → POST `/` to create a new floor plan, tab/dropdown to switch
- Undo/redo: client-side only (element state stack, max 50 steps) — no backend undo endpoint needed

### Viewer Mode (service time)

Used by floor staff during active service. Read-only canvas, tap to interact.

- Same canvas renders but shapes are not draggable/resizable
- Each element that has a `business_table_id` shows its live status color
- Elements without a `business_table_id` (walls, decor) render in neutral gray
- Tap a table → detail drawer slides up showing:
  - Table label
  - Status badge (FREE / OCCUPIED / RESERVED)
  - Active session: order IDs, opened time, unpaid total
  - Upcoming reservation (if status is RESERVED): guest name, party size, time
  - Actions: Mark free / Mark out-of-service (staff manager or merchant)
- Top bar: "Edit Layout" button → switches to Editor Mode (merchant only)
- Floor selector: if business has multiple floor plans, tabs at top

---

## Business-Type Behavior

The same data model serves both business types. The difference is in which element_kinds are most useful:

### Restaurant

- Elements: TABLE (round/rect), CHAIR, BAR, STAGE, KITCHEN_PASS, WALL, DOOR, WINDOW, PLANT, LABEL, ZONE (for "patio", "private dining room")
- Bookable units: Tables (linked to `business_tables`)
- Occupancy driven by: `table_sessions` opening/closing
- Multi-floor: restaurants with upstairs/downstairs/patio → each is a separate FloorPlan on the same business

### Hotel

- Elements: HOTEL_ROOM, HALLWAY, ELEVATOR, STAIRWELL, LABEL, ZONE (for "suite wing", "standard floor")
- Bookable units: Rooms (linked to `catalog_items` with `item_kind = ROOM`)
- Occupancy driven by: future hotel check-in/check-out event (Phase 2) — manual status override is the Phase 1 approach
- Multi-floor: each building floor → one FloorPlan

> For hotels in Phase 1, the floor plan visual is fully functional, and staff use the manual status override (PATCH element status) to mark rooms occupied. Full PMS integration is a separate feature.

---

## "Configurable in 100 ways" — How the Model Achieves This

The goal of near-unlimited configurability is met through **composition, not enumeration**:

| Lever | What it enables |
|-------|----------------|
| shape_type: rect, circle, polygon, custom-path | Any table/room shape |
| x, y, width, height, rotation | Any position, size, angle |
| element_kind enum | Any furniture/room type semantic |
| label field | Custom numbering ("Table 12A", "Honeymoon Suite") |
| seat_count field | Restaurant: chairs per table; Hotel: max occupancy |
| color override | Brand colors, zone color-coding |
| parent_element_id | Chair grouping, zone containment |
| Multi-floor plans | Upstairs, patio, building floors, wings |
| background_image | Trace over an existing architectural floor plan |
| floor_plan_templates | Save custom presets for this venue |
| canvas_width/height & grid_size | Match the actual scale of the space |

This means a restaurant with an odd L-shaped floor, 40 tables of 6 different sizes across 3 floors with a patio and a private room — all the same three tables (floor_plans, floor_plan_elements, floor_plan_element_status), just different data. Zero code changes per new restaurant layout.

---

## Real-Time WebSocket Integration

The feature plugs into the existing `RealtimeEventPublisher` / `createRealtimeClient` infrastructure:

**New channel:** `floor:{businessId}`

**Events published:**
- `FLOOR_ELEMENT_STATUS_CHANGED` → when a TableSession opens/closes, reservation changes status, or manual override applied. Payload: `{ elementId, businessTableId, previousStatus, newStatus, sessionId?, reservationId? }`
- `FLOOR_PLAN_UPDATED` → when the merchant saves a new layout. Payload: `{ planId }`. Viewer reloads the canvas.

**Frontend subscription** in `useFloorPlanLive.ts`:
```typescript
createRealtimeClient({
  channels: [`floor:${businessId}`],
  onEvent: (event) => {
    if (event.type === 'FLOOR_ELEMENT_STATUS_CHANGED') {
      // Update the element status in local state — no full reload
      setElementStatuses(prev => ({
        ...prev,
        [event.payload.elementId]: event.payload.newStatus
      }))
    }
    if (event.type === 'FLOOR_PLAN_UPDATED') {
      void reloadLiveSnapshot()
    }
  }
})
```

---

## Security

- All endpoints require `requireOwnedBusiness(businessId)` via `MerchantAccessService` (existing pattern)
- Viewer endpoints (`GET /{planId}/live`, `PATCH .../status`) additionally accept staff sessions via `X-Staff-Session` header — same pattern as `OperationsController`
- Staff roles allowed:
  - **All staff** → view the live floor plan
  - **MANAGER / STAFF_MANAGER** → manually override element status
  - **MERCHANT (owner) only** → create/edit/delete floor plans
- WebSocket channel `floor:{businessId}` protected by `ownsBusinessBySubject()` (existing check in the WS handler)

---

## Dependencies to Add

### Frontend
```json
"konva": "^9.x",
"react-konva": "^18.x"
```
Both are well-maintained, MIT-licensed. Konva is 150 KB gzipped (lazy-loadable since the floor plan page is not always accessed).

### Backend
No new backend dependencies — JPA/Hibernate handles the new entities, and the existing `RealtimeEventPublisher` handles WebSocket publishing.

---

## Implementation Phases

### Phase 1 — MVP (Restaurant Floor Plan)

**Goal:** Merchant can draw their restaurant layout, tables blink red/green during service based on table sessions.

**Deliverables:**
1. Migration V34 — tables: `floor_plans`, `floor_plan_elements`, `floor_plan_element_status`, `floor_plan_templates`
2. Backend: full CRUD for FloorPlan, FloorPlanElement, and status endpoints
3. Backend: status lifecycle auto-updates on TableSession open/close
4. Backend: WebSocket events published via `floor:{businessId}` channel
5. Frontend: Layout Studio sidebar item added to merchant portal
6. Frontend: FloorPlanPage with Editor and Viewer modes
7. Frontend: Konva canvas with drag/drop from palette (shapes: rect, circle)
8. Frontend: Element linking to BusinessTable (create inline or select existing)
9. Frontend: Viewer shows live status colors (FREE = green, OCCUPIED = red pulse)
10. Frontend: Live WebSocket subscription updates colors without reload

**Phase 1 exclusions:**
- Hotel rooms (no `catalog_items` linking yet)
- Custom shapes beyond rect/circle
- Advanced grouping / nested zones
- Undo/redo history (start with a simpler save-all-at-once model)
- Reservation auto-status (only TableSession drives status in Phase 1)

**Estimated effort:** 5–7 days (2 days backend, 3–5 days frontend + Konva integration)

---

### Phase 2 — Hotel Rooms & Reservations

**Goal:** Hotels can draw room layouts, reservations set status to RESERVED, manual check-in/check-out changes status to OCCUPIED/FREE.

**Deliverables:**
1. `FloorPlanElement` links to `catalog_items` (new FK: `catalog_item_id`) for HOTEL_ROOM elements
2. `Reservation` entity extended with `floor_plan_element_id` FK (links reservation to a specific element)
3. Status lifecycle: reservation confirmed → status = RESERVED, reservation seated/checked-in → OCCUPIED
4. Frontend: room element renders with room number label, capacity badge
5. Frontend: tap room → drawer shows room details, reservation guest info, check-in/check-out actions
6. Shape templates: hotel-specific presets (single bed, double bed, suite icon)

**Estimated effort:** 3–4 days

---

### Phase 3 — Advanced Editor Features

**Goal:** Make the editor powerful enough for complex layouts (multi-zone, custom shapes, nested rooms, background trace).

**Deliverables:**
1. Polygon tool (custom shapes beyond rect/circle)
2. Zone/grouping — select multiple elements → group as a zone (patio, private dining, wing)
3. Background image upload — trace over an existing architectural floor plan
4. Custom templates — save a reusable preset from the current layout
5. Undo/redo stack (client-side only, 50-step history)
6. Keyboard shortcuts (Delete, Esc, arrow keys for fine-tuning position)
7. Canvas zoom/pan controls
8. Copy/paste elements within the same plan
9. Import/export layout JSON (for backup or cross-business reuse)

**Estimated effort:** 4–5 days

---

### Phase 4 — Multi-Tenant Template Marketplace (Optional)

**Goal:** Platform-provided global templates for common layouts (fast-food counter, hotel standard floor, conference room).

**Deliverables:**
1. Global `floor_plan_templates` rows with `business_id = NULL`
2. Seed migration with 10–15 global presets
3. Admin console UI to create/edit global templates
4. Frontend: "Browse Templates" button in Layout Studio → modal of global + business-custom presets

**Estimated effort:** 2–3 days

---

## Data Model Deep Dive

### Element vs Bookable Unit (revisited)

This is the core design insight that makes "100 configurable ways" tractable.

**Element:**
- A drawn shape on the canvas (visual only)
- Has geometry: x, y, width, height, rotation, shape_type
- Has semantics: element_kind, label, color, seat_count
- Can be decorative (no business link) or trackable (has business_table_id)

**Bookable Unit:**
- The business entity that has occupancy status
- Today: `BusinessTable` (id, business_id, label, qr_token, active)
- Future: `CatalogItem` with `item_kind = ROOM` (hotel rooms)
- An Element becomes a Bookable Unit when the merchant links it

**Examples:**

| Use case | Elements | Bookable Units |
|----------|----------|----------------|
| Restaurant with 10 tables | 10 TABLE elements + 40 CHAIR elements (children) + walls/decor | 10 BusinessTable rows (one per TABLE element) |
| Hotel with 20 rooms | 20 HOTEL_ROOM elements + hallway/elevator/label elements | 20 CatalogItem rows with item_kind=ROOM |
| Bar with no table tracking | 1 BAR element + 8 STOOL elements + decor | 0 Bookable Units (visual only) |
| Restaurant tracking seats, not tables | 1 TABLE element + 6 CHAIR elements | 6 BusinessTable rows (one per CHAIR element) OR 1 table + 6 seat-level units (future extension) |

The last example (seat-level tracking) is not in the Phase 1 data model but shows why the separation matters — the Element (chair shape) is stable, and the Bookable Unit (what you reserve) can be added later without changing the canvas.

---

## Status Transitions — Detailed State Machine

The `FloorPlanElementStatus` table is the source of truth for occupancy color. Its `status` field follows this state machine:

```
┌──────────┐
│   FREE   │ ◄──────────────┐
└────┬─────┘                │
     │                      │
     │ (reservation confirmed)  (session closed)
     │                      │
     v                      │
┌──────────┐         ┌──────────┐
│ RESERVED │ ───────►│ OCCUPIED │
└──────────┘ (party  └──────────┘
     │       seated)      │
     │                    │
     │ (res cancelled)    │ (session closed)
     │                    │
     └────────────────────┴──────► FREE

Any state ──(manual override)──► OUT_OF_SERVICE
OUT_OF_SERVICE ──(manual clear)──► FREE
```

**Trigger events:**

| Event | Source | Action |
|-------|--------|--------|
| TableSession opened | `TableService.openSession()` | Status = OCCUPIED, session_id set |
| TableSession closed | `TableService.closeSession()` | Status = FREE, session_id cleared |
| Reservation created with table | `ReservationService.create()` | Status = RESERVED, reservation_id set |
| Reservation status → Seated | `ReservationService.markSeated()` | Status = OCCUPIED (and open session if needed) |
| Reservation cancelled | `ReservationService.cancel()` | Status = FREE, reservation_id cleared |
| Staff manual override | `FloorPlanStatusService.setStatus()` | Status = OUT_OF_SERVICE (or back to FREE) |

---

## Frontend Component Tree

```
FloorPlanPage (src/floor-plan/FloorPlanPage.tsx)
├── FloorPlanSelector         -- Floor plan tabs/dropdown (multi-floor)
├── [mode === 'editor']
│   └── FloorPlanEditor
│       ├── ShapePalette      -- Left drawer, draggable element presets
│       ├── FloorPlanCanvas   -- Konva Stage (shared with viewer)
│       │   ├── BackgroundLayer  -- Grid lines, background image
│       │   ├── ElementsLayer    -- All shapes (editor: draggable/resizable)
│       │   │   ├── TableElement
│       │   │   ├── ChairElement
│       │   │   ├── WallElement
│       │   │   ├── ZoneElement
│       │   │   └── LabelElement
│       │   └── SelectionLayer   -- Transformer handles for selected element
│       └── ElementControls    -- Right panel (label, seats, color, table link)
│           └── BusinessTableLink  -- Connect element → BusinessTable
└── [mode === 'viewer']
    └── FloorPlanViewer
        ├── FloorPlanCanvas   -- Same canvas, read-only
        │   ├── BackgroundLayer
        │   └── ElementsLayer  -- Each element reads status from live state
        │       └── StatusOverlay   -- Color fill + pulse animation layer
        └── ElementDetailDrawer  -- Slides up on tap: session info + actions
            ├── SessionSummary
            ├── ReservationInfo
            └── StatusActions   -- "Mark free" / "Out of service" (manager only)
```

---

## API Payload Contracts

### Save Floor Plan (PUT `/{planId}`)

```typescript
// Request body
{
  name: string
  canvasWidth: number
  canvasHeight: number
  gridSize: number
  backgroundImage?: string | null
  elements: Array<{
    id?: string         // omit for new elements (backend assigns UUID)
    shapeType: 'rect' | 'circle' | 'polygon' | 'custom-path'
    elementKind: 'TABLE' | 'CHAIR' | 'WALL' | 'BAR' | 'DOOR' | 'WINDOW' | 'STAGE' |
                 'PLANT' | 'DECOR' | 'HOTEL_ROOM' | 'ZONE' | 'LABEL'
    x: number
    y: number
    width: number
    height: number
    rotation: number
    zIndex: number
    color: string
    label?: string | null
    seatCount: number
    parentElementId?: string | null
    businessTableId?: string | null
  }>
}

// Response
{
  plan: {
    id: string
    name: string
    canvasWidth: number
    canvasHeight: number
    gridSize: number
    backgroundImage: string | null
    elements: Array<FloorPlanElement>   // with server-assigned IDs
    updatedAt: string
  }
}
```

### Live Snapshot (GET `/{planId}/live`)

```typescript
// Response
{
  plan: FloorPlan,
  statuses: Record<string, {   // keyed by elementId
    status: 'FREE' | 'OCCUPIED' | 'RESERVED' | 'OUT_OF_SERVICE'
    sessionId?: string | null
    reservationId?: string | null
    updatedAt: string
    tableLabel?: string | null     // convenience for tooltip
    sessionOpenedAt?: string | null
    guestName?: string | null      // from reservation
    partySize?: number | null
    unpaidTotal?: number | null    // from active session
  }>
}
```

---

## UX Considerations

### Editor Mode UX
- **Snap to grid (default ON):** Elements snap to grid intersections during drag, making alignment easy for non-designers
- **Grid toggle:** Keyboard shortcut `G` to toggle grid visibility
- **Selection:** Click any element to select (shows transformer handles), click empty canvas to deselect
- **Multi-select:** Hold Shift + click to add to selection (future Phase 3)
- **Delete:** Press Delete key or click trash icon in element controls
- **Drag from palette:** Click a template → drag onto canvas → releases at pointer location → immediately selected for customization
- **Table linking:** When a TABLE element is placed, auto-prompt: "Link to existing table or create new?" Modal with BusinessTable picker + "Create New Table" option

### Viewer Mode UX
- **Status color is the primary visual:** Free = green, Occupied = pulsing red, Reserved = amber glow, Out of Service = gray hatched
- **Tap any table:** Detail drawer slides up from bottom (mobile-friendly) showing session/reservation info
- **Auto-refresh:** WebSocket keeps status live, no manual refresh needed
- **Floor switcher:** Tabs at top if multiple floor plans exist
- **Transition to editor:** Merchant taps "Edit Layout" → switches to Editor mode (warns if active session data exists: "Editing layout may affect live view")

---

## Testing Strategy

### Unit Tests (Backend)
- `FloorPlanServiceTest` — CRUD operations, multi-tenant isolation (can't access another business's floor plans)
- `FloorPlanStatusServiceTest` — status transitions, validation (can't set OCCUPIED without a session)
- `FloorPlanLiveServiceTest` — live snapshot includes correct session/reservation details

### Integration Tests (Backend)
- `FloorPlanControllerTest` — REST endpoints with Spring MockMvc, verify auth (merchant vs staff vs none)
- WebSocket integration test — publish a FLOOR_ELEMENT_STATUS_CHANGED event → verify subscribers receive it on correct channel

### E2E Tests (Frontend with Playwright — if existing)
- Create floor plan → drag 3 tables onto canvas → save → reload page → verify tables persist
- Open TableSession → verify table element changes to red pulse in live viewer
- Switch between Editor and Viewer modes → verify correct toolbar buttons appear

---

## Open Questions / Future Extensions

1. **Seat-level tracking** — should individual chairs be bookable units, or just tables?  
   → Phase 1: table-level only. Phase 4: add `seat_number` to FloorPlanElementStatus.

2. **Capacity enforcement** — should we prevent seating a party of 8 at a 4-seat table?  
   → No hard enforcement in Phase 1. FloorPlan element shows `seat_count` as advisory only.

3. **Reservations without table assignment** — many restaurants take reservations but assign tables on arrival.  
   → Phase 1: reservation can have `floor_plan_element_id = NULL`. Phase 2: add "Assign Table" action in Viewer.

4. **3D visualization toggle** — can we add an optional Three.js viewer on top of the same data?  
   → Yes — the data model doesn't lock us out. A 3D viewer can consume the same `/live` endpoint and project elements into a scene. But that's a separate feature entirely.

5. **Print floor plan** — merchant wants a PDF of the layout for staff training.  
   → Phase 3: add "Export as PNG" button → Konva has `.toDataURL()` built-in.

---

## Summary

This feature is architecturally ready to build **today**:
- Database schema is clean (4 new tables, no breaking changes)
- Backend follows existing patterns (service/controller/DTO split, MerchantAccessService for auth, RealtimeEventPublisher for WebSocket)
- Frontend slots into the existing nav structure (one new sidebar item, one new page component)
- Multi-tenancy is enforced at every layer (business_id on all tables + access checks on all endpoints)

The data model achieves "100 configurable ways" through **composition of primitives** rather than enumerating every possible layout. This makes it resilient to edge cases (odd-shaped rooms, multi-floor venues, mixed restaurant/bar/hotel businesses) without code changes.

**Phase 1 delivers immediate value** (restaurant floor plans with live occupancy) in ~5–7 days of work.  
**Phase 2–4 extend to hotels, advanced editor tools, and platform-wide templates** as the business needs grow.

---

## Next Steps

1. ✅ **Planning complete** — this document
2. Create DB migration V34
3. Implement backend entities, repositories, services, controller
4. Add WebSocket event publishing in TableService
5. Implement frontend: FloorPlanPage, Editor, Viewer, Konva canvas
6. Install `konva` and `react-konva` dependencies
7. Add "Layout Studio" to merchant sidebar in App.tsx
8. Manual QA: create a test floor plan, link tables, open sessions, verify live colors
9. Deploy to dev environment for merchant feedback

Ready to proceed with code implementation.
