import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ShoppingCart, X } from 'lucide-react'
import { businessApi, devicesApi, ordersApi } from '../api/services'
import type { Business, CatalogItem, RegisteredDevice } from '../api/types'
import { BottomBar } from './BottomBar'
import { payments, type PaymentProvider, type PaymentStatus } from './payments'
import { ScannyMark } from './ScannyMark'
import {
  clearCheckoutDraft,
  loadCheckoutDraft,
  saveCheckoutDraft,
  type CheckoutStep,
} from './session'
import { canGoBack, previousStep, StepProgress } from './StepProgress'
import { CartStep, type CartLine } from './steps/CartStep'
import { DetailsStep } from './steps/DetailsStep'
import { DoneStep } from './steps/DoneStep'
import { MenuStep } from './steps/MenuStep'
import { PayStep } from './steps/PayStep'
import { WaitingStep } from './steps/WaitingStep'
import { currency, formatUgPhoneHint, getOrCreateDeviceId } from './utils'
import { LoadingSpinner } from '../components/LoadingSpinner'
import './CustomerApp.css'

const PROGRESS_STEPS: CheckoutStep[] = ['menu', 'cart', 'details', 'pay']

export default function CustomerApp({
  businessId,
  qrToken,
}: {
  businessId: string
  qrToken?: string | null
}) {
  const draft = useMemo(() => loadCheckoutDraft(businessId), [businessId])

  const [business, setBusiness] = useState<Business | null>(null)
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [cart, setCart] = useState<Record<string, number>>(draft?.cart ?? {})
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [step, setStep] = useState<CheckoutStep>(() => {
    const saved = draft?.step
    if (saved && PROGRESS_STEPS.includes(saved)) return saved
    return 'menu'
  })

  const [customerName, setCustomerName] = useState(draft?.customerName ?? '')
  const [customerLocation, setCustomerLocation] = useState(draft?.customerLocation ?? '')
  const [customerNote, setCustomerNote] = useState(draft?.customerNote ?? '')
  const [nameError, setNameError] = useState<string | null>(null)

  const [provider, setProvider] = useState<PaymentProvider>(draft?.provider ?? 'MTN')
  const [phone, setPhone] = useState(draft?.phone ?? '')
  const [saveNumber, setSaveNumber] = useState(draft?.saveNumber ?? true)
  const [phoneError, setPhoneError] = useState<string | null>(null)

  const [deviceKnown, setDeviceKnown] = useState(false)
  const [savedDevice, setSavedDevice] = useState<RegisteredDevice | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null)
  const [paymentId, setPaymentId] = useState<string | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('PENDING')
  const [paidTotal, setPaidTotal] = useState(0)

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

  useEffect(() => {
    if (!business) return
    const persistStep = PROGRESS_STEPS.includes(step) ? step : 'pay'
    saveCheckoutDraft(businessId, {
      cart,
      customerName,
      customerLocation,
      customerNote,
      provider,
      phone,
      saveNumber,
      step: persistStep,
    })
  }, [
    business,
    businessId,
    cart,
    customerName,
    customerLocation,
    customerNote,
    provider,
    phone,
    saveNumber,
    step,
  ])

  const cartItems: CartLine[] = useMemo(() => {
    return Object.entries(cart)
      .map(([itemId, quantity]) => {
        const item = items.find((i) => i.id === itemId)
        return item ? { ...item, quantity } : null
      })
      .filter((item): item is CartLine => item !== null)
  }, [items, cart])

  const cartTotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const cartCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0)

  const addToCart = useCallback((itemId: string) => {
    setCart((prev) => ({ ...prev, [itemId]: (prev[itemId] || 0) + 1 }))
  }, [])

  const updateQuantity = useCallback((itemId: string, delta: number) => {
    setCart((prev) => {
      const nextQty = (prev[itemId] || 0) + delta
      if (nextQty <= 0) {
        const { [itemId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [itemId]: nextQty }
    })
  }, [])

  const removeItem = useCallback((itemId: string) => {
    setCart((prev) => {
      const { [itemId]: _, ...rest } = prev
      return rest
    })
  }, [])

  function goBack() {
    if (step === 'waiting') {
      setStep('pay')
      setError(null)
      return
    }
    setStep(previousStep(step))
    setError(null)
  }

  function goDetails() {
    setNameError(null)
    if (cartCount === 0) {
      setStep('menu')
      return
    }
    setStep('details')
  }

  function goPay() {
    if (!customerName.trim()) {
      setNameError('Enter your name to continue')
      return
    }
    setNameError(null)
    setStep('pay')
  }

  function validatePhone(value: string) {
    const digits = value.replace(/\D/g, '')
    if (digits.length < 9) return 'Enter a valid mobile money number'
    return null
  }

  async function startPaymentForOrder(orderId: string, amount: number) {
    const payment = await payments.initiate({
      orderId,
      provider,
      phone: phone.trim(),
      amount,
      businessId: businessId,
    })
    setPaymentId(payment.paymentId)
    setPaymentStatus(payment.status)
    if (payment.status === 'PAID') {
      clearCheckoutDraft(businessId)
      setCart({})
      setStep('done')
    } else {
      setStep('waiting')
    }
  }

  async function submitPayment() {
    if (!business) return
    const phoneIssue = validatePhone(phone)
    if (phoneIssue) {
      setPhoneError(phoneIssue)
      return
    }
    if (!customerName.trim()) {
      setStep('details')
      setNameError('Enter your name to continue')
      return
    }

    setPhoneError(null)
    setSubmitting(true)
    setError(null)
    try {
      // Re-prompt payment for an already-placed order (e.g. after changing number)
      if (placedOrderId) {
        await startPaymentForOrder(placedOrderId, paidTotal || cartTotal)
        return
      }

      if (cartItems.length === 0) return

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
      setPaidTotal(order.total || cartTotal)

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
          // Order + payment still proceed
        }
      }

      await startPaymentForOrder(order.id, order.total || cartTotal)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place order')
    } finally {
      setSubmitting(false)
    }
  }

  async function retryPayment() {
    if (!placedOrderId) {
      void submitPayment()
      return
    }
    setSubmitting(true)
    setError(null)
    setPaymentStatus('PENDING')
    try {
      await startPaymentForOrder(placedOrderId, paidTotal || cartTotal)
    } catch (err) {
      setPaymentStatus('FAILED')
      setError(err instanceof Error ? err.message : 'Failed to retry payment')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (step !== 'waiting' || !paymentId) return
    if (paymentStatus === 'PAID' || paymentStatus === 'FAILED') return

    let cancelled = false
    const tick = async () => {
      try {
        const result = await payments.status(paymentId)
        if (cancelled) return
        setPaymentStatus(result.status)
        if (result.status === 'PAID') {
          clearCheckoutDraft(businessId)
          setCart({})
          setStep('done')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not check payment status')
        }
      }
    }

    tick()
    const id = window.setInterval(tick, 3000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [step, paymentId, paymentStatus, businessId])

  function orderMore() {
    clearCheckoutDraft(businessId)
    setCart({})
    setCustomerNote('')
    setCustomerLocation('')
    setPlacedOrderId(null)
    setPaymentId(null)
    setPaymentStatus('PENDING')
    setPaidTotal(0)
    setError(null)
    setStep('menu')
  }

  function cancelFlow() {
    clearCheckoutDraft(businessId)
    setCart({})
    setCustomerName('')
    setCustomerLocation('')
    setCustomerNote('')
    setNameError(null)
    setProvider('MTN')
    setPhone(savedDevice?.primaryPhone ?? '')
    setSaveNumber(!deviceKnown)
    setPhoneError(null)
    setSubmitting(false)
    setPlacedOrderId(null)
    setPaymentId(null)
    setPaymentStatus('PENDING')
    setPaidTotal(0)
    setError(null)
    setSelectedCategory('all')
    setStep('menu')
  }

  if (loading) {
    return (
      <div className="cm-page cm-centered">
        <ScannyMark />
        <LoadingSpinner label="Loading menu…" />
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
  const showBottomMenu = step === 'menu' && cartCount > 0
  const showBottomCart = step === 'cart' && cartCount > 0
  const showBottomDetails = step === 'details'
  const showBottomPay = step === 'pay'
  const payTotal = paidTotal || cartTotal
  const payCount = cartCount || (placedOrderId ? 1 : 0)
  const canCancel =
    step !== 'done' && (step !== 'menu' || cartCount > 0 || Boolean(placedOrderId) || Boolean(paymentId))

  return (
    <div className="cm-page" style={{ ['--cm-accent' as string]: accent }}>
      <header className="cm-topbar">
        <div className="cm-brand">
          <ScannyMark size={30} />
          <div className="cm-brand-text">
            <span className="cm-brand-name">Scanny</span>
            <span className="cm-brand-biz">{business.name}</span>
          </div>
        </div>
        <div className="cm-topbar-actions">
          {canCancel ? (
            <button type="button" className="cm-cancel-btn" onClick={cancelFlow} disabled={submitting}>
              <X size={16} /> Cancel
            </button>
          ) : null}
          {step === 'menu' ? (
            <button
              type="button"
              className="cm-cart-btn"
              onClick={() => cartCount > 0 && setStep('cart')}
              disabled={cartCount === 0}
              aria-label="Open cart"
            >
              <ShoppingCart size={18} />
              {cartCount > 0 && <span className="cm-badge">{cartCount}</span>}
            </button>
          ) : canGoBack(step) || step === 'waiting' ? (
            <button type="button" className="cm-ghost-btn" onClick={goBack}>
              <ArrowLeft size={16} /> Back
            </button>
          ) : null}
        </div>
      </header>

      <StepProgress step={step} />

      {error && step !== 'waiting' ? <div className="cm-error">{error}</div> : null}

      {step === 'menu' && (
        <MenuStep
          items={items}
          cart={cart}
          selectedCategory={selectedCategory}
          onCategory={setSelectedCategory}
          onAdd={addToCart}
          onUpdateQty={updateQuantity}
        />
      )}

      {step === 'cart' && (
        <CartStep
          cartItems={cartItems}
          cartTotal={cartTotal}
          onUpdateQty={updateQuantity}
          onRemove={removeItem}
          onBackToMenu={() => setStep('menu')}
        />
      )}

      {step === 'details' && (
        <DetailsStep
          business={business}
          customerName={customerName}
          customerLocation={customerLocation}
          customerNote={customerNote}
          nameError={nameError}
          onName={(v) => {
            setCustomerName(v)
            if (nameError) setNameError(null)
          }}
          onLocation={setCustomerLocation}
          onNote={setCustomerNote}
        />
      )}

      {step === 'pay' && (
        <PayStep
          business={business}
          cartItems={cartItems}
          cartTotal={cartTotal}
          provider={provider}
          phone={phone}
          saveNumber={saveNumber}
          deviceKnown={deviceKnown}
          savedPhone={savedDevice?.primaryPhone}
          phoneError={phoneError}
          submitting={submitting}
          onProvider={setProvider}
          onPhone={(v) => {
            setPhone(formatUgPhoneHint(v))
            if (phoneError) setPhoneError(null)
          }}
          onSaveNumber={setSaveNumber}
        />
      )}

      {step === 'waiting' && placedOrderId && (
        <WaitingStep
          businessName={business.name}
          orderId={placedOrderId}
          total={paidTotal || cartTotal}
          provider={provider}
          phone={phone}
          status={paymentStatus}
          error={error}
          onRetry={() => void retryPayment()}
          onChangeNumber={() => {
            setStep('pay')
            setError(null)
          }}
        />
      )}

      {step === 'done' && (
        <DoneStep
          businessName={business.name}
          orderId={placedOrderId}
          total={paidTotal}
          onOrderMore={orderMore}
        />
      )}

      {showBottomMenu && (
        <BottomBar count={cartCount} total={cartTotal} label="View cart" onAction={() => setStep('cart')} />
      )}
      {showBottomCart && (
        <BottomBar count={cartCount} total={cartTotal} label="Continue" onAction={goDetails} />
      )}
      {showBottomDetails && (
        <BottomBar
          count={cartCount}
          total={cartTotal}
          label="Proceed to pay"
          onAction={goPay}
          disabled={cartCount === 0}
        />
      )}
      {showBottomPay && (
        <BottomBar
          count={Math.max(cartCount, payCount)}
          total={payTotal}
          label={submitting ? 'Sending…' : `Pay ${currency(payTotal)}`}
          onAction={() => void submitPayment()}
          loading={submitting}
          disabled={submitting || (!placedOrderId && cartCount === 0)}
        />
      )}
    </div>
  )
}
