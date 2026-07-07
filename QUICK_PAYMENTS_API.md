# Quick Payment Codes API

Fixed-price reusable QR codes for services like parking, tips, and donations.

## Overview

Quick Payment Codes allow merchants/service providers to create permanent QR codes that customers can scan repeatedly to make fixed-price payments. Perfect for:

- **Parking fees** - One QR code per parking lot
- **Tips** - Fixed tip amounts for service staff
- **Donations** - Preset donation amounts
- **Entry fees** - Fixed entrance prices
- **Quick purchases** - Coffee, snacks, etc.

## Key Features

✅ **Reusable** - Same QR code used by multiple customers
✅ **Fixed Price** - Amount is preset, cannot be changed
✅ **Direct Payment** - Money goes to specified destination
✅ **No Expiration** - Code stays active forever
✅ **Usage Tracking** - Track how many times code is used
✅ **Simple Setup** - Create once, use forever

## API Endpoints

### 1. Create Quick Payment Code

**Endpoint:** `POST /api/quick-payments/codes`

**Use Case:** Parking owner creates a permanent QR code for their lot.

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
  "merchantId": null,
  "businessId": null,
  "metadata": null
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
  "qrCodeUrl": "https://scanit.app/pay/1c649a6b49ea4dacbb594df35ad4d94b",
  "createdAt": "2026-07-07T09:05:03.972915Z",
  "updatedAt": null,
  "lastUsedAt": null
}
```

**Save the `qrToken` to generate QR code for display!**

---

### 2. Get Code Details

**Endpoint:** `GET /api/quick-payments/codes/qr/{qrToken}`

**Use Case:** Customer scans QR code and app retrieves payment details.

**Example:**
```bash
curl http://localhost:4000/api/quick-payments/codes/qr/1c649a6b49ea4dacbb594df35ad4d94b
```

**Response:** Same as create response, updated with current usage stats.

---

### 3. Initiate Payment

**Endpoint:** `POST /api/quick-payments/codes/qr/{qrToken}/pay`

**Use Case:** Customer confirms payment after scanning QR code.

**Request:**
```json
{
  "customerPhone": "+256700123456",
  "customerName": "Customer Name",
  "paymentMethod": "MobileMoney",
  "deviceInfo": "Samsung Galaxy S21",
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

**Important:** 
- `transactionRef` is used to complete the payment
- Code remains `Active` and `canBeUsed: true`
- `usageCount` increments after payment completion

---

### 4. Complete Transaction

**Endpoint:** `POST /api/quick-payments/transactions/{transactionRef}/complete`

**Use Case:** Payment gateway confirms successful payment.

**Request:**
```json
{
  "status": "Completed",
  "failureReason": null
}
```

**Status Options:**
- `Completed` - Payment successful
- `Failed` - Payment failed
- `Cancelled` - Payment cancelled

**Response:**
```json
{
  "id": 1,
  "codeId": "QPC-A8901CC8",
  "transactionRef": "TXN-1783415114368-D314AA1C",
  "amount": 5000,
  "currency": "UGX",
  "customerPhone": "+256700123456",
  "customerName": "Customer Name",
  "paymentMethod": "MobileMoney",
  "paymentProvider": "",
  "status": "Completed",
  "deviceInfo": "Samsung Galaxy S21",
  "location": "Kampala Parking Lot A",
  "createdAt": "2026-07-07T09:05:14.368150Z",
  "completedAt": "2026-07-07T09:05:25.492104Z",
  "failedAt": null,
  "failureReason": null
}
```

---

### 5. Get Code Transactions

**Endpoint:** `GET /api/quick-payments/codes/{codeId}/transactions`

**Use Case:** View all payments made with this QR code.

**Response:**
```json
[
  {
    "id": 1,
    "codeId": "QPC-A8901CC8",
    "transactionRef": "TXN-1783415114368-D314AA1C",
    "amount": 5000,
    "currency": "UGX",
    "customerPhone": "+256700123456",
    "status": "Completed",
    "createdAt": "2026-07-07T09:05:14.368150Z",
    "completedAt": "2026-07-07T09:05:25.492104Z"
  },
  {
    "id": 2,
    "codeId": "QPC-A8901CC8",
    "transactionRef": "TXN-1783415138926-552A5AAF",
    "amount": 5000,
    "currency": "UGX",
    "customerPhone": "+256700999888",
    "status": "Completed",
    "createdAt": "2026-07-07T09:05:38.929620Z",
    "completedAt": "2026-07-07T09:05:45.123456Z"
  }
]
```

---

### 6. List All Codes

**Endpoint:** `GET /api/quick-payments/codes`

**Query Parameters:**
- `merchantId` - Filter by merchant
- `businessId` - Filter by business

**Examples:**
```bash
GET /api/quick-payments/codes
GET /api/quick-payments/codes?merchantId=merchant-123
GET /api/quick-payments/codes?businessId=business-456
```

---

### 7. Update Code Status

**Endpoint:** `PATCH /api/quick-payments/codes/{codeId}/status`

**Use Case:** Disable a QR code (e.g., parking lot closed).

**Request:**
```json
{
  "status": "Cancelled"
}
```

**Status Options:**
- `Active` - Code is usable
- `Cancelled` - Code is disabled
- `Invalid` - Code is invalid

---

## Complete Flow Example

### Parking Scenario

**Step 1: Owner Creates QR Code**
```bash
curl -X POST http://localhost:4000/api/quick-payments/codes \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Parking - 2 Hours",
    "amount": 5000,
    "currency": "UGX",
    "ownerPhone": "+256700111222",
    "paymentDestination": "+256700111222",
    "paymentDestinationType": "MTN MobileMoney"
  }'
```

**Step 2: Generate & Display QR Code**
- Use `qrToken` from response
- Generate QR code image (frontend)
- Display at parking entrance

**Step 3: Customer 1 Scans & Pays**
```bash
# Get payment details
curl http://localhost:4000/api/quick-payments/codes/qr/TOKEN

# Initiate payment
curl -X POST http://localhost:4000/api/quick-payments/codes/qr/TOKEN/pay \
  -H "Content-Type: application/json" \
  -d '{
    "customerPhone": "+256700123456",
    "customerName": "John Doe"
  }'

# Payment gateway completes
curl -X POST http://localhost:4000/api/quick-payments/transactions/TXN-REF/complete \
  -H "Content-Type: application/json" \
  -d '{"status": "Completed"}'
```

**Step 4: Customer 2 Uses Same QR Code**
- Scan same QR code
- Different transaction created
- Code remains active
- Owner receives another payment

**Step 5: Owner Views Statistics**
```bash
curl http://localhost:4000/api/quick-payments/codes/QPC-ID/transactions
```

---

## Data Model

### QuickPaymentCode

```
id                    : QPC-A8901CC8
qrToken              : 1c649a6b49ea4dacbb594df35ad4d94b
codeType             : FixedPrice
description          : Parking Fee - 2 Hours
amount               : 5000 (in minor units, e.g., cents)
currency             : UGX
status               : Active | Cancelled | Invalid
usageCount           : 0, 1, 2, ... (increments with each payment)
ownerName            : John Parking Owner
ownerPhone           : +256700111222
paymentDestination   : +256700111222 (where money goes)
paymentDestinationType : MobileMoney | Bank | Other
merchantId           : optional
businessId           : optional
metadata             : optional JSON
createdAt            : 2026-07-07T09:05:03.972915Z
updatedAt            : 2026-07-07T09:05:25.492104Z
lastUsedAt           : 2026-07-07T09:05:25.492104Z
```

### QuickPaymentTransaction

```
id                 : 1
codeId             : QPC-A8901CC8
transactionRef     : TXN-1783415114368-D314AA1C
amount             : 5000
currency           : UGX
customerPhone      : +256700123456
customerName       : John Doe
paymentMethod      : MobileMoney
paymentProvider    : MTN
status             : Pending | Processing | Completed | Failed
deviceInfo         : Samsung Galaxy S21
location           : Kampala Parking Lot A
createdAt          : 2026-07-07T09:05:14.368150Z
completedAt        : 2026-07-07T09:05:25.492104Z
failedAt           : null
failureReason      : null
```

---

## Use Cases

### 1. Parking Management
- Owner: Creates one QR code per parking lot
- Display: Print QR code at entrance
- Customers: Scan and pay each visit
- Benefits: No attendant needed, automatic tracking

### 2. Tip Jar
- Service staff: Create QR code for tips
- Amount: Fixed (e.g., 1000, 5000, 10000)
- Display: Table tent, badge, poster
- Customers: Scan to leave tip

### 3. Donations
- Organization: Create QR codes for donation amounts
- Options: Multiple codes for different amounts
- Display: Website, social media, posters
- Donors: Scan and donate instantly

### 4. Quick Sales
- Vendor: Create QR code for product (e.g., water bottle)
- Price: Fixed (e.g., 1500 UGX)
- Display: Product label
- Customers: Scan and pay

---

## Important Notes

### Security
- ⚠️ Code can be used by anyone with QR token
- ⚠️ No authentication required to initiate payment
- ✅ Payment confirmation happens at gateway level
- ✅ Each transaction is tracked separately

### Best Practices
1. **Monitor Usage**: Check `usageCount` regularly
2. **Secure Display**: Place QR codes in visible but secure locations
3. **Track Transactions**: Review transaction history for reconciliation
4. **Update Status**: Disable codes when not needed
5. **Clear Description**: Help customers understand what they're paying for

### Limitations
- No expiration dates (code is permanent)
- No usage limits (can be used unlimited times)
- Amount is fixed (cannot vary per transaction)
- Anyone can initiate payment with QR token

---

## Testing

```bash
# Create code
CODE=$(curl -s -X POST http://localhost:4000/api/quick-payments/codes \
  -H "Content-Type: application/json" \
  -d '{"description":"Test","amount":1000,"ownerPhone":"+256700111222","paymentDestination":"+256700111222"}')

QR_TOKEN=$(echo $CODE | jq -r '.qrToken')
CODE_ID=$(echo $CODE | jq -r '.id')

# Test payment flow
curl -X POST http://localhost:4000/api/quick-payments/codes/qr/$QR_TOKEN/pay \
  -H "Content-Type: application/json" \
  -d '{"customerPhone":"+256700123456","customerName":"Test User"}'

# View transactions
curl http://localhost:4000/api/quick-payments/codes/$CODE_ID/transactions
```

---

## Integration with Device Registration

Quick Payment Codes can be integrated with Device Registration for even faster payments:

1. Customer scans QR code
2. App detects registered device
3. Shows saved payment methods
4. One-tap payment with PIN
5. No need to enter phone number again

See [DEVICE_REGISTRATION_API.md](./DEVICE_REGISTRATION_API.md) for details.
