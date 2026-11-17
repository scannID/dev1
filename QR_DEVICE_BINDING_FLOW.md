# QR Device Binding - Complete Flow Explanation

## Overview
Device binding ensures **one QR code = one device**. A tenant cannot share their payment QR with others or scan from multiple devices. The system tracks which device first scanned the QR and blocks all others.

---

## 🔐 How Device Binding Works

### Key Components

1. **Frontend Captures:**
   - `X-Device-ID` header - Unique device identifier (generated once, stored in browser/app)
   - `deviceFingerprint` JSON - Device details (OS, browser, model, screen size, etc.)
   - `phoneNumber` - Tenant's phone for verification

2. **Backend Stores:**
   - QR token → Device ID mapping in `qr_device_bindings` table
   - One ACTIVE binding per QR token (enforced by DB constraint)
   - Binding status: ACTIVE, REVOKED, EXPIRED

3. **Security Enforcement:**
   - Every payment page access checks device binding
   - Mismatched device = immediate block with property manager contact
   - Only admin can revoke/reset bindings

---

## 📱 Complete Flow: Tenant Scanning QR

### First Scan (No Binding Exists)

```
┌─────────────┐                  ┌─────────────┐                  ┌──────────────┐
│  Frontend   │                  │   Backend   │                  │   Database   │
│  (Mobile)   │                  │             │                  │              │
└──────┬──────┘                  └──────┬──────┘                  └──────┬───────┘
       │                                │                                │
       │ 1. Generate Device ID          │                                │
       │    (if first time)             │                                │
       │    e.g., "abc123-xyz"          │                                │
       │                                │                                │
       │ 2. GET /check-device           │                                │
       │    Header: X-Device-ID         │                                │
       ├───────────────────────────────>│                                │
       │                                │                                │
       │                                │ 3. Query binding               │
       │                                ├───────────────────────────────>│
       │                                │                                │
       │                                │ 4. No binding found            │
       │                                │<───────────────────────────────┤
       │                                │                                │
       │ 5. 404 Not Found               │                                │
       │    {"decision": "FIRST_SCAN"}  │                                │
       │<───────────────────────────────┤                                │
       │                                │                                │
       │ 6. Show phone verification UI  │                                │
       │    User enters: +256700123456  │                                │
       │                                │                                │
       │ 7. Capture device fingerprint  │                                │
       │    {type: "mobile",            │                                │
       │     os: "Android 13",          │                                │
       │     browser: "Chrome 120",     │                                │
       │     model: "Samsung A53"}      │                                │
       │                                │                                │
       │ 8. POST /bind                  │                                │
       │    Header: X-Device-ID         │                                │
       │    Body: {phoneNumber,         │                                │
       │           deviceFingerprint}   │                                │
       ├───────────────────────────────>│                                │
       │                                │                                │
       │                                │ 9. Lookup tenant by QR token   │
       │                                ├───────────────────────────────>│
       │                                │<───────────────────────────────┤
       │                                │                                │
       │                                │ 10. Verify phone matches       │
       │                                │     tenant.phone               │
       │                                │                                │
       │                                │ 11. Create binding             │
       │                                │     INSERT INTO                │
       │                                │     qr_device_bindings         │
       │                                ├───────────────────────────────>│
       │                                │                                │
       │                                │ 12. Binding created            │
       │                                │<───────────────────────────────┤
       │                                │                                │
       │                                │ 13. Log audit trail            │
       │                                │     INSERT qr_scan_audit       │
       │                                ├───────────────────────────────>│
       │                                │                                │
       │ 14. 201 Created                │                                │
       │     {bindingId: 1,             │                                │
       │      message: "Device bound",  │                                │
       │      expiresAt: ...}           │                                │
       │<───────────────────────────────┤                                │
       │                                │                                │
       │ 15. Show payment page          │                                │
       │                                │                                │
```

---

### Subsequent Scans (Same Device)

```
┌─────────────┐                  ┌─────────────┐                  ┌──────────────┐
│  Frontend   │                  │   Backend   │                  │   Database   │
└──────┬──────┘                  └──────┬──────┘                  └──────┬───────┘
       │                                │                                │
       │ 1. GET /check-device           │                                │
       │    Header: X-Device-ID:        │                                │
       │            "abc123-xyz"        │                                │
       ├───────────────────────────────>│                                │
       │                                │                                │
       │                                │ 2. Query binding               │
       │                                │    WHERE qr_token = ?          │
       │                                │    AND status = 'ACTIVE'       │
       │                                ├───────────────────────────────>│
       │                                │                                │
       │                                │ 3. Binding found               │
       │                                │    device_id = "abc123-xyz"    │
       │                                │<───────────────────────────────┤
       │                                │                                │
       │                                │ 4. Compare device IDs          │
       │                                │    Request: abc123-xyz         │
       │                                │    Stored:  abc123-xyz         │
       │                                │    ✓ MATCH                     │
       │                                │                                │
       │                                │ 5. Update last_used_at,        │
       │                                │    increment use_count         │
       │                                ├───────────────────────────────>│
       │                                │                                │
       │ 6. 200 OK                      │                                │
       │    {"decision": "ALLOWED"}     │                                │
       │<───────────────────────────────┤                                │
       │                                │                                │
       │ 7. Show payment page           │                                │
       │                                │                                │
```

---

### Different Device (Security Block)

```
┌─────────────┐                  ┌─────────────┐                  ┌──────────────┐
│  Frontend   │                  │   Backend   │                  │   Database   │
│ (Different) │                  │             │                  │              │
└──────┬──────┘                  └──────┬──────┘                  └──────┬───────┘
       │                                │                                │
       │ 1. GET /check-device           │                                │
       │    Header: X-Device-ID:        │                                │
       │            "DIFFERENT-999"     │                                │
       ├───────────────────────────────>│                                │
       │                                │                                │
       │                                │ 2. Query binding               │
       │                                │    WHERE qr_token = ?          │
       │                                │    AND status = 'ACTIVE'       │
       │                                ├───────────────────────────────>│
       │                                │                                │
       │                                │ 3. Binding found               │
       │                                │    device_id = "abc123-xyz"    │
       │                                │<───────────────────────────────┤
       │                                │                                │
       │                                │ 4. Compare device IDs          │
       │                                │    Request: DIFFERENT-999      │
       │                                │    Stored:  abc123-xyz         │
       │                                │    ✗ MISMATCH                  │
       │                                │                                │
       │                                │ 5. Get property manager        │
       │                                │    contact info                │
       │                                ├───────────────────────────────>│
       │                                │<───────────────────────────────┤
       │                                │                                │
       │                                │ 6. Log security event          │
       │                                │    INSERT qr_scan_audit        │
       │                                │    outcome = 'DENIED'          │
       │                                │    reason = 'DEVICE_MISMATCH'  │
       │                                ├───────────────────────────────>│
       │                                │                                │
       │ 7. 403 Forbidden               │                                │
       │    {"decision": "DEVICE_       │                                │
       │     MISMATCH",                 │                                │
       │     "propertyManager": {       │                                │
       │       "name": "John Doe",      │                                │
       │       "phone": "+256700...",   │                                │
       │       "whatsapp": "+256700...",│                                │
       │       "propertyName": "..."}}  │                                │
       │<───────────────────────────────┤                                │
       │                                │                                │
       │ 8. Show error screen:          │                                │
       │    "This QR is bound to        │                                │
       │     another device.            │                                │
       │     Contact: John Doe          │                                │
       │     Phone: +256700..."         │                                │
       │                                │                                │
```

---

### Admin Revocation (Phone Changed)

```
┌─────────────┐                  ┌─────────────┐                  ┌──────────────┐
│   Admin     │                  │   Backend   │                  │   Database   │
│ Dashboard   │                  │             │                  │              │
└──────┬──────┘                  └──────┬──────┘                  └──────┬───────┘
       │                                │                                │
       │ 1. POST /device-bindings/      │                                │
       │         {bindingId}/revoke     │                                │
       │    Header: Authorization       │                                │
       │    Body: {reason: "Phone       │                                │
       │           changed"}            │                                │
       ├───────────────────────────────>│                                │
       │                                │                                │
       │                                │ 2. Update binding              │
       │                                │    SET status = 'REVOKED',     │
       │                                │    revoked_at = NOW(),         │
       │                                │    revoked_by = admin_id,      │
       │                                │    revoked_reason = ?          │
       │                                ├───────────────────────────────>│
       │                                │                                │
       │                                │ 3. Binding revoked             │
       │                                │<───────────────────────────────┤
       │                                │                                │
       │ 4. 204 No Content              │                                │
       │<───────────────────────────────┤                                │
       │                                │                                │
```

After revocation, tenant's original device gets `404 FIRST_SCAN` and must rebind with new device.

---

## 🛡️ Security Features (All Backend Enforced)

### 1. Phone Verification
```java
// In QrDeviceBindingService.java line 159-166
String normalizedInput = normalizePhone(phoneNumber);
String normalizedTenant = normalizePhone(tenant.getPhone());

if (!normalizedInput.equals(normalizedTenant)) {
    log.warn("Phone number mismatch");
    auditService.logDenied(qrToken, "RENT_PAY", "BIND", request, 
        "Phone number does not match tenant");
    throw new ApiException(403, "Phone number does not match tenant");
}
```

**What This Prevents:**
- ❌ Random person scanning QR cannot bind (phone won't match)
- ❌ Tenant cannot bind someone else's device (they need tenant's phone)

---

### 2. Device ID Matching
```java
// In QrDeviceBindingService.java line 100-123
QrDeviceBinding binding = findActiveBinding(qrToken);

if (binding == null) {
    return AccessCheckResult.firstScan(); // No binding, need phone verification
}

if (!binding.getDeviceId().equals(deviceId)) {
    // SECURITY BLOCK: Different device
    PropertyManagerContact contact = getPropertyManagerContact(binding);
    auditService.logDenied(qrToken, "RENT_PAY", "ACCESS", request, 
        "Device mismatch: expected=" + binding.getDeviceId() + 
        ", got=" + deviceId);
    
    return AccessCheckResult.deviceMismatch(binding, contact);
}

// Device matches, allow access
binding.recordUse();
return AccessCheckResult.allowed(binding);
```

**What This Prevents:**
- ❌ Tenant shares QR screenshot → Second device blocked
- ❌ Tenant WhatsApps QR to friend → Friend's device blocked
- ❌ Multiple devices scanning same QR → Only first bound device works

---

### 3. Unique Constraint (Database Level)
```sql
-- In V11__qr_device_bindings.sql
CREATE UNIQUE INDEX idx_qr_device_bindings_active
ON qr_device_bindings (qr_token, status)
WHERE status = 'ACTIVE';
```

**What This Prevents:**
- ❌ Two ACTIVE bindings for same QR token (database rejects it)
- ❌ Race condition: Two simultaneous bind requests → Second fails
- ✅ Multiple REVOKED bindings allowed (history tracking)

---

### 4. Audit Logging
```java
// Every device check logged in qr_scan_audit table
auditService.logAllowed(qrToken, "RENT_PAY", "ACCESS", request);
auditService.logDenied(qrToken, "RENT_PAY", "BIND", request, "Phone mismatch");
auditService.logDenied(qrToken, "RENT_PAY", "ACCESS", request, "Device mismatch");
```

**Tracks:**
- ✅ Every successful access (device, IP, timestamp)
- ✅ Every denied access (device, IP, reason)
- ✅ Phone verification attempts
- ✅ Admin revocations

---

## 📊 Database Schema

```sql
CREATE TABLE qr_device_bindings (
    id BIGSERIAL PRIMARY KEY,
    qr_token VARCHAR(255) NOT NULL,           -- The 256-bit QR token
    device_id VARCHAR(255) NOT NULL,          -- Frontend-generated device ID
    device_fingerprint TEXT,                  -- Device details JSON
    phone_number VARCHAR(20) NOT NULL,        -- Verified phone
    
    unit_id VARCHAR(36) NOT NULL,
    property_id VARCHAR(36) NOT NULL,
    
    status VARCHAR(20) NOT NULL,              -- ACTIVE, REVOKED, EXPIRED
    bound_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP,
    
    last_used_at TIMESTAMP,
    use_count INTEGER DEFAULT 0,
    
    revoked_at TIMESTAMP,
    revoked_by VARCHAR(36),                   -- Admin who revoked
    revoked_reason VARCHAR(500),
    
    CONSTRAINT fk_unit FOREIGN KEY (unit_id) REFERENCES rent_units(id),
    CONSTRAINT fk_property FOREIGN KEY (property_id) REFERENCES rent_properties(id)
);

-- Only one ACTIVE binding per QR token
CREATE UNIQUE INDEX idx_qr_device_bindings_active
ON qr_device_bindings (qr_token, status)
WHERE status = 'ACTIVE';
```

---

## 🎯 What Frontend Must Do

### 1. Generate & Store Device ID (Once)
```javascript
// On app first launch or first QR scan
function getOrCreateDeviceId() {
  let deviceId = localStorage.getItem('scanny_device_id');
  
  if (!deviceId) {
    // Generate unique ID (UUID v4)
    deviceId = crypto.randomUUID();
    localStorage.setItem('scanny_device_id', deviceId);
  }
  
  return deviceId;
}
```

**Important:** Same device = same ID every time

---

### 2. Capture Device Fingerprint (On Binding)
```javascript
function getDeviceFingerprint() {
  return JSON.stringify({
    type: /Android|iPhone|iPad/.test(navigator.userAgent) ? 'mobile' : 'desktop',
    os: getOS(), // "Android 13", "iOS 17", "Windows 11"
    browser: getBrowser(), // "Chrome 120", "Safari 17"
    model: getDeviceModel(), // "Samsung Galaxy A53", "iPhone 14"
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language
  });
}
```

**Purpose:** Admin dashboard shows friendly device names

---

### 3. Send X-Device-ID Header (Every Request)
```javascript
// Every request to /check-device, /bind, /pay
fetch(`/api/public/rent/pay/${qrToken}/check-device`, {
  headers: {
    'X-Device-ID': getOrCreateDeviceId()
  }
});
```

**Critical:** Backend uses this to match against stored binding

---

### 4. Handle Three Access States

```javascript
async function handleQrScan(qrToken) {
  const deviceId = getOrCreateDeviceId();
  
  try {
    const response = await fetch(
      `/api/public/rent/pay/${qrToken}/check-device`,
      { headers: { 'X-Device-ID': deviceId } }
    );
    
    if (response.ok) {
      // ALLOWED: Device is bound
      const data = await response.json();
      showPaymentPage(data);
    }
    
  } catch (error) {
    if (error.status === 404) {
      // FIRST_SCAN: Show phone verification
      showPhoneVerificationScreen(qrToken, deviceId);
      
    } else if (error.status === 403) {
      // DEVICE_MISMATCH: Show error with property manager contact
      const data = await error.json();
      showDeviceMismatchError(data.propertyManager);
    }
  }
}

async function verifyPhoneAndBind(qrToken, deviceId, phoneNumber) {
  const fingerprint = getDeviceFingerprint();
  
  const response = await fetch(
    `/api/public/rent/pay/${qrToken}/bind`,
    {
      method: 'POST',
      headers: {
        'X-Device-ID': deviceId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phoneNumber,
        deviceFingerprint: fingerprint
      })
    }
  );
  
  if (response.status === 201) {
    // Binding created, now show payment page
    showPaymentPage();
  } else {
    // Phone mismatch or other error
    showError(await response.json());
  }
}
```

---

## 🔄 Complete User Journey

### Happy Path
1. **First Scan**
   - Tenant scans QR with phone
   - Frontend: Generates device ID `abc123-xyz`
   - Frontend: Calls `/check-device` with `X-Device-ID: abc123-xyz`
   - Backend: No binding exists → 404 FIRST_SCAN
   - Frontend: Shows phone verification screen
   
2. **Phone Verification**
   - Tenant enters phone: `+256700123456`
   - Frontend: Captures device fingerprint
   - Frontend: Calls `/bind` with phone + fingerprint
   - Backend: Verifies phone matches tenant in database
   - Backend: Creates binding: QR token → device ID mapping
   - Backend: 201 Created
   - Frontend: Shows payment page

3. **Subsequent Scans (Same Device)**
   - Tenant opens app again (same device)
   - Frontend: Retrieves stored device ID `abc123-xyz`
   - Frontend: Calls `/check-device`
   - Backend: Binding exists, device ID matches → 200 ALLOWED
   - Frontend: Shows payment page immediately

---

### Security Block Path
1. **Different Device**
   - Tenant screenshots QR, sends to friend
   - Friend scans with their phone
   - Friend's Frontend: Device ID `different-999`
   - Friend's Frontend: Calls `/check-device`
   - Backend: Binding exists for `abc123-xyz`, not `different-999`
   - Backend: Device mismatch → 403 FORBIDDEN
   - Friend's Frontend: Shows error screen with property manager contact

2. **Cannot Bind**
   - Friend tries phone verification screen
   - Friend enters THEIR phone: `+256788999999`
   - Frontend: Calls `/bind`
   - Backend: Phone doesn't match tenant's phone in database
   - Backend: 403 Phone mismatch
   - Friend: Blocked ✓

---

### Admin Revocation Path
1. **Tenant Lost Phone**
   - Tenant calls property manager: "Lost my phone, can't access QR"
   - Admin logs into dashboard
   - Admin navigates to: Properties → Sunrise Apartments → Device Bindings
   - Admin finds tenant's binding, clicks "Revoke"
   - Admin enters reason: "Phone lost/stolen"
   - Backend: Sets binding status = REVOKED

2. **Tenant Rebinds with New Phone**
   - Tenant scans QR with new phone
   - Frontend: New device ID `new-phone-456`
   - Frontend: Calls `/check-device`
   - Backend: Old binding REVOKED (not ACTIVE) → 404 FIRST_SCAN
   - Frontend: Shows phone verification screen
   - Tenant verifies phone → New binding created ✓

---

## 🚫 What Cannot Be Done (Even by Tenant)

| Action | Result | Reason |
|--------|--------|--------|
| Scan from 2 devices simultaneously | ❌ Second device blocked | Only 1 ACTIVE binding per QR |
| Share QR screenshot | ❌ Other device blocked | Device ID won't match |
| WhatsApp QR to family | ❌ Family blocked | Device ID won't match |
| Bind without phone | ❌ 400 Bad Request | Phone required in request |
| Bind with wrong phone | ❌ 403 Forbidden | Phone must match tenant |
| Change device without admin | ❌ Blocked on new device | Old binding still ACTIVE |
| Delete binding directly | ❌ No public endpoint | Only admin can revoke |

---

## 📋 Summary: Backend vs Frontend Responsibilities

### Backend (Enforces All Security)
✅ Validates phone matches tenant  
✅ Creates/stores device binding  
✅ Checks device ID on every access  
✅ Blocks mismatched devices  
✅ Enforces one-device-per-QR constraint  
✅ Logs all access attempts  
✅ Provides property manager contact on block  
✅ Allows admin-only revocation  

### Frontend (Provides Data)
✅ Generates stable device ID  
✅ Sends device ID in `X-Device-ID` header  
✅ Captures device fingerprint on binding  
✅ Collects phone number from user  
✅ Handles 3 states: ALLOWED, FIRST_SCAN, DEVICE_MISMATCH  
✅ Shows appropriate UI for each state  

**Backend = Enforcer**  
**Frontend = Data Provider + UI**

All security logic is server-side. Frontend cannot bypass or manipulate bindings.
