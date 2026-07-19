# Client App API Quick Start

Quick reference for implementing missing backend endpoints for the client app.

## 🚨 Critical Missing Endpoints

The client app (main merchant portal) currently stores ALL data in localStorage. To make it functional with the backend, implement these endpoints:

---

## 1️⃣ Catalog Management (HIGHEST PRIORITY)

### POST /api/businesses/{businessId}/catalog
Create new catalog item

**Request:**
```json
{
  "name": "Beef Plate",
  "category": "Meals",
  "price": 18000,
  "description": "Grilled beef with rice",
  "available": true
}
```

### PATCH /api/businesses/{businessId}/catalog/{itemId}
Update catalog item

**Request:**
```json
{
  "name": "Updated Name",
  "price": 20000,
  "available": true
}
```

### DELETE /api/businesses/{businessId}/catalog/{itemId}
Delete catalog item

### PATCH /api/businesses/{businessId}/catalog/{itemId}/availability
Quick toggle item availability

**Request:**
```json
{
  "available": false
}
```

---

## 2️⃣ Order Management Updates

### PATCH /api/orders/{orderId}/status
Update order status (Pending → Preparing → Ready → Completed)

**Request:**
```json
{
  "status": "Preparing"
}
```

**Valid statuses:** Pending, Preparing, Ready, Completed, Cancelled

### PATCH /api/orders/{orderId}/payment
Update payment status

**Request:**
```json
{
  "paymentStatus": "Paid"
}
```

**Valid statuses:** Unpaid, Paid, Refunded

---

## 3️⃣ Utility Endpoints

### DELETE /api/businesses/{businessId}/orders/completed
Clear completed and cancelled orders

**Response:**
```json
{
  "deleted": 15,
  "message": "Cleared 15 completed/cancelled orders"
}
```

---

## 📊 Enhancement Endpoints (Next Phase)

### GET /api/businesses/{businessId}/metrics
Dashboard metrics

**Response:**
```json
{
  "openOrders": 5,
  "publishedItems": 12,
  "paidSales": 2400000,
  "currency": "UGX"
}
```

### GET /api/businesses/{businessId}/reports/summary
Sales reports

**Query params:** `period=day|week|month|year`

---

## 🔄 Current vs Required Implementation

### What EXISTS:
- ✅ GET /api/businesses
- ✅ GET /api/businesses/{businessId}
- ✅ POST /api/businesses
- ✅ GET /api/businesses/{businessId}/orders
- ✅ POST /api/businesses/{businessId}/orders
- ✅ GET /api/qr/{qrToken}
- ✅ GET /api/businesses/{businessId}/menu

### What's MISSING:
- ❌ Catalog CRUD (4 endpoints)
- ❌ Order status updates (2 endpoints)
- ❌ Clear completed orders (1 endpoint)
- ❌ Dashboard metrics (1 endpoint)
- ❌ Reports (1 endpoint)

---

## 🎯 Implementation Order

1. **Catalog endpoints** - Merchants can't manage menu
2. **Order updates** - Merchants can't update order status
3. **Metrics** - Dashboard shows no data
4. **Reports** - Analytics page non-functional

---

## 📝 Quick Implementation Notes

### Catalog Items
- Currently nested in Business entity
- May need separate CatalogItem entity
- Or store as JSON column in businesses table
- Client expects array of items in business object

### Orders
- Order entity already exists
- Just need update endpoints
- Status and payment are separate fields

### Metrics
- Can calculate from existing order data
- No new tables needed
- Just aggregate existing orders

---

## 🚀 Test Commands

```bash
# Test catalog creation
curl -X POST http://localhost:4000/api/businesses/kampala-grill/catalog \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Item","category":"Meals","price":15000,"available":true}'

# Test order status update
curl -X PATCH http://localhost:4000/api/orders/ORD-123/status \
  -H "Content-Type: application/json" \
  -d '{"status":"Preparing"}'

# Test payment update
curl -X PATCH http://localhost:4000/api/orders/ORD-123/payment \
  -H "Content-Type: application/json" \
  -d '{"paymentStatus":"Paid"}'

# Test metrics
curl http://localhost:4000/api/businesses/kampala-grill/metrics

# Test clear completed
curl -X DELETE http://localhost:4000/api/businesses/kampala-grill/orders/completed
```

---

## 📖 Full Documentation

For complete details, see:
- **CLIENT_APP_API_REQUIREMENTS.md** - Full analysis
- **API_DOCUMENTATION.md** - Existing API reference

---

**Priority:** HIGH  
**Blocks:** Merchant portal functionality  
**Estimated Time:** 4-6 hours for all critical endpoints
