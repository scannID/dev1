# API Integration Checklist

## ✅ COMPLETED - Ready to Use

### Backend APIs
- ✅ Spring Boot backend running on port 4000
- ✅ PostgreSQL database with 11 tables
- ✅ 5 database migrations applied
- ✅ 44 REST API endpoints implemented
- ✅ CORS configured for frontend
- ✅ All endpoints tested with curl

### Frontend API Infrastructure
- ✅ `src/api/client.ts` - HTTP client with error handling
- ✅ `src/api/types.ts` - TypeScript types (Business, Order, CatalogItem, etc.)
- ✅ `src/api/services.ts` - Service layer (businessApi, catalogApi, ordersApi)
- ✅ `src/hooks/useBusinessData.ts` - Load businesses and orders
- ✅ `src/hooks/useCatalog.ts` - Catalog CRUD operations
- ✅ `src/hooks/useOrders.ts` - Order operations
- ✅ `.env` - Environment configuration
- ✅ `.env.example` - Environment template

---

## ⏳ TO DO - Component Integration

### 1. Client App: `src/App.tsx`

#### Current State
- Uses `useState` with localStorage
- Local state management only
- No API calls

#### Needs
- [ ] Import API hooks (`useBusinessData`, `useCatalog`, `useOrders`)
- [ ] Replace `useState` initialization with hooks
- [ ] Update `updateBusinessItems()` to use catalog hook
- [ ] Update `submitOrder()` to use orders API
- [ ] Update `updateStatus()` to use orders API
- [ ] Update `updatePayment()` to use orders API
- [ ] Update `clearCompleted()` to use orders API
- [ ] Add loading spinner UI
- [ ] Add error message UI
- [ ] Test full flow

**Impact:** Main merchant portal functionality

---

### 2. Client App: `src/App.tsx` - AddItemForm Component

#### Current State
- Adds items to local array
- No API integration

#### Needs
- [ ] Pass `catalogHook` from parent
- [ ] Update `submitItem()` to call `catalogHook.createItem()`
- [ ] Refresh business data after successful creation
- [ ] Handle API errors
- [ ] Show loading state during creation

**Impact:** Adding new catalog items

---

### 3. Client App: `src/App.tsx` - CatalogPage Component

#### Current State
- Edits items in local array
- No API integration

#### Needs
- [ ] Pass `catalogHook` from parent
- [ ] Update `saveEdit()` to call `catalogHook.updateItem()`
- [ ] Update `removeItem()` to call `catalogHook.deleteItem()`
- [ ] Refresh business data after operations
- [ ] Handle API errors
- [ ] Show loading states

**Impact:** Editing and deleting catalog items

---

### 4. Customer Menu: `src/CustomerMenu.tsx`

#### Current State
- Loads business from localStorage
- Creates orders in localStorage only

#### Needs
- [ ] Load business from API (`scanitApi.businesses.get()`)
- [ ] Update `submitOrder()` to call `scanitApi.orders.create()`
- [ ] Handle API errors gracefully
- [ ] Keep localStorage as fallback
- [ ] Show loading states

**Impact:** Customer order placement

---

### 5. Admin Console: `admin-console/src/`

#### Current State
- Static demo pages
- No real data

#### Needs
- [ ] Create `admin-console/src/api/` directory
- [ ] Copy API infrastructure (client.ts, types.ts, services.ts)
- [ ] Create admin-specific service functions
- [ ] Update OverviewPage.tsx with dashboard API
- [ ] Update MerchantsPage.tsx with merchants API
- [ ] Update OrdersPage.tsx with orders API
- [ ] Update AnalyticsPage.tsx with analytics API
- [ ] Add loading states
- [ ] Handle errors

**Impact:** Admin dashboard functionality

---

## 🎯 Priority Order

### High Priority (Do First)
1. **App.tsx main component** - Core merchant functionality
2. **CustomerMenu.tsx** - Customer-facing order flow

### Medium Priority (Do Second)
3. **AddItemForm** - Creating catalog items
4. **CatalogPage** - Managing catalog

### Low Priority (Do Last)
5. **Admin Console** - Analytics and monitoring

---

## 🧪 Testing Checklist

After each integration, test:

### Catalog Operations
- [ ] Load catalog items from API
- [ ] Create new catalog item
- [ ] Update existing item (name, price, description)
- [ ] Toggle item availability
- [ ] Delete item
- [ ] Verify changes persist in database

### Order Operations
- [ ] Create order from customer menu
- [ ] View orders in merchant dashboard
- [ ] Change order status (Pending → Preparing → Ready → Completed)
- [ ] Change payment status (Unpaid → Paid)
- [ ] Clear completed orders
- [ ] Verify all changes persist

### Error Handling
- [ ] Stop backend, verify graceful fallback
- [ ] Test with slow network
- [ ] Test with invalid data
- [ ] Verify error messages display correctly

### UI/UX
- [ ] Loading spinners show during API calls
- [ ] Success messages after operations
- [ ] Error messages are user-friendly
- [ ] No hanging requests
- [ ] Responsive design maintained

---

## 📋 Pre-Integration Checklist

Before starting component integration, verify:

- [ ] Backend is running (`http://localhost:4000/health`)
- [ ] Database has data (check via Beekeeper Studio or psql)
- [ ] Frontend dev server is running (`http://localhost:5173`)
- [ ] `.env` file exists with `VITE_API_BASE_URL=http://localhost:4000/api`
- [ ] No TypeScript errors in API layer files
- [ ] Browser console shows no errors

---

## 🚀 Quick Commands

### Start Everything
```bash
# Terminal 1: Start Docker
cd backend && docker-compose up -d

# Terminal 2: Start Backend
cd backend && mvn spring-boot:run

# Terminal 3: Start Frontend
npm run dev

# Terminal 4: Test API
curl http://localhost:4000/api/businesses
```

### Check Status
```bash
# Backend health
curl http://localhost:4000/health

# Database connection
docker exec -it scanit_postgres psql -U scanit -d scanit -c "\dt"

# Frontend
open http://localhost:5173
```

---

## 📝 Notes

### Offline Support Strategy
- Try API call first
- Cache successful response in localStorage
- On failure, use cached data
- Show indicator when using cached data

### Error Handling Pattern
```typescript
try {
  const result = await api.call()
  // Update UI with result
} catch (error) {
  console.error('API error:', error)
  // Try localStorage fallback
  // Show user-friendly error message
}
```

### Loading State Pattern
```typescript
const [loading, setLoading] = useState(false)

async function doSomething() {
  setLoading(true)
  try {
    await api.call()
  } finally {
    setLoading(false)
  }
}

if (loading) return <Spinner />
```

---

## 📚 Documentation

Read these in order:
1. **API_INTEGRATION_CHECKLIST.md** (this file) - What to do
2. **FRONTEND_API_INTEGRATION_GUIDE.md** - How to do it
3. **CLIENT_API_QUICK_START.md** - API endpoint reference
4. **INTEGRATION_STATUS.md** - Current status overview

---

## ✨ Success Criteria

Integration is complete when:
- [ ] All catalog operations work via API
- [ ] All order operations work via API
- [ ] Loading states show during API calls
- [ ] Errors are handled gracefully
- [ ] Offline mode works with localStorage fallback
- [ ] No console errors
- [ ] Data persists in database
- [ ] Multiple users can interact with same data

---

**Status:** Ready to begin component integration
**Next Step:** Update `src/App.tsx` main component
**Estimated Time:** 2-3 hours for full integration

---

**Say "proceed" when ready to start!**
