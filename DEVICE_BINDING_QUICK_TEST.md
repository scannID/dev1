# Device Binding - Quick Testing Guide

## 🚀 Quick Start (5 Minutes)

### Prerequisites
- Backend running: `./mvnw spring-boot:run`
- Database migrated (V11 applied)
- At least one rent unit with QR token

---

## Test Scenario 1: First Scan → Binding Creation

### Step 1: Check Device (Should Fail - No Binding)
```bash
curl -v -X GET "http://localhost:8080/api/public/rent/pay/YOUR_UNIT_QR_TOKEN/check-device" \
  -H "X-Device-ID: test-device-12345"
```

**Expected Response:** `404 Not Found`
```json
{
  "decision": "FIRST_SCAN",
  "message": "No device binding exists. Please verify your phone number.",
  "action": "VERIFY_PHONE"
}
```

### Step 2: Create Binding with Phone Verification
```bash
curl -v -X POST "http://localhost:8080/api/public/rent/pay/YOUR_UNIT_QR_TOKEN/bind" \
  -H "X-Device-ID: test-device-12345" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "TENANT_PHONE_NUMBER",
    "deviceFingerprint": "{\"type\":\"mobile\",\"os\":\"Android 13\",\"browser\":\"Chrome\"}"
  }'
```

**Expected Response:** `201 Created`
```json
{
  "bindingId": 1,
  "message": "Device successfully bound. You can now make payments from this device.",
  "boundAt": "2025-01-22T12:00:00Z",
  "expiresAt": "2025-12-31T00:00:00Z"
}
```

### Step 3: Check Device Again (Should Succeed)
```bash
curl -v -X GET "http://localhost:8080/api/public/rent/pay/YOUR_UNIT_QR_TOKEN/check-device" \
  -H "X-Device-ID: test-device-12345"
```

**Expected Response:** `200 OK`
```json
{
  "decision": "ALLOWED",
  "message": "Device is bound to this QR code",
  "binding": {
    "id": 1,
    "qrToken": "...",
    "deviceId": "test-device-12345",
    "useCount": 1
  }
}
```

---

## Test Scenario 2: Device Mismatch (Security Block)

### Try with Different Device
```bash
curl -v -X GET "http://localhost:8080/api/public/rent/pay/YOUR_UNIT_QR_TOKEN/check-device" \
  -H "X-Device-ID: DIFFERENT-DEVICE-9999"
```

**Expected Response:** `403 Forbidden`
```json
{
  "decision": "DEVICE_MISMATCH",
  "message": "This payment link is already bound to another device. Contact your property manager to reset access.",
  "propertyManager": {
    "name": "John Doe",
    "phone": "+256-700-123-456",
    "whatsapp": "+256-700-123-456",
    "propertyName": "Sunrise Apartments"
  }
}
```

---

## Test Scenario 3: Admin Revocation

### Step 1: Get Bindings (As Admin)
```bash
curl -X GET "http://localhost:8080/api/rent/properties/YOUR_PROPERTY_ID/device-bindings" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Expected:** List of bindings including the one you just created

### Step 2: Revoke the Binding
```bash
curl -v -X POST "http://localhost:8080/api/rent/properties/YOUR_PROPERTY_ID/device-bindings/1/revoke" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Phone changed - testing"}'
```

**Expected Response:** `204 No Content`

### Step 3: Original Device Now Blocked
```bash
curl -v -X GET "http://localhost:8080/api/public/rent/pay/YOUR_UNIT_QR_TOKEN/check-device" \
  -H "X-Device-ID: test-device-12345"
```

**Expected Response:** `404 Not Found` (binding revoked, treated as first scan)

### Step 4: Can Rebind
Now repeat Test Scenario 1 Step 2 to create a new binding.

---

## Database Verification

### Check Binding Created
```sql
SELECT * FROM qr_device_bindings 
WHERE qr_token = 'YOUR_UNIT_QR_TOKEN' 
ORDER BY bound_at DESC;
```

### Check Unique Constraint
```sql
-- Try to create duplicate active binding (should fail)
INSERT INTO qr_device_bindings (
    qr_token, device_id, phone_number, 
    unit_id, property_id, status
) VALUES (
    'YOUR_UNIT_QR_TOKEN', 
    'another-device', 
    '+256700000000',
    'YOUR_UNIT_ID',
    'YOUR_PROPERTY_ID',
    'ACTIVE'
);
-- Expected: ERROR: duplicate key value violates unique constraint
```

### Check Audit Logs
```sql
SELECT * FROM qr_scan_audit 
WHERE token_hash = encode(sha256('YOUR_UNIT_QR_TOKEN'::bytea), 'hex')
ORDER BY scanned_at DESC 
LIMIT 10;
```

### View Statistics
```sql
SELECT * FROM device_binding_summary;
```

---

## Common Issues & Fixes

### Issue 1: "X-Device-ID header is required"
**Fix:** Add header to request:
```bash
-H "X-Device-ID: test-device-12345"
```

### Issue 2: "Phone number does not match tenant"
**Fix:** Use exact phone number from rent_tenants table:
```sql
SELECT phone_number FROM rent_tenants WHERE id = 'YOUR_TENANT_ID';
```

### Issue 3: "Device binding already exists"
**Fix:** Revoke existing binding first or use different QR token

### Issue 4: 404 on admin endpoints
**Fix:** Ensure RentAccountDetails authentication is configured

---

## Environment Variables

Add to `application.yml` or environment:
```yaml
# Optional: Custom cleanup schedules
spring:
  task:
    scheduling:
      enabled: true
```

---

## Next Steps

After successful testing:

1. ✅ Test expiry scheduled job (runs at 2 AM daily)
2. ✅ Test cleanup job (runs on 1st of month)
3. ✅ Load test: Create 100+ bindings
4. ✅ Security test: Attempt SQL injection in device_id
5. ✅ Frontend integration with device fingerprinting
6. ✅ Admin dashboard UI implementation

---

## Support

If you encounter errors:

1. Check application logs: `tail -f logs/application.log`
2. Check database: `SELECT * FROM qr_device_bindings ORDER BY id DESC LIMIT 5;`
3. Check audit logs: `SELECT * FROM qr_scan_audit WHERE outcome = 'DENIED' ORDER BY scanned_at DESC LIMIT 10;`

---

**Testing Complete!** ✅

All 3 scenarios working = System ready for production.
