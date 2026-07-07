import { useState, useEffect, useMemo } from 'react'
import { ShoppingCart, Plus, Minus, X } from 'lucide-react'
import './App.css'

interface Business {
  id: string
  name: string
  description?: string
  items: CatalogItem[]
}

interface CatalogItem {
  id: string
  name: string
  category: string
  price: number
  description: string
  available: boolean
}

interface CartItem extends CatalogItem {
  quantity: number
}

const ORDERS_KEY = 'scanny-orders-v1'
const BUSINESSES_KEY = 'scanny-businesses-v2'

function currency(amount: number) {
  return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(amount)
}

export default function CustomerMenu({ businessId }: { businessId: string }) {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [cart, setCart] = useState<Record<string, number>>({})
  const [showCart, setShowCart] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [orderSubmitted, setOrderSubmitted] = useState(false)

  // Load businesses from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(BUSINESSES_KEY)
    if (stored) {
      setBusinesses(JSON.parse(stored))
    }
  }, [])

  const business = businesses.find(b => b.id === businessId)

  const categories = useMemo(() => {
    if (!business) return []
    return ['all', ...new Set(business.items.map(item => item.category))]
  }, [business])

  const filteredItems = useMemo(() => {
    if (!business) return []
    if (selectedCategory === 'all') return business.items.filter(item => item.available)
    return business.items.filter(item => item.available && item.category === selectedCategory)
  }, [business, selectedCategory])

  const cartItems: CartItem[] = useMemo(() => {
    if (!business) return []
    return Object.entries(cart)
      .map(([itemId, quantity]) => {
        const item = business.items.find(i => i.id === itemId)
        return item ? { ...item, quantity } : null
      })
      .filter((item): item is CartItem => item !== null)
  }, [business, cart])

  const cartTotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const cartCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0)

  function addToCart(itemId: string) {
    setCart(prev => ({ ...prev, [itemId]: (prev[itemId] || 0) + 1 }))
  }

  function updateQuantity(itemId: string, delta: number) {
    setCart(prev => {
      const newQty = (prev[itemId] || 0) + delta
      if (newQty <= 0) {
        const { [itemId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [itemId]: newQty }
    })
  }

  function submitOrder() {
    if (!customerName.trim() || cartItems.length === 0 || !business) return

    const order = {
      id: `${business.id}-${Date.now()}`,
      businessId: business.id,
      customerName: customerName.trim(),
      items: cartItems.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity
      })),
      total: cartTotal,
      status: 'Pending',
      paymentStatus: 'Unpaid',
      createdAt: new Date().toISOString()
    }

    // Save order to localStorage
    const stored = localStorage.getItem(ORDERS_KEY)
    const orders = stored ? JSON.parse(stored) : []
    orders.push(order)
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders))

    // Show confirmation
    setOrderSubmitted(true)
    setTimeout(() => {
      setCart({})
      setCustomerName('')
      setShowCart(false)
      setOrderSubmitted(false)
    }, 3000)
  }

  if (!business) {
    return (
      <div className="customer-menu-error">
        <h1>Business Not Found</h1>
        <p>The restaurant you're looking for doesn't exist.</p>
        <p className="error-code">Business ID: {businessId}</p>
      </div>
    )
  }

  return (
    <div className="customer-menu">
      {/* Header */}
      <header className="customer-header">
        <div className="customer-header-content">
          <h1>{business.name}</h1>
          {business.description && <p className="business-description">{business.description}</p>}
        </div>
        <button className="cart-button" onClick={() => setShowCart(true)}>
          <ShoppingCart size={20} />
          {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
        </button>
      </header>

      {/* Category Filter */}
      <div className="category-filter">
        {categories.map(cat => (
          <button
            key={cat}
            className={`category-btn ${selectedCategory === cat ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat === 'all' ? 'All' : cat}
          </button>
        ))}
      </div>

      {/* Menu Items */}
      <div className="menu-items">
        {filteredItems.map(item => (
          <div key={item.id} className="menu-item">
            <div className="menu-item-info">
              <h3>{item.name}</h3>
              <p className="menu-item-description">{item.description}</p>
              <p className="menu-item-price">{currency(item.price)}</p>
            </div>
            <button className="add-to-cart-btn" onClick={() => addToCart(item.id)}>
              <Plus size={16} />
              Add
            </button>
          </div>
        ))}
      </div>

      {/* Cart Drawer */}
      {showCart && (
        <div className="cart-overlay" onClick={() => setShowCart(false)}>
          <div className="cart-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="cart-header">
              <h2>Your Order</h2>
              <button onClick={() => setShowCart(false)}>
                <X size={20} />
              </button>
            </div>

            {cartItems.length === 0 ? (
              <div className="empty-cart">
                <ShoppingCart size={48} />
                <p>Your cart is empty</p>
              </div>
            ) : (
              <>
                <div className="cart-items">
                  {cartItems.map(item => (
                    <div key={item.id} className="cart-item">
                      <div className="cart-item-info">
                        <h4>{item.name}</h4>
                        <p>{currency(item.price)}</p>
                      </div>
                      <div className="cart-item-controls">
                        <button onClick={() => updateQuantity(item.id, -1)}>
                          <Minus size={14} />
                        </button>
                        <span>{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, 1)}>
                          <Plus size={14} />
                        </button>
                      </div>
                      <p className="cart-item-total">{currency(item.price * item.quantity)}</p>
                    </div>
                  ))}
                </div>

                <div className="cart-footer">
                  <div className="cart-total">
                    <span>Total</span>
                    <strong>{currency(cartTotal)}</strong>
                  </div>

                  {!orderSubmitted ? (
                    <>
                      <input
                        type="text"
                        placeholder="Your name"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="customer-name-input"
                      />
                      <button
                        className="checkout-btn"
                        onClick={submitOrder}
                        disabled={!customerName.trim()}
                      >
                        Place Order
                      </button>
                    </>
                  ) : (
                    <div className="order-success">
                      <div className="success-icon">✓</div>
                      <p>Order placed successfully!</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        .customer-menu {
          min-height: 100vh;
          background: #f9fafb;
          padding-bottom: 80px;
        }
        .customer-header {
          background: white;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .customer-header h1 {
          margin: 0;
          font-size: 24px;
          color: #111827;
        }
        .business-description {
          margin: 4px 0 0;
          font-size: 14px;
          color: #6b7280;
        }
        .cart-button {
          position: relative;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 50%;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
        }
        .cart-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          background: #ef4444;
          color: white;
          border-radius: 10px;
          padding: 2px 6px;
          font-size: 11px;
          font-weight: 600;
        }
        .category-filter {
          padding: 16px 20px;
          background: white;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          gap: 8px;
          overflow-x: auto;
        }
        .category-btn {
          padding: 8px 16px;
          border: 1px solid #d1d5db;
          background: white;
          border-radius: 20px;
          font-size: 14px;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s;
        }
        .category-btn.active {
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }
        .menu-items {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .menu-item {
          background: white;
          border-radius: 12px;
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .menu-item-info {
          flex: 1;
        }
        .menu-item h3 {
          margin: 0 0 4px;
          font-size: 16px;
          color: #111827;
        }
        .menu-item-description {
          margin: 0 0 8px;
          font-size: 13px;
          color: #6b7280;
          line-height: 1.4;
        }
        .menu-item-price {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #3b82f6;
        }
        .add-to-cart-btn {
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 10px 16px;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        }
        .cart-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 50;
          display: flex;
          justify-content: center;
          align-items: flex-end;
        }
        .cart-drawer {
          background: white;
          width: 100%;
          max-width: 500px;
          max-height: 80vh;
          border-radius: 16px 16px 0 0;
          display: flex;
          flex-direction: column;
        }
        .cart-header {
          padding: 20px;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .cart-header h2 {
          margin: 0;
          font-size: 20px;
        }
        .cart-header button {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
        }
        .empty-cart {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          color: #9ca3af;
        }
        .cart-items {
          flex: 1;
          overflow-y: auto;
          padding: 16px 20px;
        }
        .cart-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid #f3f4f6;
        }
        .cart-item-info {
          flex: 1;
        }
        .cart-item h4 {
          margin: 0 0 4px;
          font-size: 14px;
        }
        .cart-item p {
          margin: 0;
          font-size: 13px;
          color: #6b7280;
        }
        .cart-item-controls {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #f3f4f6;
          border-radius: 8px;
          padding: 4px 8px;
        }
        .cart-item-controls button {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          display: flex;
        }
        .cart-item-total {
          font-weight: 600;
          min-width: 80px;
          text-align: right;
        }
        .cart-footer {
          padding: 20px;
          border-top: 1px solid #e5e7eb;
        }
        .cart-total {
          display: flex;
          justify-content: space-between;
          margin-bottom: 16px;
          font-size: 18px;
        }
        .customer-name-input {
          width: 100%;
          padding: 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 12px;
        }
        .checkout-btn {
          width: 100%;
          padding: 14px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
        }
        .checkout-btn:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }
        .order-success {
          text-align: center;
          padding: 20px;
        }
        .success-icon {
          width: 60px;
          height: 60px;
          background: #10b981;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          margin: 0 auto 12px;
        }
        .customer-menu-error {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
          text-align: center;
        }
        .error-code {
          font-family: monospace;
          color: #6b7280;
          margin-top: 8px;
        }
      `}</style>
    </div>
  )
}
