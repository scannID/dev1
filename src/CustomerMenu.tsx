import { useState, useEffect, useMemo } from 'react'
import { ShoppingCart, Plus, Minus, X } from 'lucide-react'
import { businessApi, ordersApi } from './api/services'
import type { Business, CatalogItem } from './api/types'
import './App.css'

interface CartItem extends CatalogItem {
  quantity: number
}

function currency(amount: number) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    minimumFractionDigits: 0,
  }).format(amount)
}

export default function CustomerMenu({
  businessId,
  qrToken,
}: {
  businessId: string
  qrToken?: string | null
}) {
  const [business, setBusiness] = useState<Business | null>(null)
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cart, setCart] = useState<Record<string, number>>({})
  const [showCart, setShowCart] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerLocation, setCustomerLocation] = useState('')
  const [customerNote, setCustomerNote] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [orderSubmitted, setOrderSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadMenu() {
      try {
        setLoading(true)
        setError(null)
        const menu = await businessApi.getMenu(businessId, qrToken || undefined)
        if (cancelled) return
        setBusiness(menu.business)
        setItems(menu.items ?? [])
      } catch (err) {
        if (cancelled) return
        console.error(err)
        setError(err instanceof Error ? err.message : 'Failed to load menu')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadMenu()
    return () => {
      cancelled = true
    }
  }, [businessId, qrToken])

  const categories = useMemo(
    () => ['all', ...new Set(items.map((item) => item.category))],
    [items]
  )

  const filteredItems = useMemo(() => {
    if (selectedCategory === 'all') return items.filter((item) => item.available)
    return items.filter((item) => item.available && item.category === selectedCategory)
  }, [items, selectedCategory])

  const cartItems: CartItem[] = useMemo(() => {
    return Object.entries(cart)
      .map(([itemId, quantity]) => {
        const item = items.find((i) => i.id === itemId)
        return item ? { ...item, quantity } : null
      })
      .filter((item): item is CartItem => item !== null)
  }, [items, cart])

  const cartTotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const cartCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0)

  function addToCart(itemId: string) {
    setCart((prev) => ({ ...prev, [itemId]: (prev[itemId] || 0) + 1 }))
  }

  function updateQuantity(itemId: string, delta: number) {
    setCart((prev) => {
      const newQty = (prev[itemId] || 0) + delta
      if (newQty <= 0) {
        const { [itemId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [itemId]: newQty }
    })
  }

  async function submitOrder() {
    if (!customerName.trim() || cartItems.length === 0 || !business) return

    setSubmitting(true)
    setError(null)
    try {
      await ordersApi.create(business.id, {
        customer: {
          name: customerName.trim(),
          location: customerLocation.trim() || undefined,
          note: customerNote.trim() || undefined,
        },
        items: cartItems.map((item) => ({
          id: item.id,
          quantity: item.quantity,
        })),
      })

      setOrderSubmitted(true)
      setTimeout(() => {
        setCart({})
        setCustomerName('')
        setCustomerLocation('')
        setCustomerNote('')
        setShowCart(false)
        setOrderSubmitted(false)
      }, 2200)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to place order')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="customer-menu" style={{ padding: 24, textAlign: 'center' }}>
        <p>Loading menu…</p>
      </div>
    )
  }

  if (!business) {
    return (
      <div className="customer-menu" style={{ padding: 24, textAlign: 'center' }}>
        <h2>Menu unavailable</h2>
        <p>{error || 'This QR code is invalid or expired.'}</p>
      </div>
    )
  }

  return (
    <div className="customer-menu">
      <header className="customer-menu-header">
        <div>
          <p className="eyebrow">Scanny</p>
          <h1>{business.name}</h1>
          <p>Order from your phone — no app required</p>
        </div>
        <button
          type="button"
          className="cart-fab"
          onClick={() => setShowCart(true)}
          aria-label="Open cart"
        >
          <ShoppingCart size={20} />
          {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
        </button>
      </header>

      {error && (
        <p style={{ color: 'crimson', padding: '0 16px', marginBottom: 8 }}>{error}</p>
      )}

      <div className="category-tabs" role="tablist">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            role="tab"
            className={selectedCategory === category ? 'active' : ''}
            onClick={() => setSelectedCategory(category)}
          >
            {category === 'all' ? 'All' : category}
          </button>
        ))}
      </div>

      <div className="menu-grid">
        {filteredItems.map((item) => (
          <article key={item.id} className="menu-item-card">
            <div>
              <h3>{item.name}</h3>
              <p>{item.description}</p>
              <strong>{currency(item.price)}</strong>
            </div>
            <button type="button" onClick={() => addToCart(item.id)} aria-label={`Add ${item.name}`}>
              <Plus size={18} />
            </button>
          </article>
        ))}
        {filteredItems.length === 0 && (
          <p style={{ padding: 16, opacity: 0.7 }}>No items available in this category.</p>
        )}
      </div>

      {showCart && (
        <div className="cart-drawer-backdrop" onClick={() => setShowCart(false)}>
          <aside className="cart-drawer" onClick={(e) => e.stopPropagation()}>
            <header>
              <h2>Your order</h2>
              <button type="button" onClick={() => setShowCart(false)} aria-label="Close cart">
                <X size={18} />
              </button>
            </header>

            {orderSubmitted ? (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <h3>Order sent</h3>
                <p>The merchant has received your order.</p>
              </div>
            ) : (
              <>
                <div className="cart-lines">
                  {cartItems.length === 0 && <p>Your cart is empty.</p>}
                  {cartItems.map((item) => (
                    <div key={item.id} className="cart-line">
                      <div>
                        <strong>{item.name}</strong>
                        <span>{currency(item.price * item.quantity)}</span>
                      </div>
                      <div className="qty-controls">
                        <button type="button" onClick={() => updateQuantity(item.id, -1)}>
                          <Minus size={14} />
                        </button>
                        <span>{item.quantity}</span>
                        <button type="button" onClick={() => updateQuantity(item.id, 1)}>
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <label>
                  Your name
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Your name"
                  />
                </label>
                <label>
                  {business.tableLabel || 'Location'}
                  <input
                    value={customerLocation}
                    onChange={(e) => setCustomerLocation(e.target.value)}
                    placeholder="Table 4, counter…"
                  />
                </label>
                <label>
                  Note
                  <input
                    value={customerNote}
                    onChange={(e) => setCustomerNote(e.target.value)}
                    placeholder="No onions, extra sauce…"
                  />
                </label>

                <div className="cart-total">
                  <span>Total</span>
                  <strong>{currency(cartTotal)}</strong>
                </div>

                <button
                  className="primary-action"
                  type="button"
                  disabled={!customerName.trim() || cartItems.length === 0 || submitting}
                  onClick={submitOrder}
                >
                  {submitting ? 'Sending…' : 'Place order'}
                </button>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
