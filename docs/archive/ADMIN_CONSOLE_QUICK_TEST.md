# Admin Console Quick Test Guide

## 🚀 Quick Start (5 minutes)

### Step 1: Start Backend (if not already running)
```bash
# Terminal 1: Docker services
cd backend
docker-compose up -d

# Terminal 2: Spring Boot
cd backend
mvn spring-boot:run
```

**Wait for:** `Started ScanitApplication` message

### Step 2: Start Admin Console
```bash
# Terminal 3: Admin Console
cd admin-console
npm run dev
```

**Open:** http://localhost:5174

---

## ✅ Test Checklist

### Test 1: Overview Page (/overview)
- [ ] Page loads without errors
- [ ] Shows "Loading dashboard..." briefly
- [ ] Displays 4 metric cards with numbers
- [ ] Shows platform activity list
- [ ] Shows top merchants table
- [ ] Metrics are numbers from backend (not hardcoded)

**Expected:** Dashboard with real-time metrics

### Test 2: Merchants Page (/merchants)
- [ ] Page loads without errors
- [ ] Shows 4 summary cards (Total, Active, Pending, Suspended)
- [ ] Displays merchants table with data
- [ ] Search box filters merchants
- [ ] Status badges show correct colors
- [ ] Revenue shows as "UGX X.XM"

**Expected:** Table with actual merchants from database

### Test 3: Orders Page (/orders)
- [ ] Page loads without errors
- [ ] Shows 4 metric cards (Total, Completed, Pending, Cancelled)
- [ ] Displays orders table
- [ ] Search box filters orders
- [ ] Status and payment badges visible
- [ ] Order IDs match format "ORD-XXXXX"

**Expected:** Platform-wide orders feed

---

## 🔍 API Verification

### Check Backend Health
```bash
curl http://localhost:4000/health
```
**Expected:** `{"status":"UP"}`

### Check Dashboard API
```bash
curl http://localhost:4000/api/admin/dashboard
```
**Expected:** JSON with metrics object

### Check Merchants API
```bash
curl http://localhost:4000/api/admin/merchants
```
**Expected:** JSON with merchants array

### Check Orders API
```bash
curl http://localhost:4000/api/admin/orders
```
**Expected:** JSON with orders array

---

## 🐛 Common Issues & Fixes

### Issue: "Loading..." never disappears
**Cause:** Backend not running or wrong port
**Fix:**
```bash
# Check if backend is running
lsof -i :4000

# If not running, start it
cd backend && mvn spring-boot:run
```

### Issue: Shows error message
**Cause:** API endpoint returning error
**Fix:** Check backend console for errors. Ensure database is running:
```bash
docker ps | grep postgres
```

### Issue: Shows fallback data
**Cause:** Backend not responding
**Fix:** Verify backend URL in `.env`:
```bash
cat admin-console/.env
# Should show: VITE_API_BASE_URL=http://localhost:4000/api
```

### Issue: CORS errors in browser console
**Cause:** Admin console running on unexpected port
**Fix:** Backend CORS configured for port 5174. If using different port, update `backend/src/main/java/com/scanit/config/WebConfig.java`

---

## 📊 Expected Data

### Dashboard Metrics (Example)
```
Total Merchants: ~10-150
Orders Today: ~50-2000
Active QR Scans: ~1000-10000
Platform Revenue: UGX 1M - 10M
```

### Merchants Table
Should show:
- Merchant IDs (MER-XXX)
- Business names
- Owner names
- Types (Restaurant, Bar, etc.)
- Order counts
- Revenue amounts
- Status badges (Active, Warning, etc.)

### Orders Table
Should show:
- Order IDs (ORD-XXXXX)
- Business names
- Customer names
- Item counts (1-10)
- Total amounts (UGX)
- Payment status (Paid/Unpaid)
- Order status (Pending/Completed/etc.)

---

## 🎯 Success Indicators

### ✅ Integration Working
- No console errors
- Real data from backend displaying
- Search/filter working
- Loading states appear briefly
- All tables populated

### ❌ Integration NOT Working
- Console errors about fetch/CORS
- "Loading..." stuck forever
- Shows "Error: Failed to load..." messages
- Empty tables with no data
- Hardcoded mock data showing

---

## 🔄 Testing Offline Mode

### Test Fallback Behavior
1. **Start admin console** - Should load normally
2. **Stop backend** - `Ctrl+C` in backend terminal
3. **Refresh admin page** - Should show error but still display fallback data
4. **Start backend again** - Refresh, should load real data

**Expected:** App remains functional even when backend is down

---

## 📱 Mobile Testing

Open on mobile/tablet to verify:
- [ ] Tables are responsive
- [ ] Search works on mobile
- [ ] Cards stack vertically
- [ ] No horizontal scroll
- [ ] Touch interactions work

---

## 🎨 Visual Verification

### Overview Page Should Show:
- 4 colored metric cards with sparklines
- System status indicators (green dots)
- Activity feed with icons and timestamps
- Top merchants table with badges

### Merchants Page Should Show:
- Summary cards at top
- Search bar with icon
- "Add merchant" button
- Table with hover effects
- Status badges (green/amber/red)

### Orders Page Should Show:
- Metric cards with totals
- Search functionality
- Orders table
- Status badges for payment and order status
- Time stamps for each order

---

## 💡 Tips

1. **Check Network Tab** - Open browser DevTools → Network tab to see API calls
2. **Check Console** - Look for any red errors
3. **Compare with Mock Data** - If numbers match `MERCHANTS` array in code, API not working
4. **Test Search** - Search for merchant/order name to verify filtering
5. **Refresh Often** - Hard refresh (Cmd+Shift+R / Ctrl+Shift+R) to clear cache

---

## 📸 Screenshot Comparison

### Before Integration (Mock Data)
- Shows exact same data every time
- Numbers never change
- No loading states

### After Integration (Real Data)
- Shows actual database data
- Numbers reflect real business activity
- Brief loading state on page load
- Data changes as backend data changes

---

## ⚡ Quick Smoke Test (30 seconds)

```bash
# 1. Backend running?
curl http://localhost:4000/health

# 2. Admin console running?
curl http://localhost:5174

# 3. API responding?
curl http://localhost:4000/api/admin/dashboard

# 4. Open browser
open http://localhost:5174
```

If all 4 commands succeed without errors, integration is working! ✅

---

**Ready to test!** Open http://localhost:5174 and verify the checklist above.
