# ScanIT - Complete QR-Based Payment & Ordering Platform

A comprehensive QR code-based platform for payments, ticketing, ordering, and device registration.

## 🎯 Features

### 1. Event Ticketing System
- Generate unique QR code tickets for events
- One-time or multi-use tickets
- Payment status tracking
- Scan validation at entry points
- Prevent fraud and ticket reuse
- Expiration date support

### 2. Quick Payment Codes
- Fixed-price reusable QR codes
- Perfect for parking, tips, donations
- Permanent codes for merchants
- Payment destination configuration
- Usage analytics

### 3. Device Registration
- Register devices on first payment
- Link up to 2 mobile money numbers
- Auto-payment with PIN protection
- Quick repeat transactions
- Transaction history

### 4. Business Orders (Legacy)
- Merchant catalog management
- QR-linked ordering
- Order tracking
- Customer management

## 🚀 Quick Start

### Prerequisites

- Java 21+
- Maven 3.9+
- Node.js 18+
- PostgreSQL 16+
- Docker Desktop

### Backend Setup

```bash
cd backend

# Start PostgreSQL (using Docker)
docker compose up -d

# Run the backend
mvn spring-boot:run
```

Backend runs on: **http://localhost:4000**

Health check: `http://localhost:4000/health`

### Frontend Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Frontend runs on: **http://localhost:5173**

## 📚 Documentation

- **[Complete API Documentation](./API_DOCUMENTATION.md)** - Full API reference with all endpoints
- **[Ticketing API](./TICKETING_API.md)** - Event ticketing system guide
- **[Implementation Summary](./IMPLEMENTATION_SUMMARY.md)** - What's been built
- **[Database Setup](./DATABASE_CONNECTION_SUMMARY.md)** - Database configuration
- **[Device Registration Summary](./DEVICE_REGISTRATION_SUMMARY.md)** - Device feature overview

## 🏗️ Architecture

### Technology Stack

**Backend:**
- Java 21
- Spring Boot 3.4.1
- PostgreSQL 16
- Flyway (migrations)
- JPA/Hibernate

**Frontend:**
- React 18
- TypeScript
- Vite
- TailwindCSS

### Database Schema

```
tickets
  ├── ticket_scans
  
quick_payment_codes
  ├── quick_payment_transactions
  
registered_devices
  ├── device_payment_methods (max 2)
  └── device_transactions
  
businesses
  ├── catalog_items
  └── orders
      └── order_line_items
```

## 🔧 Configuration

### Backend Configuration

Edit `backend/src/main/resources/application.yml`:

```yaml
server:
  port: 4000

spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/scanit
    username: scanit
    password: scanit
```

### Database Migrations

Migrations in `backend/src/main/resources/db/migration/`:

- `V1__schema.sql` - Base schema (businesses, catalog, orders)
- `V2__seed_data.sql` - Sample data
- `V3__add_tickets.sql` - Ticketing system
- `V4__add_quick_payment_codes.sql` - Quick payment codes
- `V5__add_device_registration.sql` - Device registration

## 📖 API Endpoints Summary

### Ticketing
```
POST   /api/tickets                           # Create ticket
GET    /api/tickets                           # List all tickets
GET    /api/tickets/{id}                      # Get ticket by ID
GET    /api/tickets/qr/{qrToken}              # Get by QR token
POST   /api/tickets/qr/{qrToken}/scan         # Scan & validate
PATCH  /api/tickets/{id}/payment              # Update payment status
PATCH  /api/tickets/{id}/status               # Update ticket status
```

### Quick Payments
```
POST   /api/quick-payments/codes              # Create payment code
GET    /api/quick-payments/codes              # List all codes
GET    /api/quick-payments/codes/{id}         # Get code by ID
GET    /api/quick-payments/codes/qr/{token}   # Get by QR token
POST   /api/quick-payments/codes/qr/{token}/pay   # Initiate payment
POST   /api/quick-payments/transactions/{ref}/complete  # Complete payment
GET    /api/quick-payments/codes/{id}/transactions    # Get code transactions
PATCH  /api/quick-payments/codes/{id}/status  # Update code status
```

### Device Registration
```
POST   /api/devices/register                  # Register new device
GET    /api/devices/{deviceId}                # Get device details
GET    /api/devices/{deviceId}/check          # Check if registered
POST   /api/devices/{deviceId}/payment-methods    # Add payment method (max 2)
POST   /api/devices/{deviceId}/auto-payment   # Enable/disable auto-payment
POST   /api/devices/pay                       # Process device payment
GET    /api/devices/{deviceId}/transactions   # Get device transaction history
```

### Business & Orders
```
POST   /api/businesses                        # Create business
GET    /api/businesses                        # List businesses
GET    /api/businesses/{id}                   # Get business
GET    /api/qr/{qrToken}                      # Get by QR token
GET    /api/businesses/{id}/menu              # Get menu
GET    /api/businesses/{id}/orders            # Get orders
POST   /api/businesses/{id}/orders            # Create order
PATCH  /api/orders/{id}                       # Update order
```

See **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** for complete details with examples.

## 🧪 Testing Examples

### Create and Use a Ticket

```bash
# 1. Create ticket
curl -X POST http://localhost:4000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "ticketType": "VIP",
    "eventName": "Tech Conference 2026",
    "price": 50000,
    "usageLimit": 1
  }'

# 2. Mark as paid
curl -X PATCH http://localhost:4000/api/tickets/TKT-XXX/payment \
  -H "Content-Type: application/json" \
  -d '{"paymentStatus": "Paid", "paymentReference": "PAY-123"}'

# 3. Scan at entrance
curl -X POST http://localhost:4000/api/tickets/qr/TOKEN/scan \
  -H "Content-Type: application/json" \
  -d '{"scannedBy": "Gate 1", "scanLocation": "Main Entry"}'
```

### Quick Payment Flow

```bash
# 1. Parking owner creates reusable QR code
curl -X POST http://localhost:4000/api/quick-payments/codes \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Parking Fee - 2 Hours",
    "amount": 5000,
    "ownerPhone": "+256700111222",
    "paymentDestination": "+256700111222"
  }'

# 2. Customer scans and pays
curl -X POST http://localhost:4000/api/quick-payments/codes/qr/TOKEN/pay \
  -H "Content-Type: application/json" \
  -d '{
    "customerPhone": "+256700123456",
    "customerName": "John Doe"
  }'

# 3. Payment gateway completes transaction
curl -X POST http://localhost:4000/api/quick-payments/transactions/TXN-REF/complete \
  -H "Content-Type: application/json" \
  -d '{"status": "Completed"}'
```

### Device Registration + Auto-Payment

```bash
# 1. Register device
curl -X POST http://localhost:4000/api/devices/register \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "PHONE-ABC123",
    "primaryPhone": "+256700123456",
    "customerName": "John Doe"
  }'

# 2. Add second payment method
curl -X POST http://localhost:4000/api/devices/PHONE-ABC123/payment-methods \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+256700999888",
    "paymentProvider": "Airtel Money"
  }'

# 3. Enable auto-payment
curl -X POST http://localhost:4000/api/devices/PHONE-ABC123/auto-payment \
  -H "Content-Type: application/json" \
  -d '{"enabled": true, "pin": "1234"}'

# 4. Quick payment with PIN
curl -X POST http://localhost:4000/api/devices/pay \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "PHONE-ABC123",
    "referenceId": "QPC-123",
    "referenceType": "QuickPaymentCode",
    "amount": 5000,
    "useAutoPayment": true,
    "pin": "1234"
  }'
```

## 🌍 Use Cases

### 1. Parking Management
- Owner creates one permanent QR code
- Sets payment destination (mobile money number)
- Displays QR at parking entrance
- Customers scan and pay instantly
- Payment goes directly to owner
- No expiration, unlimited use

### 2. Event Ticketing
- Organizer creates tickets for event
- Customers purchase tickets online
- QR codes sent via email/SMS
- Scan tickets at entrance
- Track attendance in real-time
- Prevent duplicate entry

### 3. Quick Tipping
- Service provider creates tip QR code
- Fixed amounts (e.g., 1000, 5000, 10000)
- Customers scan and tip
- Instant transfer to provider

### 4. Device Auto-Payment
- Customer registers device on first transaction
- Links mobile money account(s)
- Enables auto-payment with PIN
- Future transactions are instant
- No need to re-enter payment details

## 🔐 Security

### Current Implementation
- ⚠️ Basic PIN hashing (NOT production-ready)
- ⚠️ No API authentication
- ⚠️ HTTP only

### Production Requirements
- ✅ BCrypt/Argon2 for password hashing
- ✅ JWT/OAuth2 authentication
- ✅ Rate limiting on payment endpoints
- ✅ HTTPS/TLS encryption
- ✅ Input validation & sanitization
- ✅ SQL injection prevention
- ✅ CSRF protection
- ✅ PCI DSS compliance

## 📊 Database

**Connection:**
```
Host: localhost
Port: 5432
Database: scanit
Username: scanit
Password: scanit
```

**Reset Database:**
```bash
cd backend
docker compose down -v
docker compose up -d
mvn spring-boot:run  # Re-applies all migrations
```

**View Tables:**
```bash
docker exec -it scanit-postgres psql -U scanit -d scanit -c "\dt"
```

## 🐛 Troubleshooting

### Backend Won't Start

```bash
# Check if PostgreSQL is running
docker ps

# Check if port 4000 is available
lsof -i :4000

# Check Java version (need 21+)
java --version

# Check logs
cd backend
mvn spring-boot:run
```

### Database Connection Error

```bash
# Verify PostgreSQL is running
docker compose ps

# Test connection
docker exec -it scanit-postgres psql -U scanit -d scanit

# Reset database
docker compose down -v
docker compose up -d
```

### Migration Errors

```sql
-- Check migration history
SELECT * FROM flyway_schema_history ORDER BY installed_rank;

-- Delete failed migration
DELETE FROM flyway_schema_history WHERE version = 'X';

-- Restart backend to reapply
```

### Port Already in Use

```bash
# Find process using port 4000
lsof -i :4000

# Kill the process
kill -9 <PID>
```

## 🛠️ Development

### Project Structure

```
scanIT/
├── src/                          # Frontend (React + TypeScript)
├── admin-console/                # Admin dashboard
├── backend/
│   ├── src/main/
│   │   ├── java/com/scanit/
│   │   │   ├── controller/       # REST controllers
│   │   │   ├── service/          # Business logic
│   │   │   ├── repository/       # Data access
│   │   │   ├── entity/           # JPA entities
│   │   │   ├── dto/              # Data transfer objects
│   │   │   └── model/enums/      # Enums
│   │   └── resources/
│   │       ├── db/migration/     # Flyway migrations
│   │       └── application.yml   # Configuration
│   └── pom.xml
├── API_DOCUMENTATION.md          # Complete API reference
├── TICKETING_API.md              # Ticketing guide
├── IMPLEMENTATION_SUMMARY.md     # Implementation details
└── README.md                     # This file
```

### Adding a New Feature

1. Create database migration in `db/migration/`
2. Create entity in `entity/`
3. Create repository interface in `repository/`
4. Create DTOs in `dto/`
5. Create service in `service/`
6. Create controller in `controller/`
7. Test with curl/Postman

### Running Tests

```bash
cd backend
mvn test
```

## 🌐 URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Backend API | http://localhost:4000 | REST API |
| Health Check | http://localhost:4000/health | System status |
| Frontend | http://localhost:5173 | Customer app |
| Admin Console | http://localhost:5174 | Admin panel |
| PostgreSQL | localhost:5432 | Database |

## 📝 What's Been Built

### ✅ Completed Features

1. **Ticketing System**
   - Create tickets with QR codes
   - Payment tracking
   - Scan validation
   - Usage limits
   - Expiration dates
   - Full scan history

2. **Quick Payment Codes**
   - Reusable QR codes
   - Fixed-price payments
   - Payment destinations
   - Unlimited usage
   - Transaction tracking

3. **Device Registration**
   - Register devices
   - 2 payment methods max
   - Auto-payment with PIN
   - Device transaction history
   - Payment method management

4. **Business System** (Legacy)
   - Business management
   - Catalog/menu items
   - Order creation
   - Order tracking

### 📈 Statistics

- **10 Repository Interfaces**
- **10+ JPA Entities**
- **5 Database Migrations**
- **30+ API Endpoints**
- **Full CRUD Operations**

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

## 📄 License

MIT License - feel free to use for personal and commercial projects.

## 👥 Support

For help:
- Check [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
- Review [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
- Test health endpoint: `curl http://localhost:4000/health`

---

**Built with:** Java 21, Spring Boot 3.4.1, PostgreSQL 16, React 18, TypeScript
