import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Clock3, History, Package, Receipt, ShoppingCart, X } from 'lucide-react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { businessApi, devicesApi, feesApi, fxApi, ordersApi } from '../api/services'
import type { Business, CatalogItem, OrderStatus, RegisteredDevice } from '../api/types'
import { BottomBar } from './BottomBar'
import { payments, type PaymentProvider, type PaymentStatus } from './payments'
import { KodeMark } from './KodeMark'
import { OrderHistoryPanel } from './OrderHistoryPanel'
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
import { StayStep } from './steps/StayStep'
import { PayStep, type SplitShareDraft } from './steps/PayStep'
import { validateCustomSplit } from './splitValidation'
import { WaitingStep, type SplitShareLive } from './steps/WaitingStep'
import { OrderTrackingPanel } from './OrderTrackingPanel'
import { ReceiptsPanel } from './ReceiptsPanel'
import {
  cartLineKey,
  isLodgingItem,
  nightsBetween,
  normalizeRemovedIngredients,
  parseCartLineKey,
} from '../lib/catalogCart'
import { effectivePrice } from '../lib/catalogPricing'
import {
  buildReceipt,
  getReceiptCount,
  loadReceipts,
  saveReceipt,
  type CustomerReceipt,
} from './receipts'
import { useOrderTracking } from './useOrderTracking'
import {
  currency,
  formatUgPhoneHint,
  getOrCreateDeviceId,
  DEFAULT_SERVICE_FEE_UGX,
  setLiveUgxPerUsd,
  withServiceFee,
} from './utils'
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
  const [, setFxTick] = useState(0)

  const [cart, setCart] = useState<Record<string, number>>(draft?.cart ?? {})
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [browseMode, setBrowseMode] = useState<'stay' | 'food'>('stay')
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
  const [splitEnabled, setSplitEnabled] = useState(false)
  const [splitShares, setSplitShares] = useState<SplitShareDraft[]>([])
  const [splitSummary, setSplitSummary] = useState<SplitShareLive[] | null>(null)
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
  const [showHistory, setShowHistory] = useState(false)
  const [receipts, setReceipts] = useState<CustomerReceipt[]>(() => loadReceipts())
  const [receiptCount, setReceiptCount] = useState(() => getReceiptCount())
  const [ordersPaused, setOrdersPaused] = useState(false)
  const [busyBanner, setBusyBanner] = useState<string | null>(null)

  const trackOrder = Boolean(orderPublicId) && Boolean(phone.trim())
  const {
    order: trackedOrder,
    loading: trackingLoading,
    error: trackingError,
  } = useOrderTracking(orderPublicId, phone, trackOrder)

  const cartItems: CartLine[] = useMemo(() => {
    return Object.entries(cart)
      .map(([lineKey, quantity]) => {
        const { itemId, removedIngredients, checkInDate, checkOutDate } = parseCartLineKey(lineKey)
        const item = items.find((i) => i.id === itemId)
        if (!item) return null
        const nights =
          checkInDate && checkOutDate ? nightsBetween(checkInDate, checkOutDate) : undefined
        return {
          ...item,
          quantity,
          removedIngredients,
          lineKey,
          checkInDate,
          checkOutDate,
          nights,
        }
      })
      .filter((item): item is CartLine => item !== null)
  }, [items, cart])

  const checkoutMode = useMemo<'food' | 'stay'>(() => {
    if (cartItems.length > 0) {
      return cartItems.every((item) => isLodgingItem(item)) ? 'stay' : 'food'
    }
    if (business?.type === 'Hotel' && browseMode === 'stay') return 'stay'
    return 'food'
  }, [cartItems, business?.type, browseMode])

  const cartTotal = cartItems.reduce((sum, item) => {
    const unit = effectivePrice(item)
    if (isLodgingItem(item) && item.nights) {
      return sum + unit * item.nights * item.quantity
    }
    return sum + unit * item.quantity
  }, 0)
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
    const refreshLiveFx = async () => {
      try {
        const rate = await fxApi.ugxPerUsd()
        if (cancelled) return
        setLiveUgxPerUsd(rate)
        setFxTick((v) => v + 1)
      } catch {
        // keep last known rate or env fallback
      }
    }
    void refreshLiveFx()
    const id = window.setInterval(() => {
      void refreshLiveFx()
    }, 1000 * 60 * 5)
    return () => {
      cancelled = true
      window.clearInterval(id)
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
        if (menu.business.type === 'Hotel') {
          setBrowseMode('stay')
        }
        setEstimatedWaitMinutes(
          typeof menu.estimatedWaitMinutes === 'number' ? menu.estimatedWaitMinutes : null,
        )
        const accepting = menu.business.acceptingOrders !== false
        setOrdersPaused(!accepting)
        if (menu.business.busyMode) {
          const eta = menu.business.busyEtaMinutes
          setBusyBanner(
            menu.business.pauseMessage?.trim()
              || (typeof eta === 'number' && eta > 0
                ? `Kitchen is busy — about ${eta} min wait`
                : 'Kitchen is busy right now'),
          )
        } else {
          setBusyBanner(null)
        }
        if (!accepting) {
          setBusyBanner(
            menu.business.pauseMessage?.trim() || 'This location is not accepting orders right now.',
          )
        }
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

  // Record one scan per open. Server also dedupes (~45s). sessionStorage only
  // suppresses rapid reloads in the same tab so counts still move on real revisits.
  useEffect(() => {
    const key = `Kode:scan:${businessId}:${qrToken || ''}`
    const DEDUPE_MS = 45_000
    const now = Date.now()

    try {
      const prev = Number(sessionStorage.getItem(key) || 0)
      if (Number.isFinite(prev) && prev > 0 && now - prev < DEDUPE_MS) return
    } catch {
      // private mode / blocked storage
    }

    // In-memory guard for React StrictMode double-mount in the same tick.
    if (recordedScanKeys.has(key)) return
    recordedScanKeys.add(key)

    let cancelled = false
    void businessApi
      .recordScan(businessId, qrToken || undefined)
      .then(() => {
        // Persist even if this effect was cleaned up (StrictMode) — the scan was saved.
        try {
          sessionStorage.setItem(key, String(now))
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        if (!cancelled) recordedScanKeys.delete(key)
      })
      .finally(() => {
        window.setTimeout(() => {
          recordedScanKeys.delete(key)
        }, DEDUPE_MS)
      })

    return () => {
      cancelled = true
    }
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

  const addStayToCart = useCallback((itemId: string, checkInDate: string, checkOutDate: string) => {
    const key = cartLineKey(itemId, null, { checkInDate, checkOutDate })
    setCart((prev) => ({ ...prev, [key]: (prev[key] || 0) + 1 }))
    setStep('cart')
    toast.success('Stay added to cart')
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
    if (ordersPaused) {
      setError(busyBanner || 'This location is not accepting orders right now.')
      return
    }
    setNameError(null)
    setLocationError(null)
    if (cartCount === 0) {
      setStep('menu')
      return
    }
    const incompleteStay = cartItems.some(
      (item) => isLodgingItem(item) && (!item.checkInDate || !item.checkOutDate || !item.nights),
    )
    if (incompleteStay) {
      setError('Each stay needs valid check-in and check-out dates')
      setStep('menu')
      setBrowseMode('stay')
      return
    }
    setError(null)
    setStep('details')
  }

  function goPay() {
    let valid = true
    if (!customerName.trim()) {
      setNameError(checkoutMode === 'stay' ? 'Enter the guest name to continue' : 'Enter your name to continue')
      valid = false
    } else {
      setNameError(null)
    }
    if (checkoutMode !== 'stay' && !customerLocation.trim()) {
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
    setSplitSummary(null)
    if (payment.status === 'PAID') {
      persistPaidReceipt(orderId, amount, cartItems)
      clearCheckoutDraft(businessId)
      setCart({})
      setStep('done')
    } else {
      setStep('waiting')
    }
  }

  async function startSplitPayments(
    orderId: string,
    publicId: string,
    shares: Array<{ name: string; phone: string; amount: number }>,
    orderTotal: number,
  ) {
    const { operationsApi } = await import('../api/operations')
    const created = await operationsApi.createPublicCustomSplits(publicId, {
      shares: shares.map((share) => ({
        payerName: share.name,
        payerPhone: share.phone,
        amount: share.amount,
      })),
    })

    const live: SplitShareLive[] = []
    for (let i = 0; i < created.length; i++) {
      const split = created[i]
      const draft = shares[i]
      try {
        const payment = await payments.initiateSplit({
          splitId: split.id,
          provider,
          phone: (draft?.phone || split.payerPhone || '').trim(),
          amount: split.amount,
          businessId,
          customerName: draft?.name || split.payerName,
        })
        live.push({
          name: draft?.name || split.payerName,
          phone: draft?.phone || split.payerPhone,
          amount: split.amount,
          splitId: split.id,
          paymentId: payment.paymentId,
          status: payment.status,
        })
      } catch {
        live.push({
          name: draft?.name || split.payerName,
          phone: draft?.phone || split.payerPhone,
          amount: split.amount,
          splitId: split.id,
          status: 'FAILED',
        })
      }
    }

    setSplitSummary(live)
    setPaymentId(live.find((s) => s.paymentId)?.paymentId ?? null)

    const allPaid = live.length > 0 && live.every((s) => s.status === 'PAID')
    const anyFailed = live.some((s) => s.status === 'FAILED')
    if (allPaid) {
      setPaymentStatus('PAID')
      persistPaidReceipt(orderId, orderTotal, cartItems)
      clearCheckoutDraft(businessId)
      setCart({})
      setStep('done')
      return
    }
    setPaymentStatus(anyFailed && live.every((s) => s.status !== 'PENDING') ? 'FAILED' : 'PENDING')
    setStep('waiting')
  }

  async function retryUnpaidSplits() {
    if (!splitSummary?.length || !business) return
    setSubmitting(true)
    setError(null)
    try {
      const next: SplitShareLive[] = []
      for (const share of splitSummary) {
        if (share.status === 'PAID') {
          next.push(share)
          continue
        }
        if (!share.splitId) {
          next.push({ ...share, status: 'FAILED' })
          continue
        }
        const payment = await payments.initiateSplit({
          splitId: share.splitId,
          provider,
          phone: share.phone.trim(),
          amount: share.amount,
          businessId,
          customerName: share.name,
        })
        next.push({
          ...share,
          paymentId: payment.paymentId,
          status: payment.status,
        })
      }
      setSplitSummary(next)
      setPaymentId(next.find((s) => s.paymentId && s.status === 'PENDING')?.paymentId ?? next[0]?.paymentId ?? null)
      const allPaid = next.every((s) => s.status === 'PAID')
      const anyPending = next.some((s) => s.status === 'PENDING')
      if (allPaid) {
        setPaymentStatus('PAID')
        if (placedOrderId) {
          persistPaidReceipt(placedOrderId, paidTotal || payableTotal, cartItems)
        }
        clearCheckoutDraft(businessId)
        setCart({})
        setStep('done')
      } else {
        setPaymentStatus(anyPending ? 'PENDING' : 'FAILED')
      }
    } catch (err) {
      setPaymentStatus('FAILED')
      const message = err instanceof Error ? err.message : 'Failed to retry split payments'
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  async function submitPayment() {
    if (ordersPaused && !placedOrderId) {
      setError(busyBanner || 'This location is not accepting orders right now.')
      return
    }
    if (!business) return
    const needsLocation = checkoutMode !== 'stay'
    if (!customerName.trim() || (needsLocation && !customerLocation.trim())) {
      if (!customerName.trim()) {
        setNameError(checkoutMode === 'stay' ? 'Enter the guest name to continue' : 'Enter your name to continue')
      }
      if (needsLocation && !customerLocation.trim()) {
        const label = (business.tableLabel || 'Table / location').toLowerCase()
        setLocationError(`Enter your ${label} to continue`)
      }
      setStep('details')
      return
    }

    const splitAllocation = splitEnabled
      ? splitShares.map((share, index) => ({
          name: share.name.trim() || `Guest ${index + 1}`,
          phone: share.phone.trim(),
          amount: Math.round(Number(share.amount) || 0),
        }))
      : null

    if (splitAllocation) {
      const validation = validateCustomSplit(payableTotal, splitShares, validatePhone)
      if (!validation.ok) {
        const first = validation.errors[0] ?? 'Fix the split before paying'
        if (/phone|MoMo|number/i.test(first)) {
          setPhoneError(first)
        } else {
          setError(first)
        }
        return
      }
      // Order contact = first payer
      setPhone(splitAllocation[0].phone)
    } else {
      const phoneIssue = validatePhone(phone)
      if (phoneIssue) {
        setPhoneError(phoneIssue)
        return
      }
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
        if (splitSummary?.length) {
          await retryUnpaidSplits()
          return
        }
        await startPaymentForOrder(placedOrderId, paidTotal || payableTotal)
        return
      }

      if (cartItems.length === 0) return

      const orderPhone = splitAllocation?.[0]?.phone || phone.trim()

      // Only attach table session when a real table scan was used.
      // Business menu QR also uses ?qr= — never send that as a table token.
      const url = new URL(window.location.href)
      const tableId = url.searchParams.get('table') || undefined
      const tableQrToken = tableId
        ? url.searchParams.get('tableQr') || url.searchParams.get('tqr') || undefined
        : undefined

      const order = await ordersApi.create(business.id, {
        customer: {
          name: customerName.trim(),
          phone: orderPhone,
          location: checkoutMode === 'stay' ? '' : customerLocation.trim(),
          note: customerNote.trim() || undefined,
        },
        items: cartItems.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          removedIngredients: item.removedIngredients,
          checkInDate: item.checkInDate,
          checkOutDate: item.checkOutDate,
        })),
        tableId,
        tableQrToken,
      })

      setPlacedOrderId(order.id)
      setPaidTotal(order.total || payableTotal)
      toast.success('Order placed successfully')
      if (order.publicId) {
        setOrderPublicId(order.publicId)
        saveActiveOrder(businessId, {
          publicId: order.publicId,
          orderId: order.id,
          phone: orderPhone,
        })
      }

      if (!deviceKnown && saveNumber && !splitAllocation) {
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

      if (splitAllocation && order.publicId) {
        toast.message('Sending MoMo prompts to each payer…')
        await startSplitPayments(order.id, order.publicId, splitAllocation, order.total || payableTotal)
      } else {
        setSplitSummary(null)
        await startPaymentForOrder(order.id, order.total || payableTotal)
      }
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
    if (splitSummary?.length) {
      await retryUnpaidSplits()
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

  const pendingSplitPaymentKey = (splitSummary ?? [])
    .filter((s) => s.paymentId && s.status === 'PENDING')
    .map((s) => s.paymentId)
    .join('|')

  useEffect(() => {
    if (step !== 'waiting') return
    if (paymentStatus === 'PAID' || paymentStatus === 'FAILED') return

    if (splitSummary && splitSummary.length > 0) {
      const multiIds = splitSummary
        .filter((s) => s.paymentId && s.status === 'PENDING')
        .map((s) => s.paymentId!)

      if (multiIds.length === 0) {
        const allPaid = splitSummary.every((s) => s.status === 'PAID')
        if (allPaid) {
          setPaymentStatus('PAID')
          if (placedOrderId) {
            persistPaidReceipt(placedOrderId, paidTotal || payableTotal, cartItems)
          }
          clearCheckoutDraft(businessId)
          setCart({})
          setStep('done')
        } else if (splitSummary.some((s) => s.status === 'FAILED')) {
          setPaymentStatus('FAILED')
        }
        return
      }

      let cancelled = false
      const tick = async () => {
        try {
          const updates = await Promise.all(
            multiIds.map(async (id) => {
              const result = await payments.status(id)
              return { paymentId: id, status: result.status as PaymentStatus }
            }),
          )
          if (cancelled) return

          setSplitSummary((current) => {
            if (!current) return current
            const next = current.map((share) => {
              const hit = updates.find((u) => u.paymentId === share.paymentId)
              return hit ? { ...share, status: hit.status } : share
            })
            const allPaid = next.every((s) => s.status === 'PAID')
            const anyPending = next.some((s) => s.status === 'PENDING')
            if (allPaid) {
              setPaymentStatus('PAID')
              if (placedOrderId) {
                persistPaidReceipt(placedOrderId, paidTotal || payableTotal, cartItems)
              }
              clearCheckoutDraft(businessId)
              setCart({})
              setStep('done')
            } else if (!anyPending) {
              setPaymentStatus('FAILED')
            }
            return next
          })
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
    }

    if (!paymentId) return

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
  }, [
    step,
    paymentId,
    paymentStatus,
    pendingSplitPaymentKey,
    businessId,
    placedOrderId,
    paidTotal,
    payableTotal,
    cartItems,
    persistPaidReceipt,
  ])

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
    setSplitEnabled(false)
    setSplitShares([])
    setSplitSummary(null)
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
    setSplitEnabled(false)
    setSplitShares([])
    setSplitSummary(null)
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

  const showBottomMenu = step === 'menu' && cartCount > 0
  const showBottomCart = step === 'cart' && cartCount > 0
  const showBottomDetails = step === 'details'
  const showBottomPay = step === 'pay'
  const payTotal = paidTotal || payableTotal
  const payCount = cartCount || (placedOrderId ? 1 : 0)
  const splitAllocated = splitShares.reduce((sum, share) => sum + (Math.round(Number(share.amount)) || 0), 0)
  const splitPhonesOk =
    !splitEnabled ||
    (splitShares.length >= 2 &&
      splitShares.every((share) => !validatePhone(share.phone.trim())))
  const splitReady =
    !splitEnabled || (splitShares.length >= 2 && splitAllocated === payableTotal && splitPhonesOk)
  const payBlocked = submitting || (step === 'pay' && !splitReady)
  const canCancel =
    step !== 'done' && (step !== 'menu' || cartCount > 0 || Boolean(placedOrderId) || Boolean(paymentId))

  return (
    <div className="cm-page">
      <Toaster />
      <header className="cm-topbar">
        <div className="cm-brand">
          {business.logoUrl ? (
            <img src={business.logoUrl} alt="" className="cm-brand-logo" />
          ) : (
            <KodeMark size={26} />
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
              <X size={14} />
            </button>
          ) : null}
          <button
            type="button"
            className="cm-track-btn"
            onClick={() => setShowHistory(true)}
            aria-label="Order history"
          >
            <History size={15} />
          </button>
          {orderPublicId ? (
            <button
              type="button"
              className="cm-track-btn"
              onClick={() => setShowTracking(true)}
              aria-label="Track order"
            >
              <Package size={15} />
            </button>
          ) : null}
          {receiptCount > 0 ? (
            <button
              type="button"
              className={`cm-receipt-btn${showReceipts ? ' active' : ''}`}
              onClick={() => setShowReceipts(true)}
              aria-label={`${receiptCount} receipts on this device`}
            >
              <Receipt size={15} />
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
              <ShoppingCart size={15} />
              {cartCount > 0 && <span className="cm-badge">{cartCount}</span>}
            </button>
          ) : canGoBack(step) || step === 'waiting' ? (
            <button type="button" className="cm-ghost-btn" onClick={goBack} aria-label="Back">
              <ArrowLeft size={14} />
            </button>
          ) : null}
        </div>
      </header>

      {busyBanner ? (
        <div className={`cm-ops-banner${ordersPaused ? ' paused' : ''}`} role="status">
          <Clock3 size={16} />
          <span>{busyBanner}</span>
        </div>
      ) : null}

      <StepProgress step={step} variant={checkoutMode} />

      {error && step !== 'waiting' ? <div className="cm-error">{error}</div> : null}

      {step === 'menu' && business?.type === 'Hotel' ? (
        <div className="cm-browse-tabs" role="tablist" aria-label="Browse">
          <button
            type="button"
            role="tab"
            aria-selected={browseMode === 'stay'}
            className={browseMode === 'stay' ? 'active' : undefined}
            onClick={() => setBrowseMode('stay')}
          >
            Stay
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={browseMode === 'food'}
            className={browseMode === 'food' ? 'active' : undefined}
            onClick={() => setBrowseMode('food')}
          >
            Food
          </button>
        </div>
      ) : null}

      {step === 'menu' && business?.type === 'Hotel' && browseMode === 'stay' ? (
        <StayStep items={items} onAddStay={addStayToCart} />
      ) : null}

      {step === 'menu' && (business?.type !== 'Hotel' || browseMode === 'food') && (
        <MenuStep
          items={items.filter((item) => !isLodgingItem(item))}
          popularItems={popularItems.filter((item) => !isLodgingItem(item))}
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
          mode={checkoutMode}
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
          splitEnabled={splitEnabled}
          splitShares={splitShares}
          onSplitEnabled={setSplitEnabled}
          onSplitShares={setSplitShares}
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
          paymentReference={business.paymentReference}
          businessId={business.id}
          orderId={placedOrderId}
          publicId={orderPublicId}
          total={paidTotal || payableTotal}
          provider={provider}
          phone={phone}
          customerName={customerName}
          status={paymentStatus}
          orderStatus={trackedOrder?.status ?? fulfillmentStatus}
          estimatedWaitMinutes={
            trackedOrder?.estimatedWaitMinutes ?? estimatedWaitMinutes ?? undefined
          }
          trackingLoading={trackingLoading}
          error={error}
          splitSummary={splitSummary}
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
          publicId={orderPublicId}
          businessId={business.id}
          total={paidTotal}
          orderStatus={trackedOrder?.status ?? fulfillmentStatus}
          estimatedWaitMinutes={
            trackedOrder?.estimatedWaitMinutes ?? estimatedWaitMinutes ?? undefined
          }
          trackingLoading={trackingLoading}
          trackingError={trackingError}
          onOrderMore={orderMore}
          phone={phone}
          customerName={customerName}
          provider={provider}
        />
      )}

      {showBottomMenu && !ordersPaused && (
        <BottomBar count={cartCount} total={payableTotal} label="View cart" onAction={() => setStep('cart')} />
      )}
      {showBottomCart && !ordersPaused && (
        <BottomBar count={cartCount} total={payableTotal} label="Continue" onAction={goDetails} />
      )}
      {showBottomDetails && !ordersPaused && (
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
          label={
            submitting
              ? splitEnabled
                ? 'Prompting payers…'
                : 'Sending…'
              : !splitReady
                ? !splitPhonesOk
                  ? 'Add each MoMo number'
                  : splitAllocated < payableTotal
                    ? `Allocate ${currency(payableTotal - splitAllocated)} more`
                    : 'Fix split amounts'
                : splitEnabled
                  ? `Prompt ${splitShares.length} payers · ${currency(payTotal)}`
                  : `Pay ${currency(payTotal)}`
          }
          onAction={() => void submitPayment()}
          loading={submitting}
          disabled={
            submitting
            || !splitReady
            || (!placedOrderId && (cartCount === 0 || ordersPaused))
          }
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

      {showHistory ? (
        <OrderHistoryPanel initialPhone={phone} onClose={() => setShowHistory(false)} />
      ) : null}
    </div>
  )
}
