# Admin API Endpoints Specification

Complete API endpoints needed for the Admin Console based on all admin pages.

---

## 📊 Overview / Dashboard

### GET /api/admin/dashboard/metrics
**Description:** Get key platform metrics for overview page

**Response:**
```json
{
  "merchants": {
    "total": 142,
    "change": "+2.2%",
    "thisWeek": 3
  },
  "ordersToday": {
    "total": 1847,
    "change": "+14.3%"
  },
  "qrScans": {
    "last24Hours": 8304,
    "change": "+8.1%"
  },
  "revenue": {
    "thisMonth": 4200000,
    "currency": "UGX",
    "change": "+19.4%"
  }
}
```

### GET /api/admin/dashboard/activity
**Description:** Recent platform activity feed

**Response:**
```json
[
  {
    "id": "evt-123",
    "type": "merchant_registered",
    "title": "New merchant registered",
    "description": "Kampala Grill",
    "timestamp": "2026-07-07T11:45:00Z",
    "icon": "merchant"
  },
  {
    "id": "evt-124",
    "type": "orders_milestone",
    "title": "284 orders placed",
    "description": "across 38 merchants · today",
    "timestamp": "2026-07-07T11:43:00Z",
    "icon": "orders"
  }
]
```

### GET /api/admin/dashboard/top-merchants
**Description:** Top performing merchants

**Query Params:**
- `period` - `today`, `week`, `month` (default: `month`)
- `sortBy` - `orders`, `revenue` (default: `orders`)
- `limit` - number (default: 5)

**Response:**
```json
[
  {
    "id": "MER-001",
    "name": "Kampala Grill",
    "type": "Restaurant",
    "orders": 312,
    "revenue": 5600000,
    "currency": "UGX",
    "status": "active"
  }
]
```

### GET /api/admin/system/status
**Description:** Platform services health status

**Response:**
```json
{
  "services": [
    {
      "name": "API",
      "status": "operational",
      "uptime": "99.98%"
    },
    {
      "name": "Database",
      "status": "operational",
      "uptime": "99.99%"
    },
    {
      "name": "Payments",
      "status": "degraded",
      "uptime": "98.12%"
    }
  ],
  "overallStatus": "operational"
}
```

---

## 🏪 Merchants Management

### GET /api/admin/merchants
**Description:** List all merchants with pagination

**Query Params:**
- `page` - number (default: 1)
- `limit` - number (default: 20)
- `search` - string (searches name, owner, ID)
- `status` - `active`, `pending`, `suspended`, `warning`
- `type` - `Restaurant`, `Bar`, `Events`, etc.
- `plan` - `Basic`, `Pro`

**Response:**
```json
{
  "merchants": [
    {
      "id": "MER-001",
      "name": "Kampala Grill",
      "owner": "James Okello",
      "type": "Restaurant",
      "plan": "Pro",
      "orders": 1240,
      "revenue": 22400000,
      "currency": "UGX",
      "status": "active",
      "joinedAt": "2024-01-12T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 142,
    "pages": 8
  },
  "summary": {
    "total": 142,
    "active": 128,
    "pending": 9,
    "suspended": 5
  }
}
```

### GET /api/admin/merchants/{merchantId}
**Description:** Get merchant details

**Response:**
```json
{
  "id": "MER-001",
  "name": "Kampala Grill",
  "owner": {
    "name": "James Okello",
    "email": "james@grill.co",
    "phone": "+256700111222"
  },
  "type": "Restaurant",
  "plan": "Pro",
  "status": "active",
  "qrToken": "kampala-grill",
  "statistics": {
    "totalOrders": 1240,
    "totalRevenue": 22400000,
    "avgOrderValue": 18000,
    "currency": "UGX"
  },
  "joinedAt": "2024-01-12T00:00:00Z",
  "lastActiveAt": "2026-07-07T10:30:00Z"
}
```

### POST /api/admin/merchants
**Description:** Create new merchant

**Request:**
```json
{
  "name": "New Restaurant",
  "ownerName": "John Doe",
  "ownerEmail": "john@restaurant.com",
  "ownerPhone": "+256700123456",
  "type": "Restaurant",
  "plan": "Basic"
}
```

### PATCH /api/admin/merchants/{merchantId}
**Description:** Update merchant details

**Request:**
```json
{
  "name": "Updated Name",
  "plan": "Pro",
  "status": "active"
}
```

### PATCH /api/admin/merchants/{merchantId}/status
**Description:** Update merchant status

**Request:**
```json
{
  "status": "suspended",
  "reason": "Payment issues"
}
```

### DELETE /api/admin/merchants/{merchantId}
**Description:** Delete/deactivate merchant

---

## 👥 Users Management

### GET /api/admin/users
**Description:** List all platform users

**Query Params:**
- `page` - number
- `limit` - number
- `role` - `Customer`, `Merchant`, `Admin`
- `status` - `active`, `suspended`
- `search` - string

**Response:**
```json
{
  "users": [
    {
      "id": "USR-001",
      "name": "Amina Nakato",
      "email": "amina@mail.com",
      "role": "Customer",
      "status": "active",
      "ordersCount": 14,
      "joinedAt": "2024-01-02T00:00:00Z",
      "lastLoginAt": "2026-07-07T09:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 4812,
    "pages": 241
  },
  "summary": {
    "total": 4812,
    "customers": 4660,
    "merchants": 142,
    "admins": 10
  }
}
```

### GET /api/admin/users/{userId}
**Description:** Get user details

### PATCH /api/admin/users/{userId}/status
**Description:** Update user status (suspend, activate)

**Request:**
```json
{
  "status": "suspended",
  "reason": "Terms violation"
}
```

---

## 📦 Orders Management

### GET /api/admin/orders
**Description:** List all orders across platform

**Query Params:**
- `page` - number
- `limit` - number
- `search` - string (order ID, merchant, customer)
- `status` - `Pending`, `Preparing`, `Ready`, `Completed`, `Cancelled`
- `paymentStatus` - `Paid`, `Unpaid`, `Refunded`
- `merchantId` - string
- `dateFrom` - ISO date
- `dateTo` - ISO date

**Response:**
```json
{
  "orders": [
    {
      "id": "ORD-03800",
      "merchantId": "MER-001",
      "merchantName": "Kampala Grill",
      "customerName": "Amina N.",
      "items": 2,
      "total": 25000,
      "currency": "UGX",
      "paymentStatus": "Paid",
      "status": "Completed",
      "createdAt": "2026-07-07T08:30:00Z",
      "completedAt": "2026-07-07T09:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1847,
    "pages": 93
  },
  "summary": {
    "today": 1847,
    "completed": 1402,
    "pending": 312,
    "cancelled": 133
  }
}
```

### GET /api/admin/orders/{orderId}
**Description:** Get detailed order information

### PATCH /api/admin/orders/{orderId}
**Description:** Update order (admin override)

**Request:**
```json
{
  "status": "Cancelled",
  "reason": "Customer request",
  "refund": true
}
```

---

## 📱 QR Activity

### GET /api/admin/qr/activity
**Description:** QR code scan activity

**Response:**
```json
{
  "summary": {
    "scansToday": 18304,
    "uniqueDevices": 12841,
    "conversionRate": 18.4,
    "activeCodes": 142
  },
  "hourlyScans": [
    { "hour": 0, "scans": 320 },
    { "hour": 1, "scans": 480 },
    ...
  ]
}
```

### GET /api/admin/qr/top-codes
**Description:** Top performing QR codes

**Query Params:**
- `period` - `today`, `week`, `month`
- `limit` - number (default: 10)
- `sortBy` - `scans`, `orders`, `conversion`

**Response:**
```json
[
  {
    "merchantId": "MER-001",
    "merchantName": "Kampala Grill",
    "qrToken": "SIT-KGL-1001",
    "scans": 1842,
    "orders": 312,
    "conversionRate": 16.9
  }
]
```

### GET /api/admin/qr/scans
**Description:** Detailed scan log

**Query Params:**
- `page`, `limit`, `merchantId`, `deviceId`, `dateFrom`, `dateTo`

---

## 📊 Reports & Analytics

### GET /api/admin/reports/overview
**Description:** Monthly/weekly reports

**Query Params:**
- `period` - `week`, `month`, `year`
- `year` - number
- `month` - number (1-12)

**Response:**
```json
{
  "period": "month",
  "year": 2026,
  "month": 7,
  "summary": {
    "totalOrders": 36410,
    "totalRevenue": 313000000,
    "currency": "UGX",
    "newMerchants": 14,
    "avgOrderValue": 24700
  },
  "weeklyBreakdown": [
    {
      "week": 1,
      "merchants": 128,
      "orders": 7840,
      "revenue": 62000000
    }
  ],
  "growth": {
    "orders": 8.8,
    "revenue": 18.5,
    "merchants": 3,
    "avgOrderValue": 4.2
  }
}
```

### GET /api/admin/reports/revenue
**Description:** Revenue analytics

### GET /api/admin/reports/export
**Description:** Export reports (CSV/PDF)

**Query Params:**
- `type` - `orders`, `revenue`, `merchants`, `users`
- `format` - `csv`, `pdf`, `json`
- `period` - date range

---

## 💰 Revenue & Payments

### GET /api/admin/revenue/overview
**Description:** Revenue dashboard data

**Response:**
```json
{
  "currentMonth": {
    "revenue": 96000000,
    "transactions": 3890,
    "failedPayments": 47,
    "avgOrderValue": 24700,
    "currency": "UGX",
    "growth": {
      "revenue": 14.2,
      "transactions": 9.8,
      "failedPayments": -12.3,
      "avgOrderValue": 3.1
    }
  },
  "monthly": [
    {
      "month": "Jan",
      "revenue": 42000000,
      "transactions": 1820
    }
  ],
  "paymentMethods": [
    {
      "method": "Mobile Money",
      "percentage": 64,
      "amount": 61440000
    },
    {
      "method": "Card",
      "percentage": 22,
      "amount": 21120000
    },
    {
      "method": "Cash",
      "percentage": 14,
      "amount": 13440000
    }
  ]
}
```

### GET /api/admin/transactions
**Description:** List all transactions

**Query Params:**
- `page`, `limit`, `status`, `method`, `merchantId`, `dateFrom`, `dateTo`

**Response:**
```json
{
  "transactions": [
    {
      "id": "TXN-8812",
      "merchantId": "MER-001",
      "merchantName": "Kampala Grill",
      "orderId": "ORD-03800",
      "amount": 18000,
      "currency": "UGX",
      "method": "Mobile Money",
      "provider": "MTN",
      "status": "Settled",
      "createdAt": "2026-07-07T14:22:00Z",
      "settledAt": "2026-07-07T14:22:05Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 3890
  }
}
```

### GET /api/admin/transactions/{transactionId}
**Description:** Get transaction details

### POST /api/admin/transactions/{transactionId}/refund
**Description:** Process refund

**Request:**
```json
{
  "amount": 18000,
  "reason": "Customer request",
  "notify": true
}
```

---

## 🏥 System Health

### GET /api/admin/health/services
**Description:** Detailed service health status

**Response:**
```json
{
  "services": [
    {
      "name": "API Gateway",
      "status": "operational",
      "uptime": "99.98%",
      "latency": 42,
      "unit": "ms",
      "incidents": 0
    },
    {
      "name": "Database (Primary)",
      "status": "operational",
      "uptime": "99.99%",
      "latency": 8,
      "unit": "ms",
      "incidents": 0
    },
    {
      "name": "Payment Gateway",
      "status": "degraded",
      "uptime": "98.12%",
      "latency": 340,
      "unit": "ms",
      "incidents": 3
    }
  ],
  "overall": {
    "status": "degraded",
    "uptime": "99.84%",
    "avgLatency": 42,
    "openIncidents": 2,
    "errorRate": 0.16
  }
}
```

### GET /api/admin/health/incidents
**Description:** System incidents log

**Response:**
```json
[
  {
    "id": "INC-042",
    "service": "Payment Gateway",
    "description": "Elevated failure rate on MTN Mobile Money",
    "severity": "high",
    "status": "investigating",
    "createdAt": "2026-07-07T08:14:00Z",
    "updatedAt": "2026-07-07T08:20:00Z",
    "resolvedAt": null
  }
]
```

### POST /api/admin/health/incidents
**Description:** Create incident report

### PATCH /api/admin/health/incidents/{incidentId}
**Description:** Update incident status

---

## 📋 Audit Log

### GET /api/admin/audit
**Description:** Platform audit log

**Query Params:**
- `page`, `limit`
- `actor` - email/user ID
- `action` - specific action type
- `dateFrom`, `dateTo`
- `target` - resource affected

**Response:**
```json
{
  "logs": [
    {
      "id": "AUD-123",
      "actor": "admin@scanny.app",
      "actorType": "admin",
      "action": "SUSPEND_MERCHANT",
      "target": "MER-006",
      "targetType": "merchant",
      "description": "Suspended Sky Bar",
      "ipAddress": "196.0.2.1",
      "userAgent": "Mozilla/5.0...",
      "timestamp": "2026-07-07T14:32:01Z",
      "metadata": {
        "reason": "Payment issues"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 284
  },
  "summary": {
    "today": 284,
    "adminActions": 42,
    "systemEvents": 138
  }
}
```

### GET /api/admin/audit/export
**Description:** Export audit log

---

## ⚙️ System Configuration

### GET /api/admin/config
**Description:** Get system configuration

**Response:**
```json
{
  "features": {
    "ticketing": true,
    "quickPayments": true,
    "deviceRegistration": true
  },
  "limits": {
    "maxCatalogItems": 100,
    "maxPaymentMethods": 2,
    "orderTimeout": 3600
  },
  "payment": {
    "providers": ["MTN", "Airtel", "Card"],
    "currency": "UGX",
    "minAmount": 1000,
    "maxAmount": 10000000
  }
}
```

### PATCH /api/admin/config
**Description:** Update system configuration

---

## 📈 Analytics & Metrics

### GET /api/admin/analytics/tickets
**Description:** Ticketing system analytics

**Response:**
```json
{
  "summary": {
    "totalTickets": 1240,
    "activeTickets": 980,
    "redeemedTickets": 210,
    "expiredTickets": 50
  },
  "byType": [
    {
      "type": "VIP",
      "count": 420,
      "revenue": 21000000
    }
  ],
  "scanActivity": [
    { "date": "2026-07-01", "scans": 142, "successful": 138, "failed": 4 }
  ]
}
```

### GET /api/admin/analytics/quick-payments
**Description:** Quick payment codes analytics

**Response:**
```json
{
  "summary": {
    "totalCodes": 85,
    "activeCodes": 78,
    "totalTransactions": 3420,
    "totalRevenue": 17100000
  },
  "topCodes": [
    {
      "id": "QPC-001",
      "description": "Parking Fee - 2 Hours",
      "transactions": 420,
      "revenue": 2100000
    }
  ],
  "byCategory": [
    { "category": "Parking", "codes": 45, "transactions": 1890 }
  ]
}
```

### GET /api/admin/analytics/devices
**Description:** Device registration analytics

**Response:**
```json
{
  "summary": {
    "totalDevices": 2840,
    "activeDevices": 2680,
    "autoPaymentEnabled": 980,
    "averageTransactionsPerDevice": 5.2
  },
  "adoption": [
    { "date": "2026-07-01", "newDevices": 42, "autoPaymentEnabled": 18 }
  ],
  "topDevices": [
    {
      "deviceId": "DEVICE-123",
      "customerName": "John Doe",
      "transactions": 48,
      "totalSpent": 240000
    }
  ]
}
```

---

## 🔔 Notifications

### GET /api/admin/notifications
**Description:** Admin notifications

**Response:**
```json
[
  {
    "id": "NOT-123",
    "type": "payment_failure_spike",
    "title": "Payment failure rate increased",
    "message": "MTN Mobile Money failures at 12% (normal: 2%)",
    "severity": "high",
    "read": false,
    "createdAt": "2026-07-07T10:00:00Z"
  }
]
```

### PATCH /api/admin/notifications/{notificationId}/read
**Description:** Mark notification as read

---

## 📊 Catalog Management

### GET /api/admin/catalog
**Description:** Platform-wide catalog items

**Query Params:**
- `merchantId`, `category`, `available`, `search`

### GET /api/admin/catalog/stats
**Description:** Catalog statistics

**Response:**
```json
{
  "totalItems": 2480,
  "byCategory": [
    { "category": "Food", "count": 1840 },
    { "category": "Drinks", "count": 640 }
  ],
  "topItems": [
    {
      "id": "item-123",
      "name": "Beef Plate",
      "merchantName": "Kampala Grill",
      "orderCount": 420,
      "revenue": 5040000
    }
  ]
}
```

---

## 🔐 Admin Users

### GET /api/admin/admins
**Description:** List admin users

### POST /api/admin/admins
**Description:** Create admin user

### PATCH /api/admin/admins/{adminId}/permissions
**Description:** Update admin permissions

**Request:**
```json
{
  "permissions": [
    "merchants.read",
    "merchants.write",
    "orders.read",
    "users.read"
  ]
}
```

---

## 📤 Bulk Operations

### POST /api/admin/bulk/merchants/export
**Description:** Export merchants data

### POST /api/admin/bulk/users/export
**Description:** Export users data

### POST /api/admin/bulk/orders/export
**Description:** Export orders data

---

## Priority Implementation Order

### Phase 1: Core Admin (Immediate)
1. ✅ Dashboard metrics - `GET /api/admin/dashboard/metrics`
2. ✅ Merchants list - `GET /api/admin/merchants`
3. ✅ Orders list - `GET /api/admin/orders`
4. ✅ Users list - `GET /api/admin/users`
5. ✅ System status - `GET /api/admin/system/status`

### Phase 2: Management (Next)
6. ✅ Merchant details & updates
7. ✅ User management
8. ✅ Order management
9. ✅ Activity feed

### Phase 3: Analytics (Then)
10. ✅ Reports & analytics
11. ✅ Revenue & payments
12. ✅ QR activity
13. ✅ Ticket analytics
14. ✅ Device analytics

### Phase 4: Advanced (Later)
15. ✅ System health monitoring
16. ✅ Audit logging
17. ✅ Configuration management
18. ✅ Bulk operations
19. ✅ Notifications

---

## Authentication & Authorization

All admin endpoints require:
- **Authentication:** JWT token with admin role
- **Authorization:** Role-based permissions

**Headers:**
```
Authorization: Bearer {admin_jwt_token}
X-Admin-Role: superadmin | admin | support
```

**Roles:**
- `superadmin` - Full access
- `admin` - Most operations
- `support` - Read-only + limited actions

---

## Rate Limiting

- **Default:** 100 requests/minute per IP
- **Admin endpoints:** 200 requests/minute
- **Analytics/Reports:** 20 requests/minute (expensive queries)

---

## Next Steps

1. Implement Phase 1 endpoints first
2. Add admin authentication middleware
3. Set up role-based permissions
4. Implement audit logging for all admin actions
5. Add rate limiting
6. Create admin API documentation
7. Build admin SDK/client library
