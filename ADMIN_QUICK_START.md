# Admin API Quick Start Guide

Quick guide to start using the Admin API endpoints.

## 🚀 What's Implemented

**15 Admin Endpoints** across 5 categories:
- ✅ Dashboard & Metrics (3 endpoints)
- ✅ Merchants Management (5 endpoints)
- ✅ Orders Management (3 endpoints)
- ✅ Analytics (4 endpoints)
- ✅ System Health (2 endpoints)

## 📡 Base URL

```
http://localhost:4000/api/admin
```

## 🧪 Quick Test

```bash
# Test if admin API is working
curl http://localhost:4000/api/admin/dashboard/metrics

# Run full test suite
./test-admin-endpoints.sh
```

## 📊 Key Endpoints

### Dashboard
```bash
# Get dashboard metrics
GET /api/admin/dashboard/metrics

# Get activity feed
GET /api/admin/dashboard/activity

# Get top merchants
GET /api/admin/dashboard/top-merchants?period=month&limit=5
```

### Merchants
```bash
# List all merchants
GET /api/admin/merchants?page=1&limit=20

# Get merchant details
GET /api/admin/merchants/{merchantId}

# Update merchant
PATCH /api/admin/merchants/{merchantId}

# Delete merchant
DELETE /api/admin/merchants/{merchantId}
```

### Orders
```bash
# List all orders
GET /api/admin/orders?page=1&limit=20

# Get order details
GET /api/admin/orders/{orderId}

# Update order
PATCH /api/admin/orders/{orderId}
```

### Analytics
```bash
# Ticket analytics
GET /api/admin/analytics/tickets

# Quick payment analytics
GET /api/admin/analytics/quick-payments

# Device analytics
GET /api/admin/analytics/devices

# Revenue overview
GET /api/admin/revenue/overview
```

### System Health
```bash
# System status
GET /api/admin/system/status

# Health services
GET /api/admin/health/services
```

## 🎯 Frontend Integration

### React/TypeScript Example

```typescript
// api/admin.ts
const ADMIN_API_BASE = 'http://localhost:4000/api/admin';

export async function getDashboardMetrics() {
  const response = await fetch(`${ADMIN_API_BASE}/dashboard/metrics`);
  return response.json();
}

export async function getMerchants(page = 1, limit = 20) {
  const response = await fetch(
    `${ADMIN_API_BASE}/merchants?page=${page}&limit=${limit}`
  );
  return response.json();
}

export async function getOrdersList(page = 1, limit = 20) {
  const response = await fetch(
    `${ADMIN_API_BASE}/orders?page=${page}&limit=${limit}`
  );
  return response.json();
}

export async function getTicketAnalytics() {
  const response = await fetch(`${ADMIN_API_BASE}/analytics/tickets`);
  return response.json();
}

export async function getSystemHealth() {
  const response = await fetch(`${ADMIN_API_BASE}/system/status`);
  return response.json();
}
```

### Using in Admin Console Components

```typescript
// pages/OverviewPage.tsx
import { useEffect, useState } from 'react';
import { getDashboardMetrics } from '../api/admin';

export function OverviewPage() {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    getDashboardMetrics().then(setMetrics);
  }, []);

  if (!metrics) return <div>Loading...</div>;

  return (
    <div>
      <h1>Dashboard</h1>
      <div>Total Merchants: {metrics.merchants.total}</div>
      <div>Orders Today: {metrics.ordersToday.total}</div>
      <div>QR Scans (24h): {metrics.qrScans.last24Hours}</div>
      <div>Revenue This Month: {metrics.revenue.thisMonth} UGX</div>
    </div>
  );
}
```

## 📦 Response Examples

### Dashboard Metrics
```json
{
  "merchants": {
    "total": 2,
    "change": "+2.2%",
    "thisWeek": 2
  },
  "ordersToday": {
    "total": 0,
    "change": "+14.3%"
  },
  "qrScans": {
    "last24Hours": 2,
    "change": "+8.1%"
  },
  "revenue": {
    "thisMonth": 5000,
    "currency": "UGX",
    "change": "+19.4%"
  }
}
```

### Merchants List
```json
{
  "merchants": [
    {
      "id": "kampala-grill",
      "name": "Kampala Grill",
      "owner": "Owner",
      "type": "Bar",
      "plan": "Basic",
      "orders": 0,
      "revenue": 0,
      "currency": "UGX",
      "status": "active",
      "joinedAt": "2026-07-06T11:17:40.060388Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 2,
    "pages": 1
  },
  "summary": {
    "total": 2,
    "active": 2,
    "pending": 0,
    "suspended": 0
  }
}
```

### Ticket Analytics
```json
{
  "summary": {
    "totalTickets": 1,
    "activeTickets": 0,
    "redeemedTickets": 1,
    "expiredTickets": 0
  },
  "byType": [
    {
      "type": "VIP",
      "count": 1,
      "revenue": 50000
    }
  ],
  "scanActivity": []
}
```

## 🔐 Authentication (Coming Soon)

Current status: **No authentication required** (development mode)

Production implementation will require:
- JWT tokens in Authorization header
- Role-based access control
- Admin user management

```typescript
// Future implementation
const response = await fetch(`${ADMIN_API_BASE}/dashboard/metrics`, {
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'X-Admin-Role': 'superadmin'
  }
});
```

## 📚 Full Documentation

For complete documentation, see:
- **[ADMIN_IMPLEMENTATION_SUMMARY.md](./ADMIN_IMPLEMENTATION_SUMMARY.md)** - All endpoints with examples
- **[ADMIN_API_ENDPOINTS.md](./ADMIN_API_ENDPOINTS.md)** - Complete API specification
- **[DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md)** - All documentation links

## ✅ Verification Checklist

- [ ] Backend running on port 4000
- [ ] Can access `GET /api/admin/dashboard/metrics`
- [ ] Can access `GET /api/admin/merchants`
- [ ] Can access `GET /api/admin/orders`
- [ ] Can access `GET /api/admin/system/status`
- [ ] Can access `GET /api/admin/analytics/tickets`
- [ ] Test script runs successfully: `./test-admin-endpoints.sh`

## 🚨 Troubleshooting

### 404 Not Found
- Ensure backend is running: `curl http://localhost:4000/health`
- Check endpoint URL matches examples

### Empty Data
- System has no data yet
- Create some test data using customer/merchant APIs
- Data will populate after transactions

### Connection Refused
- Start backend: `cd backend && mvn spring-boot:run`
- Check port 4000 is free: `lsof -i :4000`

## 🎉 Next Steps

1. ✅ Backend API is ready
2. ✅ All endpoints are tested
3. 🔄 Integrate with admin console frontend
4. 🔄 Add authentication
5. 🔄 Deploy to production

---

**Status:** ✅ Ready for Frontend Integration
**Last Updated:** July 7, 2026
**Version:** 1.0.0
