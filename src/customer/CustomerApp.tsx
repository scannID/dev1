import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Package, Receipt, ShoppingCart, X } from 'lucide-react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { businessApi, devicesApi, feesApi, ordersApi } from '../api/services'
import type { Business, CatalogItem, OrderStatus, RegisteredDevice } from '../api/types'
import { BottomBar } from './BottomBar'
import { payments, type PaymentProvider, type PaymentStatus } from './payments'
import { KodeMark } from './KodeMark'
import {
  clearActiveOrder,
  clearCheckoutDraft,
  loadActiveOrder,
  loadCheckoutDraft,
  saveActiveOrder,
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
import { OrderTrackingPanel } from './OrderTrackingPanel'
import { ReceiptsPanel } from './ReceiptsPanel'
import { cartLineKey, normalizeRemovedIngredients, parseCartLineKey } from '../lib/catalogCart'
import { effectivePrice } from '../lib/catalogPricing'
import {
  buildReceipt,
  getReceiptCount,
  loadReceipts,
  saveReceipt,
  type CustomerReceipt,
} from './receipts'
import { useOrderTracking } from './useOrderTracking'
import { currency, formatUgPhoneHint, getOrCreateDeviceId, DEFAULT_SERVICE_FEE_UGX, withServiceFee } from './utils'
import { UtensilLoader } from './UtensilLoader'
import './CustomerApp.css'

const PROGRESS_STEPS: CheckoutStep[] = ['menu', 'cart', 'details', 'pay']

/** In-memory guard so React StrictMode remounts don't fire two scan POSTs before sessionStorage sticks. */
const recordedScanKeys = new Set<string>()

export default function CustomerApp({
  businessId,
  qrToken,
}: {
  businessId: string
  qrToken?: string | null
}) {
  const draft = useMemo(() => loadCheckoutDraft(businessId), [businessId])
  const savedActiveOrder = useMemo(() => loadActiveOrder(businessId), [businessId])

  const [business, setBusiness] = useState<Business | null>(null)
  const [items, setItems] = useState<CatalogItem[]>([])
  const [popularItems, setPopularItems] = useState<CatalogItem[]>([])
  const [estimatedWaitMinutes, setEstimatedWaitMinutes] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [serviceFeeUgx, setServiceFeeUgx] = useState(DEFAULT_SERVICE_FEE_UGX)

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
  const [locationError, setLocationError] = useState<string | null>(null)

  const [provider, setProvider] = useState<PaymentProvider>(draft?.provider ?? 'MTN')
  const [phone, setPhone] = useState(draft?.phone ?? '')
  const [saveNumber, setSaveNumber] = useState(draft?.saveNumber ?? true)
  const [phoneError, setPhoneError] = useState<string | null>(null)

  const [deviceKnown, setDeviceKnown] = useState(false)
  const [savedDevice, setSavedDevice] = useState<RegisteredDevice | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [placedOrderId, setPlacedOrderId] = useState<string | null>(savedActiveOrder?.orderId ?? null)
  const [orderPublicId, setOrderPublicId] = useState<string | null>(savedActiveOrder?.publicId ?? null)
  const [paymentId, setPaymentId] = useState<string | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('PENDING')
  const [paidTotal, setPaidTotal] = useState(0)
  const [fulfillmentStatus, setFulfillmentStatus] = useState<OrderStatus>('Pending')
  const [showTracking, setShowTracking] = useState(false)
  const [showReceipts, setShowReceipts] = useState(false)
  const [receipts, setReceipts] = useState<CustomerReceipt[]>(() => loadReceipts())
  const [receiptCount, setReceiptCount] = useState(() => getReceiptCount())

  const trackOrder = Boolean(orderPublicId) && Boolean(phone.trim())
  const {
    order: trackedOrder,
    loading: trackingLoading,
    error: trackingError,
  } = useOrderTracking(orderPublicId, phone, trackOrder)

  const cartItems: CartLine[] = useMemo(() => {
    return Object.entries(cart)
      .map(([lineKey, quantity]) => {
        const { itemId, removedIngredients } = parseCartLineKey(lineKey)
        const item = items.find((i) => i.id === itemId)
        return item
          ? {
              ...item,
              quantity,
              removedIngredients,
              lineKey,
            }
          : null
      })
      .filter((item): item is CartLine => item !== null)
  }, [items, cart])

  const cartTotal = cartItems.reduce((sum, item) => sum + effectivePrice(item) * item.quantity, 0)
  const payableTotal = withServiceFee(cartTotal, serviceFeeUgx)
  const cartCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0)

  const persistPaidReceipt = useCallback(
    (orderId: string, total: number, items: CartLine[]) => {
      if (!business || items.length === 0) return
      const receipt = buildReceipt({
        orderId,
        businessId: business.id,
        businessName: business.name,
        businessLogoUrl: business.logoUrl,
        customerName: customerName.trim() || 'Guest',
        customerPhone: phone.trim(),
        items: items.map((item) => ({
          itemId: item.id,
          name: item.name,
          quantity: item.quantity,
          price: effectivePrice(item),
          removedIngredients: item.removedIngredients,
        })),
        total,
        provider,
        serviceFeeUgx,
      })
      const next = saveReceipt(receipt)
      setReceipts(next)
      setReceiptCount(next.length)
    },
    [business, customerName, phone, provider, serviceFeeUgx],
  )

  useEffect(() => {
    if (!trackedOrder) return
    setFulfillmentStatus(trackedOrder.status)
    setPaidTotal(trackedOrder.total)
    if (trackedOrder.paymentStatus === 'Paid' && step === 'waiting' && paymentStatus !== 'PAID') {
      setPaymentStatus('PAID')
      if (placedOrderId) {
        const itemsForReceipt =
          cartItems.length > 0
            ? cartItems
            : trackedOrder.items.map((item, index) => ({
                id: item.name,
                name: item.name,
                category: '',
                price: Math.round(
                  Math.max(trackedOrder.total - (trackedOrder.serviceFee ?? serviceFeeUgx), 0) /
                    Math.max(
                      trackedOrder.items.reduce((sum, entry) => sum + entry.quantity, 0),
                      1,
                    ),
                ),
                description: '',
                available: true,
                quantity: item.quantity,
                removedIngredients: item.removedIngredients ?? [],
                lineKey: `${item.name}-${index}`,
              }))
        persistPaidReceipt(placedOrderId, trackedOrder.total, itemsForReceipt)
      }
      clearCheckoutDraft(businessId)
      setCart({})
      setStep('done')
    }
  }, [trackedOrder, step, paymentStatus, businessId, placedOrderId, cartItems, persistPaidReceipt, serviceFeeUgx])

  useEffect(() => {
    let cancelled = false
    feesApi
      .get()
      .then((fees) => {
        if (!cancelled && typeof fees.serviceFeeUgx === 'number') {
          setServiceFeeUgx(fees.serviceFeeUgx)
        }
      })
      .catch(() => {
        /* keep DEFAULT_SERVICE_FEE_UGX */
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadMenu() {
      try {
        setLoading(true)
        setError(null)
        const started = Date.now()
        const menu = await businessApi.getMenu(businessId, qrToken || undefined)
        const remaining = Math.max(0, 700 - (Date.now() - started))
        if (remaining > 0) await new Promise((r) => setTimeout(r, remaining))
        if (cancelled) return
        setBusiness(menu.business)
        setItems(menu.items ?? [])
        setPopularItems(menu.popular ?? [])
        setEstimatedWaitMinutes(
          typeof menu.estimatedWaitMinutes === 'number' ? menu.estimatedWaitMinutes : null,
        )
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

  // One scan beacon per business/QR open — not tied to menu GET (avoids StrictMode/double-fetch inflation).
  useEffect(() => {
    const key = `Kode:scan:${businessId}:${qrToken || ''}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, String(Date.now()))
    } catch {
      // private mode / blocked storage — still attempt once via module guard below
    }
    if (recordedScanKeys.has(key)) return
    recordedScanKeys.add(key)
    void businessApi.recordScan(businessId, qrToken || undefined).catch(() => {
      recordedScanKeys.delete(key)
      try {
        sessionStorage.removeItem(key)
      } catch {
        /* ignore */
      }
    })
  }, [businessId, qrToken])

  const restoredActiveOrder = useRef(false)

  useEffect(() => {
    if (restoredActiveOrder.current || !savedActiveOrder || draft?.step) return
    restoredActiveOrder.current = true
    setPlacedOrderId(savedActiveOrder.orderId)
    setOrderPublicId(savedActiveOrder.publicId)
    if (savedActiveOrder.phone) {
      setPhone(savedActiveOrder.phone)
    }
    setStep('waiting')
  }, [savedActiveOrder, draft?.step])

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

  const addToCart = useCallback((itemId: string, removedIngredients?: string[]) => {
    const key = cartLineKey(itemId, normalizeRemovedIngredients(removedIngredients))
    setCart((prev) => ({ ...prev, [key]: (prev[key] || 0) + 1 }))
  }, [])

  const updateQuantity = useCallback((lineKey: string, delta: number) => {
    setCart((prev) => {
      const nextQty = (prev[lineKey] || 0) + delta
      if (nextQty <= 0) {
        const { [lineKey]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [lineKey]: nextQty }
    })
  }, [])

  const removeItem = useCallback((lineKey: string) => {
    setCart((prev) => {
      const { [lineKey]: _, ...rest } = prev
      return rest
    })
  }, [])

  const reorderFromReceipt = useCallback(
    (receipt: CustomerReceipt) => {
      if (!business || receipt.businessId !== business.id) {
        toast.error('This receipt is from another place')
        return
      }
      const next: Record<string, number> = {}
      let added = 0
      let skipped = 0
      for (const line of receipt.items) {
        let catalogId = line.itemId
        if (!catalogId) {
          const match = items.find(
            (item) => item.available && item.name.toLowerCase() === line.name.toLowerCase(),
          )
          catalogId = match?.id
        }
        const catalog = catalogId ? items.find((item) => item.id === catalogId && item.available) : undefined
        if (!catalog) {
          skipped += 1
          continue
        }
        const key = cartLineKey(catalog.id, line.removedIngredients)
        next[key] = (next[key] || 0) + Math.max(1, line.quantity)
        added += 1
      }
      if (added === 0) {
        toast.error('None of these items are on the menu right now')
        return
      }
      setCart(next)
      setShowReceipts(false)
      setStep('cart')
      toast.success(
        skipped > 0
          ? `Added ${added} item${added === 1 ? '' : 's'} (${skipped} unavailable)`
          : `Added ${added} item${added === 1 ? '' : 's'} to cart`,
      )
    },
    [business, items],
  )

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
    setLocationError(null)
    if (cartCount === 0) {
      setStep('menu')
      return
    }
    setStep('details')
  }

  function goPay() {
    let valid = true
    if (!customerName.trim()) {
      setNameError('Enter your name to continue')
      valid = false
    } else {
      setNameError(null)
    }
    if (!customerLocation.trim()) {
      const label = (business?.tableLabel || 'Table / location').toLowerCase()
      setLocationError(`Enter your ${label} to continue`)
      valid = false
    } else {
      setLocationError(null)
    }
    if (!valid) return
    setStep('pay')
  }

  function validatePhone(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return 'Enter your mobile money number'
    const digits = trimmed.replace(/\D/g, '')
    // UG local 07XXXXXXXX (10) or +2567XXXXXXXX (12) or 2567XXXXXXXX (12)
    if (digits.length === 10 && /^0[67]\d{8}$/.test(digits)) return null
    if (digits.length === 12 && /^256[67]\d{8}$/.test(digits)) return null
    if (digits.length === 9 && /^[67]\d{8}$/.test(digits)) return null
    if (digits.length < 9) return 'Enter a valid mobile money number'
    return 'Use a valid UG number (07… or +256…)'
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
      persistPaidReceipt(orderId, amount, cartItems)
      clearCheckoutDraft(businessId)
      setCart({})
      setStep('done')
    } else {
      setStep('waiting')
    }
  }

  async function submitPayment() {
    if (!business) return
    if (!customerName.trim() || !customerLocation.trim()) {
      if (!customerName.trim()) setNameError('Enter your name to continue')
      if (!customerLocation.trim()) {
        const label = (business.tableLabel || 'Table / location').toLowerCase()
        setLocationError(`Enter your ${label} to continue`)
      }
      setStep('details')
      return
    }
    const phoneIssue = validatePhone(phone)
    if (phoneIssue) {
      setPhoneError(phoneIssue)
      return
    }
    if (!provider) {
      setError('Choose MTN or Airtel to continue')
      return
    }

    setPhoneError(null)
    setSubmitting(true)
    setError(null)
    try {
      // Re-prompt payment for an already-placed order (e.g. after changing number)
      if (placedOrderId) {
        await startPaymentForOrder(placedOrderId, paidTotal || payableTotal)
        return
      }

      if (cartItems.length === 0) return

      const order = await ordersApi.create(business.id, {
        customer: {
          name: customerName.trim(),
          phone: phone.trim(),
          location: customerLocation.trim(),
          note: customerNote.trim() || undefined,
        },
        items: cartItems.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          removedIngredients: item.removedIngredients,
        })),
      })

      setPlacedOrderId(order.id)
      setPaidTotal(order.total || payableTotal)
      toast.success('Order placed successfully')
      if (order.publicId) {
        setOrderPublicId(order.publicId)
        saveActiveOrder(businessId, {
          publicId: order.publicId,
          orderId: order.id,
          phone: phone.trim(),
        })
      }

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

      await startPaymentForOrder(order.id, order.total || payableTotal)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to place order'
      setError(message)
      toast.error(message)
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
      await startPaymentForOrder(placedOrderId, paidTotal || payableTotal)
    } catch (err) {
      setPaymentStatus('FAILED')
      const message = err instanceof Error ? err.message : 'Failed to retry payment'
      setError(message)
      toast.error(message)
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
          if (placedOrderId) {
            persistPaidReceipt(placedOrderId, paidTotal || payableTotal, cartItems)
          }
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
  }, [step, paymentId, paymentStatus, businessId, placedOrderId, paidTotal, payableTotal, cartItems, persistPaidReceipt])

  function orderMore() {
    clearCheckoutDraft(businessId)
    clearActiveOrder(businessId)
    setCart({})
    setCustomerNote('')
    setCustomerLocation('')
    setPlacedOrderId(null)
    setOrderPublicId(null)
    setPaymentId(null)
    setPaymentStatus('PENDING')
    setPaidTotal(0)
    setFulfillmentStatus('Pending')
    setError(null)
    setStep('menu')
  }

  function cancelFlow() {
    clearCheckoutDraft(businessId)
    clearActiveOrder(businessId)
    setCart({})
    setCustomerName('')
    setCustomerLocation('')
    setCustomerNote('')
    setNameError(null)
    setLocationError(null)
    setProvider('MTN')
    setPhone(savedDevice?.primaryPhone ?? '')
    setSaveNumber(!deviceKnown)
    setPhoneError(null)
    setSubmitting(false)
    setPlacedOrderId(null)
    setOrderPublicId(null)
    setPaymentId(null)
    setPaymentStatus('PENDING')
    setPaidTotal(0)
    setFulfillmentStatus('Pending')
    setError(null)
    setSelectedCategory('all')
    setStep('menu')
  }

  if (loading) {
    return (
      <div className="cm-page cm-centered cm-boot">
        <UtensilLoader />
      </div>
    )
  }

  if (!business) {
    return (
      <div className="cm-page cm-centered">
        <KodeMark />
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
  const payTotal = paidTotal || payableTotal
  const payCount = cartCount || (placedOrderId ? 1 : 0)
  const canCancel =
    step !== 'done' && (step !== 'menu' || cartCount > 0 || Boolean(placedOrderId) || Boolean(paymentId))

  return (
    <div className="cm-page" style={{ ['--cm-accent' as string]: accent }}>
      <Toaster />
      <header className="cm-topbar">
        <div className="cm-brand">
          {business.logoUrl ? (
            <img src={business.logoUrl} alt="" className="cm-brand-logo" />
          ) : (
            <KodeMark size={30} />
          )}
          <div className="cm-brand-text">
            <span className="cm-brand-name">Kode</span>
            <span className="cm-brand-biz">{business.name}</span>
          </div>
        </div>
        <div className="cm-topbar-actions">
          {canCancel ? (
            <button
              type="button"
              className="cm-cancel-btn"
              onClick={cancelFlow}
              disabled={submitting}
              aria-label="Cancel"
            >
              <X size={16} />
            </button>
          ) : null}
          {orderPublicId ? (
            <button
              type="button"
              className="cm-track-btn"
              onClick={() => setShowTracking(true)}
              aria-label="Track order"
            >
              <Package size={18} />
            </button>
          ) : null}
          {receiptCount > 0 ? (
            <button
              type="button"
              className={`cm-receipt-btn${showReceipts ? ' active' : ''}`}
              onClick={() => setShowReceipts(true)}
              aria-label={`${receiptCount} receipts on this device`}
            >
              <Receipt size={18} />
              <span className="cm-badge">{receiptCount > 99 ? '99+' : receiptCount}</span>
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
          popularItems={popularItems}
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
          serviceFeeUgx={serviceFeeUgx}
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
          locationError={locationError}
          onName={(v) => {
            setCustomerName(v)
            if (nameError) setNameError(null)
          }}
          onLocation={(v) => {
            setCustomerLocation(v)
            if (locationError) setLocationError(null)
          }}
          onNote={setCustomerNote}
        />
      )}

      {step === 'pay' && (
        <PayStep
          business={business}
          cartItems={cartItems}
          cartTotal={cartTotal}
          serviceFeeUgx={serviceFeeUgx}
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
          total={paidTotal || payableTotal}
          provider={provider}
          phone={phone}
          status={paymentStatus}
          orderStatus={trackedOrder?.status ?? fulfillmentStatus}
          estimatedWaitMinutes={
            trackedOrder?.estimatedWaitMinutes ?? estimatedWaitMinutes ?? undefined
          }
          trackingLoading={trackingLoading}
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
          orderStatus={trackedOrder?.status ?? fulfillmentStatus}
          estimatedWaitMinutes={
            trackedOrder?.estimatedWaitMinutes ?? estimatedWaitMinutes ?? undefined
          }
          trackingLoading={trackingLoading}
          trackingError={trackingError}
          onOrderMore={orderMore}
        />
      )}

      {showBottomMenu && (
        <BottomBar count={cartCount} total={payableTotal} label="View cart" onAction={() => setStep('cart')} />
      )}
      {showBottomCart && (
        <BottomBar count={cartCount} total={payableTotal} label="Continue" onAction={goDetails} />
      )}
      {showBottomDetails && (
        <BottomBar
          count={cartCount}
          total={payableTotal}
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

      <OrderTrackingPanel
        open={showTracking}
        order={trackedOrder}
        loading={trackingLoading}
        error={trackingError}
        onClose={() => setShowTracking(false)}
      />

      <ReceiptsPanel
        open={showReceipts}
        receipts={receipts}
        currentBusinessId={business.id}
        onReorder={reorderFromReceipt}
        onClose={() => setShowReceipts(false)}
      />
    </div>
  )
}
