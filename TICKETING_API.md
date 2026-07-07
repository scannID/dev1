# ScanIT Ticketing API

One-time QR code ticketing system for events, conferences, and access control.

## Overview

The ticketing system allows you to:
- Generate unique QR codes for tickets
- Support one-time or multi-use tickets
- Track payment status
- Validate and scan tickets at entry points
- Prevent ticket reuse and fraud
- Set expiration dates
- Track all scan attempts

## API Endpoints

### Create Ticket
```
POST /api/tickets
```

**Request Body:**
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
  "canBeUsed": false,
  "qrCodeUrl": "https://scanit.app/ticket/3f9b76a3387a4a8783299e8ab4ea86c6"
}
```

### Get All Tickets
```
GET /api/tickets
GET /api/tickets?eventName=Tech Conference 2026
```

### Get Ticket by ID
```
GET /api/tickets/{ticketId}
```

### Get Ticket by QR Token
```
GET /api/tickets/qr/{qrToken}
```

### Update Payment Status
```
PATCH /api/tickets/{ticketId}/payment
```

**Request Body:**
```json
{
  "paymentStatus": "Paid",
  "paymentReference": "PAY-12345-MTN"
}
```

### Scan Ticket (Validate & Redeem)
```
POST /api/tickets/qr/{qrToken}/scan
```

**Request Body:**
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

### Update Ticket Status
```
PATCH /api/tickets/{ticketId}/status
```

**Request Body:**
```json
{
  "status": "Cancelled"
}
```

## Ticket Status Flow

1. **Active** - Ticket is created (default)
2. **Paid** - Payment confirmed (via payment status update)
3. **Redeemed** - Ticket has been used (usage_count >= usage_limit)
4. **Expired** - Past expiration date
5. **Cancelled** - Manually cancelled
6. **Invalid** - Other validation failures

## Scan Results

- `Success` - Ticket is valid and accepted
- `PaymentRequired` - Ticket not paid yet
- `Expired` - Past expiration date
- `UsageLimitReached` - Already used maximum times
- `Invalid` - Cancelled or invalid ticket

## Validation Rules

A ticket can be used when:
- ✅ Status is `Active`
- ✅ Payment status is `Paid`
- ✅ Not expired (`expiresAt` is in the future or null)
- ✅ Usage count is less than usage limit

## Use Cases

### 1. Event Ticketing (One-Time Use)
```json
{
  "ticketType": "General Admission",
  "eventName": "Music Festival 2026",
  "eventDate": "2026-08-20T14:00:00Z",
  "price": 75000,
  "usageLimit": 1,
  "expiresAt": "2026-08-21T02:00:00Z"
}
```

### 2. Multi-Day Pass
```json
{
  "ticketType": "3-Day Pass",
  "eventName": "Workshop Series",
  "price": 150000,
  "usageLimit": 3,
  "expiresAt": "2026-09-30T23:59:59Z"
}
```

### 3. Access Control
```json
{
  "ticketType": "Building Access",
  "eventName": "Office Entry",
  "holderName": "Employee Name",
  "price": 0,
  "usageLimit": 999,
  "expiresAt": "2027-12-31T23:59:59Z"
}
```

## Database Schema

### tickets
- `id` - Unique ticket ID (TKT-XXXXXXXX)
- `qr_token` - Unique QR code token
- `ticket_type` - Type of ticket (VIP, General, etc.)
- `event_name` - Event name
- `event_date` - Event date/time
- `holder_name` - Ticket holder name
- `holder_phone` - Ticket holder phone
- `holder_email` - Ticket holder email
- `price` - Ticket price (in cents/minor units)
- `currency` - Currency code (UGX, USD, etc.)
- `status` - Ticket status enum
- `usage_limit` - How many times can be used
- `usage_count` - How many times has been used
- `expires_at` - Expiration timestamp
- `payment_reference` - Payment transaction reference
- `payment_status` - Payment status enum
- `issued_by` - Who issued the ticket
- `metadata` - JSON metadata
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp
- `redeemed_at` - When fully redeemed

### ticket_scans
- `id` - Scan record ID
- `ticket_id` - Reference to ticket
- `scanned_at` - Scan timestamp
- `scanned_by` - Who scanned it
- `scan_location` - Where it was scanned
- `device_info` - Scanner device info
- `scan_result` - Result of the scan

## Testing Examples

### Create and scan a ticket
```bash
# 1. Create ticket
TICKET=$(curl -s -X POST http://localhost:4000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "ticketType": "VIP",
    "eventName": "Concert",
    "price": 100000,
    "usageLimit": 1
  }')

TICKET_ID=$(echo $TICKET | jq -r '.id')
QR_TOKEN=$(echo $TICKET | jq -r '.qrToken')

# 2. Mark as paid
curl -X PATCH http://localhost:4000/api/tickets/$TICKET_ID/payment \
  -H "Content-Type: application/json" \
  -d '{"paymentStatus": "Paid", "paymentReference": "PAY-123"}'

# 3. Scan ticket
curl -X POST http://localhost:4000/api/tickets/qr/$QR_TOKEN/scan \
  -H "Content-Type: application/json" \
  -d '{"scannedBy": "Gate 1", "scanLocation": "Main Entry"}'
```

## Next Steps

Future enhancements could include:
- QR code image generation
- Email/SMS ticket delivery
- Bulk ticket creation
- Transfer ticket ownership
- Refund/cancellation workflow
- Analytics dashboard
- Integration with payment gateways
