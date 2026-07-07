# Device Registration API

Enable fast, automatic payments by registering customer devices with their mobile money accounts.

## Overview

Device Registration allows customers to:
- Register their device on first payment
- Link up to 2 mobile money numbers
- Enable auto-payment with PIN protection
- Make instant repeat payments
- Skip entering payment details each time

Perfect for **frequent customers** who make regular payments (parking, events, tips, etc.).

## Key Features

✅ **One-Time Setup** - Register once, use forever
✅ **2 Payment Methods** - Link up to 2 mobile money accounts
✅ **Auto-Payment** - Enable instant payments with PIN
✅ **Transaction History** - Track all device payments
✅ **Secure** - PIN protected, device fingerprint verification
✅ **Fast** - Payments in seconds, no re-entry of details

---

## API Endpoints

### 1. Register Device

**Endpoint:** `POST /api/devices/register`

**Use Case:** Customer makes first payment and registers their device.

**Request:**
```json
{
  "deviceId": "SAMSUNG-S21-ABC123XYZ",
  "deviceName": "Samsung Galaxy S21",
  "deviceModel": "SM-G991B",
  "deviceOs": "Android 13",
  "deviceFingerprint": "sha256:abc123...",
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
  "lastUsedAt": null,
  "createdAt": "2026-07-07T09:23:08.060613Z",
  "updatedAt": null,
  "paymentMethods": [
    {
      "id": 1,
      "phoneNumber": "+256700123456",
      "paymentProvider": "MobileMoney",
      "accountName": "John Doe",
      "isDefault": true,
      "isVerified": false,
      "verifiedAt": null,
      "addedAt": "2026-07-07T09:23:08.091897Z",
      "lastUsedAt": null
    }
  ],
  "totalTransactions": 0,
  "completedTransactions": 0
}
```

**Notes:**
- Primary phone is automatically added as first payment method
- Device is set to `Active` status
- Auto-payment is disabled by default
- `deviceId` should be unique per device

---

### 2. Check if Device is Registered

**Endpoint:** `GET /api/devices/{deviceId}/check`

**Use Case:** App checks if device has been registered before.

**Example:**
```bash
curl http://localhost:4000/api/devices/SAMSUNG-S21-ABC123XYZ/check
```

**Response:**
```json
true
```

or

```json
false
```

---

### 3. Get Device Details

**Endpoint:** `GET /api/devices/{deviceId}`

**Use Case:** Retrieve device information and payment methods.

**Response:**
```json
{
  "id": "DEV-D9A9ACE7",
  "deviceId": "SAMSUNG-S21-ABC123XYZ",
  "status": "Active",
  "primaryPhone": "+256700123456",
  "secondaryPhone": "+256700999888",
  "customerName": "John Doe",
  "autoPaymentEnabled": true,
  "paymentMethods": [
    {
      "id": 1,
      "phoneNumber": "+256700123456",
      "paymentProvider": "MTN MobileMoney",
      "isDefault": true,
      "isVerified": true
    },
    {
      "id": 2,
      "phoneNumber": "+256700999888",
      "paymentProvider": "Airtel Money",
      "isDefault": false,
      "isVerified": false
    }
  ],
  "totalTransactions": 15,
  "completedTransactions": 14
}
```

---

### 4. Add Payment Method

**Endpoint:** `POST /api/devices/{deviceId}/payment-methods`

**Use Case:** Customer adds a second mobile money account.

**Request:**
```json
{
  "phoneNumber": "+256700999888",
  "paymentProvider": "Airtel Money",
  "accountName": "John Doe",
  "isDefault": false
}
```

**Response:**
```json
{
  "id": 2,
  "phoneNumber": "+256700999888",
  "paymentProvider": "Airtel Money",
  "accountName": "John Doe",
  "isDefault": false,
  "isVerified": false,
  "verifiedAt": null,
  "addedAt": "2026-07-07T09:23:32.763199Z",
  "lastUsedAt": null
}
```

**Notes:**
- Maximum 2 payment methods per device
- If `isDefault: true`, previous default is unset
- `secondaryPhone` is automatically updated

**Error Response (3rd method):**
```json
{
  "error": "Maximum 2 payment methods allowed per device"
}
```

---

### 5. Enable Auto-Payment

**Endpoint:** `POST /api/devices/{deviceId}/auto-payment`

**Use Case:** Customer enables quick payments with PIN.

**Request:**
```json
{
  "enabled": true,
  "pin": "1234"
}
```

**Response:**
```json
{
  "id": "DEV-D9A9ACE7",
  "deviceId": "SAMSUNG-S21-ABC123XYZ",
  "autoPaymentEnabled": true,
  "updatedAt": "2026-07-07T09:23:43.729097Z",
  ...
}
```

**Disable Auto-Payment:**
```json
{
  "enabled": false,
  "pin": null
}
```

**Notes:**
- PIN is hashed and stored securely
- ⚠️ Current implementation uses simple hashing (NOT production-ready)
- ✅ Use BCrypt/Argon2 in production

---

### 6. Process Device Payment

**Endpoint:** `POST /api/devices/pay`

**Use Case:** Make payment using registered device (with or without auto-payment).

#### Option A: Auto-Payment with PIN

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

**Success Response:**
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
    "createdAt": "2026-07-07T09:23:57.092405Z",
    "completedAt": null
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

#### Option B: Manual Payment (No PIN)

**Request:**
```json
{
  "deviceId": "SAMSUNG-S21-ABC123XYZ",
  "referenceId": "QPC-A8901CC8",
  "referenceType": "QuickPaymentCode",
  "amount": 5000,
  "currency": "UGX",
  "paymentMethodId": 1,
  "useAutoPayment": false,
  "pin": null
}
```

**Notes:**
- `referenceType` can be: `QuickPaymentCode`, `Ticket`, `Order`, etc.
- If `paymentMethodId` not provided, uses primary phone
- Transaction is created with `Pending` status
- Payment gateway completes the transaction

---

### 7. Get Device Transactions

**Endpoint:** `GET /api/devices/{deviceId}/transactions`

**Use Case:** View payment history for this device.

**Response:**
```json
[
  {
    "id": 1,
    "deviceId": "SAMSUNG-S21-ABC123XYZ",
    "transactionType": "Payment",
    "referenceId": "QPC-A8901CC8",
    "referenceType": "QuickPaymentCode",
    "amount": 5000,
    "currency": "UGX",
    "phoneNumber": "+256700123456",
    "status": "Completed",
    "autoPayment": true,
    "createdAt": "2026-07-07T09:23:57.092405Z",
    "completedAt": "2026-07-07T09:24:05.123456Z"
  },
  {
    "id": 2,
    "deviceId": "SAMSUNG-S21-ABC123XYZ",
    "transactionType": "Payment",
    "referenceId": "TKT-3D02AA56",
    "referenceType": "Ticket",
    "amount": 50000,
    "currency": "UGX",
    "phoneNumber": "+256700999888",
    "status": "Completed",
    "autoPayment": false,
    "createdAt": "2026-07-07T10:15:30.000000Z",
    "completedAt": "2026-07-07T10:15:45.000000Z"
  }
]
```

---

## Complete Flow Examples

### First-Time User

```bash
# Step 1: Check if device registered
curl http://localhost:4000/api/devices/PHONE-123/check
# Response: false

# Step 2: Register device on first payment
curl -X POST http://localhost:4000/api/devices/register \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "PHONE-123",
    "deviceName": "iPhone 14",
    "primaryPhone": "+256700123456",
    "customerName": "Jane Doe"
  }'

# Step 3: Make first payment (manual entry)
# ... customer enters payment details manually ...
```

### Returning User (No Auto-Payment)

```bash
# Step 1: Check if registered
curl http://localhost:4000/api/devices/PHONE-123/check
# Response: true

# Step 2: Get device details
curl http://localhost:4000/api/devices/PHONE-123

# Step 3: Show saved payment methods
# ... customer selects payment method ...

# Step 4: Process payment
curl -X POST http://localhost:4000/api/devices/pay \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "PHONE-123",
    "referenceId": "QPC-123",
    "referenceType": "QuickPaymentCode",
    "amount": 5000,
    "paymentMethodId": 1,
    "useAutoPayment": false
  }'
```

### Power User (With Auto-Payment)

```bash
# Step 1: Enable auto-payment (one-time setup)
curl -X POST http://localhost:4000/api/devices/PHONE-123/auto-payment \
  -H "Content-Type: application/json" \
  -d '{"enabled": true, "pin": "1234"}'

# Step 2: Future payments are instant
curl -X POST http://localhost:4000/api/devices/pay \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "PHONE-123",
    "referenceId": "QPC-123",
    "referenceType": "QuickPaymentCode",
    "amount": 5000,
    "useAutoPayment": true,
    "pin": "1234"
  }'
# Payment completes in seconds!
```

### Add Second Payment Method

```bash
# Add Airtel Money as backup
curl -X POST http://localhost:4000/api/devices/PHONE-123/payment-methods \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+256700999888",
    "paymentProvider": "Airtel Money",
    "isDefault": false
  }'

# Use secondary method for payment
curl -X POST http://localhost:4000/api/devices/pay \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "PHONE-123",
    "referenceId": "QPC-123",
    "referenceType": "QuickPaymentCode",
    "amount": 5000,
    "paymentMethodId": 2,
    "useAutoPayment": true,
    "pin": "1234"
  }'
```

---

## Data Model

### RegisteredDevice

```
id                  : DEV-D9A9ACE7
deviceId            : SAMSUNG-S21-ABC123XYZ (unique)
deviceName          : Samsung Galaxy S21
deviceModel         : SM-G991B
deviceOs            : Android 13
deviceFingerprint   : sha256:abc123... (for security)
status              : Active | Suspended | Blocked | Unverified
primaryPhone        : +256700123456
secondaryPhone      : +256700999888 (optional)
customerName        : John Doe
customerEmail       : john@example.com
autoPaymentEnabled  : true | false
pinHash             : HASH:1234 (hashed)
lastUsedAt          : 2026-07-07T09:23:57.092405Z
createdAt           : 2026-07-07T09:23:08.060613Z
updatedAt           : 2026-07-07T09:23:43.729097Z
```

### DevicePaymentMethod

```
id              : 1
deviceId        : DEV-D9A9ACE7
phoneNumber     : +256700123456
paymentProvider : MTN MobileMoney | Airtel Money | etc.
accountName     : John Doe
isDefault       : true | false
isVerified      : true | false
verificationCode: 123456 (optional)
verifiedAt      : 2026-07-07T09:25:00.000000Z
addedAt         : 2026-07-07T09:23:08.091897Z
lastUsedAt      : 2026-07-07T09:23:57.092405Z
```

### DeviceTransaction

```
id              : 1
deviceId        : SAMSUNG-S21-ABC123XYZ
transactionType : Payment
referenceId     : QPC-A8901CC8 | TKT-123 | ORD-456
referenceType   : QuickPaymentCode | Ticket | Order
amount          : 5000
currency        : UGX
paymentMethodId : 1
phoneNumber     : +256700123456
status          : Pending | Processing | Completed | Failed
autoPayment     : true | false
createdAt       : 2026-07-07T09:23:57.092405Z
completedAt     : 2026-07-07T09:24:05.123456Z
```

---

## Integration with Other Features

### With Quick Payment Codes

```javascript
// Customer scans parking QR code
const code = await getQuickPaymentCode(qrToken);

// Check if device registered
const isRegistered = await checkDevice(deviceId);

if (isRegistered) {
  const device = await getDevice(deviceId);
  
  if (device.autoPaymentEnabled) {
    // Show PIN prompt
    const pin = await promptForPIN();
    
    // Instant payment
    const result = await processDevicePayment({
      deviceId,
      referenceId: code.id,
      referenceType: 'QuickPaymentCode',
      amount: code.amount,
      useAutoPayment: true,
      pin
    });
  } else {
    // Show saved payment methods
    // Let customer select and confirm
  }
} else {
  // First time - register device
  // Process payment manually
}
```

### With Ticketing

```javascript
// Customer scans event ticket QR
const ticket = await getTicket(qrToken);

// Device registered and auto-payment enabled
const result = await processDevicePayment({
  deviceId,
  referenceId: ticket.id,
  referenceType: 'Ticket',
  amount: ticket.price,
  useAutoPayment: true,
  pin: userPin
});

// Ticket automatically paid and activated
```

---

## Security Considerations

### Current Implementation
- ⚠️ Simple PIN hashing (NOT production-ready)
- ⚠️ No device fingerprint verification
- ⚠️ No rate limiting on PIN attempts

### Production Requirements

1. **Password Security**
   - Use BCrypt or Argon2 for PIN hashing
   - Salt each PIN individually
   - Never store plain text PINs

2. **Device Security**
   - Verify device fingerprint on each payment
   - Detect device changes
   - Require re-registration if device changes

3. **Transaction Security**
   - Rate limit payment attempts
   - Limit PIN attempts (3-5 max)
   - Temporarily lock after failed attempts
   - Send notifications for suspicious activity

4. **Network Security**
   - Use HTTPS/TLS
   - Implement certificate pinning
   - Add API authentication (JWT/OAuth2)

5. **Data Protection**
   - Encrypt sensitive data at rest
   - Use secure key storage
   - Implement PCI DSS compliance

---

## Best Practices

### For App Developers

1. **Device ID Generation**
   - Use platform-specific IDs (Android ID, iOS UUID)
   - Include device model/OS for tracking
   - Generate secure fingerprint

2. **PIN Management**
   - Enforce strong PINs (6+ digits)
   - Allow PIN change
   - Implement forgot PIN flow

3. **User Experience**
   - Clear onboarding for device registration
   - Show payment method switching
   - Display transaction history
   - Allow disabling auto-payment easily

4. **Error Handling**
   - Handle network failures gracefully
   - Provide clear error messages
   - Allow retry mechanism

### For Backend Integration

1. **Transaction Completion**
   - Always complete transactions via webhook
   - Handle payment gateway callbacks
   - Update transaction status promptly

2. **Monitoring**
   - Track device registration rate
   - Monitor auto-payment usage
   - Alert on suspicious patterns

3. **Analytics**
   - Track payment method usage
   - Analyze auto-payment adoption
   - Monitor transaction success rates

---

## Testing

```bash
# Full flow test
DEVICE_ID="TEST-DEVICE-123"

# 1. Register
curl -X POST http://localhost:4000/api/devices/register \
  -H "Content-Type: application/json" \
  -d "{\"deviceId\":\"$DEVICE_ID\",\"primaryPhone\":\"+256700111222\",\"customerName\":\"Test User\"}"

# 2. Add second method
curl -X POST http://localhost:4000/api/devices/$DEVICE_ID/payment-methods \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+256700999888","paymentProvider":"Airtel Money"}'

# 3. Enable auto-payment
curl -X POST http://localhost:4000/api/devices/$DEVICE_ID/auto-payment \
  -H "Content-Type: application/json" \
  -d '{"enabled":true,"pin":"1234"}'

# 4. Test payment
curl -X POST http://localhost:4000/api/devices/pay \
  -H "Content-Type: application/json" \
  -d "{\"deviceId\":\"$DEVICE_ID\",\"referenceId\":\"TEST\",\"referenceType\":\"Test\",\"amount\":1000,\"useAutoPayment\":true,\"pin\":\"1234\"}"

# 5. Test wrong PIN
curl -X POST http://localhost:4000/api/devices/pay \
  -H "Content-Type: application/json" \
  -d "{\"deviceId\":\"$DEVICE_ID\",\"referenceId\":\"TEST\",\"referenceType\":\"Test\",\"amount\":1000,\"useAutoPayment\":true,\"pin\":\"9999\"}"

# 6. View transactions
curl http://localhost:4000/api/devices/$DEVICE_ID/transactions
```

---

## Troubleshooting

### Device Already Registered Error
**Problem:** Trying to register device that exists

**Solution:**
```bash
# Check if registered
curl http://localhost:4000/api/devices/DEVICE-ID/check

# If true, get device details instead
curl http://localhost:4000/api/devices/DEVICE-ID
```

### Maximum Payment Methods Error
**Problem:** Trying to add 3rd payment method

**Solution:** Remove one payment method first (API endpoint coming soon) or use existing methods.

### Invalid PIN Error
**Problem:** Wrong PIN entered

**Solution:**
- Verify PIN is correct
- Check if auto-payment is enabled
- Implement PIN reset flow in your app

### Device Not Found Error
**Problem:** Device not registered

**Solution:**
```bash
# Register device first
curl -X POST http://localhost:4000/api/devices/register \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"...","primaryPhone":"..."}'
```

---

## Future Enhancements

- [ ] Remove/update payment methods
- [ ] PIN reset via OTP
- [ ] Biometric authentication
- [ ] Transaction limits
- [ ] Spending analytics
- [ ] Device verification via SMS
- [ ] Multi-device support per customer
- [ ] Family/shared payment methods

---

For complete API documentation, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).
