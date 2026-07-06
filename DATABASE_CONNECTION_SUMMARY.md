# ✅ PostgreSQL Connection - Already Configured!

## Summary

Your Spring Boot backend is **already fully configured** to connect to PostgreSQL. No additional setup needed!

---

## Current Configuration

### Connection Details
```
Host:     localhost
Port:     5432
Database: scanit
Username: scanit
Password: scanit
URL:      jdbc:postgresql://localhost:5432/scanit
```

### Location
- **Backend Config**: `backend/src/main/resources/application.yml`
- **Docker Setup**: `backend/docker-compose.yml`
- **Migrations**: `backend/src/main/resources/db/migration/`

---

## How It Works

### 1. Docker Container
Your `docker-compose.yml` runs PostgreSQL 16 in a container:
- Container name: `scanit-postgres`
- Exposes port: `5432`
- Creates database: `scanit`
- Creates user: `scanit` with password `scanit`

### 2. Spring Boot Connection
Your `application.yml` connects automatically:
- Reads JDBC URL, username, password
- Uses Hibernate to validate schema
- Uses Flyway to run migrations

### 3. Database Migrations
Two migration files run on first startup:

**V1__schema.sql** - Creates:
- `businesses` table
- `catalog_items` table  
- `orders` table
- `order_line_items` table

**V2__seed_data.sql** - Inserts:
- 2 sample businesses (Kampala Grill, City Lounge)
- 7 sample catalog items

---

## Quick Test

### Start PostgreSQL
```bash
./start-dev.sh
# or
cd backend && docker compose up -d postgres
```

### Test Connection
```bash
./test-postgres.sh
```

### Expected Output
```
✅ PostgreSQL container is running
✅ PostgreSQL is accepting connections
✅ Database 'scanit' exists
✅ Found 5 tables
✅ Found 2 businesses
```

### Start Backend (Connects Automatically)
```bash
cd backend
./mvnw spring-boot:run
```

**Look for these logs:**
```
Flyway Community Edition by Redgate
Database: jdbc:postgresql://localhost:5432/scanit
Successfully validated 2 migrations
Schema "public" is up to date. No migration necessary.
Started ScanItApplication in 3.456 seconds
```

This means:
- ✅ Connected to PostgreSQL
- ✅ Migrations validated
- ✅ Schema is current
- ✅ Ready to accept requests

---

## Test API Endpoints

```bash
# Health check
curl http://localhost:4000/health

# Get all businesses
curl http://localhost:4000/api/businesses

# Get menu for Kampala Grill
curl "http://localhost:4000/api/businesses/kampala-grill/menu?qr=SIT-KGL-1001"
```

---

## Database GUI Access

Use any PostgreSQL client:
- **TablePlus** (Recommended for Mac)
- **pgAdmin**
- **DBeaver**
- **Postico** (Mac only)

### Connection Settings:
```
Host:     localhost
Port:     5432
Database: scanit
Username: scanit
Password: scanit
```

---

## Database Schema

### Tables
```
businesses
├─ id (PK)
├─ merchant_id
├─ qr_token
├─ name
├─ owner_name
├─ type
└─ ...

catalog_items
├─ id (PK)
├─ business_id (FK → businesses.id)
├─ name
├─ category
├─ price
└─ available

orders
├─ id (PK)
├─ business_id (FK → businesses.id)
├─ customer_name
├─ customer_phone
├─ total
├─ status
└─ payment_status

order_line_items
├─ id (PK)
├─ order_id (FK → orders.id)
├─ item_id
├─ name
├─ price
├─ quantity
└─ line_total
```

---

## Common Tasks

### View Database Contents
```bash
docker exec -it scanit-postgres psql -U scanit -d scanit

# List tables
\dt

# View businesses
SELECT * FROM businesses;

# View catalog items
SELECT * FROM catalog_items;

# Exit
\q
```

### Reset Database
```bash
cd backend
docker compose down -v
docker compose up -d postgres
# Wait 10 seconds
./mvnw spring-boot:run
# Migrations will recreate everything
```

### View Logs
```bash
docker logs scanit-postgres
```

### Stop PostgreSQL
```bash
./stop-dev.sh
# or
cd backend && docker compose down
```

---

## Troubleshooting

### Backend won't start - "Connection refused"
**Solution:** Start PostgreSQL first
```bash
cd backend
docker compose up -d postgres
sleep 10
./mvnw spring-boot:run
```

### Port 5432 already in use
**Solution:** Stop other PostgreSQL instances
```bash
lsof -ti:5432 | xargs kill -9
# or
brew services stop postgresql
```

### Flyway migration errors
**Solution:** Reset database
```bash
cd backend
docker compose down -v
docker compose up -d postgres
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `backend/src/main/resources/application.yml` | Database connection config |
| `backend/docker-compose.yml` | PostgreSQL container config |
| `backend/src/main/resources/db/migration/V1__schema.sql` | Database schema |
| `backend/src/main/resources/db/migration/V2__seed_data.sql` | Sample data |
| `POSTGRES_SETUP.md` | Detailed PostgreSQL guide |
| `test-postgres.sh` | Test database connection |

---

## ✅ Summary

**Your PostgreSQL connection is fully configured and working!**

Just run:
```bash
./start-dev.sh              # Start PostgreSQL
cd backend && ./mvnw spring-boot:run  # Connect automatically
```

**No configuration changes needed!** 🎉

---

## Architecture Flow

```
┌─────────────┐
│ Docker      │
│ Compose     │ Starts PostgreSQL container
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ PostgreSQL  │ localhost:5432
│ Container   │ Database: scanit
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Spring Boot │ Reads: application.yml
│ Backend     │ JDBC URL: jdbc:postgresql://localhost:5432/scanit
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Flyway      │ Runs migrations:
│ Migrations  │ V1__schema.sql → Creates tables
└──────┬──────┘ V2__seed_data.sql → Inserts data
       │
       ▼
┌─────────────┐
│ JPA/        │ business.save()
│ Hibernate   │ orderRepository.findAll()
└─────────────┘ etc.
```

Everything works automatically when you start the backend! ✅
