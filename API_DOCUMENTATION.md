# Scanny API Documentation

Complete API reference for the Scanny QR-based payment and ordering platform.

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [Ticketing System](#ticketing-system)
3. [Quick Payment Codes](#quick-payment-codes)
4. [Device Registration](#device-registration)
5. [Business & Orders](#business--orders)
6. [Error Handling](#error-handling)

---

## Getting Started

**Base URL:** `http://localhost:4000`

**Health Check:**
```bash
GET /health
```

Response:
```json
{
  "service": "scanny-backend",
  "ok": true
}
```

---

## Ticketing System

Generate and manage one-time or multi-use QR code tickets for events.

### Create Ticket

```http
POST /api/tickets
```

**Request:**
```json
{
  "ticketType": "VIP",
  "eventName": "Tech Conference 2026",
  "eventDate": "2026-08-15T09:00:00Z",
  "holderName": "John Doe",
  "holderPhone": "+256700123456",
  "holderEmail": "john@example.com",
  "price": 50000,
  "currency": "UGX",
  "usageLimit": 1,
  "expiresAt": "2026-08-15T18:00:00Z",
  "issuedBy": "EventOrg Inc",
  "metadata": "{\"seatNumber\": \"A12\"}"
}
```

**Response:**
```json
{
  "id": "TKT-3D02AA56",
  "qrToken": "3f9b76a3387a4a8783299e8ab4ea86c6",
  "ticketType": "VIP",
  "eventName": "Tech Conference 2026",
  "status": "Active",
  "paymentStatus": "Unpaid",
  "usageCount": 0,
  "usageLimit": 1,
  "canBeUsed": false,
  "qrCodeUrl": "https://scanny.app/ticket/3f9b76a3387a4a8783299e8ab4ea86c6",
  "createdAt": "2026-07-07T08:38:49.597894Z"
}
```

### Get All Tickets

```http
GET /api/tickets
GET /api/tickets?eventName=Tech Conference 2026
```

### Get Ticket by ID

```http
GET /api/tickets/{ticketId}
```

### Get Ticket by QR Token

```http
GET /api/tickets/qr/{qrToken}
```

### Update Payment Status

```http
PATCH /api/tickets/{ticketId}/payment
```

**Request:**
```json
{
  "paymentStatus": "Paid",
  "paymentReference": "PAY-12345-MTN"
}
```

### Scan & Validate Ticket

```http
POST /api/tickets/qr/{qrToken}/scan
```

**Request:**
```json
{
  "scannedBy": "Gate Attendant",
  "scanLocation": "Main Entrance",
  "deviceInfo": "Scanner #3"
}
```

**Response:**
```json
{
  "valid": true,
  "result": "Success",
  "message": "Ticket is valid",
  "ticket": {
    "id": "TKT-3D02AA56",
    "status": "Redeemed",
    "usageCount": 1,
    "canBeUsed": false
  }
}
```

**Scan Results:**
- `Success` - Ticket valid and accepted
- `PaymentRequired` - Not paid yet
- `Expired` - Past expiration date
- `UsageLimitReached` - Already used
- `Invalid` - Cancelled or invalid

### Update Ticket Status

```http
PATCH /api/tickets/{ticketId}/status
```

**Request:**
```json
{
  "status": "Cancelled"
}
```

---

## Quick Payment Codes

Fixed-price reusable QR codes for services like parking, tips, donations.

### Create Quick Payment Code

```http
POST /api/quick-payments/codes
```

**Request:**
```json
{
  "description": "Parking Fee - 2 Hours",
  "amount": 5000,
  "currency": "UGX",
  "ownerName": "John Parking Owner",
  "ownerPhone": "+256700111222",
  "paymentDestination": "+256700111222",
  "paymentDestinationType": "MobileMoney",
  "merchantId": "merchant-123",
  "businessId": "business-456"
}
```

**Response:**
```json
{
  "id": "QPC-A8901CC8",
  "qrToken": "1c649a6b49ea4dacbb594df35ad4d94b",
  "codeType": "FixedPrice",
  "description": "Parking Fee - 2 Hours",
  "amount": 5000,
  "currency": "UGX",
  "status": "Active",
  "usageCount": 0,
  "ownerName": "John Parking Owner",
  "ownerPhone": "+256700111222",
  "paymentDestination": "+256700111222",
  "paymentDestinationType": "MobileMoney",
  "canBeUsed": true,
  "qrCodeUrl": "https://scanny.app/pay/1c649a6b49ea4dacbb594df35ad4d94b",
  "createdAt": "2026-07-07T09:05:03.972915Z"
}
```

### Get All Codes

```http
GET /api/quick-payments/codes
GET /api/quick-payments/codes?merchantId=merchant-123
GET /api/quick-payments/codes?businessId=business-456
```

### Get Code by ID

```http
GET /api/quick-payments/codes/{codeId}
```

### Get Code by QR Token

```http
GET /api/quick-payments/codes/qr/{qrToken}
```

### Initiate Payment

```http
POST /api/quick-payments/codes/qr/{qrToken}/pay
```

**Request:**
```json
{
  "customerPhone": "+256700123456",
  "customerName": "Customer 1",
  "paymentMethod": "MobileMoney",
  "location": "Kampala Parking Lot A"
}
```

**Response:**
```json
{
  "valid": true,
  "message": "Payment initiated successfully. Pay to: +256700111222",
  "code": {
    "id": "QPC-A8901CC8",
    "status": "Active",
    "usageCount": 1,
    "canBeUsed": true
  },
  "transactionRef": "TXN-1783415114368-D314AA1C"
}
```

### Complete Transaction

```http
POST /api/quick-payments/transactions/{transactionRef}/complete
```

**Request:**
```json
{
  "status": "Completed",
  "failureReason": null
}
```

### Get Transaction

```http
GET /api/quick-payments/transactions/{transactionRef}
```

### Get Code Transactions

```http
GET /api/quick-payments/codes/{codeId}/transactions
```

### Update Code Status

```http
PATCH /api/quick-payments/codes/{codeId}/status
```

**Request:**
```json
{
  "status": "Cancelled"
}
```

---

## Device Registration

Register devices and enable automatic payments.

### Register Device

```http
POST /api/devices/register
```

**Request:**
```json
{
  "deviceId": "SAMSUNG-S21-ABC123XYZ",
  "deviceName": "Samsung Galaxy S21",
  "deviceModel": "SM-G991B",
  "deviceOs": "Android 13",
  "deviceFingerprint": "...",
  "primaryPhone": "+256700123456",
  "customerName": "John Doe",
  "customerEmail": "john@example.com"
}
```

**Response:**
```json
{
  "id": "DEV-D9A9ACE7",
  "deviceId": "SAMSUNG-S21-ABC123XYZ",
  "deviceName": "Samsung Galaxy S21",
  "deviceModel": "SM-G991B",
  "deviceOs": "Android 13",
  "status": "Active",
  "primaryPhone": "+256700123456",
  "secondaryPhone": null,
  "customerName": "John Doe",
  "customerEmail": "john@example.com",
  "autoPaymentEnabled": false,
  "paymentMethods": [
    {
      "id": 1,
      "phoneNumber": "+256700123456",
      "paymentProvider": "MobileMoney",
      "accountName": "John Doe",
      "isDefault": true,
      "isVerified": false
    }
  ],
  "totalTransactions": 0,
  "completedTransactions": 0,
  "createdAt": "2026-07-07T09:23:08.060613Z"
}
```

### Get Device

```http
GET /api/devices/{deviceId}
```

### Check if Device is Registered

```http
GET /api/devices/{deviceId}/check
```

**Response:**
```json
true
```

### Add Payment Method

```http
POST /api/devices/{deviceId}/payment-methods
```

**Request:**
```json
{
  "phoneNumber": "+256700999888",
  "paymentProvider": "Airtel Money",
  "accountName": "John Doe",
  "isDefault": false
}
```

**Note:** Maximum 2 payment methods per device.

### Enable Auto-Payment

```http
POST /api/devices/{deviceId}/auto-payment
```

**Request:**
```json
{
  "enabled": true,
  "pin": "1234"
}
```

### Process Device Payment

```http
POST /api/devices/pay
```

**Request:**
```json
{
  "deviceId": "SAMSUNG-S21-ABC123XYZ",
  "referenceId": "QPC-A8901CC8",
  "referenceType": "QuickPaymentCode",
  "amount": 5000,
  "currency": "UGX",
  "paymentMethodId": 1,
  "useAutoPayment": true,
  "pin": "1234"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment initiated successfully",
  "transactionId": "1",
  "transaction": {
    "id": 1,
    "deviceId": "SAMSUNG-S21-ABC123XYZ",
    "transactionType": "Payment",
    "referenceId": "QPC-A8901CC8",
    "referenceType": "QuickPaymentCode",
    "amount": 5000,
    "currency": "UGX",
    "phoneNumber": "+256700123456",
    "status": "Pending",
    "autoPayment": true,
    "createdAt": "2026-07-07T09:23:57.092405Z"
  }
}
```

**Invalid PIN Response:**
```json
{
  "success": false,
  "message": "Invalid PIN",
  "transactionId": null,
  "transaction": null
}
```

### Get Device Transactions

```http
GET /api/devices/{deviceId}/transactions
```

---

## Business & Orders

Existing merchant catalog and order management system.

### Create Business

```http
POST /api/businesses
```

**Request:**
```json
{
  "ownerName": "Sarah",
  "businessName": "Sarah Fashion House",
  "phone": "+256701111111",
  "type": "Boutique"
}
```

### Get All Businesses

```http
GET /api/businesses
```

### Get Business by ID

```http
GET /api/businesses/{businessId}
```

### Get Business by QR Token

```http
GET /api/qr/{qrToken}
```

### Get Business Menu

```http
GET /api/businesses/{businessId}/menu?qr={qrToken}
```

### Get Business Orders

```http
GET /api/businesses/{businessId}/orders
```

### Create Order

```http
POST /api/businesses/{businessId}/orders
```

**Request:**
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

### Update Order Status

```http
PATCH /api/orders/{orderId}
```

**Request:**
```json
{
  "status": "Preparing",
  "paymentStatus": "Paid"
}
```

---

## Error Handling

All failures return a consistent JSON envelope. The `error` field remains populated for existing clients; `message` mirrors the same human-readable text.

### HTTP Status Codes

- `200 OK` - Success
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request data or validation failure
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Authenticated but not allowed
- `404 Not Found` - Resource not found
- `405 Method Not Allowed` - Unsupported HTTP method
- `409 Conflict` - Conflicts with current state
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

### Error Response Format

```json
{
  "success": false,
  "error": "Order was not found.",
  "message": "Order was not found.",
  "code": "ORDER_NOT_FOUND",
  "status": 404,
  "path": "/api/orders/abc",
  "timestamp": "2026-07-22T17:45:00Z",
  "fieldErrors": []
}
```

### Validation Error Example

```json
{
  "success": false,
  "error": "Email is required",
  "message": "Email is required",
  "code": "VALIDATION_FAILED",
  "status": 400,
  "path": "/api/auth/merchant/register",
  "timestamp": "2026-07-22T17:45:00Z",
  "fieldErrors": [
    {
      "field": "email",
      "rejectedValue": "",
      "message": "Email is required",
      "code": "NotBlank"
    }
  ]
}
```

### Stable Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `VALIDATION_FAILED` | 400 | Bean Validation / missing params |
| `INVALID_REQUEST` | 400 | Bad JSON or invalid input |
| `UNAUTHORIZED` | 401 | Missing or invalid auth |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Generic missing resource |
| `ORDER_NOT_FOUND` | 404 | Order missing |
| `BUSINESS_NOT_FOUND` | 404 | Business missing |
| `CONFLICT` | 409 | Data conflict |
| `METHOD_NOT_ALLOWED` | 405 | Wrong HTTP verb |
| `RATE_LIMITED` | 429 | Rate limit |
| `INTERNAL_ERROR` | 500 | Unexpected server failure |

---

## Integration Examples

### Complete Ticketing Flow

```bash
# 1. Create ticket
TICKET=$(curl -X POST http://localhost:4000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"ticketType":"VIP","eventName":"Concert","price":100000,"usageLimit":1}')

TICKET_ID=$(echo $TICKET | jq -r '.id')
QR_TOKEN=$(echo $TICKET | jq -r '.qrToken')

# 2. Mark as paid
curl -X PATCH http://localhost:4000/api/tickets/$TICKET_ID/payment \
  -H "Content-Type: application/json" \
  -d '{"paymentStatus":"Paid","paymentReference":"PAY-123"}'

# 3. Scan ticket at entrance
curl -X POST http://localhost:4000/api/tickets/qr/$QR_TOKEN/scan \
  -H "Content-Type: application/json" \
  -d '{"scannedBy":"Gate 1","scanLocation":"Main Entry"}'
```

### Device Registration + Quick Payment

```bash
# 1. Register device on first payment
curl -X POST http://localhost:4000/api/devices/register \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"PHONE-123","primaryPhone":"+256700123456","customerName":"John"}'

# 2. Enable auto-payment
curl -X POST http://localhost:4000/api/devices/PHONE-123/auto-payment \
  -H "Content-Type: application/json" \
  -d '{"enabled":true,"pin":"1234"}'

# 3. Quick payment for parking
curl -X POST http://localhost:4000/api/devices/pay \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"PHONE-123","referenceId":"QPC-123","referenceType":"QuickPaymentCode","amount":5000,"useAutoPayment":true,"pin":"1234"}'
```

---

## Database Schema

### Entities Overview

- **tickets** - Event tickets with QR codes
- **ticket_scans** - Scan history for tickets
- **quick_payment_codes** - Reusable payment QR codes
- **quick_payment_transactions** - Payment transactions
- **registered_devices** - Customer devices
- **device_payment_methods** - Payment methods per device (max 2)
- **device_transactions** - Device transaction history
- **businesses** - Merchant businesses
- **catalog_items** - Business menu items
- **orders** - Customer orders
- **order_line_items** - Order details

---

## Security Notes

⚠️ **Important for Production:**

1. **PIN Storage**: Current implementation uses simple hashing. Use BCrypt or Argon2 in production.
2. **Authentication**: Add JWT/OAuth for API authentication
3. **Rate Limiting**: Implement rate limiting on payment endpoints
4. **HTTPS**: Always use HTTPS in production
5. **Input Validation**: Validate all inputs server-side
6. **PCI Compliance**: Follow PCI DSS for payment card data
7. **Encryption**: Encrypt sensitive data at rest

---

## Support

For issues or questions:
- Backend running on: `http://localhost:4000`
- Health check: `http://localhost:4000/health`
- Database: PostgreSQL on `localhost:5432`

**Built with:**
- Java 21
- Spring Boot 3.4.1
- PostgreSQL 16
- Flyway (Database Migrations)
