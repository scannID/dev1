# ScanIT Quick Reference

Fast access to all essential information.

---

## 🚀 Quick Start

```bash
# 1. Start services
cd backend && docker compose up -d

# 2. Start backend
mvn spring-boot:run

# 3. Test endpoints
./test-client-api-endpoints.sh
```

---

## 🔗 URLs

| Service | URL | Port |
|---------|-----|------|
| Backend API | http://localhost:4000 | 4000 |
| Health Check | http://localhost:4000/health | 4000 |
| PostgreSQL | localhost:5432 | 5432 |
| Keycloak | http://localhost:8080 | 8080 |
| Main App | http://localhost:5173 | 5173 |
| Admin Console | http://localhost:5174 | 5174 |

---

## 🗄️ Database

**Connection:**
```
Host: localhost
Port: 5432
Database: scanit
User: scanit
Password: scanit
```

**Tables:** 11 (businesses, catalog_items, orders, tickets, devices, etc.)

---

## 📡 API Endpoints Summary

### Business & Orders (11 endpoints)
```
GET    /api/businesses
POST   /api/businesses
GET    /api/businesses/{id}
GET    /api/qr/{token}
GET    /api/businesses/{id}/menu
GET    /api/businesses/{id}/orders
POST   /api/businesses/{id}/orders
GET    /api/businesses/{id}/catalog
POST   /api/businesses/{id}/catalog
PATCH  /api/businesses/{id}/catalog/{itemId}
DELETE /api/businesses/{id}/catalog/{itemId}
```

### Tickets (6 endpoints)
```
GET    /api/tickets
POST   /api/tickets
GET    /api/tickets/{id}
POST   /api/tickets/scan/{qrToken}
PATCH  /api/tickets/{id}/status
PATCH  /api/tickets/{id}/payment
```

### Quick Payments (5 endpoints)
```
GET    /api/quick-payments/codes
POST   /api/quick-payments/codes
GET    /api/quick-payments/codes/{id}
POST   /api/quick-payments/pay/{codeId}
GET    /api/quick-payments/transactions
```

### Device Registration (7 endpoints)
```
POST   /api/devices/register
GET    /api/devices/{deviceId}
POST   /api/devices/{deviceId}/payment-methods
POST   /api/devices/{deviceId}/enable-auto-payment
POST   /api/devices/{deviceId}/pay
GET    /api/devices/{deviceId}/transactions
DELETE /api/devices/{deviceId}/payment-methods/{methodId}
```

### Admin (15 endpoints)
```
GET    /api/admin/dashboard/metrics
GET    /api/admin/dashboard/activity
GET    /api/admin/dashboard/top-merchants
GET    /api/admin/merchants
GET    /api/admin/merchants/{id}
GET    /api/admin/orders
GET    /api/admin/system/status
GET    /api/admin/analytics/tickets
GET    /api/admin/analytics/quick-payments
GET    /api/admin/analytics/devices
GET    /api/admin/revenue/overview
PATCH  /api/orders/{id}/status
PATCH  /api/orders/{id}/payment
DELETE /api/businesses/{id}/orders/completed
PATCH  /api/admin/merchants/{id}
```

**Total:** 44 endpoints

---

## 🧪 Quick Tests

### Create Business
```bash
curl -X POST http://localhost:4000/api/businesses \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Cafe","ownerName":"Owner","phone":"+256700","type":"Restaurant","tableLabel":"Table"}'
```

### Add Catalog Item
```bash
curl -X POST http://localhost:4000/api/businesses/kampala-grill/catalog \
  -H "Content-Type: application/json" \
  -d '{"name":"Coffee","category":"Drinks","price":5000,"available":true}'
```

### Create Order
```bash
curl -X POST http://localhost:4000/api/businesses/kampala-grill/orders \
  -H "Content-Type: application/json" \
  -d '{"customer":{"name":"John"},"items":[{"id":"beef-plate","quantity":1}]}'
```

### Update Order Status
```bash
curl -X PATCH http://localhost:4000/api/orders/ORD-123/status \
  -H "Content-Type: application/json" \
  -d '{"status":"Preparing"}'
```

---

## 📚 Documentation Files

| File | Description |
|------|-------------|
| API_DOCUMENTATION.md | Complete API reference |
| ADMIN_IMPLEMENTATION_SUMMARY.md | Admin API guide |
| PHASE_1_IMPLEMENTATION_COMPLETE.md | Client app endpoints |
| TICKETING_API.md | Event ticketing guide |
| QUICK_PAYMENTS_API.md | Quick payments guide |
| DEVICE_REGISTRATION_API.md | Device registration guide |
| CLIENT_APP_API_REQUIREMENTS.md | Frontend requirements |
| IMPLEMENTATION_STATUS.md | Current status |
| DOCUMENTATION_INDEX.md | All docs index |

---

## 🔧 Common Commands

### Backend
```bash
cd backend
mvn spring-boot:run           # Start backend
mvn clean install             # Build
./test-admin-endpoints.sh     # Test admin
./test-client-api-endpoints.sh # Test client
```

### Database
```bash
docker compose up -d          # Start DB + Keycloak
docker compose down           # Stop services
docker compose logs postgres  # View DB logs
psql -h localhost -U scanit -d scanit  # Connect to DB
```

### Frontend
```bash
npm install                   # Install deps
npm run dev                   # Start main app (5173)
cd admin-console && npm run dev  # Start admin (5174)
```

---

## 🎯 Feature Status

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| Business Management | ✅ | ⚠️ | Ready |
| Catalog Management | ✅ | ⚠️ | Ready |
| Order Management | ✅ | ⚠️ | Ready |
| Event Tickets | ✅ | ✅ | Ready |
| Quick Payments | ✅ | ❌ | Ready |
| Device Registration | ✅ | ❌ | Ready |
| Admin Dashboard | ✅ | ⚠️ | Ready |
| Admin Analytics | ✅ | ⚠️ | Ready |

**Legend:** ✅ Complete | ⚠️ Partial | ❌ Not Started

---

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check if port 4000 is free
lsof -i :4000
# Check DB connection
docker ps
```

### Database connection error
```bash
# Restart PostgreSQL
docker compose restart postgres
# Check credentials in application.yml
```

### Orders not appearing
```bash
# Check order creation
curl http://localhost:4000/api/businesses/kampala-grill/orders
```

---

## 📞 Quick Help

| Issue | Solution |
|-------|----------|
| Port already in use | `lsof -i :4000` then kill process |
| DB connection failed | Check Docker: `docker ps` |
| Compile errors | `mvn clean install` |
| 404 Not Found | Check endpoint URL in docs |
| No test data | Run test scripts to create data |

---

## 🎉 Quick Wins

**Test the system in 2 minutes:**

```bash
# 1. Health check
curl http://localhost:4000/health

# 2. List businesses
curl http://localhost:4000/api/businesses

# 3. Run full test
./test-client-api-endpoints.sh

# 4. Check admin metrics
curl http://localhost:4000/api/admin/dashboard/metrics
```

---

**Version:** 1.0.0  
**Last Updated:** July 7, 2026  
**Status:** Production Ready 🚀
