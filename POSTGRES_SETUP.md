# PostgreSQL Connection Guide

## Current Configuration ✅

Your project is already configured to connect to PostgreSQL with these settings:

### Connection Details
- **Host**: `localhost`
- **Port**: `5432`
- **Database**: `scanit`
- **Username**: `scanit`
- **Password**: `scanit`
- **JDBC URL**: `jdbc:postgresql://localhost:5432/scanit`

### Location
File: `backend/src/main/resources/application.yml`

---

## How It Works

### 1. Docker Compose Setup
Your `backend/docker-compose.yml` creates a PostgreSQL container with:
- Database name: `scanit`
- User: `scanit`
- Password: `scanit`
- Port: `5432` (mapped to localhost)

### 2. Spring Boot Auto-Configuration
Spring Boot automatically connects to PostgreSQL when you start the backend:
- Reads credentials from `application.yml`
- Connects to `jdbc:postgresql://localhost:5432/scanit`
- Uses Flyway to run database migrations

### 3. Flyway Migrations
Migrations are located in: `backend/src/main/resources/db/migration/`

**V1__schema.sql** - Creates tables:
- `businesses` - Store business information
- `catalog_items` - Store menu items
- `orders` - Store customer orders
- `order_line_items` - Store order details

**V2__seed_data.sql** - Inserts demo data:
- 2 sample businesses (Kampala Grill, City Lounge)
- 7 sample catalog items

---

## Quick Start

### 1. Start PostgreSQL
```bash
cd backend
docker compose up -d postgres
```

### 2. Verify PostgreSQL is Running
```bash
docker ps | grep postgres
```

You should see:
```
scanit-postgres   postgres:16-alpine   Up   0.0.0.0:5432->5432/tcp
```

### 3. Test Connection
```bash
docker exec -it scanit-postgres psql -U scanit -d scanit
```

You should see the PostgreSQL prompt:
```
psql (16.x)
Type "help" for help.

scanit=#
```

### 4. Check Tables
```sql
\dt
```

Expected output:
```
              List of relations
 Schema |       Name        | Type  | Owner
--------+-------------------+-------+-------
 public | businesses        | table | scanit
 public | catalog_items     | table | scanit
 public | flyway_schema_... | table | scanit
 public | order_line_items  | table | scanit
 public | orders            | table | scanit
```

### 5. Check Sample Data
```sql
SELECT id, name, type FROM businesses;
```

Expected output:
```
      id       |      name      | type
---------------+----------------+------
 kampala-grill | Kampala Grill  | Bar
 city-lounge   | City Lounge    | Bar
```

Exit psql:
```sql
\q
```

---

## Start Backend with PostgreSQL Connection

### Terminal 1: Start PostgreSQL
```bash
cd backend
docker compose up -d postgres
# Wait 5 seconds for PostgreSQL to initialize
```

### Terminal 2: Start Spring Boot
```bash
cd backend
./mvnw spring-boot:run
```

**Watch for these logs:**
```
Flyway Community Edition ... by Redgate
Database: jdbc:postgresql://localhost:5432/scanit (PostgreSQL 16.x)
Successfully validated 2 migrations
Current version of schema "public": 2
Schema "public" is up to date. No migration necessary.

Started ScanItApplication in X.XXX seconds
```

This means:
- ✅ Connected to PostgreSQL
- ✅ Migrations applied successfully
- ✅ Backend is ready

### Terminal 3: Test API
```bash
# Health check
curl http://localhost:4000/health

# Get businesses
curl http://localhost:4000/api/businesses

# Get menu for a business
curl "http://localhost:4000/api/businesses/kampala-grill/menu?qr=SIT-KGL-1001"
```

---

## Database Management

### View Logs
```bash
docker logs scanit-postgres
```

### Access Database Shell
```bash
docker exec -it scanit-postgres psql -U scanit -d scanit
```

### Common SQL Commands
```sql
-- List all tables
\dt

-- Describe a table
\d businesses

-- View businesses
SELECT * FROM businesses;

-- View catalog items
SELECT * FROM catalog_items;

-- View orders
SELECT * FROM orders;

-- Count records
SELECT COUNT(*) FROM businesses;

-- Exit
\q
```

### Reset Database (Delete All Data)
```bash
cd backend
docker compose down -v
docker compose up -d postgres
# Wait 5 seconds
./mvnw spring-boot:run
# Flyway will recreate schema and seed data
```

---

## Connection from GUI Tools

You can connect using tools like:
- **pgAdmin** (https://www.pgadmin.org/)
- **DBeaver** (https://dbeaver.io/)
- **TablePlus** (https://tableplus.com/)
- **Postico** (Mac only - https://eggerapps.at/postico/)

### Connection Settings:
- **Host**: `localhost`
- **Port**: `5432`
- **Database**: `scanit`
- **Username**: `scanit`
- **Password**: `scanit`

---

## Troubleshooting

### Issue: "Connection refused" when starting backend

**Check if PostgreSQL is running:**
```bash
docker ps | grep postgres
```

**If not running, start it:**
```bash
cd backend
docker compose up -d postgres
```

**Wait 5-10 seconds, then try again.**

---

### Issue: Port 5432 already in use

**Check what's using the port:**
```bash
lsof -ti:5432
```

**Kill the process (if it's not your Docker container):**
```bash
lsof -ti:5432 | xargs kill -9
```

**Or stop existing PostgreSQL:**
```bash
brew services stop postgresql  # If installed via Homebrew
```

---

### Issue: Flyway migration errors

**Reset the database:**
```bash
cd backend
docker compose down -v
docker compose up -d postgres
# Wait 10 seconds
./mvnw spring-boot:run
```

---

### Issue: "Schema validation failed"

This means your entity classes don't match the database schema.

**Solution 1: Reset database (development only)**
```bash
cd backend
docker compose down -v
docker compose up -d
```

**Solution 2: Create a new migration**
Create a new file: `V3__your_changes.sql` in `src/main/resources/db/migration/`

---

## Database Schema Diagram

```
businesses (Parent)
    ↓ (business_id)
catalog_items (Menu items for each business)

businesses (Parent)
    ↓ (business_id)
orders (Customer orders)
    ↓ (order_id)
order_line_items (Items in each order)
```

---

## Configuration Reference

### application.yml (Current Settings)
```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/scanit
    username: scanit
    password: scanit
  jpa:
    hibernate:
      ddl-auto: validate  # Don't auto-create tables, use Flyway
  flyway:
    enabled: true         # Run migrations on startup
```

### docker-compose.yml
```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: scanit-postgres
    environment:
      POSTGRES_DB: scanit
      POSTGRES_USER: scanit
      POSTGRES_PASSWORD: scanit
    ports:
      - "5432:5432"
```

---

## ✅ Your Setup is Complete!

The connection is already configured. Just:
1. Start PostgreSQL: `cd backend && docker compose up -d postgres`
2. Start Backend: `./mvnw spring-boot:run`
3. Migrations run automatically
4. Sample data is loaded
5. API is ready to use

**No additional configuration needed!** 🎉
