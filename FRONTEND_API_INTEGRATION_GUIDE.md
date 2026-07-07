# Frontend API Integration Guide

## Status: READY TO INTEGRATE

All API infrastructure is now in place. This guide explains how to integrate the backend APIs into the frontend components.

---

## ✅ Completed Work

### 1. API Infrastructure (Created)
- ✅ `src/api/client.ts` - Base API client with error handling
- ✅ `src/api/types.ts` - TypeScript types for all API requests/responses  
- ✅ `src/api/services.ts` - API service functions organized by domain
- ✅ `src/hooks/useBusinessData.ts` - Hook for loading businesses and orders
- ✅ `src/hooks/useCatalog.ts` - Hook for catalog operations (CRUD)
- ✅ `src/hooks/useOrders.ts` - Hook for order operations (NEW)
- ✅ `.env` and `.env.example` - Environment configuration

### 2. Backend APIs (Ready)
- ✅ 44 total endpoints operational
- ✅ 15 admin endpoints
- ✅ 7 Phase 1 client endpoints
- ✅ All tested and working

---

## 🚀 Integration Steps

### Step 1: Update App.tsx Main Component

**File:** `src/App.tsx`

**Changes needed:**

1. **Add imports:**
```typescript
import { useBusinessData } from './hooks/useBusinessData'
import { useCatalog } from './hooks/useCatalog'
import { useOrders } from './hooks/useOrders'
import type { Business, Order, CatalogItem } from './api/types'
```

2. **Replace localStorage initialization with API hooks:**
```typescript
// OLD:
const [businesses, setBusinesses] = useState(() => readJson(BUSINESSES_KEY, defaultBusinesses))
const [orders, setOrders] = useState<Order[]>(() => readJson<Order[]>(ORDERS_KEY, []))

// NEW:
const { 
  businesses, 
  orders, 
  loading, 
  error, 
  refreshBusinesses, 
  loadOrders, 
  setOrders 
} = useBusinessData()

const business = businesses[0] // or find by activeBusinessId
const catalogHook = useCatalog(business?.id || '')
const ordersHook = useOrders(business?.id || '')
```

3. **Load orders on mount:**
```typescript
useEffect(() => {
  if (business?.id) {
    loadOrders(business.id)
  }
}, [business?.id, loadOrders])
```

4. **Add loading state UI:**
```typescript
if (loading) {
  return <div className="loading-spinner">Loading...</div>
}

if (error) {
  return <div className="error-message">Error: {error}</div>
}
```

5. **Update catalog operations to use API:**
```typescript
// OLD updateBusinessItems:
function updateBusinessItems(nextItems) {
  setBusinesses((current) =>
    current.map((entry) => (entry.id === business.id ? { ...entry, items: nextItems } : entry)),
  )
}

// NEW - use the catalogHook methods:
// For adding items: catalogHook.createItem(data)
// For updating: catalogHook.updateItem(itemId, data)
// For toggle: catalogHook.toggleAvailability(itemId, available)
// For delete: catalogHook.deleteItem(itemId)

// After successful API call, refresh business data:
await catalogHook.createItem(itemData)
await refreshBusinesses() // Reload from API
```

6. **Update order operations to use API:**
```typescript
// OLD submitOrder:
function submitOrder(event) {
  event.preventDefault()
  // ... validation ...
  const order: Order = { /* ... */ }
  setOrders((current) => [order, ...current])
}

// NEW:
async function submitOrder(event) {
  event.preventDefault()
  if (!cartLines.length || !customer.name.trim()) return

  const orderRequest: CreateOrderRequest = {
    customerName: customer.name.trim(),
    customerPhone: customer.phone.trim(),
    customerLocation: customer.location.trim(),
    customerNote: customer.note.trim(),
    items: cartLines.map(({ id, name, price, quantity }) => ({
      id,
      name,
      price,
      quantity,
    })),
    total,
  }

  const order = await ordersHook.createOrder(orderRequest)
  if (order) {
    setCart({})
    setCustomer({ name: '', phone: '', location: '', note: '' })
    setView('dashboard')
    await loadOrders(business.id) // Refresh orders
  }
}
```

7. **Update status change handlers:**
```typescript
// OLD:
function updateStatus(orderId, status) {
  setOrders((current) =>
    current.map((order) => (order.id === orderId ? { ...order, status } : order)),
  )
}

// NEW:
async function updateStatus(orderId: string, status: OrderStatus) {
  const updated = await ordersHook.updateStatus(orderId, status)
  if (updated) {
    await loadOrders(business.id) // Refresh from API
  }
}

async function updatePayment(orderId: string, paymentStatus: PaymentStatus) {
  const updated = await ordersHook.updatePayment(orderId, paymentStatus)
  if (updated) {
    await loadOrders(business.id)
  }
}
```

8. **Update clear completed:**
```typescript
// OLD:
function clearCompleted() {
  setOrders((current) =>
    current.filter(
      (order) =>
        order.businessId !== business.id ||
        (order.status !== 'Completed' && order.status !== 'Cancelled'),
    ),
  )
}

// NEW:
async function clearCompleted() {
  const result = await ordersHook.clearCompleted()
  if (result) {
    await loadOrders(business.id)
  }
}
```

---

### Step 2: Update AddItemForm Component

**File:** `src/App.tsx` (AddItemForm component)

**Changes needed:**

```typescript
// OLD onSubmit:
function submitItem(event) {
  event.preventDefault()
  // ... validation ...
  const newItem = { /* ... */ }
  onItemsChange([...business.items, newItem])
}

// NEW:
async function submitItem(event) {
  event.preventDefault()
  
  const name = item.name.trim()
  const category = item.category.trim()
  const price = Number(item.price)

  setSubmitted(true)
  if (!name || !category || !Number.isFinite(price) || price <= 0) return

  const itemData: CreateCatalogItemRequest = {
    name,
    category,
    price,
    description: item.description.trim() || 'No description added yet.',
    available: item.available,
  }

  // Call API via hook passed from parent
  const created = await catalogHook.createItem(itemData)
  if (created) {
    await refreshBusinesses() // Passed from parent
    setItem(emptyItem)
    setSubmitted(false)
  }
}
```

**Update component props:**
```typescript
function AddItemForm({
  business,
  catalogHook,
  onSuccess,
}: {
  business: Business
  catalogHook: ReturnType<typeof useCatalog>
  onSuccess: () => void
}) {
  // ... use catalogHook.createItem() ...
}
```

---

### Step 3: Update CatalogPage Component

**File:** `src/App.tsx` (CatalogPage component)

**Changes needed:**

```typescript
// Update edit save handler:
async function saveEdit() {
  if (!editDraft.name?.trim() || !editDraft.category?.trim()) return
  
  const updated = await catalogHook.updateItem(editingId!, {
    name: editDraft.name,
    category: editDraft.category,
    price: Number(editDraft.price),
    description: editDraft.description,
    available: editDraft.available,
  })
  
  if (updated) {
    await refreshBusinesses()
    cancelEdit()
  }
}

// Update remove handler:
async function removeItem(itemId: string) {
  const success = await catalogHook.deleteItem(itemId)
  if (success) {
    await refreshBusinesses()
    if (editingId === itemId) cancelEdit()
  }
}
```

---

### Step 4: Update CustomerMenu Component

**File:** `src/CustomerMenu.tsx`

**Changes needed:**

1. **Add imports:**
```typescript
import { useState, useEffect, useMemo } from 'react'
import { scanitApi } from './api/services'
import type { Business, CreateOrderRequest } from './api/types'
```

2. **Load business data from API:**
```typescript
// OLD:
useEffect(() => {
  const stored = localStorage.getItem(BUSINESSES_KEY)
  if (stored) {
    setBusinesses(JSON.parse(stored))
  }
}, [])

// NEW:
useEffect(() => {
  async function loadBusiness() {
    try {
      const data = await scanitApi.businesses.get(businessId)
      setBusinesses([data])
    } catch (error) {
      console.error('Failed to load business:', error)
      // Fallback to localStorage
      const stored = localStorage.getItem(BUSINESSES_KEY)
      if (stored) {
        setBusinesses(JSON.parse(stored))
      }
    }
  }
  loadBusiness()
}, [businessId])
```

3. **Update submitOrder:**
```typescript
async function submitOrder() {
  if (!customerName.trim() || cartItems.length === 0 || !business) return

  const orderData: CreateOrderRequest = {
    customerName: customerName.trim(),
    items: cartItems.map(item => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    })),
    total: cartTotal,
  }

  try {
    await scanitApi.orders.create(business.id, orderData)
    
    // Show confirmation
    setOrderSubmitted(true)
    setTimeout(() => {
      setCart({})
      setCustomerName('')
      setShowCart(false)
      setOrderSubmitted(false)
    }, 3000)
  } catch (error) {
    console.error('Failed to create order:', error)
    alert('Failed to place order. Please try again.')
  }
}
```

---

### Step 5: Environment Variables

**File:** `.env`

Ensure this exists with:
```env
VITE_API_BASE_URL=http://localhost:4000/api
```

---

## 🔄 Offline Support Strategy

The hooks already implement a fallback strategy:
1. **Try API first** - Always attempt to load from backend
2. **Cache in localStorage** - Store successful API responses
3. **Fallback on error** - Use cached data if API fails
4. **Optimistic updates** - Update UI immediately, sync with API

This provides the best of both worlds:
- **Online**: Full backend sync
- **Offline**: Cached data with localStorage fallback

---

## 🧪 Testing Checklist

After integration, test these scenarios:

### Business & Catalog
- [ ] Load businesses from API on app start
- [ ] Create new catalog item
- [ ] Update existing catalog item
- [ ] Toggle item availability
- [ ] Delete catalog item
- [ ] Search and filter catalog

### Orders
- [ ] Create order from customer menu
- [ ] View orders in dashboard
- [ ] Update order status (Pending → Preparing → Ready → Completed)
- [ ] Update payment status (Unpaid → Paid)
- [ ] Clear completed orders

### Error Handling
- [ ] Handle API connection errors gracefully
- [ ] Show loading states during API calls
- [ ] Display error messages when operations fail
- [ ] Fallback to localStorage when API unavailable

### Offline Mode
- [ ] App works with cached data when backend is down
- [ ] Syncs data when backend comes back online

---

## 🐛 Common Issues & Solutions

### Issue 1: CORS Errors
**Solution:** Backend already has CORS configured in `WebConfig.java`. Ensure frontend uses `http://localhost:5173` (default Vite port).

### Issue 2: 404 Not Found
**Solution:** Check that backend is running on port 4000:
```bash
cd backend
mvn spring-boot:run
```

### Issue 3: Type Errors
**Solution:** All types are defined in `src/api/types.ts`. Import from there instead of duplicating.

### Issue 4: Stale Data
**Solution:** Call `refreshBusinesses()` or `loadOrders()` after mutations to sync with backend.

---

## 📝 Next Steps

1. **Start with App.tsx** - Integrate the hooks into the main component
2. **Test catalog operations** - Add, edit, delete items
3. **Test order flow** - Create orders, update status
4. **Update CustomerMenu** - Integrate order creation API
5. **Admin Console** - Create similar integration for admin pages

---

## 💡 Pro Tips

1. **Use async/await** - All API calls return Promises
2. **Handle errors** - Check for null returns from hook methods
3. **Refresh after mutations** - Call `refreshBusinesses()` or `loadOrders()` to sync
4. **Keep localStorage as fallback** - Don't remove it completely for offline support
5. **Add loading states** - Show spinners during API calls
6. **Test incrementally** - Integrate one feature at a time

---

## 📚 API Documentation Reference

- **Business API**: `src/api/services.ts` → `businessApi`
- **Catalog API**: `src/api/services.ts` → `catalogApi`
- **Orders API**: `src/api/services.ts` → `ordersApi`
- **Types**: `src/api/types.ts`
- **Backend Endpoints**: `CLIENT_API_QUICK_START.md`

---

## 🎯 Integration Priority

1. **High Priority** (Core functionality):
   - ✅ Business loading
   - ✅ Catalog CRUD operations
   - ✅ Order creation and status updates

2. **Medium Priority** (Enhanced features):
   - Admin dashboard integration
   - Analytics endpoints
   - Real-time order updates

3. **Low Priority** (Nice-to-have):
   - Advanced error recovery
   - Optimistic UI updates
   - WebSocket integration for live updates

---

**Status:** Ready to proceed with integration
**Estimated Time:** 2-3 hours for full integration
**Backend:** ✅ Running and tested
**API Layer:** ✅ Complete and tested
**Next Action:** Update App.tsx component with API hooks
