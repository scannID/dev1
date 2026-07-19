import { useState, useEffect, useMemo } from 'react'
import { ShoppingCart, Plus, Minus, ArrowLeft, Check, ChevronRight } from 'lucide-react'
import { businessApi, ordersApi, devicesApi } from './api/services'
import type { Business, CatalogItem, RegisteredDevice } from './api/types'
import './CustomerMenu.css'

type Step = 'menu' | 'checkout' | 'payment' | 'done'

interface CartItem extends CatalogItem {
  quantity: number
}

const DEVICE_KEY = 'scanny-device-id'

function currency(amount: number) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    minimumFractionDigits: 0,
  }).format(amount)
}

function getOrCreateDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = `SCN-${crypto.randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'S'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function ScannyMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#0f766e" />
      <path
        d="M9 16.5c0-3.2 2.2-5.2 5.6-5.2 2.2 0 3.7.8 4.7 2.1l-1.7 1.2c-.7-.9-1.7-1.4-3-1.4-1.8 0-3 1.1-3 3.1s1.2 3.1 3 3.1c1.3 0 2.3-.5 3-1.4l1.7 1.2c-1 1.3-2.5 2.1-4.7 2.1-3.4 0-5.6-2-5.6-5.2z"
        fill="#fff"
      />
      <circle cx="23" cy="11" r="2" fill="#5eead4" />
    </svg>
  )
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
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [step, setStep] = useState<Step>('menu')

  const [customerName, setCustomerName] = useState('')
  const [customerLocation, setCustomerLocation] = useState('')
  const [customerNote, setCustomerNote] = useState('')

  const [provider, setProvider] = useState<'MTN' | 'Airtel'>('MTN')
  const [phone, setPhone] = useState('')
  const [saveNumber, setSaveNumber] = useState(true)
  const [deviceKnown, setDeviceKnown] = useState(false)
  const [savedDevice, setSavedDevice] = useState<RegisteredDevice | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null)

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

  useEffect(() => {
    const deviceId = getOrCreateDeviceId()
    devicesApi
      .check(deviceId)
      .then(async (registered) => {
        setDeviceKnown(registered)
        if (registered) {
          const device = await devicesApi.get(deviceId)
          setSavedDevice(device)
          if (device.primaryPhone) setPhone(device.primaryPhone)
          if (device.customerName) setCustomerName(device.customerName)
          setSaveNumber(false)
        }
      })
      .catch(() => {
        setDeviceKnown(false)
      })
  }, [])

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

  async function submitPayment() {
    if (!business || !customerName.trim() || cartItems.length === 0 || !phone.trim()) return

    setSubmitting(true)
    setError(null)
    try {
      const order = await ordersApi.create(business.id, {
        customer: {
          name: customerName.trim(),
          phone: phone.trim(),
          location: customerLocation.trim() || undefined,
          note: customerNote.trim() || undefined,
        },
        items: cartItems.map((item) => ({
          id: item.id,
          quantity: item.quantity,
        })),
      })

      setPlacedOrderId(order.id)

      if (!deviceKnown && saveNumber) {
        try {
          const deviceId = getOrCreateDeviceId()
          await devicesApi.register({
            deviceId,
            deviceName: navigator.userAgent.slice(0, 80),
            deviceModel: 'Browser',
            deviceOs: navigator.platform || 'Web',
            deviceFingerprint: deviceId,
            primaryPhone: phone.trim(),
            customerName: customerName.trim(),
          })
          setDeviceKnown(true)
        } catch {
          // Order still succeeds even if device save fails
        }
      }

      setStep('done')
      setCart({})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place order')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="cm-page cm-centered">
        <ScannyMark />
        <p className="cm-muted">Loading menu…</p>
      </div>
    )
  }

  if (!business) {
    return (
      <div className="cm-page cm-centered">
        <ScannyMark />
        <h2>Menu unavailable</h2>
        <p className="cm-muted">{error || 'This QR code is invalid or expired.'}</p>
      </div>
    )
  }

  const accent = business.accent || '#0f766e'

  return (
    <div className="cm-page" style={{ ['--cm-accent' as string]: accent }}>
      <header className="cm-topbar">
        <div className="cm-brand">
          <ScannyMark size={30} />
          <span>Scanny</span>
        </div>
        {step === 'menu' ? (
          <button
            type="button"
            className="cm-cart-btn"
            onClick={() => cartCount > 0 && setStep('checkout')}
            disabled={cartCount === 0}
            aria-label="Open cart"
          >
            <ShoppingCart size={18} />
            {cartCount > 0 && <span className="cm-badge">{cartCount}</span>}
          </button>
        ) : step !== 'done' ? (
          <button
            type="button"
            className="cm-ghost-btn"
            onClick={() => setStep(step === 'payment' ? 'checkout' : 'menu')}
          >
            <ArrowLeft size={16} /> Back
          </button>
        ) : null}
      </header>

      {error && <div className="cm-error">{error}</div>}

      {step === 'menu' && (
        <>
          <section className="cm-hero">
            <div className="cm-monogram" aria-hidden="true">
              {initials(business.name)}
            </div>
            <div>
              <p className="cm-eyebrow">{business.type}</p>
              <h1>{business.name}</h1>
              <p className="cm-muted">Order from your phone — no app needed</p>
            </div>
          </section>

          <div className="cm-cats" role="tablist">
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

          <div className="cm-list">
            {filteredItems.map((item) => {
              const qty = cart[item.id] || 0
              return (
                <article key={item.id} className="cm-row">
                  <div className="cm-row-body">
                    <h3>{item.name}</h3>
                    {item.description && <p>{item.description}</p>}
                    <strong>{currency(item.price)}</strong>
                  </div>
                  {qty === 0 ? (
                    <button type="button" className="cm-add" onClick={() => addToCart(item.id)}>
                      <Plus size={16} /> Add
                    </button>
                  ) : (
                    <div className="cm-qty">
                      <button type="button" onClick={() => updateQuantity(item.id, -1)} aria-label="Decrease">
                        <Minus size={14} />
                      </button>
                      <span>{qty}</span>
                      <button type="button" onClick={() => updateQuantity(item.id, 1)} aria-label="Increase">
                        <Plus size={14} />
                      </button>
                    </div>
                  )}
                </article>
              )
            })}
            {filteredItems.length === 0 && (
              <p className="cm-empty">No items available in this category.</p>
            )}
          </div>

          {cartCount > 0 && (
            <div className="cm-bottom-bar">
              <div>
                <span>
                  {cartCount} item{cartCount === 1 ? '' : 's'}
                </span>
                <strong>{currency(cartTotal)}</strong>
              </div>
              <button type="button" className="cm-primary" onClick={() => setStep('checkout')}>
                Checkout <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {step === 'checkout' && (
        <section className="cm-panel">
          <h2>Checkout</h2>
          <p className="cm-muted">Confirm your order details</p>

          <div className="cm-summary">
            {cartItems.map((item) => (
              <div key={item.id} className="cm-summary-line">
                <div>
                  <strong>
                    {item.quantity}× {item.name}
                  </strong>
                  <div className="cm-qty compact">
                    <button type="button" onClick={() => updateQuantity(item.id, -1)}>
                      <Minus size={12} />
                    </button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => updateQuantity(item.id, 1)}>
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
                <span>{currency(item.price * item.quantity)}</span>
              </div>
            ))}
            <div className="cm-summary-total">
              <span>Total</span>
              <strong>{currency(cartTotal)}</strong>
            </div>
          </div>

          <label className="cm-field">
            Your name
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Jane"
              autoComplete="name"
            />
          </label>
          <label className="cm-field">
            {business.tableLabel || 'Table / location'}
            <input
              value={customerLocation}
              onChange={(e) => setCustomerLocation(e.target.value)}
              placeholder="Table 4, counter…"
            />
          </label>
          <label className="cm-field">
            Note (optional)
            <input
              value={customerNote}
              onChange={(e) => setCustomerNote(e.target.value)}
              placeholder="No onions, extra sauce…"
            />
          </label>

          <button
            type="button"
            className="cm-primary cm-full"
            disabled={!customerName.trim() || cartItems.length === 0}
            onClick={() => setStep('payment')}
          >
            Continue to payment <ChevronRight size={16} />
          </button>
        </section>
      )}

      {step === 'payment' && (
        <section className="cm-panel">
          <h2>Payment</h2>
          <p className="cm-muted">
            Pay {currency(cartTotal)} to <strong>{business.name}</strong>
          </p>
          <p className="cm-ref">Ref: {business.paymentReference}</p>

          {deviceKnown && savedDevice?.primaryPhone ? (
            <div className="cm-saved-box">
              <p className="cm-eyebrow">Saved on this phone</p>
              <strong>{savedDevice.primaryPhone}</strong>
              <p className="cm-muted">We’ll use this number for mobile money.</p>
            </div>
          ) : (
            <>
              <div className="cm-providers">
                <button
                  type="button"
                  className={provider === 'MTN' ? 'active' : ''}
                  onClick={() => setProvider('MTN')}
                >
                  MTN MoMo
                </button>
                <button
                  type="button"
                  className={provider === 'Airtel' ? 'active' : ''}
                  onClick={() => setProvider('Airtel')}
                >
                  Airtel Money
                </button>
              </div>

              <label className="cm-field">
                Mobile money number
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+2567…"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </label>

              <label className="cm-check">
                <input
                  type="checkbox"
                  checked={saveNumber}
                  onChange={(e) => setSaveNumber(e.target.checked)}
                />
                <span>Save this number on this phone for faster payments next time</span>
              </label>
            </>
          )}

          {deviceKnown && (
            <label className="cm-field">
              Or pay with a different number
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+2567…"
                inputMode="tel"
              />
            </label>
          )}

          <button
            type="button"
            className="cm-primary cm-full"
            disabled={!phone.trim() || submitting}
            onClick={submitPayment}
          >
            {submitting ? 'Sending…' : `Pay ${currency(cartTotal)}`}
          </button>
          <p className="cm-hint">
            You’ll get a {provider} prompt on your phone. Your order is sent to the restaurant right away.
          </p>
        </section>
      )}

      {step === 'done' && (
        <section className="cm-panel cm-done">
          <div className="cm-done-icon">
            <Check size={28} />
          </div>
          <h2>Order sent</h2>
          <p className="cm-muted">
            {business.name} has your order
            {placedOrderId ? ` (${placedOrderId})` : ''}. Complete the mobile money prompt if it appears.
          </p>
          {!deviceKnown && saveNumber === false ? null : (
            <p className="cm-saved-note">Your mobile money number is ready for next time on this phone.</p>
          )}
          <button
            type="button"
            className="cm-primary cm-full"
            onClick={() => {
              setStep('menu')
              setPlacedOrderId(null)
              setCustomerNote('')
              setCustomerLocation('')
              setError(null)
            }}
          >
            Order more
          </button>
        </section>
      )}
    </div>
  )
}
