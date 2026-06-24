# Scanny Backend

Small Node backend for QR-linked businesses, goods, prices, payments, and orders.

## Run

```bash
cd backend
npm run dev
```

The API runs on `http://localhost:4000` by default.

## Main endpoints

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
{
  "ownerName": "Sarah",
  "businessName": "Sarah Fashion House",
  "phone": "+256701111111",
  "type": "Boutique"
}
```

The backend generates the business ID, merchant ID, QR token, payment reference, customer URL, and starter items.

## Create order

```json
{
  "customer": {
    "name": "Allan",
    "phone": "+256700000000",
    "location": "Table 4",
    "note": "No onions"
  },
  "items": [
    {
      "itemId": "beef-plate",
      "quantity": 2
    }
  ]
}
```
