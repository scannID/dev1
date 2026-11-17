# QR Security Enhancements - Quick Start Guide

## ✅ What Was Fixed

Your QR code security has been upgraded with 4 critical improvements:

1. **🔐 256-bit Token Entropy** - Tokens are now cryptographically secure (was 48-bit, predictable)
2. **🚦 Rate Limiting** - 60 requests/minute on public endpoints, prevents brute force attacks  
3. **📊 Comprehensive Audit Logging** - Every QR scan tracked with IP, device, outcome
4. **✅ PII Minimization** - Verified that tenant data exposure is already minimal

---

## 🚀 Deployment Steps

### 1. Build the Application
```bash
cd backend
./mvnw clean package -DskipTests
```

### 2. Start with Database Migration
The migration `V10__qr_security_enhancements.sql` will run automatically on startup.

**What it does:**
- Creates `qr_scan_audit` table
- Increases token column sizes
- Adds token versioning columns
- Creates security monitoring view

### 3. Verify Migration Success
```sql
-- Check the new audit table exists
SELECT COUNT(*) FROM qr_scan_audit;

-- Check token column sizes
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'merchants' AND column_name = 'qr_code_token';
-- Should show VARCHAR(100)

-- Check security view
SELECT * FROM qr_security_summary;
```

---

## 🧪 Testing the Fixes

### Test 1: New Token Format
```bash
# Generate a new merchant QR code (via your admin UI or API)
# Check the format:
# OLD: QR-A1B2C3D4E5F6-1737513600 (28 chars, predictable)
# NEW: QR-8fK3mN9pL2dQ7xR4vT6wY1sZ5cA0hJ8bE4gU7iO9kXy (46 chars, random)
```

### Test 2: Rate Limiting
```bash
# Test public QR endpoint (should limit at 60/min)
for i in {1..70}; do
  curl -w "\nStatus: %{http_code}\n" http://localhost:8080/api/qr/test-token
  sleep 0.9
done

# Expected: First ~60 return 200, rest return 429 with:
# {
#   "error": "Rate limit exceeded",
#   "message": "Maximum 60 requests per minute. Try again later.",
#   "retryAfter": 60
# }
```

### Test 3: Audit Logging
```sql
-- Trigger some QR scans (via your app or curl)
# curl http://localhost:8080/api/qr/some-token

-- Check audit logs
SELECT * FROM qr_scan_audit ORDER BY scanned_at DESC LIMIT 10;

-- Should show:
-- ✅ Token hash (not plaintext)
-- ✅ IP address
-- ✅ User agent
-- ✅ Outcome (SUCCESS, DENIED, INVALID, etc.)
-- ✅ Timestamp
```

### Test 4: Suspicious Activity Detection
```bash
# Rapid fire scans to trigger suspicion
for i in {1..100}; do
  curl http://localhost:8080/api/qr/fake-token &
done

# Check suspicious flagging
sql> SELECT * FROM qr_scan_audit WHERE suspicious = TRUE;
# Should show entries flagged by automated detection
```

---

## 📊 New Security Monitoring

### Audit Dashboard Queries

**Daily scan summary:**
```sql
SELECT * FROM qr_security_summary 
WHERE scan_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY scan_date DESC;
```

**Failed scans by IP:**
```sql
SELECT ip_address, COUNT(*) as failed_count
FROM qr_scan_audit
WHERE outcome IN ('DENIED', 'INVALID', 'EXPIRED')
  AND scanned_at >= NOW() - INTERVAL '1 hour'
GROUP BY ip_address
HAVING COUNT(*) > 10
ORDER BY failed_count DESC;
```

**Suspicious activity:**
```sql
SELECT * FROM qr_scan_audit 
WHERE suspicious = TRUE 
ORDER BY scanned_at DESC 
LIMIT 50;
```

**QR scan rate by token type:**
```sql
SELECT 
    token_type,
    COUNT(*) as total_scans,
    COUNT(DISTINCT ip_address) as unique_ips,
    COUNT(*) FILTER (WHERE outcome = 'SUCCESS') as successful,
    COUNT(*) FILTER (WHERE outcome != 'SUCCESS') as failed
FROM qr_scan_audit
WHERE scanned_at >= NOW() - INTERVAL '24 hours'
GROUP BY token_type;
```

---

## 🔧 Configuration

### Redis (Required for Rate Limiting)

The rate limiting filter requires Redis. If Redis is not available:
- Rate limiting is **disabled** (logged as warning)
- Audit logging still works
- Deploy Redis for production use

**Redis connection:**
```yaml
# application.yml
spring:
  redis:
    host: localhost
    port: 6379
```

### Rate Limit Tuning

Edit `QrRateLimitFilter.java` to adjust limits:
```java
private static final int PUBLIC_QR_LIMIT = 60;  // Public QR scans per minute
private static final int RENT_PAY_LIMIT = 30;   // Rent payment per minute
private static final int ADMIN_LIMIT = 10;      // Admin operations per minute
```

---

## 📱 For Existing QR Codes

**Important:** Existing QR codes will continue to work.

- Old tokens (short format) are still valid
- New tokens (long format) will be generated for:
  - New merchants
  - Regenerated QR codes
  - New rent properties/units
  - New tenant pay tokens

**Migration path:**
1. Deploy the update
2. Existing QR codes keep working
3. Gradually regenerate QR codes for high-security merchants
4. Use regeneration endpoints:
   - `POST /api/merchants/{id}/qr/regenerate` - Merchant QR
   - `POST /api/rent/properties/{id}/qr/regenerate` - Property QR
   - `POST /api/rent/properties/{id}/units/{unitId}/qr/regenerate` - Unit QR

---

## 🚨 Security Monitoring Alerts

### Set up alerts for:

1. **High failure rate**
   ```sql
   -- Alert if >100 failed scans in 5 minutes
   SELECT COUNT(*) FROM qr_scan_audit 
   WHERE outcome != 'SUCCESS' 
   AND scanned_at >= NOW() - INTERVAL '5 minutes';
   ```

2. **Token enumeration**
   ```sql
   -- Alert if same token hit by >20 unique IPs in 1 hour
   SELECT token_hash, COUNT(DISTINCT ip_address) as unique_ips
   FROM qr_scan_audit
   WHERE scanned_at >= NOW() - INTERVAL '1 hour'
   GROUP BY token_hash
   HAVING COUNT(DISTINCT ip_address) > 20;
   ```

3. **Suspicious flagging**
   ```sql
   -- Alert on any suspicious=true entries
   SELECT COUNT(*) FROM qr_scan_audit 
   WHERE suspicious = TRUE 
   AND scanned_at >= NOW() - INTERVAL '5 minutes';
   ```

---

## 🗄️ Database Maintenance

### Audit Log Cleanup (Run Monthly)

```sql
-- Delete old non-suspicious logs (90 days)
-- Keep suspicious logs for 1 year
SELECT cleanup_old_qr_audit_logs();

-- Returns number of rows deleted
```

### Check Audit Table Size

```sql
SELECT 
    pg_size_pretty(pg_total_relation_size('qr_scan_audit')) as total_size,
    COUNT(*) as row_count
FROM qr_scan_audit;

-- If > 10M rows, consider partitioning by month
```

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] Application starts without errors
- [ ] Migration V10 shows as "Success" in flyway_schema_history
- [ ] qr_scan_audit table exists and is empty
- [ ] New QR codes use 46-character format (QR-...)
- [ ] Rate limiting returns 429 after limit exceeded
- [ ] Audit logs are created on QR scans
- [ ] Suspicious activity gets flagged (test with rapid scans)
- [ ] Redis is connected (check logs for "Redis not available" warning)
- [ ] Token hashes in audit (not plaintext)
- [ ] qr_security_summary view returns data

---

## 📚 Documentation

**Full details:**
- `QR_CODE_SECURITY_ANALYSIS.md` - Complete vulnerability analysis
- `QR_SECURITY_IMPLEMENTATION_SUMMARY.md` - Implementation details

**Database:**
- `V10__qr_security_enhancements.sql` - Migration script with comments

**Code:**
- `QrAuditService.java` - Audit logging with suspicious detection
- `QrRateLimitFilter.java` - Rate limiting filter
- `QrScanAudit.java` - Audit entity
- `QrCodeService.java` - Updated token generation (merchants)
- `RentPropertyService.java` - Updated token generation (rent)

---

## 🆘 Troubleshooting

### Issue: Migration fails
**Check:** Database connection in `application.yml`
**Fix:** Ensure database is running and credentials are correct

### Issue: Rate limiting not working
**Check:** Redis connection logs
**Fix:** Start Redis or set `spring.redis.host` in config

### Issue: Audit logs not appearing
**Check:** Application logs for errors in QrAuditService
**Fix:** Ensure @Async is enabled and database permissions allow INSERT

### Issue: Old QR codes not working
**This should NOT happen** - old tokens remain valid
**If it does:** Check migration didn't drop/alter token columns incorrectly

---

## 📞 Support

If you encounter issues:

1. Check application logs for errors
2. Verify database migration status: `SELECT * FROM flyway_schema_history ORDER BY installed_rank DESC;`
3. Test rate limiting with curl commands above
4. Check audit table: `SELECT * FROM qr_scan_audit LIMIT 5;`

---

**Status:** ✅ Ready for Deployment  
**Migration:** V10 (automatic on startup)  
**Breaking Changes:** None (backward compatible)  
**Next Phase:** Token rotation + HMAC signatures (see Phase 2 docs)
