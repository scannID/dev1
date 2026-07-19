# 🍕 Testing the Restaurant Ordering Flow

## Quick Setup (2 minutes)

### Step 1: Seed the Restaurant Data
1. Open browser to **http://localhost:5173**
2. Open browser console (F12 or Cmd+Option+I on Mac)
3. Copy and paste the entire contents of `seed-restaurant-data.js` into the console
4. Press Enter - you'll see: `✅ Restaurant created with 15 menu items`
5. **Refresh the page**

### Step 2: View as Merchant (Dashboard)
1. You'll now see "Bella Pizza Restaurant" in your business list
2. Click on it to see the merchant dashboard with:
   - **Catalog tab**: See all 15 menu items (pizzas, pasta, drinks, appetizers, desserts)
   - **Orders tab**: Empty for now (will populate when customers order)
   - **Dashboard tab**: Business metrics
   
---

## 🧪 Testing the Customer Experience

### Option A: Simulate QR Code Scan (Direct URL)
1. Open a **new incognito/private window** (Cmd+Shift+N)
2. Go to: **http://localhost:5173/?bid=bella-pizza-001**
3. You'll see the customer menu view!

### Option B: Generate Real QR Code
1. In the merchant dashboard, look for QR code display
2. Or use this URL in any QR code generator: `http://localhost:5173/?bid=bella-pizza-001`
3. Scan with your phone's camera (make sure phone is on same WiFi network)
4. Your phone must be able to reach `http://YOUR-COMPUTER-IP:5173`

---

## 📱 Customer Ordering Flow Test

### 1. Browse Menu
- See categories: Pizzas, Pasta, Drinks, Appetizers, Desserts
- Each item shows:
  - Name
  - Description
  - Price (UGX)
  - "Add to cart" button

### 2. Add Items to Cart
- Click "Add to cart" on any item (e.g., Margherita Pizza)
- Cart badge shows item count
- Click cart icon to see cart drawer
- Can adjust quantities with +/- buttons
- See real-time total calculation

### 3. Checkout
- In cart drawer, click "Checkout"
- Enter customer name
- Click "Submit Order"
- Order confirmation appears

### 4. Merchant View (Real-time)
- Go back to merchant dashboard (http://localhost:5173)
- Switch to **Orders tab**
- See the new order appear instantly!
- Can mark status: Pending → Preparing → Ready → Completed
- Can mark payment: Unpaid → Paid

---

## 🧪 Test Scenarios

### Scenario 1: Small Order
```
Customer: John
Items:
- 1x Margherita Pizza (25,000 UGX)
- 1x Coca Cola (3,000 UGX)
Total: 28,000 UGX
```

### Scenario 2: Family Order
```
Customer: Sarah
Items:
- 2x Pepperoni Pizza (60,000 UGX)
- 1x Caesar Salad (15,000 UGX)
- 3x Coca Cola (9,000 UGX)
- 2x Tiramisu (20,000 UGX)
Total: 104,000 UGX
```

### Scenario 3: Multiple Orders
Open **3 incognito tabs** simultaneously:
- Tab 1: Order as "Alice"
- Tab 2: Order as "Bob"  
- Tab 3: Order as "Charlie"

Watch all 3 orders appear in merchant dashboard!

---

## 🔍 What to Verify

### Customer Side ✅
- [ ] Menu loads correctly with all items
- [ ] Can browse by category
- [ ] Add to cart works
- [ ] Quantity adjustments work
- [ ] Cart total calculates correctly
- [ ] Can submit order with name
- [ ] Order confirmation shows

### Merchant Side ✅
- [ ] Order appears in Orders tab
- [ ] Shows customer name
- [ ] Shows all items with quantities
- [ ] Shows correct total
- [ ] Can change order status
- [ ] Can change payment status
- [ ] Dashboard shows order count

---

## 💡 Pro Tips

### For Phone Testing (Same WiFi Network)
1. Find your computer's IP address:
   ```bash
   # On Mac
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # On Windows
   ipconfig
   ```
2. Use URL: `http://YOUR-IP:5173/?bid=bella-pizza-001`
3. Generate QR code with this URL at https://qr-code-generator.com
4. Print or display QR code on screen
5. Scan with phone camera

### Testing Locally Without Phone
- Use incognito windows to simulate different customers
- Each incognito session = different customer
- Main window = merchant dashboard

### Simulating a Real Restaurant Table
1. Print QR code
2. Place on table
3. Have someone scan it
4. They place order
5. You see it in dashboard

---

## 🎯 Expected Behavior

### Customer Menu View (`?bid=bella-pizza-001`)
```
┌─────────────────────────────────────┐
│   🍕 Bella Pizza Restaurant         │
│   Authentic Italian pizza and pasta │
├─────────────────────────────────────┤
│   Categories: All | Pizzas | Pasta  │
├─────────────────────────────────────┤
│   Margherita Pizza        25,000 UGX│
│   Fresh mozzarella, tomato...       │
│   [ Add to cart ]                   │
├─────────────────────────────────────┤
│   Pepperoni Pizza         30,000 UGX│
│   ...                               │
└─────────────────────────────────────┘
```

### Merchant Orders View
```
┌─────────────────────────────────────┐
│   Orders for Bella Pizza Restaurant │
├─────────────────────────────────────┤
│   Order #bella-pizza-001-1234567    │
│   Customer: John                    │
│   Items:                            │
│   - 1x Margherita Pizza             │
│   - 1x Coca Cola                    │
│   Total: 28,000 UGX                 │
│   Status: [Pending ▼]               │
│   Payment: [Unpaid ▼]               │
└─────────────────────────────────────┘
```

---

## 🐛 Troubleshooting

### "No menu items found"
- Refresh the page after running seed script
- Check browser console for errors
- Verify localStorage has data:
  ```javascript
  JSON.parse(localStorage.getItem('scanny-businesses-v2'))
  ```

### Orders not appearing
- Make sure you're logged in to same account
- Refresh merchant dashboard
- Check Orders tab (not Dashboard tab)

### Phone can't connect
- Both devices must be on same WiFi
- Check firewall isn't blocking port 5173
- Use computer's IP address, not localhost

---

## 🚀 Next Steps

After testing locally:
1. Deploy to production (Vercel, Netlify, etc.)
2. Update QR codes with production URL
3. Print physical QR codes for restaurant tables
4. Each table can have its own QR code (same business ID)

**Questions?** Check the console logs or open browser DevTools to debug!
