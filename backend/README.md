# ScanIT Backend (Java + Spring Boot + PostgreSQL)

REST API for QR-linked businesses, catalog items, orders, and payments.

## Prerequisites

- Java 21+
- Maven 3.9+
- Docker (for PostgreSQL)

## Quick start

```bash
# 1. Start PostgreSQL
cd backend
docker compose up -d

# 2. Run the API (port 4000)
./mvnw spring-boot:run
```

Health check: `http://localhost:4000/health`

## Configuration

Edit `src/main/resources/application.yml`:

| Setting | Default |
|---------|---------|
| Server port | `4000` |
| Database | `jdbc:postgresql://localhost:5432/scanit` |
| DB user/password | `scanit` / `scanit` |
| Customer URL base | `https://scanit.app` |

## API endpoints

```text
GET    /health
GET    /api/businesses
POST   /api/businesses
GET    /api/qr/:qrToken
GET    /api/businesses/:businessId
GET    /api/businesses/:businessId/menu?qr=:qrToken
GET    /api/businesses/:businessId/orders
POST   /api/businesses/:businessId/orders
PATCH  /api/orders/:orderId
```

## Create business

```json
POST /api/businesses
{
  "ownerName": "Sarah",
  "businessName": "Sarah Fashion House",
  "phone": "+256701111111",
  "type": "Boutique"
}
```

## Create order

```json
POST /api/businesses/kampala-grill/orders
{
  "customer": {
    "name": "Allan",
    "phone": "+256700000000",
    "location": "Table 4",
    "note": "No onions"
  },
  "items": [
    { "itemId": "beef-plate", "quantity": 2 }
  ]
}
```

## Database

Flyway migrations live in `src/main/resources/db/migration/`. Seed data includes sample businesses from the frontend demo.
