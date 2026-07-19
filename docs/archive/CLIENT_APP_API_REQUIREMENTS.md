# Client App API Requirements Analysis

Complete analysis of the client app (main frontend) to identify all required backend API endpoints.

---

## 📱 App Structure Overview

The client app has **4 main views**:

1. **Landing Page** - Marketing/homepage
2. **Merchant Portal (App.tsx)** - Main merchant dashboard (requires authentication)
3. **Customer Menu** - Public-facing menu for customers
4. **Event Ticket** - Standalone ticket generator

---

## 🔍 Current Data Storage

### LocalStorage Keys
```javascript
'scanny-orders-v1'          // All orders
'scanny-businesses-v2'      // All businesses  
'scanny-dark-mode'          // UI preference
```

### Current Implementation
- **100% client-side** - All data stored in browser localStorage
- **No API calls** - Everything is mock/local data
- **No backend integration** - Completely standalone

---

## 🎯 Required Backend Endpoints

Based on the client app analysis, here are ALL the endpoints needed:

### 1️⃣ Authentication & Session
Already handled by Keycloak - no custom endpoints needed

---

### 2️⃣ Business/Merchant Endpoints

#### GET /api/businesses
**Purpose:** List all businesses for authenticated merchant  
**Used in:** App initial load  
**Current:** Loads from localStorage  
**Response:**
```json
{
  "businesses": [
    {
      "id": "kampala-grill",
      "merchantId": "MER-KGL-1001",
      "qrToken": "SIT-KGL-1001",
      "name": "Kampala Grill",
      "ownerName": "Owner Name",
      "phone": "+256700123456",
      "type": "Restaurant",
      "tableLabel": "Location",
      "paymentReference": "PAY-KGL-1001",
      "accent": "#2563eb",
      "items": [...catalog items]
    }
  ]
}
```

#### GET /api/businesses/{businessId}
**Purpose:** Get single business with full details  
**Used in:** Business detail views  
**Already exists:** ✅ Yes

#### POST /api/businesses
**Purpose:** Create new business  
**Used in:** Business onboarding  
**Already exists:** ✅ Yes

#### GET /api/qr/{qrToken}
**Purpose:** Get business by QR token (for customer menu)  
**Used in:** Customer menu page  
**Already exists:** ✅ Yes

#### GET /api/businesses/{businessId}/menu
**Purpose:** Get business menu with available items  
**Used in:** Customer menu display  
**Already exists:** ✅ Yes

---

### 3️⃣ Catalog/Items Endpoints

#### GET /api/businesses/{businessId}/catalog
**Purpose:** Get all catalog items for a business  
**Used in:** Catalog page in merchant portal  
**Current:** Items are nested in business object  
**Response:**
```json
{
  "items": [
    {
      "id": "beef-plate",
      "name": "Beef Plate",
      "category": "Meals",
      "price": 18000,
      "description": "Grilled beef, rice, greens, and house sauce.",
      "available": true
    }
  ],
  "categories": ["Meals", "Drinks", "Bites"]
}
```

#### POST /api/businesses/{businessId}/catalog
**Purpose:** Add new catalog item  
**Used in:** "Add item" button in merchant portal  
**Current:** Updates localStorage  
**Request:**
```json
{
  "name": "New Item",
  "category": "Meals",
  "price": 15000,
  "description": "Description",
  "available": true
}
```

#### PATCH /api/businesses/{businessId}/catalog/{itemId}
**Purpose:** Update existing catalog item  
**Used in:** Edit item in catalog page  
**Current:** Updates localStorage

#### DELETE /api/businesses/{businessId}/catalog/{itemId}
**Purpose:** Delete catalog item  
**Used in:** Delete item in catalog page  
**Current:** Removes from localStorage

#### PATCH /api/businesses/{businessId}/catalog/{itemId}/availability
**Purpose:** Toggle item availability  
**Used in:** Quick toggle in catalog page  
**Request:**
```json
{
  "available": false
}
```

---

### 4️⃣ Orders Endpoints

#### GET /api/businesses/{businessId}/orders
**Purpose:** List all orders for a business  
**Used in:** Orders dashboard page  
**Already exists:** ✅ Yes  
**Current:** Reads from localStorage  
**Response:**
```json
{
  "orders": [
    {
      "id": "ORD-123456",
      "businessId": "kampala-grill",
      "merchantId": "MER-KGL-1001",
      "qrToken": "SIT-KGL-1001",
      "paymentReference": "PAY-KGL-1001",
      "businessName": "Kampala Grill",
      "customer": {
        "name": "John Doe",
        "phone": "+256700123456",
        "location": "Table 5",
        "note": "Extra spicy"
      },
      "items": [
        {
          "id": "beef-plate",
          "name": "Beef Plate",
          "price": 18000,
          "quantity": 2,
          "lineTotal": 36000
        }
      ],
      "total": 36000,
      "paymentStatus": "Unpaid",
      "status": "Pending",
      "createdAt": "2026-07-07T10:30:00Z"
    }
  ]
}
```

#### POST /api/businesses/{businessId}/orders
**Purpose:** Create new order (from customer menu)  
**Used in:** Customer menu checkout  
**Already exists:** ✅ Yes  
**Current:** Saves to localStorage  
**Request:**
```json
{
  "customer": {
    "name": "John Doe",
    "phone": "+256700123456",
    "location": "Table 5",
    "note": "Extra spicy"
  },
  "items": [
    {
      "id": "beef-plate",
      "quantity": 2
    }
  ]
}
```

#### PATCH /api/orders/{orderId}/status
**Purpose:** Update order status  
**Used in:** Order status dropdown in merchant dashboard  
**Current:** Updates localStorage  
**Request:**
```json
{
  "status": "Preparing"
}
```
**Status values:** Pending, Preparing, Ready, Completed, Cancelled

#### PATCH /api/orders/{orderId}/payment
**Purpose:** Update payment status  
**Used in:** Payment status toggle in merchant dashboard  
**Current:** Updates localStorage  
**Request:**
```json
{
  "paymentStatus": "Paid"
}
```
**Payment status values:** Unpaid, Paid, Refunded

#### DELETE /api/businesses/{businessId}/orders/completed
**Purpose:** Clear completed/cancelled orders  
**Used in:** "Clear completed" button in orders page  
**Current:** Filters localStorage

---

### 5️⃣ QR Code Generation

#### GET /api/businesses/{businessId}/qr
**Purpose:** Get QR code image for business  
**Used in:** Overview page QR display  
**Current:** Generated client-side with qrcode library  
**Response:** Returns PNG image or base64 data URL

---

### 6️⃣ Dashboard Metrics

#### GET /api/businesses/{businessId}/metrics
**Purpose:** Get business performance metrics  
**Used in:** Overview page metric cards  
**Current:** Calculated client-side from orders  
**Response:**
```json
{
  "openOrders": 5,
  "publishedItems": 12,
  "paidSales": 2400000,
  "currency": "UGX",
  "recentActivity": [
    {
      "type": "order_placed",
      "orderId": "ORD-123",
      "customerName": "John Doe",
      "amount": 18000,
      "timestamp": "2026-07-07T10:30:00Z"
    }
  ]
}
```

---

### 7️⃣ Reports & Analytics

#### GET /api/businesses/{businessId}/reports/summary
**Purpose:** Get sales and performance reports  
**Used in:** Reports page  
**Current:** Calculated client-side  
**Query params:** `period` (day, week, month, year)  
**Response:**
```json
{
  "period": "month",
  "totalOrders": 142,
  "totalRevenue": 2550000,
  "avgOrderValue": 17958,
  "currency": "UGX",
  "ordersByStatus": {
    "completed": 120,
    "cancelled": 12,
    "pending": 10
  },
  "ordersByPayment": {
    "paid": 130,
    "unpaid": 12
  },
  "topItems": [
    {
      "itemId": "beef-plate",
      "name": "Beef Plate",
      "orderCount": 45,
      "revenue": 810000
    }
  ],
  "dailyRevenue": [
    { "date": "2026-07-01", "revenue": 85000, "orders": 5 },
    { "date": "2026-07-02", "revenue": 92000, "orders": 6 }
  ]
}
```

---

## 🎨 UI Features Requiring Backend Support

### Notifications Panel
**Current:** Shows recent orders from localStorage  
**Needs:** 
- WebSocket or polling for real-time order updates
- `GET /api/businesses/{businessId}/notifications`

### Live Order Count Badge
**Current:** Calculated from localStorage  
**Needs:** 
- Real-time updates via WebSocket
- Or polling `GET /api/businesses/{businessId}/orders?status=pending`

### Dark Mode
**Current:** Stored in localStorage only  
**Future:** Could sync across devices via user preferences API

---

## 📊 Data Flow Summary

### Current Flow (All Local):
```
User Action → Update localStorage → Re-render UI
```

### Required Flow (With Backend):
```
User Action → API Call → Update Database → Return Response → Update UI
```

---

## 🔄 Real-Time Features Needed

### 1. Order Updates
- **Method:** WebSocket or Server-Sent Events (SSE)
- **Endpoint:** `ws://localhost:4000/api/businesses/{businessId}/orders/live`
- **Events:** order_created, order_updated, payment_updated

### 2. Notifications
- **Method:** WebSocket or polling
- **Frequency:** Every 5-10 seconds for polling
- **Endpoint:** `GET /api/businesses/{businessId}/notifications`

---

## 🚀 Implementation Priority

### Phase 1: Core CRUD (Immediate)
1. ✅ Business endpoints (already exist)
2. ✅ Orders endpoints (already exist)
3. ❌ **Catalog/Items endpoints** (NEW - highest priority)
4. ❌ **Order status updates** (NEW - highest priority)
5. ❌ **Payment status updates** (NEW - highest priority)

### Phase 2: Enhanced Features
6. ❌ Dashboard metrics endpoint
7. ❌ Reports & analytics endpoint
8. ❌ QR code generation endpoint
9. ❌ Clear completed orders endpoint

### Phase 3: Real-Time
10. ❌ WebSocket for live orders
11. ❌ Notifications system
12. ❌ Live metrics updates

---

## 📝 Missing Backend Endpoints (NEW)

### Critical (Blocks core functionality):
```
POST   /api/businesses/{businessId}/catalog
PATCH  /api/businesses/{businessId}/catalog/{itemId}
DELETE /api/businesses/{businessId}/catalog/{itemId}
PATCH  /api/businesses/{businessId}/catalog/{itemId}/availability
PATCH  /api/orders/{orderId}/status
PATCH  /api/orders/{orderId}/payment
DELETE /api/businesses/{businessId}/orders/completed
```

### Important (Enhances UX):
```
GET /api/businesses/{businessId}/metrics
GET /api/businesses/{businessId}/reports/summary
GET /api/businesses/{businessId}/qr
GET /api/businesses/{businessId}/notifications
```

### Optional (Nice to have):
```
ws://localhost:4000/api/businesses/{businessId}/orders/live
GET /api/businesses/{businessId}/catalog (if not nested in business)
```

---

## 💡 Recommendations

### 1. Catalog Management
**Current:** Items are nested in business object  
**Recommendation:** Create separate catalog endpoints for easier management

### 2. Orders Management
**Current:** Some endpoints exist, but missing status/payment updates  
**Recommendation:** Add PATCH endpoints for status and payment

### 3. Real-Time Updates
**Current:** None  
**Recommendation:** Start with polling, add WebSocket later

### 4. QR Code Generation
**Current:** Client-side with qrcode library  
**Recommendation:** Can stay client-side OR move to backend for consistency

### 5. Reports
**Current:** Calculated client-side  
**Recommendation:** Move to backend for better performance with large datasets

---

## 🔗 Integration Points

### Customer Menu Flow:
1. Customer scans QR code → `?bid={businessId}`
2. Load business → `GET /api/businesses/{businessId}` OR `GET /api/qr/{qrToken}`
3. Display menu → Uses business.items array
4. Customer adds to cart → Local state
5. Customer submits order → `POST /api/businesses/{businessId}/orders`
6. Order appears in merchant dashboard → Real-time update needed

### Merchant Portal Flow:
1. Merchant logs in → Keycloak authentication
2. Load businesses → `GET /api/businesses`
3. Select business → Load from state
4. View orders → `GET /api/businesses/{businessId}/orders`
5. Update order status → `PATCH /api/orders/{orderId}/status` (MISSING)
6. Mark payment → `PATCH /api/orders/{orderId}/payment` (MISSING)
7. Add catalog item → `POST /api/businesses/{businessId}/catalog` (MISSING)
8. Toggle availability → `PATCH /api/businesses/{businessId}/catalog/{itemId}/availability` (MISSING)

---

## ✅ Summary

**Existing Endpoints:** 4/14 (29%)
- GET /api/businesses
- GET /api/businesses/{businessId}
- POST /api/businesses  
- GET /api/businesses/{businessId}/orders

**Missing Critical Endpoints:** 7
- Catalog CRUD (4 endpoints)
- Order status/payment updates (2 endpoints)
- Clear completed orders (1 endpoint)

**Missing Enhancement Endpoints:** 3
- Dashboard metrics
- Reports/analytics
- Notifications

**Total Implementation Needed:** 10 new endpoints

---

## 🎯 Next Steps

1. **Implement catalog management endpoints** (highest priority)
2. **Add order status/payment update endpoints** (blocks merchant workflow)
3. **Create metrics endpoint** (improves dashboard)
4. **Add reports endpoint** (enhances analytics)
5. **Set up real-time updates** (best UX)

---

**Last Updated:** July 7, 2026  
**Client App Version:** 1.0.0  
**Backend API:** Partially implemented
