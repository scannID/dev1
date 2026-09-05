import { type ChangeEvent, type CSSProperties, type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeftRight, Banknote, BarChart3, BedDouble, Bell, CalendarCheck, Check, ChevronDown, ChevronsUpDown, Eye, Home, ImagePlus, Info, LayoutDashboard, LogOut, Megaphone, Menu, Moon, Package, Pencil, Plus, Scale, Search, Settings2, ShoppingCart, Sun, Trash2, Trash, UtensilsCrossed, Warehouse, X } from 'lucide-react'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DanceLoader } from './components/DanceLoader'
import CategoryField from './components/CategoryField'
import { CatalogItemImageField } from './components/CatalogItemImageField'
import { CatalogItemGalleryField } from './components/CatalogItemGalleryField'
import { IngredientsEditor } from './components/IngredientsEditor'
import { PaginationBar } from './components/PaginationBar'
import { businessCategories } from './lib/catalogCategories'
import { getCategoryImage } from './lib/categoryImages'
import { formatRemovedIngredients } from './lib/catalogCart'
import { discountPercentOf, effectivePrice } from './lib/catalogPricing'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useBusinessData } from './hooks/useBusinessData'
import { useCatalog } from './hooks/useCatalog'
import { useMerchantBroadcasts } from './hooks/useMerchantBroadcasts'
import { useOrders } from './hooks/useOrders'
import { usePagination } from './hooks/usePagination'
import { useServerPagination } from './hooks/useServerPagination'
import type {
  Business as ApiBusiness,
  CatalogItem as ApiCatalogItem,
  CatalogItemKind,
  CreateCatalogItemRequest,
  MerchantBroadcast,
  Order as ApiOrder,
  OrderStatus,
  PaymentStatus,
} from './api/types'
import { scannyApi } from './api/services'
import { MetricsCard } from './MetricsCard'
import { OperationsHub, type OperationsTab } from './operations/OperationsHub'
import { InventoryPage } from './inventory/InventoryPage'
import {
  InventoryAdjustPage,
  InventoryTransferPage,
  InventoryWastePage,
} from './inventory/InventoryActionPage'
import { PurchaseOrdersPage } from './inventory/PurchaseOrdersPage'
import { SuppliersPage } from './inventory/SuppliersPage'
import { VarianceReportPage } from './inventory/VarianceReportPage'
import { SplitBillPanel } from './operations/SplitBillPanel'
import { FloorPlanPage } from './floor-plan/FloorPlanPage'
import { hasPermission, type PermissionId } from './operations/roleCatalog'
import type { StaffRole } from './api/operations'
import { resizeImageFile } from './lib/resizeImage'
import { buildReportData, dailySeries } from './lib/orderAnalytics'
import { applyDarkMode, persistDarkMode, readDarkMode } from './lib/theme'
import { AnnouncementsPanel } from './components/AnnouncementsPanel'
import { BookedRoomsTab } from './components/BookedRoomsTab'
import './App.css'

// Sparkline component with soft area fill and smooth curves
function Sparkline({ data, color = '#10b981' }: { data: number[]; color?: string }) {
  if (data.length === 0) return null

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const n = Math.max(data.length - 1, 1)

  const points = data.map((value, index): [number, number] => {
    const x = (index / n) * 100
    const y = 100 - ((value - min) / range) * 80 - 10
    return [x, y]
  })

  let linePath = `M${points[0][0]},${points[0][1]}`
  for (let i = 1; i < points.length; i++) {
    const mx = (points[i - 1][0] + points[i][0]) / 2
    linePath += ` C${mx},${points[i - 1][1]} ${mx},${points[i][1]} ${points[i][0]},${points[i][1]}`
  }
  const last = points[points.length - 1]
  const first = points[0]
  const areaPath = `${linePath} L${last[0]},100 L${first[0]},100 Z`

  const gradientId = `gradient-${color.replace(/[^a-z0-9]/gi, '')}`

  return (
    <svg className="sparkline-chart" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
const SCAN_BASE_URL =
  import.meta.env.VITE_SCAN_BASE_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173')
const REQUIRED_FIELD_MESSAGE = 'Please fill out this field.'

type CatalogItem = ApiCatalogItem
type Business = ApiBusiness
type Order = ApiOrder
const emptyBusiness: Business = {
  id: '',
  merchantId: '',
  qrToken: '',
  name: '',
  ownerName: '',
  phone: '',
  type: 'Restaurant',
  tableLabel: 'Location',
  paymentReference: '',
  accent: '#2563eb',
  items: [],
}

type QrStyle = CSSProperties & {
  '--accent': string
}

function currency(amount) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0,
  }).format(amount)
}

/** What the merchant receives on MoMo (subtotal). Falls back to total for legacy orders. */
function merchantPayoutOf(order: { merchantPayout?: number; subtotal?: number; total: number }) {
  if (typeof order.merchantPayout === 'number' && order.merchantPayout > 0) return order.merchantPayout
  if (typeof order.subtotal === 'number' && order.subtotal > 0) return order.subtotal
  return order.total
}

/** Prefer LAN scan base so phone QRs work even if merchant UI is open on localhost. */
function scanOrigin() {
  const configured = String(import.meta.env.VITE_SCAN_BASE_URL || '').replace(/\/$/, '')
  if (configured && !/localhost|127\.0\.0\.1/i.test(configured)) return configured
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname
    if (host !== 'localhost' && host !== '127.0.0.1') return window.location.origin
  }
  return configured || SCAN_BASE_URL
}

function customerUrl(business: Business) {
  const origin = scanOrigin()
  if (business.id && business.qrToken) {
    return `${origin}/b/${business.id}?qr=${encodeURIComponent(business.qrToken)}`
  }
  if (business.customerUrl && !/localhost|127\.0\.0\.1/i.test(business.customerUrl)) {
    return business.customerUrl
  }
  return origin
}

function loadQrLogo(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load logo'))
    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      img.crossOrigin = 'anonymous'
    }
    img.src = src
  })
}

/** QR with merchant logo nested in the center (high error correction keeps it scannable). */
async function merchantQrDataUrl(url: string, logoUrl: string | null | undefined, size: number) {
  const canvas = document.createElement('canvas')
  await QRCode.toCanvas(canvas, url, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: size,
    color: {
      dark: '#18211f',
      light: '#ffffff',
    },
  })

  const ctx = canvas.getContext('2d')
  if (!ctx || !logoUrl) return canvas.toDataURL('image/png')

  try {
    const logo = await loadQrLogo(logoUrl)
    const logoSize = Math.round(size * 0.22)
    const pad = Math.max(4, Math.round(logoSize * 0.18))
    const box = logoSize + pad * 2
    const boxX = (size - box) / 2
    const boxY = (size - box) / 2
    const radius = Math.max(3, Math.round(box * 0.12))

    ctx.beginPath()
    ctx.moveTo(boxX + radius, boxY)
    ctx.arcTo(boxX + box, boxY, boxX + box, boxY + box, radius)
    ctx.arcTo(boxX + box, boxY + box, boxX, boxY + box, radius)
    ctx.arcTo(boxX, boxY + box, boxX, boxY, radius)
    ctx.arcTo(boxX, boxY, boxX + box, boxY, radius)
    ctx.closePath()
    ctx.fillStyle = '#ffffff'
    ctx.fill()

    // Contain-fit logo inside the padded box
    const scale = Math.min(logoSize / logo.width, logoSize / logo.height)
    const drawW = logo.width * scale
    const drawH = logo.height * scale
    const drawX = (size - drawW) / 2
    const drawY = (size - drawH) / 2
    ctx.drawImage(logo, drawX, drawY, drawW, drawH)
  } catch {
    // Keep plain QR if logo can't load
  }

  return canvas.toDataURL('image/png')
}

function App({
  onLogout,
  onBackToLanding: _onBackToLanding,
  kcUsername: _kcUsername,
}: {
  onLogout?: () => void
  onBackToLanding?: () => void
  kcUsername?: string
}) {
  const {
    businesses,
    selectedBusiness,
    selectBusiness,
    orders,
    merchant,
    loading: sessionLoading,
    error: sessionError,
    accountSuspended,
    suspendedMessage,
    refreshBusiness,
    refreshBusinesses,
    loadOrders,
    setOrders,
    updateLocalItems,
    staffMode,
    staffName,
    staffRole,
    logoutStaff,
  } = useBusinessData()

  const [view, setView] = useState('account')
  const [inventoryNavOpen, setInventoryNavOpen] = useState(false)
  const [operationsNavOpen, setOperationsNavOpen] = useState(false)
  const [floorPlanNavOpen, setFloorPlanNavOpen] = useState(false)
  const [catalogNavOpen, setCatalogNavOpen] = useState(false)
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const [showMobileNav, setShowMobileNav] = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)
  const [addItemSection, setAddItemSection] = useState<'food' | 'lodging'>('food')
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showAnnouncements, setShowAnnouncements] = useState(false)
  const [darkMode, setDarkMode] = useState(() => readDarkMode())
  const {
    broadcasts,
    unread: broadcastUnread,
    bannerBroadcast,
    markRead: markBroadcastRead,
    dismiss: dismissBroadcast,
  } = useMerchantBroadcasts(!staffMode)
  const [actionError, setActionError] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [branchOverviewCounts, setBranchOverviewCounts] = useState<Record<string, { openOrders: number; kitchenOrders: number }>>({})
  const [branchOverviewLoading, setBranchOverviewLoading] = useState(false)

  // Block disallowed views for staff (Overview + Reports are owner / general manager only)
  useEffect(() => {
    if (!staffMode || !staffRole) return
    const merchantOnlyViews = new Set([
      'account',
      'operations',
      'operations-roles',
      'operations-settings',
      'operations-branches',
      'reports',
      'inventory',
      'inventory-transfer',
      'inventory-adjust',
      'inventory-waste',
      'inventory-purchase-orders',
      'inventory-suppliers',
      'inventory-variance',
      'floor-plan',
      'floor-plan-live',
      'floor-plan-edit',
    ])
    const viewPermMap: Record<string, PermissionId> = {
      catalog: 'catalog:read',
      'catalog-food': 'catalog:read',
      'catalog-rooms': 'catalog:read',
      'catalog-booked': 'catalog:read',
      dashboard: 'orders:read',
      kitchen: 'kitchen:view',
    }
    const blocked =
      merchantOnlyViews.has(view) ||
      (viewPermMap[view] != null && !hasPermission(staffRole as StaffRole, viewPermMap[view]))
    if (!blocked) return

    const fallbacks: Array<{ id: string; perm: PermissionId }> = [
      { id: 'dashboard', perm: 'orders:read' },
      { id: 'kitchen', perm: 'kitchen:view' },
      { id: 'catalog', perm: 'catalog:read' },
    ]
    const next = fallbacks.find((f) => hasPermission(staffRole as StaffRole, f.perm))
    setView(next?.id ?? 'dashboard')
  }, [view, staffMode, staffRole])

  const business = selectedBusiness ?? emptyBusiness
  const operationViews = new Set(['operations', 'operations-roles', 'operations-settings', 'operations-branches'])
  const operationTabByView: Record<string, OperationsTab> = {
    operations: 'roles',
    'operations-roles': 'roles',
    'operations-settings': 'settings',
    'operations-branches': 'branches',
  }
  const hourOfDay = new Date().getHours()
  const timeGreeting = hourOfDay < 12 ? 'Good morning' : hourOfDay < 18 ? 'Good afternoon' : 'Good evening'
  const welcomeName = business.branchLabel || business.name || merchant?.businessName || business.ownerName || 'Merchant'
  const catalogHook = useCatalog(business.id)
  const ordersHook = useOrders(business.id)

  const openOrdersTrend = useMemo(
    () =>
      dailySeries(
        orders.filter((order) => order.businessId === business.id),
        (dayOrders) =>
          dayOrders.filter((order) => order.status !== 'Completed' && order.status !== 'Cancelled').length,
      ),
    [orders, business.id],
  )
  const paidSalesTrend = useMemo(
    () =>
      dailySeries(
        orders.filter((order) => order.businessId === business.id),
        (dayOrders) =>
          dayOrders
            .filter((order) => order.paymentStatus === 'Paid')
            .reduce((sum, order) => sum + (order.merchantPayout ?? order.subtotal ?? order.total), 0),
      ),
    [orders, business.id],
  )
  const catalogTrend = useMemo(
    () => Array.from({ length: 7 }, () => (business.items ?? []).filter((item) => item.available).length),
    [business.items],
  )

  // Toggle dark mode with 'D' key
  useEffect(() => {
    function handleKeyPress(e: KeyboardEvent) {
      if (e.key === 'd' || e.key === 'D') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return
        }
        setDarkMode((prev: boolean) => {
          const newMode = !prev
          persistDarkMode(newMode)
          return newMode
        })
      }
    }
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])

  useEffect(() => {
    applyDarkMode(darkMode)
  }, [darkMode])

  useEffect(() => {
    document.body.classList.toggle('mobile-nav-open', showMobileNav)
    return () => document.body.classList.remove('mobile-nav-open')
  }, [showMobileNav])

  const loadBranchOverviewCounts = useCallback(async () => {
    const pairs = await Promise.all(
      businesses.map(async (b) => {
        try {
          const branchOrders = await scannyApi.orders.list(b.id)
          const openOrders = branchOrders.filter(
            (o) => o.status !== 'Completed' && o.status !== 'Cancelled',
          ).length
          const kitchenOrders = branchOrders.filter(
            (o) =>
              ['Pending', 'Preparing', 'Ready'].includes(o.status) &&
              (!o.items || o.items.some((i: any) => !i.checkInDate && i.itemKind !== 'ROOM' && i.itemKind !== 'SUITE')),
          ).length
          return [b.id, { openOrders, kitchenOrders }] as const
        } catch {
          return [b.id, { openOrders: 0, kitchenOrders: 0 }] as const
        }
      }),
    )
    setBranchOverviewCounts(Object.fromEntries(pairs))
  }, [businesses])

  // Owner-only: keep branch cards fresh with realtime + polling fallback.
  useEffect(() => {
    if (staffMode) return
    if (businesses.length <= 1) {
      setBranchOverviewCounts({})
      return
    }

    let cancelled = false
    let client: { close: () => void } | null = null
    setBranchOverviewLoading(true)

    ;(async () => {
      try {
        await loadBranchOverviewCounts()
      } finally {
        if (!cancelled) setBranchOverviewLoading(false)
      }
    })()

    async function startRealtime() {
      const { createRealtimeClient } = await import('./lib/realtime')
      const keycloak = (await import('./keycloak')).default
      if (cancelled) return
      client = createRealtimeClient({
        channels: businesses.map((b) => `orders:${b.id}`),
        getToken: async () => {
          try {
            await keycloak.updateToken(30)
            return keycloak.token
          } catch {
            return keycloak.token
          }
        },
        poll: loadBranchOverviewCounts,
        pollIntervalMs: 15000,
        onEvent: (event) => {
          if (event.type?.startsWith('ORDER') || event.type === 'ORDERS_CLEARED') {
            void loadBranchOverviewCounts()
          }
        },
      })
    }

    void startRealtime()

    return () => {
      cancelled = true
      client?.close()
    }
  }, [staffMode, businesses, loadBranchOverviewCounts])

  // Realtime orders with polling fallback — subscribe to ALL businesses so
  // switching to a branch never has a gap where events are missed.
  useEffect(() => {
    if (!business.id) return
    let client: { close: () => void } | null = null
    let cancelled = false

    const allChannels = [
      ...businesses.map((b) => `orders:${b.id}`),
      `catalog:${business.id}`,
    ]

    async function start() {
      const { createRealtimeClient } = await import('./lib/realtime')
      const keycloak = (await import('./keycloak')).default
      if (cancelled) return
      client = createRealtimeClient({
        channels: allChannels,
        getToken: async () => {
          try {
            await keycloak.updateToken(30)
            return keycloak.token
          } catch {
            return keycloak.token
          }
        },
        poll: () => loadOrders(business.id),
        pollIntervalMs: 15000,
        onEvent: (event) => {
          if (event.type?.startsWith('ORDER') || event.type === 'ORDERS_CLEARED') {
            // Refresh orders for whichever branch the event belongs to.
            // loadOrders merges by businessId so other branches are not wiped.
            const eventBusinessId = event.businessId ?? event.channel?.split(':')[1]
            if (eventBusinessId) {
              void loadOrders(eventBusinessId)
            }
          }
        },
      })
    }

    void start()
    return () => {
      cancelled = true
      client?.close()
    }
  }, [business.id, businesses, loadOrders])

  const businessOrders = orders.filter((order) => order.businessId === business.id)
  const pendingCount = businessOrders.filter(
    (order) => order.status !== 'Completed' && order.status !== 'Cancelled',
  ).length
  const kitchenCount = businessOrders.filter(
    (order) =>
      (order.status === 'Pending' || order.status === 'Preparing' || order.status === 'Ready') &&
      (!order.items || order.items.some((i: any) => !i.checkInDate && i.itemKind !== 'ROOM' && i.itemKind !== 'SUITE')),
  ).length
  const paidTotal = businessOrders
    .filter((order) => order.paymentStatus === 'Paid')
    .reduce((sum, _order) => sum + merchantPayoutOf(_order), 0)
  const availableItems = (business.items ?? []).filter((item) => item.available).length

  async function handleCreateCatalogItem(data: CreateCatalogItemRequest) {
    if (!business.id) return
    setActionError(null)
    try {
      await catalogHook.createItem(data)
      await refreshBusiness(business.id)
      setShowAddItem(false)
      setEditingItem(null)
      toast.success('Item created successfully')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create item'
      setActionError(message)
      toast.error(message)
    }
  }

  async function handleUpdateCatalogItem(itemId: string, data: Partial<CatalogItem>) {
    if (!business.id) return
    setActionError(null)
    try {
      await catalogHook.updateItem(itemId, {
        name: data.name,
        category: data.category,
        price: data.price,
        description: data.description,
        imageUrl: data.imageUrl,
        imageUrls: data.imageUrls,
        details: data.details,
        ingredients: data.ingredients,
        available: data.available,
        discountPercent: data.discountPercent,
        itemKind: data.itemKind,
        capacity: data.capacity,
        amenities: data.amenities,
        unitsAvailable: data.unitsAvailable,
      })
      await refreshBusiness(business.id)
      setEditingItem(null)
      setShowAddItem(false)
      toast.success('Item updated successfully')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update item'
      setActionError(message)
      toast.error(message)
    }
  }

  async function handleDeleteCatalogItem(itemId: string) {
    if (!business.id) return
    setActionError(null)
    try {
      await catalogHook.deleteItem(itemId)
      updateLocalItems(
        business.id,
        (business.items ?? []).filter((entry) => entry.id !== itemId),
      )
      setEditingItem(null)
      setShowAddItem(false)
      toast.success('Item deleted successfully')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete item'
      setActionError(message)
      toast.error(message)
    }
  }

  async function handleAddCategory(name: string) {
    if (!business.id) {
      throw new Error('Business not loaded')
    }
    setActionError(null)
    try {
      const categories = await catalogHook.addCategory(name)
      await refreshBusiness(business.id)
      toast.success('Category added successfully')
      return categories
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add category'
      setActionError(message)
      toast.error(message)
      throw err
    }
  }

  async function updateStatus(orderId: string, status: OrderStatus) {
    setActionError(null)
    try {
      const updated = await ordersHook.updateStatus(orderId, status)
      setOrders((current) =>
        current.map((order) => (order.id === orderId ? updated : order)),
      )
      toast.success(`Order status updated to ${status}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update status'
      setActionError(message)
      toast.error(message)
    }
  }

  async function updatePayment(orderId: string, paymentStatus: PaymentStatus) {
    setActionError(null)
    try {
      const updated = await ordersHook.updatePayment(orderId, paymentStatus)
      setOrders((current) =>
        current.map((order) => (order.id === orderId ? updated : order)),
      )
      toast.success(`Payment marked as ${paymentStatus}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update payment'
      setActionError(message)
      toast.error(message)
    }
  }

  async function clearCompleted() {
    if (!business.id) return
    setActionError(null)
    try {
      await ordersHook.clearCompleted()
      setOrders((current) =>
        current.filter(
          (order) =>
            order.businessId !== business.id ||
            (order.status !== 'Completed' && order.status !== 'Cancelled'),
        ),
      )
      toast.success('Completed orders cleared')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to clear completed orders'
      setActionError(message)
      toast.error(message)
    }
  }

  async function handleLogoUpload(dataUrl: string) {
    setLogoUploading(true)
    setActionError(null)
    try {
      await scannyApi.merchant.updateProfile({ businessLogoUrl: dataUrl })
      await refreshBusinesses()
      toast.success('Logo updated successfully')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload logo'
      setActionError(message)
      toast.error(message)
    } finally {
      setLogoUploading(false)
    }
  }

  function handleLogout() {
    if (staffMode) {
      logoutStaff()
    }
    if (onLogout) {
      onLogout()
    } else {
      window.location.reload()
    }
  }

  if (sessionLoading) {
    return (
      <main className="company-shell" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <DanceLoader label="Opening your portal…" />
      </main>
    )
  }

  if (accountSuspended) {
    return (
      <main className="company-shell" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 24 }}>
        <div style={{ maxWidth: 440, textAlign: 'center', display: 'grid', gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'oklch(0.96 0.02 30 / 0.2)', border: '1px solid oklch(0.577 0.245 27.325 / 0.3)', display: 'grid', placeItems: 'center', margin: '0 auto' }}>
            <span style={{ fontSize: 24 }}>🚫</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, color: 'var(--foreground)' }}>Account suspended</h1>
          <p style={{ margin: 0, color: 'var(--muted-foreground)', fontSize: 14, lineHeight: 1.6 }}>
            {suspendedMessage || 'Your account has been suspended. Please contact the system administrator.'}
          </p>
          <p style={{ margin: 0, color: 'var(--muted-foreground)', fontSize: 13 }}>
            If you believe this is a mistake, reach out to{' '}
            <a href="mailto:alsekx@gmail.com" style={{ color: 'var(--primary)' }}>alsekx@gmail.com</a>
          </p>
          <Button type="button" variant="outline" onClick={handleLogout} style={{ width: 'fit-content', margin: '0 auto' }}>
            Sign out
          </Button>
        </div>
      </main>
    )
  }

  if (!business.id) {
    return (
      <main className="company-shell" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 24 }}>
        <div style={{ maxWidth: 420, textAlign: 'center', display: 'grid', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>Couldn’t load your business</h1>
          <p style={{ margin: 0, color: 'var(--muted-foreground, #6b7280)' }}>
            {sessionError || 'Your session loaded, but no business data came back. Try again or sign in again.'}
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button type="button" onClick={() => void refreshBusinesses()}>
              Retry
            </Button>
            <Button type="button" variant="outline" onClick={handleLogout}>
              Sign out
            </Button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="company-shell">
      <Toaster />
      <aside className={`company-sidebar${showMobileNav ? ' mobile-open' : ''}`} aria-label="Company workspace navigation">
        {/* Mobile close button */}
        <button
          type="button"
          className="mobile-nav-close"
          aria-label="Close navigation"
          onClick={() => setShowMobileNav(false)}
        >
          <X size={20} />
        </button>
        <div className="sidebar-brand">
          <img
            src="/kodte-icon.svg"
            alt="Koddly"
            className="sidebar-brand-logo"
          />
          <div className="sidebar-brand-text">
            <strong>Koddly</strong>
            <span>{staffMode ? (staffRole ?? 'Staff') + ' Portal' : 'Merchant Portal'}</span>
          </div>
        </div>

        <nav className="side-nav" aria-label="Workspace sections">
          {([
            { id: 'account', label: 'Overview', icon: Home, merchantOnly: true },
            { id: 'catalog', label: 'Catalog', icon: Package, perm: 'catalog:read' as PermissionId,
              // Hotel merchants get Food + Rooms + Booked rooms sub-items; others use the flat link
              children: business.type === 'Hotel' ? [
                { id: 'catalog-food', label: 'Food', icon: UtensilsCrossed },
                { id: 'catalog-rooms', label: 'Rooms', icon: BedDouble },
                { id: 'catalog-booked', label: 'Booked rooms', icon: CalendarCheck },
              ] : undefined,
            },
            {
              id: 'inventory',
              label: 'Inventory',
              icon: Warehouse,
              merchantOnly: true,
              children: [
                { id: 'inventory', label: 'Stock', icon: Warehouse },
                { id: 'inventory-transfer', label: 'Transfer', icon: ArrowLeftRight },
                { id: 'inventory-adjust', label: 'Adjust', icon: Scale },
                { id: 'inventory-waste', label: 'Waste', icon: Trash },
                { id: 'inventory-purchase-orders', label: 'Purchase Orders', icon: Package },
                { id: 'inventory-suppliers', label: 'Suppliers', icon: ShoppingCart },
                { id: 'inventory-variance', label: 'Variance', icon: BarChart3 },
              ],
            },
            { id: 'dashboard', label: 'Orders', icon: ShoppingCart, count: pendingCount, perm: 'orders:read' as PermissionId },
            { id: 'kitchen', label: 'Kitchen', icon: UtensilsCrossed, count: kitchenCount, perm: 'kitchen:view' as PermissionId },
            {
              id: 'operations',
              label: 'Permissions',
              icon: Settings2,
              perm: 'staff:manage' as PermissionId,
              merchantOnly: true,
              children: [
                { id: 'operations-roles', label: 'Staff', icon: Settings2 },
                { id: 'operations-settings', label: 'Busy mode', icon: Settings2 },
                { id: 'operations-branches', label: 'Branches', icon: Settings2 },
              ],
            },
            { id: 'reports', label: 'Reports', icon: BarChart3, merchantOnly: true },
          ] as Array<{
            id: string
            label: string
            icon: typeof Home
            count?: number
            perm?: PermissionId
            merchantOnly?: boolean
            children?: Array<{ id: string; label: string; icon: typeof Home }>
          }>)
          .filter(({ perm, merchantOnly }) => {
            if (staffMode && merchantOnly) return false
            return !staffMode || !perm || hasPermission(staffRole as StaffRole, perm)
          })
          .map(({ id, label, icon: Icon, count, children }) => {
            const inventoryChildActive =
              id === 'inventory' &&
              (view === 'inventory' ||
                view === 'inventory-transfer' ||
                view === 'inventory-adjust' ||
                view === 'inventory-waste' ||
                view === 'inventory-purchase-orders' ||
                view === 'inventory-suppliers' ||
                view === 'inventory-variance')
            const catalogChildActive = id === 'catalog' && (view === 'catalog-food' || view === 'catalog-rooms' || view === 'catalog-booked')
            const operationsChildActive = id === 'operations' && operationViews.has(view)
            const floorPlanChildActive = id === 'floor-plan' && (view === 'floor-plan-live' || view === 'floor-plan-edit')
            const isActive = !showAddItem && !editingItem && (view === id || inventoryChildActive || catalogChildActive || operationsChildActive || floorPlanChildActive)
            const groupOpen =
              id === 'inventory'
                ? (inventoryNavOpen || inventoryChildActive)
                : id === 'catalog'
                  ? (catalogNavOpen || catalogChildActive)
                  : id === 'operations'
                    ? (operationsNavOpen || operationsChildActive)
                    : id === 'floor-plan'
                      ? (floorPlanNavOpen || floorPlanChildActive)
                      : false

            if (children?.length) {
              const defaultChildView = children[0]?.id
              return (
                <div key={id} className={`side-nav-group${groupOpen ? ' open' : ''}${(inventoryChildActive || catalogChildActive || operationsChildActive || floorPlanChildActive) ? ' active-group' : ''}`}>
                  <button
                    type="button"
                    className={isActive ? 'active' : ''}
                    aria-expanded={groupOpen}
                    onClick={() => {
                      setShowAddItem(false)
                      setEditingItem(null)
                      if (id === 'inventory') {
                        setInventoryNavOpen((open) => !open)
                        if (!inventoryChildActive) setView('inventory')
                      } else if (id === 'catalog') {
                        setCatalogNavOpen((open) => !open)
                        if (!catalogChildActive) setView('catalog-food')
                      } else if (id === 'operations') {
                        setOperationsNavOpen((open) => !open)
                        if (!operationsChildActive && defaultChildView) setView(defaultChildView)
                      } else if (id === 'floor-plan') {
                        setFloorPlanNavOpen((open) => !open)
                        if (!floorPlanChildActive) setView('floor-plan-live')
                      }
                    }}
                  >
                    <Icon size={20} />
                    <span style={{ flex: 1 }}>{label}</span>
                    <ChevronDown
                      size={16}
                      className={`side-nav-chevron${groupOpen ? ' open' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                  {groupOpen ? (
                    <div className="side-nav-sub" role="group" aria-label={`${label} sections`}>
                      {children.map(({ id: childId, label: childLabel, icon: ChildIcon }) => (
                        <button
                          type="button"
                          key={childId}
                          className={!showAddItem && !editingItem && view === childId ? 'active' : ''}
                          onClick={() => {
                            setShowAddItem(false)
                            setEditingItem(null)
                            if (id === 'inventory') setInventoryNavOpen(true)
                            if (id === 'catalog') setCatalogNavOpen(true)
                            if (id === 'operations') setOperationsNavOpen(true)
                            setView(childId)
                            setShowMobileNav(false)
                          }}
                        >
                          <ChildIcon size={16} />
                          <span style={{ flex: 1 }}>{childLabel}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            }

            return (
              <button
                type="button"
                className={!showAddItem && !editingItem && view === id ? 'active' : ''}
                key={id}
                onClick={() => {
                  setShowAddItem(false)
                  setEditingItem(null)
                  setView(id)
                  setShowMobileNav(false)
                }}
              >
                <Icon size={20} />
                <span style={{ flex: 1 }}>{label}</span>
                {typeof count === 'number' ? (
                  <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px]">
                    {count}
                  </Badge>
                ) : null}
              </button>
            )
          })}
        </nav>

        <SidebarProfile
          business={business}
          businesses={businesses}
          businessName={merchant?.businessName || business.name || 'Business'}
          logoUrl={business.logoUrl ?? merchant?.businessLogoUrl}
          onLogoUpload={handleLogoUpload}
          logoUploading={logoUploading}
          staffMode={staffMode}
          staffName={staffName}
          onSelectBranch={selectBusiness}
          onLogoutRequest={() => setShowLogoutDialog(true)}
        />

        <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Log out of Koddly?</AlertDialogTitle>
              <AlertDialogDescription>
                You will be logged out and returned to the landing page.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleLogout}>
                Log out
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </aside>

      <section className="company-workspace">
        <header className="company-topbar">
          <div>
            <p className="eyebrow">
              {editingItem && (editingItem.itemKind === 'ROOM' || editingItem.itemKind === 'SUITE'
                ? 'Merchant · Edit room / suite'
                : 'Merchant · Edit item')}
              {!editingItem && showAddItem && 'Merchant · Add item'}
              {!editingItem && !showAddItem && view === 'account' && 'Merchant · Overview'}
              {!editingItem && !showAddItem && view === 'catalog-food' && 'Merchant · Catalog · Food'}
              {!editingItem && !showAddItem && view === 'catalog-rooms' && 'Merchant · Catalog · Rooms'}
              {!editingItem && !showAddItem && view === 'catalog-booked' && 'Merchant · Booked rooms'}
              {!editingItem && !showAddItem && view === 'inventory' && 'Merchant · Inventory'}
              {!editingItem && !showAddItem && view === 'inventory-transfer' && 'Merchant · Inventory · Transfer'}
              {!editingItem && !showAddItem && view === 'inventory-adjust' && 'Merchant · Inventory · Adjust'}
              {!editingItem && !showAddItem && view === 'inventory-waste' && 'Merchant · Inventory · Waste'}
              {!editingItem && !showAddItem && view === 'inventory-purchase-orders' && 'Merchant · Inventory · Purchase Orders'}
              {!editingItem && !showAddItem && view === 'inventory-suppliers' && 'Merchant · Inventory · Suppliers'}
              {!editingItem && !showAddItem && view === 'inventory-variance' && 'Merchant · Inventory · Variance'}
              {!editingItem && !showAddItem && view === 'dashboard' && 'Merchant · Orders'}
              {!editingItem && !showAddItem && view === 'kitchen' && 'Merchant · Kitchen'}
              {!editingItem && !showAddItem && operationViews.has(view) && 'Merchant · Permissions'}
              {!editingItem && !showAddItem && view === 'reports' && 'Merchant · Reports'}
            </p>
            <h2>
              {editingItem && (editingItem.itemKind === 'ROOM' || editingItem.itemKind === 'SUITE'
                ? 'Edit room / suite'
                : 'Edit item')}
              {!editingItem && showAddItem && 'Add item'}
              {!editingItem && !showAddItem && view === 'account' && `${timeGreeting}, ${welcomeName}`}
              {!editingItem && !showAddItem && view === 'catalog-food' && 'Food catalog'}
              {!editingItem && !showAddItem && view === 'catalog-rooms' && 'Rooms & suites'}
              {!editingItem && !showAddItem && view === 'catalog-booked' && 'Booked rooms'}
              {!editingItem && !showAddItem && view === 'inventory' && 'Inventory'}
              {!editingItem && !showAddItem && view === 'inventory-transfer' && 'Transfer'}
              {!editingItem && !showAddItem && view === 'inventory-adjust' && 'Adjust'}
              {!editingItem && !showAddItem && view === 'inventory-waste' && 'Waste'}
              {!editingItem && !showAddItem && view === 'inventory-purchase-orders' && 'Purchase Orders'}
              {!editingItem && !showAddItem && view === 'inventory-suppliers' && 'Suppliers'}
              {!editingItem && !showAddItem && view === 'inventory-variance' && 'Variance report'}
              {!editingItem && !showAddItem && view === 'dashboard' && 'Orders'}
              {!editingItem && !showAddItem && view === 'kitchen' && 'Kitchen display'}
              {!editingItem && !showAddItem && view === 'operations-roles' && 'Staff'}
              {!editingItem && !showAddItem && view === 'operations-settings' && 'Busy mode'}
              {!editingItem && !showAddItem && view === 'operations-branches' && 'Branches'}
              {!editingItem && !showAddItem && view === 'operations' && 'Permissions'}
              {!editingItem && !showAddItem && view === 'reports' && 'Reports'}
            </h2>
            {(actionError || sessionError) && (
              <p className="scanny-error" role="alert" style={{ marginTop: 8 }}>{actionError || sessionError}</p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Mobile hamburger — only visible on small screens */}
            <Button
              variant="outline"
              size="icon-sm"
              className="mobile-nav-toggle"
              aria-label="Open navigation"
              onClick={() => setShowMobileNav(true)}
            >
              <Menu className="size-3.5" />
            </Button>
            {!showAddItem && !editingItem && view === 'account' && (
              <Button className="" size="sm" onClick={() => { setAddItemSection('food'); setEditingItem(null); setShowAddItem(true) }}>
                <Plus className="size-3.5" />
                Add item
              </Button>
            )}
            {/* Dark mode toggle */}
            <Button
              variant="outline"
              size="icon-sm"
              title={darkMode ? 'Light mode' : 'Dark mode'}
              onClick={() => {
                setDarkMode((prev: boolean) => {
                  const newMode = !prev
                  persistDarkMode(newMode)
                  return newMode
                })
              } } className={undefined}            >
              {darkMode ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            </Button>
            {/* Announcements */}
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Announcements"
              title="Announcements"
              onClick={() => setShowAnnouncements(true)}
            >
              <Megaphone className="size-3.5" />
            </Button>
            {/* Notifications */}
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Notifications"
              className="relative"
              onClick={() => setShowNotifications(true)}
            >
              <Bell className="size-3.5" />
              {broadcastUnread > 0 ? (
                <span className="absolute top-1 right-1 size-1.5 rounded-full bg-destructive" />
              ) : null}
            </Button>
          </div>
        </header>

        {bannerBroadcast ? (
          <div
            className={`merchant-broadcast-banner severity-${bannerBroadcast.severity.toLowerCase()}`}
            role="status"
          >
            <div className="merchant-broadcast-banner-icon" aria-hidden="true">
              <Megaphone size={16} />
            </div>
            <div className="merchant-broadcast-banner-copy">
              <strong>{bannerBroadcast.title}</strong>
              <p>{bannerBroadcast.body}</p>
            </div>
            <button
              type="button"
              className="merchant-broadcast-banner-dismiss"
              aria-label="Dismiss message"
              onClick={() => void dismissBroadcast(bannerBroadcast.id)}
            >
              <X size={14} />
            </button>
          </div>
        ) : null}

        {showAddItem || editingItem ? (
          <div className="page-content add-item-page-content">
            <div className="add-item-page">
              <AddItemForm
                key={editingItem?.id ?? `new-${addItemSection}`}
                business={business}
                section={
                  editingItem
                    ? (editingItem.itemKind === 'ROOM' || editingItem.itemKind === 'SUITE' ? 'lodging' : 'food')
                    : addItemSection
                }
                initialItem={editingItem ?? undefined}
                onCreateItem={handleCreateCatalogItem}
                onUpdateItem={handleUpdateCatalogItem}
                onDeleteItem={editingItem ? handleDeleteCatalogItem : undefined}
                onAddCategory={handleAddCategory}
                onCancel={() => {
                  setShowAddItem(false)
                  setEditingItem(null)
                }}
              />
            </div>
          </div>
        ) : (
          <>
            {view === 'account' && (
              <div className="page-content">
                {!staffMode && businesses.length > 1 ? (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 10, marginBottom: 10 }}>
                      {branchOverviewLoading ? (
                        <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Loading…</div>
                      ) : null}
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {businesses.map((b) => {
                        const active = b.id === business.id
                        const counts = branchOverviewCounts[b.id]
                        const openOrders = counts?.openOrders ?? 0
                        const kitchenOrders = counts?.kitchenOrders ?? 0
                        const status = b.busyMode ? 'Busy' : b.acceptingOrders === false ? 'Paused' : 'Open'
                        return (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => void selectBusiness(b.id)}
                            style={{
                              borderRadius: 10,
                              border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
                              background: active ? 'var(--card)' : 'transparent',
                              padding: '10px 12px',
                              minWidth: 190,
                              textAlign: 'left',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                              <div style={{ fontWeight: 800, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {b.branchLabel || b.name}
                              </div>
                              <Badge variant={active ? 'secondary' : 'outline'} style={{ fontSize: 10, padding: '4px 6px' } as any}>
                                {status}
                              </Badge>
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                              <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                                Open: <strong>{openOrders}</strong>
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                                Kitchen: <strong>{kitchenOrders}</strong>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
                <section className="metric-grid overview-metric-grid" aria-label="Overview summary">
                  <div>
                    <span>Open orders</span>
                    <strong>{pendingCount}</strong>
                    <Sparkline data={openOrdersTrend} color="#3b82f6" />
                  </div>
                  <div>
                    <span>Published items</span>
                    <strong>{availableItems}</strong>
                    <Sparkline data={catalogTrend} color="#8b5cf6" />
                  </div>
                  <div>
                    <span>Paid sales</span>
                    <strong>{currency(paidTotal)}</strong>
                    <Sparkline data={paidSalesTrend} color="#10b981" />
                  </div>
                </section>
                <OverviewPage business={business} orders={businessOrders} />
              </div>
            )}

            {(view === 'catalog' || view === 'catalog-food' || view === 'catalog-rooms' || view === 'catalog-booked') && (
              <div className="page-content">
                <CatalogPage
                  key={view}
                  business={business}
                  onAddItem={(section) => {
                    setEditingItem(null)
                    setAddItemSection(section)
                    setShowAddItem(true)
                  }}
                  onEditItem={(item) => {
                    setShowAddItem(false)
                    setEditingItem(item)
                  }}
                  Sparkline={Sparkline}
                  initialSection={
                    view === 'catalog-booked' ? 'booked-rooms'
                    : view === 'catalog-rooms' ? 'lodging'
                    : view === 'catalog-food' ? 'food'
                    : undefined
                  }
                  hideSectionTabs={view === 'catalog-food' || view === 'catalog-rooms' || view === 'catalog-booked'}
                />
              </div>
            )}

            {view === 'inventory' && (
              <div className="page-content">
                <InventoryPage businessId={business.id} catalogItems={business.items ?? []} />
              </div>
            )}

            {view === 'inventory-transfer' && (
              <div className="page-content">
                <InventoryTransferPage businessId={business.id} />
              </div>
            )}

            {view === 'inventory-adjust' && (
              <div className="page-content">
                <InventoryAdjustPage businessId={business.id} />
              </div>
            )}

            {view === 'inventory-waste' && (
              <div className="page-content">
                <InventoryWastePage businessId={business.id} />
              </div>
            )}

            {view === 'inventory-purchase-orders' && (
              <div className="page-content">
                <PurchaseOrdersPage
                  businessId={business.id}
                  ingredients={[]}
                  suppliers={[]}
                />
              </div>
            )}

            {view === 'inventory-suppliers' && (
              <div className="page-content">
                <SuppliersPage businessId={business.id} />
              </div>
            )}

            {view === 'inventory-variance' && (
              <div className="page-content">
                <VarianceReportPage businessId={business.id} />
              </div>
            )}

            {view === 'dashboard' && (
              <div className="page-content">
                <Dashboard
                  business={business}
                  orders={businessOrders}
                  onClearCompleted={clearCompleted}
                  onPaymentChange={updatePayment}
                  onStatusChange={updateStatus}
                  Sparkline={Sparkline}
                />
              </div>
            )}

            {view === 'kitchen' && (
              <div className="page-content">
                <div style={{ marginBottom: 12 }}>
                  <Button variant="outline" onClick={() => window.open(`/kitchen/${business.id}`, '_blank')}>
                    Open fullscreen kitchen
                  </Button>
                </div>
                <iframe
                  title="Kitchen display"
                  src={`/kitchen/${business.id}`}
                  style={{ width: '100%', minHeight: '70vh', border: '1px solid var(--border)', borderRadius: 12 }}
                />
              </div>
            )}

            {operationViews.has(view) && (
              <div className="page-content">
                <OperationsHub
                  businessId={business.id}
                  staffMode={staffMode}
                  staffRole={staffRole}
                  activeTab={operationTabByView[view] ?? 'roles'}
                  showTabs={false}
                  onBranchCreated={(branchId) => {
                    void refreshBusinesses().then(() => selectBusiness(branchId))
                  }}
                />
              </div>
            )}

            {(view === 'floor-plan-live' || view === 'floor-plan-edit') && (
              <div className="page-content" style={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <FloorPlanPage
                  businessId={business.id}
                  businessType={business.type}
                  staffMode={staffMode}
                  staffRole={staffRole}
                  initialMode={view === 'floor-plan-edit' ? 'editor' : 'viewer'}
                />
              </div>
            )}

            {view === 'reports' && (
              <div className="page-content">
                <ReportsPage business={business} orders={businessOrders} />
              </div>
            )}
          </>
        )}

        {/* Notifications drawer */}
        <Sheet open={showNotifications} onOpenChange={setShowNotifications}>
          <SheetContent side="right" className="w-full sm:max-w-sm flex flex-col gap-0 p-0">
            <SheetHeader className="border-b border-border px-6 py-4">
              <SheetTitle className="">Notifications</SheetTitle>
              <SheetDescription className="">Koddly messages and recent activity for {business.name || 'your business'}</SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto">
              <NotificationsPanel
                businessName={business.name}
                orders={businessOrders}
                broadcasts={broadcasts}
                onOpenBroadcast={(id) => void markBroadcastRead(id)}
                onDismissBroadcast={(id) => void dismissBroadcast(id)}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Announcements drawer */}
        <AnnouncementsPanel
          open={showAnnouncements}
          businessId={business.id}
          onOpenChange={setShowAnnouncements}
        />
      </section>
      {/* Mobile nav backdrop */}
      {showMobileNav && (
        <div
          className="mobile-nav-backdrop"
          aria-hidden="true"
          onClick={() => setShowMobileNav(false)}
        />
      )}
    </main>
  )
}
function NotificationsPanel({
  businessName,
  orders,
  broadcasts = [],
  onOpenBroadcast,
  onDismissBroadcast,
}: {
  businessName: string
  orders: Order[]
  broadcasts?: MerchantBroadcast[]
  onOpenBroadcast?: (id: string) => void
  onDismissBroadcast?: (id: string) => void
}) {
  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [orders],
  )
  const ordersPagination = usePagination(sortedOrders, { initialPageSize: 10 })
  const unpaid = orders.filter(o => o.paymentStatus === 'Unpaid' && o.status !== 'Cancelled').length
  const pending = orders.filter(o => o.status === 'Pending').length

  const systemNotifs = [
    unpaid > 0 && {
      icon: '💳',
      bg: 'oklch(0.96 0.02 30)',
      title: `${unpaid} unpaid order${unpaid > 1 ? 's' : ''}`,
      sub: 'Awaiting payment collection',
      time: 'Now',
      dot: true,
    },
    pending > 0 && {
      icon: '🔔',
      bg: 'oklch(0.96 0.04 75)',
      title: `${pending} order${pending > 1 ? 's' : ''} pending`,
      sub: 'Needs your attention',
      time: 'Now',
      dot: true,
    },
  ].filter(Boolean) as { icon: string; bg: string; title: string; sub: string; time: string; dot: boolean }[]

  return (
    <div>
      {broadcasts.length > 0 && (
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <p style={{ margin: 0, padding: '10px 20px 6px', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>From Koddly</p>
          {broadcasts.map((b) => (
            <div
              key={b.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpenBroadcast?.(b.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onOpenBroadcast?.(b.id)
                }
              }}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
            >
              <div style={{ width: 34, height: 34, borderRadius: 9, background: b.severity === 'CRITICAL' ? 'oklch(0.96 0.02 30)' : b.severity === 'WARNING' ? 'oklch(0.96 0.04 75)' : 'oklch(0.94 0.04 250)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--foreground)' }}>
                <Megaphone size={15} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: b.unread ? 600 : 500, color: 'var(--foreground)' }}>{b.title}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted-foreground)', whiteSpace: 'pre-wrap' }}>{b.body}</p>
                <p style={{ margin: '4px 0 0', fontSize: 10, color: 'var(--muted-foreground)' }}>
                  {b.publishedAt ? new Date(b.publishedAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Koddly'}
                  {b.dismissed ? ' · Dismissed' : ''}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                {b.unread && !b.dismissed ? <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--destructive)', flexShrink: 0 }} /> : null}
                {!b.dismissed ? (
                  <button
                    type="button"
                    aria-label={`Dismiss ${b.title}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onDismissBroadcast?.(b.id)
                    }}
                    style={{ border: 'none', background: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer', padding: 2 }}
                  >
                    <X size={12} />
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* System alerts */}
      {systemNotifs.length > 0 && (
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <p style={{ margin: 0, padding: '10px 20px 6px', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Alerts</p>
          {systemNotifs.map((n, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: n.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{n.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>{n.title}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted-foreground)' }}>{n.sub}</p>
              </div>
              {n.dot && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--destructive)', flexShrink: 0, marginTop: 5 }} />}
            </div>
          ))}
        </div>
      )}

      {/* Recent orders */}
      <div>
        <p style={{ margin: 0, padding: '10px 20px 6px', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Recent Orders</p>
        {ordersPagination.totalItems === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>No orders yet for {businessName || 'your business'}.</p>
          </div>
        ) : (
          <>
            {ordersPagination.pageItems.map((order) => (
              <div key={order.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: order.status === 'Pending' ? 'oklch(0.96 0.04 75)' : order.status === 'Completed' ? 'oklch(0.94 0.04 145)' : 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
                  {order.status === 'Pending' ? '🕐' : order.status === 'Completed' ? '✅' : order.status === 'Preparing' ? '👨‍🍳' : order.status === 'Ready' ? '🛎' : '❌'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>{order.id} · {order.customer.name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted-foreground)' }}>
                    {order.status} · {order.paymentStatus} · {currency(merchantPayoutOf(order))}
                  </p>
                </div>
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)', flexShrink: 0 }}>
                  {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
            <PaginationBar pagination={ordersPagination} hideWhenEmpty={false} />
          </>
        )}
      </div>
    </div>
  )
}

function SidebarProfile({
  business,
  businesses,
  businessName,
  logoUrl,
  onLogoUpload,
  logoUploading,
  staffMode,
  staffName,
  onSelectBranch,
  onLogoutRequest,
}: {
  business: Business
  businesses: Business[]
  businessName: string
  logoUrl?: string | null
  onLogoUpload: (dataUrl: string) => Promise<void>
  logoUploading?: boolean
  staffMode: boolean
  staffName: string | null
  onSelectBranch: (businessId: string) => void | Promise<void>
  onLogoutRequest: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const initials = businessName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const branchLabel = business.branchLabel || business.name || 'Branch'
  const canSwitchBranches = !staffMode && businesses.length > 1

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setUploadError('Please choose an image file (PNG, JPG, or WebP).')
      return
    }
    // Allow up to 15MB raw — resizeImageFile always outputs a small 256×256 JPEG
    if (file.size > 15 * 1024 * 1024) {
      setUploadError('Image must be under 15MB.')
      return
    }
    setUploadError(null)

    try {
      const dataUrl = await resizeImageFile(file)
      // Sanity check on the output (should never exceed ~80KB as a 256px JPEG)
      if (dataUrl.length > 200_000) {
        setUploadError('Could not compress that image small enough. Try a different file.')
        return
      }
      await onLogoUpload(dataUrl)
    } catch {
      setUploadError('Could not process that image. Try another file.')
    }
  }

  return (
    <div className="sidebar-profile">
      <button
        type="button"
        className="sidebar-profile-avatar"
        style={logoUrl ? undefined : { background: business.accent }}
        title="Tap to upload your logo"
        aria-label="Upload business logo"
        disabled={logoUploading || staffMode}
        onClick={() => inputRef.current?.click()}
      >
        {logoUrl ? (
          <img src={logoUrl} alt="" className="sidebar-profile-avatar-img" />
        ) : (
          initials
        )}
        {!staffMode ? (
          <span className="sidebar-profile-avatar-badge" aria-hidden="true">
            <ImagePlus size={10} />
          </span>
        ) : null}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        onChange={handleFileChange}
        disabled={logoUploading || staffMode}
      />
      <div className="sidebar-profile-info">
        <strong>{businessName}</strong>
        <span className="sidebar-profile-type">
          {staffMode
            ? `${branchLabel}${staffName ? ` · ${staffName}` : ''}`
            : branchLabel}
        </span>
        {uploadError ? <span className="sidebar-profile-error">{uploadError}</span> : null}
      </div>

      <div className="sidebar-profile-actions">
        {canSwitchBranches ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="sidebar-profile-branch"
                title="Switch branch"
                aria-label="Switch branch"
              >
                <ChevronsUpDown size={15} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" sideOffset={8} className="min-w-44">
              <DropdownMenuLabel>Branches</DropdownMenuLabel>
              {businesses.map((b) => {
                const label = `${b.branchLabel || b.name}${b.primary ? ' (Main)' : ''}`
                const active = b.id === business.id
                return (
                  <DropdownMenuItem
                    key={b.id}
                    onSelect={() => {
                      if (!active) void onSelectBranch(b.id)
                    }}
                  >
                    <span style={{ flex: 1 }}>{label}</span>
                    {active ? <Check size={14} /> : null}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        <button
          type="button"
          className="sidebar-profile-logout"
          title="Log out"
          onClick={onLogoutRequest}
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  )
}

function OverviewPage({
  business,
  orders,
}: {
  business: Business
  orders: Order[]
}) {
  const openOrders = orders.filter(
    (order) => order.status !== 'Completed' && order.status !== 'Cancelled',
  ).length
  const menuItems = (business.items ?? []).filter((item) => item.available).length
  const totalItems = (business.items ?? []).length

  return (
    <div className="account-layout">
      <MetricsCard business={business} />

      <section className="account-summary">
        <QrPanel business={business} />

        <div className="link-map">
          <h3>At a glance</h3>
          <div>
            <span>Customer menu</span>
            <strong>Make QR code Visible To Clients</strong>
          </div>
          <div>
            <span>Open orders</span>
            <strong>
              {openOrders === 0
                ? 'None right now'
                : openOrders === 1
                  ? '1 order waiting'
                  : `${openOrders} orders waiting`}
            </strong>
          </div>
          <div>
            <span>Menu items</span>
            <strong>
              {totalItems === 0
                ? 'No items yet — add some in Catalog'
                : `${menuItems} available · ${totalItems} total`}
            </strong>
          </div>
          <div>
            <span>Business</span>
            <strong>
              {business.name}
              {business.type ? ` · ${business.type}` : ''}
            </strong>
          </div>
        </div>
      </section>
    </div>
  )
}


function QrPanel({ business, compact = false }: { business: Business; compact?: boolean }) {
  const [qrImage, setQrImage] = useState('')
  const url = customerUrl(business)
  const size = compact ? 110 : 220
  const logoUrl = business.logoUrl || null

  useEffect(() => {
    let cancelled = false

    merchantQrDataUrl(url, logoUrl, size)
      .then((image) => {
        if (!cancelled) setQrImage(image)
      })
      .catch(() => {
        if (!cancelled) setQrImage('')
      })

    return () => {
      cancelled = true
    }
  }, [business.id, compact, logoUrl, size, url])

  async function shareQr() {
    if (!qrImage) {
      toast.error('QR image is still loading')
      return
    }

    const shareTitle = `${business.name} QR code`
    const fileName = `${business.name.replace(/[^\w-]+/g, '_').slice(0, 40) || 'Koddly'}-qr.png`

    try {
      const imageResponse = await fetch(qrImage)
      const imageBlob = await imageResponse.blob()
      const imageFile = new File([imageBlob], fileName, { type: 'image/png' })

      if (
        typeof navigator !== 'undefined'
        && typeof navigator.share === 'function'
        && (!navigator.canShare || navigator.canShare({ files: [imageFile] }))
      ) {
        await navigator.share({
          title: shareTitle,
          files: [imageFile],
        })
        return
      }

      // Fallback for browsers that cannot share files directly.
      const a = document.createElement('a')
      a.href = qrImage
      a.download = fileName
      a.click()
      toast.success('QR image downloaded. Share the PNG from your files.')
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      toast.error(err instanceof Error ? err.message : 'Could not share QR image')
    }
  }

  return (
    <div className={compact ? 'qr-panel compact' : 'qr-panel large'} style={{ '--accent': business.accent } as QrStyle}>
      <div className="print-card">
        <div className="print-brand">Koddly</div>
        <h3>{business.name}</h3>
        <p>Scan to view prices, browse the menu, and place orders.</p>
        {qrImage ? <img src={qrImage} alt={`${business.name} QR code`} /> : <div className="qr-loading" />}
      </div>

      <div className="qr-details">
        {!compact && (
          <>
            <dl>
              <div>
                <dt>Business</dt>
                <dd>{business.name}</dd>
              </div>
              <div>
                <dt>How it works</dt>
                <dd>Customers scan this code to open your menu and place an order</dd>
              </div>
            </dl>
            <div className="qr-actions">
              <button type="button" onClick={() => window.print()}>
                Print QR
              </button>
              <button
                type="button"
                disabled={!qrImage}
                onClick={() => {
                  if (!qrImage) return
                  const a = document.createElement('a')
                  a.href = qrImage
                  a.download = `${business.name.replace(/[^\w-]+/g, '_').slice(0, 40) || 'Koddly'}-qr.png`
                  a.click()
                }}
              >
                Download QR
              </button>
              <button type="button" onClick={() => void shareQr()}>
                Share QR
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function catalogItemToFormState(item: CatalogItem | undefined, isLodging: boolean) {
  if (!item) {
    return {
      name: '',
      category: isLodging ? 'Rooms' : '',
      price: '',
      discountPercent: '',
      description: '',
      imageUrl: null as string | null,
      imageUrls: [] as string[],
      details: '',
      ingredients: [] as NonNullable<CatalogItem['ingredients']>,
      available: true,
      itemKind: (isLodging ? 'ROOM' : 'FOOD') as CatalogItemKind,
      capacity: '2',
      amenitiesText: '',
      unitsAvailable: '1',
    }
  }
  return {
    name: item.name ?? '',
    category: item.category ?? (isLodging ? 'Rooms' : ''),
    price: item.price != null ? String(item.price) : '',
    discountPercent: item.discountPercent && item.discountPercent > 0 ? String(item.discountPercent) : '',
    description: item.description ?? '',
    imageUrl: item.imageUrl ?? null,
    imageUrls: item.imageUrls?.length ? [...item.imageUrls] : item.imageUrl ? [item.imageUrl] : [],
    details: item.details ?? '',
    ingredients: item.ingredients ? [...item.ingredients] : [],
    available: item.available !== false,
    itemKind: (item.itemKind ?? (isLodging ? 'ROOM' : 'FOOD')) as CatalogItemKind,
    capacity: String(item.capacity ?? 2),
    amenitiesText: (item.amenities ?? []).join(', '),
    unitsAvailable: String(item.unitsAvailable ?? 1),
  }
}

function AddItemForm({
  business,
  section = 'food',
  initialItem,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
  onAddCategory,
  onCancel,
}: {
  business: Business
  section?: 'food' | 'lodging'
  initialItem?: CatalogItem
  onCreateItem: (data: CreateCatalogItemRequest) => Promise<void> | void
  onUpdateItem?: (itemId: string, data: Partial<CatalogItem>) => Promise<void> | void
  onDeleteItem?: (itemId: string) => Promise<void> | void
  onAddCategory: (name: string) => Promise<string[] | void>
  onCancel?: () => void
}) {
  const isHotel = business.type === 'Hotel'
  const isEdit = Boolean(initialItem?.id)
  const isLodging = isHotel && (
    section === 'lodging'
    || initialItem?.itemKind === 'ROOM'
    || initialItem?.itemKind === 'SUITE'
  )
  const [item, setItem] = useState(() => catalogItemToFormState(initialItem, isLodging))
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const categories = businessCategories(business).filter((cat) => {
    if (!isHotel) return true
    const lodgingCats = cat === 'Rooms' || cat === 'Suites'
    return isLodging ? lodgingCats || cat === item.category : !lodgingCats
  })

  async function submitItem(event) {
    event.preventDefault()

    const name = item.name.trim()
    const category = item.category.trim()
    const price = Number(item.price)
    const discountPercent = Math.max(0, Math.min(100, Math.round(Number(item.discountPercent) || 0)))
    const capacity = Math.max(0, Math.round(Number(item.capacity) || 0))
    const unitsAvailable = Math.max(0, Math.round(Number(item.unitsAvailable) || 0))

    setSubmitted(true)

    if (!name || !category || !Number.isFinite(price) || price <= 0) return
    if (isLodging && (capacity < 1 || unitsAvailable < 1)) return

    setSaving(true)
    try {
      const amenities = item.amenitiesText
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
      const gallery = isLodging
        ? item.imageUrls
        : item.imageUrl
          ? [item.imageUrl]
          : []
      const payload = {
        name,
        category,
        price,
        description: item.description.trim() || (isLodging ? 'Comfortable stay.' : 'No description added yet.'),
        imageUrl: gallery[0] ?? item.imageUrl,
        imageUrls: gallery,
        details: item.details.trim(),
        ingredients: isLodging ? [] : item.ingredients,
        available: item.available,
        discountPercent,
        itemKind: isLodging ? item.itemKind : 'FOOD' as CatalogItemKind,
        capacity: isLodging ? capacity : 0,
        amenities: isLodging ? amenities : [],
        unitsAvailable: isLodging ? unitsAvailable : 0,
      }
      if (isEdit && initialItem?.id && onUpdateItem) {
        await onUpdateItem(initialItem.id, payload)
      } else {
        await onCreateItem(payload)
        setItem(catalogItemToFormState(undefined, isLodging))
        setSubmitted(false)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!initialItem?.id || !onDeleteItem) return
    setSaving(true)
    try {
      await onDeleteItem(initialItem.id)
    } finally {
      setSaving(false)
    }
  }

  const isItemNameMissing = submitted && !item.name.trim()
  const isCategoryMissing = submitted && !item.category.trim()
  const price = Number(item.price)
  const isPriceMissing = submitted && (!Number.isFinite(price) || price <= 0)
  const capacity = Number(item.capacity)
  const unitsAvailable = Number(item.unitsAvailable)
  const isCapacityMissing = isLodging && submitted && (!Number.isFinite(capacity) || capacity < 1)
  const isUnitsMissing = isLodging && submitted && (!Number.isFinite(unitsAvailable) || unitsAvailable < 1)
  const discountPercent = Math.max(0, Math.min(100, Math.round(Number(item.discountPercent) || 0)))
  const salePrice = Number.isFinite(price) && price > 0 ? effectivePrice(price, discountPercent) : null
  const formId = isEdit ? 'edit-item' : 'add-item'

  return (
    <form className="add-item-form" noValidate onSubmit={submitItem}>
      <aside className="add-item-media" aria-label={isLodging ? 'Room photos' : 'Item photo'}>
        {isLodging ? (
          <CatalogItemGalleryField
            imageUrls={item.imageUrls}
            name={item.name}
            disabled={saving}
            onChange={(imageUrls) => setItem({ ...item, imageUrls, imageUrl: imageUrls[0] ?? null })}
          />
        ) : (
          <CatalogItemImageField
            layout="side"
            imageUrl={item.imageUrl}
            category={item.category}
            name={item.name}
            disabled={saving}
            onChange={(imageUrl) => setItem({ ...item, imageUrl })}
          />
        )}
      </aside>

      <div className="add-item-fields">
        <section className="add-item-card" aria-labelledby={`${formId}-general-heading`}>
          <header className="add-item-card-head">
            <Info className="add-item-card-icon" aria-hidden="true" />
            <h3 id={`${formId}-general-heading`}>{isLodging ? 'Room / Suite' : 'General Information'}</h3>
          </header>

          {isLodging ? (
            <div className="grid gap-1.5">
              <Label htmlFor={`${formId}-kind`}>Type</Label>
              <Select
                value={item.itemKind}
                onValueChange={(value) =>
                  setItem({
                    ...item,
                    itemKind: value as CatalogItemKind,
                    category: value === 'SUITE' ? 'Suites' : 'Rooms',
                  })
                }
              >
                <SelectTrigger id={`${formId}-kind`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ROOM">Room</SelectItem>
                  <SelectItem value="SUITE">Suite</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="add-item-row">
            <div className="grid gap-1.5">
              <Label htmlFor={`${formId}-name`}>{isLodging ? 'Name' : 'Item name'}</Label>
              <Input
                id={`${formId}-name`}
                type="text"
                required
                aria-invalid={isItemNameMissing}
                className={isItemNameMissing ? 'border-destructive' : undefined}
                value={item.name}
                onChange={(event) => setItem({ ...item, name: event.target.value })}
                placeholder={isLodging ? 'Deluxe King Suite' : 'Big Burger Combo'}
              />
              {isItemNameMissing && <span className="text-xs text-destructive">{REQUIRED_FIELD_MESSAGE}</span>}
            </div>

            <div className="grid gap-1.5">
              <CategoryField
                id={`${formId}-category`}
                categories={categories.length ? categories : isLodging ? ['Rooms', 'Suites'] : []}
                value={item.category}
                onChange={(category) => setItem({ ...item, category })}
                onAddCategory={onAddCategory}
                error={isCategoryMissing}
                disabled={saving}
              />
              {isCategoryMissing && <span className="text-xs text-destructive">{REQUIRED_FIELD_MESSAGE}</span>}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`${formId}-description`}>Short description</Label>
            <Textarea
              id={`${formId}-description`}
              className=""
              rows={3}
              value={item.description}
              onChange={(event) => setItem({ ...item, description: event.target.value })}
              placeholder={isLodging ? 'City view, king bed, ensuite bathroom' : 'Shown on the card — e.g. Burger + fries + soda'}
            />
          </div>
        </section>

        <section className="add-item-card" aria-labelledby={`${formId}-pricing-heading`}>
          <header className="add-item-card-head">
            <Banknote className="add-item-card-icon" aria-hidden="true" />
            <h3 id={`${formId}-pricing-heading`}>{isLodging ? 'Nightly rate & stay details' : 'Pricing & Details'}</h3>
          </header>

          <div className="add-item-row">
            <div className="grid gap-1.5">
              <Label htmlFor={`${formId}-price`}>{isLodging ? 'Price per night (UGX)' : 'Price (UGX)'}</Label>
              <Input
                id={`${formId}-price`}
                required
                aria-invalid={isPriceMissing}
                className={isPriceMissing ? 'border-destructive' : undefined}
                min="1"
                type="number"
                value={item.price}
                onChange={(event) => setItem({ ...item, price: event.target.value })}
                placeholder={isLodging ? '250000' : '18000'}
              />
              {isPriceMissing && <span className="text-xs text-destructive">{REQUIRED_FIELD_MESSAGE}</span>}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor={`${formId}-discount`}>Discount (%)</Label>
              <Input
                id={`${formId}-discount`}
                min="0"
                max="100"
                type="number"
                value={item.discountPercent}
                onChange={(event) => setItem({ ...item, discountPercent: event.target.value })}
                placeholder="Optional"
              />
              {discountPercent > 0 && salePrice != null ? (
                <p className="text-xs text-muted-foreground">
                  Now <strong className="text-foreground">{currency(salePrice)}</strong>
                  {' '}
                  <span className="line-through">{currency(price)}</span>
                  {isLodging ? ' / night' : ''}
                </p>
              ) : null}
            </div>
          </div>

          {isLodging ? (
            <>
              <div className="add-item-row">
                <div className="grid gap-1.5">
                  <Label htmlFor={`${formId}-capacity`}>Max guests</Label>
                  <Input
                    id={`${formId}-capacity`}
                    type="number"
                    min="1"
                    aria-invalid={isCapacityMissing}
                    className={isCapacityMissing ? 'border-destructive' : undefined}
                    value={item.capacity}
                    onChange={(event) => setItem({ ...item, capacity: event.target.value })}
                  />
                  {isCapacityMissing && <span className="text-xs text-destructive">{REQUIRED_FIELD_MESSAGE}</span>}
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`${formId}-units`}>Units available</Label>
                  <Input
                    id={`${formId}-units`}
                    type="number"
                    min="1"
                    aria-invalid={isUnitsMissing}
                    className={isUnitsMissing ? 'border-destructive' : undefined}
                    value={item.unitsAvailable}
                    onChange={(event) => setItem({ ...item, unitsAvailable: event.target.value })}
                  />
                  {isUnitsMissing && <span className="text-xs text-destructive">{REQUIRED_FIELD_MESSAGE}</span>}
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`${formId}-amenities`}>Amenities (comma-separated)</Label>
                <Input
                  id={`${formId}-amenities`}
                  value={item.amenitiesText}
                  onChange={(event) => setItem({ ...item, amenitiesText: event.target.value })}
                  placeholder="Wi‑Fi, AC, Mini bar, Balcony"
                />
              </div>
            </>
          ) : null}

          <div className="grid gap-1.5">
            <Label htmlFor={`${formId}-details`}>{isLodging ? 'Full details' : 'Combo details'}</Label>
            <Textarea
              id={`${formId}-details`}
              className=""
              rows={4}
              value={item.details}
              onChange={(event) => setItem({ ...item, details: event.target.value })}
              placeholder={isLodging ? 'Room size, bed type, view, house rules…' : 'Full details customers see when they expand the item…'}
            />
          </div>
        </section>

        <section className="add-item-card">
          {!isLodging ? (
            <IngredientsEditor
              value={item.ingredients}
              disabled={saving}
              onChange={(ingredients) => setItem({ ...item, ingredients })}
            />
          ) : null}

          <div className="flex items-center gap-2">
            <input
              id={`${formId}-available`}
              checked={item.available}
              type="checkbox"
              className="size-4 rounded border-border accent-primary"
              onChange={(event) => setItem({ ...item, available: event.target.checked })}
            />
            <Label htmlFor={`${formId}-available`} className="cursor-pointer font-normal">
              Available to customers
            </Label>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {onCancel ? (
              <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>
                Cancel
              </Button>
            ) : null}
            <Button className="min-w-36" type="submit" disabled={saving}>
              {saving
                ? 'Saving…'
                : isEdit
                  ? 'Save changes'
                  : isLodging
                    ? 'Add room / suite'
                    : 'Add item'}
            </Button>
            {isEdit && onDeleteItem ? (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                disabled={saving}
                title="Delete item"
                onClick={() => void handleDelete()}
              >
                <Trash2 className="size-4" />
              </Button>
            ) : null}
          </div>
        </section>
      </div>
    </form>
  )
}
function CatalogPage({
  business,
  onAddItem,
  onEditItem,
  Sparkline,
  initialSection,
  hideSectionTabs,
}: {
  business: Business
  onAddItem: (section: 'food' | 'lodging') => void
  onEditItem: (item: CatalogItem) => void
  Sparkline: (props: { data: number[]; color?: string }) => ReactElement | null
  initialSection?: 'food' | 'lodging' | 'booked-rooms'
  /** When true, hide the Food / Rooms / Booked-rooms toggle buttons (sidebar handles it). */
  hideSectionTabs?: boolean
}) {
  const isHotel = business.type === 'Hotel'
  const [catalogSection, setCatalogSection] = useState<'food' | 'lodging' | 'booked-rooms'>(
    initialSection ?? 'food'
  )
  const categories = useMemo(() => {
    const all = businessCategories(business)
    if (!isHotel) return all
    return all.filter((cat) => {
      const lodging = cat === 'Rooms' || cat === 'Suites'
      return catalogSection === 'lodging' ? lodging : !lodging
    })
  }, [business, isHotel, catalogSection])

  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [pageItems, setPageItems] = useState<CatalogItem[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)

  const filterResetKey = `${search}|${filterCategory}|${filterStatus}|${catalogSection}`
  const pagination = useServerPagination({
    totalItems,
    initialPageSize: 20,
    resetKey: filterResetKey,
  })

  useEffect(() => {
    if (!business.id) return
    if (catalogSection === 'booked-rooms') return  // handled by BookedRoomsTab itself
    let cancelled = false
    async function loadPage() {
      setListLoading(true)
      setListError(null)
      try {
        const available =
          filterStatus === 'available' ? true : filterStatus === 'hidden' ? false : undefined
        const result = await scannyApi.catalog.listPaged(business.id, {
          page: pagination.page,
          size: pagination.pageSize,
          search: search.trim() || undefined,
          category: filterCategory === 'all' ? undefined : filterCategory,
          available,
          lodging: isHotel ? catalogSection === 'lodging' : undefined,
        })
        if (cancelled) return
        setPageItems(result.items)
        setTotalItems(result.pagination.totalItems)
      } catch (err) {
        if (cancelled) return
        setListError(err instanceof Error ? err.message : 'Failed to load catalog')
        setPageItems([])
        setTotalItems(0)
      } finally {
        if (!cancelled) setListLoading(false)
      }
    }
    void loadPage()
    return () => {
      cancelled = true
    }
  }, [
    business.id,
    pagination.page,
    pagination.pageSize,
    search,
    filterCategory,
    filterStatus,
    business.items.length,
    catalogSection,
    isHotel,
  ])

  function resetFilters() {
    setSearch('')
    setFilterCategory('all')
    setFilterStatus('all')
  }

  const isFiltered = search || filterCategory !== 'all' || filterStatus !== 'all'

  const sectionItems = (business.items ?? []).filter((item) => {
    const lodging = item.itemKind === 'ROOM' || item.itemKind === 'SUITE'
    return isHotel && catalogSection === 'lodging' ? lodging : !lodging
  })

  return (
    <section className="catalog-page">
      {isHotel && !hideSectionTabs ? (
        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={catalogSection === 'food' ? 'default' : 'outline'}
            onClick={() => { setCatalogSection('food'); resetFilters() }}
          >
            Food menu
          </Button>
          <Button
            type="button"
            size="sm"
            variant={catalogSection === 'lodging' ? 'default' : 'outline'}
            onClick={() => { setCatalogSection('lodging'); resetFilters() }}
          >
            Rooms &amp; suites
          </Button>
          <Button
            type="button"
            size="sm"
            variant={catalogSection === 'booked-rooms' ? 'default' : 'outline'}
            onClick={() => { setCatalogSection('booked-rooms'); resetFilters() }}
          >
            <BedDouble size={14} className="mr-1.5" />
            Booked rooms
          </Button>
        </div>
      ) : null}

      {/* Booked Rooms management view — hotel only */}
      {isHotel && catalogSection === 'booked-rooms' ? (
        <BookedRoomsTab businessId={business.id} />
      ) : (
        <>
      <section className="metric-grid" aria-label="Catalog summary">
        <div>
          <span>Total items</span>
          <strong>{sectionItems.length}</strong>
          <Sparkline data={Array.from({ length: 7 }, () => sectionItems.length)} color="#3b82f6" />
        </div>
        <div>
          <span>Available</span>
          <strong>{sectionItems.filter(i => i.available).length}</strong>
          <Sparkline data={Array.from({ length: 7 }, () => sectionItems.filter(i => i.available).length)} color="#10b981" />
        </div>
        <div>
          <span>Hidden</span>
          <strong>{sectionItems.filter(i => !i.available).length}</strong>
          <Sparkline data={Array.from({ length: 7 }, () => sectionItems.filter(i => !i.available).length)} color="#f59e0b" />
        </div>
        <div>
          <span>Categories</span>
          <strong>{categories.length}</strong>
          <Sparkline data={Array.from({ length: 7 }, () => categories.length)} color="#8b5cf6" />
        </div>
      </section>

        {/* Catalog grid */}
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder={catalogSection === 'lodging' ? 'Search rooms…' : 'Search items…'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-sm"
                aria-label="Search catalog items"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-8 w-[150px] text-sm" aria-label="Filter by category">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent className="">
                <SelectItem className="" value="all">All categories</SelectItem>
                {categories.map((cat) => <SelectItem className="" key={cat} value={cat}>{cat}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 w-[130px] text-sm" aria-label="Filter by status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent className="">
                <SelectItem className="" value="all">All statuses</SelectItem>
                <SelectItem className="" value="available">Available</SelectItem>
                <SelectItem className="" value="hidden">Hidden</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-auto">
              {totalItems} of {sectionItems.length} items
            </span>
            {isFiltered && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 text-xs">
                Clear filters
              </Button>
            )}
            <Button size="sm" className="h-8" onClick={() => onAddItem(catalogSection === 'lodging' ? 'lodging' : 'food')}>
              <Plus className="size-3.5" />
              {catalogSection === 'lodging' ? 'Add room / suite' : 'Add item'}
            </Button>
          </div>

          <div className="p-4">
            {listLoading ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Loading catalog…</p>
            ) : listError ? (
              <p className="py-10 text-center text-sm text-destructive">{listError}</p>
            ) : pageItems.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No items match your search.{' '}
                <button type="button" className="text-primary underline" onClick={resetFilters}>Clear filters</button>
              </p>
            ) : (
              <div className="catalog-item-grid">
                {pageItems.map((entry) => {
                  const thumb = entry.imageUrl || entry.imageUrls?.[0] || getCategoryImage(entry.category)
                  const ingredientCount = entry.ingredients?.length ?? 0
                  const galleryCount = entry.imageUrls?.length ?? (entry.imageUrl ? 1 : 0)
                  const off = discountPercentOf(entry)
                  const sale = effectivePrice(entry)
                  const lodging = entry.itemKind === 'ROOM' || entry.itemKind === 'SUITE'
                  return (
                    <article key={entry.id} className="catalog-item-card">
                      <button type="button" className="catalog-item-card-media" onClick={() => onEditItem(entry)}>
                        <img src={thumb} alt="" />
                        {!entry.available ? <span className="catalog-item-card-ribbon">Hidden</span> : null}
                        {entry.available && off > 0 ? (
                          <span className="catalog-item-card-ribbon catalog-item-card-ribbon-offer">{off}% OFF</span>
                        ) : null}
                      </button>
                      <div className="catalog-item-card-body">
                        <div className="catalog-item-card-top">
                          <h3>{entry.name}</h3>
                          <Badge variant="secondary" className="shrink-0">
                            {lodging ? entry.itemKind : entry.category}
                          </Badge>
                        </div>
                        {entry.description ? <p className="catalog-item-card-desc">{entry.description}</p> : null}
                        <div className="catalog-item-card-meta">
                          {off > 0 ? (
                            <strong>
                              {currency(sale)}{lodging ? ' / night' : ''}{' '}
                              <span className="text-xs font-normal text-muted-foreground line-through">
                                {currency(entry.price)}
                              </span>
                            </strong>
                          ) : (
                            <strong>{currency(entry.price)}{lodging ? ' / night' : ''}</strong>
                          )}
                          {lodging ? (
                            <span className="text-xs text-muted-foreground">
                              {entry.capacity ?? 0} guests · {galleryCount} photo{galleryCount === 1 ? '' : 's'}
                            </span>
                          ) : ingredientCount > 0 ? (
                            <span className="text-xs text-muted-foreground">{ingredientCount} ingredients</span>
                          ) : null}
                        </div>
                        <div className="catalog-item-card-actions">
                          <Badge
                            variant="secondary"
                            className={entry.available
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-muted text-muted-foreground'}
                          >
                            {entry.available ? 'Available' : 'Hidden'}
                          </Badge>
                          <Button variant="outline" size="sm" className="h-7 text-xs ml-auto" onClick={() => onEditItem(entry)}>
                            <Pencil className="size-3" />
                            Edit
                          </Button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="border-t border-border px-5 py-3">
            <PaginationBar pagination={pagination} hideWhenEmpty={false} />
          </div>
        </div>
        </>
      )}
      </section>
    )
}

function OrderActionMenu({
  onViewDetails,
}: {
  onViewDetails: () => void
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="View order details"
      onClick={onViewDetails} className={undefined}    >
      <Eye className="size-4" />
    </Button>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    Pending: 'bg-amber-50 text-amber-700 border-amber-200',
    Preparing: 'bg-blue-50 text-blue-700 border-blue-200',
    Ready: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Completed: 'bg-muted text-muted-foreground',
    Cancelled: 'bg-red-50 text-red-600 border-red-200',
  }
  return <Badge variant="secondary" className={cls[status] ?? cls.Pending}>{status}</Badge>
}

function PaymentBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    Unpaid: 'bg-red-50 text-red-600 border-red-200',
    Paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Refunded: 'bg-muted text-muted-foreground',
  }
  return <Badge variant="secondary" className={cls[status] ?? cls.Unpaid}>{status}</Badge>
}

function Dashboard({
  business,
  orders,
  onClearCompleted,
  onPaymentChange,
  onStatusChange,
  Sparkline,
}: {
  business: Business
  orders: Order[]
  onClearCompleted: () => void
  onPaymentChange: (orderId: string, paymentStatus: PaymentStatus) => void
  onStatusChange: (orderId: string, status: OrderStatus) => void
  Sparkline: (props: { data: number[]; color?: string }) => ReactElement | null
}) {
  const statusOptions: OrderStatus[] = ['Pending', 'Preparing', 'Ready', 'Completed', 'Cancelled']
  const paymentOptions: PaymentStatus[] = ['Unpaid', 'Paid', 'Refunded']
  const listKey = `${business.id}:${orders.length}`
  const [detailOrderId, setDetailOrderId] = useState('')
  const [detailListKey, setDetailListKey] = useState(listKey)
  const [pageOrders, setPageOrders] = useState<Order[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  if (detailListKey !== listKey) {
    setDetailListKey(listKey)
    setDetailOrderId('')
  }

  const pagination = useServerPagination({
    totalItems,
    initialPageSize: 20,
    resetKey: business.id,
  })

  useEffect(() => {
    if (!business.id) return
    let cancelled = false
    async function loadPage() {
      setListLoading(true)
      setListError(null)
      try {
        const result = await scannyApi.orders.listPaged(business.id, {
          page: pagination.page,
          size: pagination.pageSize,
        })
        if (cancelled) return
        setPageOrders(result.items)
        setTotalItems(result.pagination.totalItems)
      } catch (err) {
        if (cancelled) return
        setListError(err instanceof Error ? err.message : 'Failed to load orders')
        setPageOrders([])
        setTotalItems(0)
      } finally {
        if (!cancelled) setListLoading(false)
      }
    }
    void loadPage()
    return () => {
      cancelled = true
    }
  }, [business.id, pagination.page, pagination.pageSize, reloadToken, orders.length])

  const detailOrder =
    pageOrders.find((order) => order.id === detailOrderId) ??
    orders.find((order) => order.id === detailOrderId)

  const openCount = orders.filter(o => o.status !== 'Completed' && o.status !== 'Cancelled').length
  const paidSales = orders.filter(o => o.paymentStatus === 'Paid').reduce((sum, o) => sum + o.total, 0)
  const unpaidCount = orders.filter(o => o.paymentStatus === 'Unpaid' && o.status !== 'Cancelled').length
  const completedCount = orders.filter(o => o.status === 'Completed').length

  const openTrend = useMemo(
    () => dailySeries(orders, (dayOrders) => dayOrders.filter((o) => o.status !== 'Completed' && o.status !== 'Cancelled').length),
    [orders],
  )
  const paidTrend = useMemo(
    () => dailySeries(orders, (dayOrders) => dayOrders.filter((o) => o.paymentStatus === 'Paid').reduce((sum, o) => sum + o.total, 0)),
    [orders],
  )
  const unpaidTrend = useMemo(
    () => dailySeries(orders, (dayOrders) => dayOrders.filter((o) => o.paymentStatus === 'Unpaid' && o.status !== 'Cancelled').length),
    [orders],
  )
  const completedTrend = useMemo(
    () => dailySeries(orders, (dayOrders) => dayOrders.filter((o) => o.status === 'Completed').length),
    [orders],
  )

  async function handleStatusChange(orderId: string, status: OrderStatus) {
    await onStatusChange(orderId, status)
    setReloadToken((n) => n + 1)
  }

  async function handlePaymentChange(orderId: string, paymentStatus: PaymentStatus) {
    await onPaymentChange(orderId, paymentStatus)
    setReloadToken((n) => n + 1)
  }

  async function handleClearCompleted() {
    await onClearCompleted()
    setReloadToken((n) => n + 1)
  }

  return (
    <section className="dashboard">
      {/* Metric cards */}
      <section className="metric-grid" aria-label="Orders summary">
        <div>
          <span>Open orders</span>
          <strong>{openCount}</strong>
          <Sparkline data={openTrend} color="#3b82f6" />
        </div>
        <div>
          <span>Paid sales</span>
          <strong>{currency(paidSales)}</strong>
          <Sparkline data={paidTrend} color="#10b981" />
        </div>
        <div>
          <span>Awaiting payment</span>
          <strong>{unpaidCount}</strong>
          <Sparkline data={unpaidTrend} color="#f59e0b" />
        </div>
        <div>
          <span>Completed</span>
          <strong>{completedCount}</strong>
          <Sparkline data={completedTrend} color="#8b5cf6" />
        </div>
      </section>

      {/* Orders table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
          <div>
            <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Management</p>
            <h3 className="mt-0.5 text-base font-semibold text-foreground">Orders</h3>
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => void handleClearCompleted()}>
            <Trash2 className="size-3.5" />
            Clear finished
          </Button>
        </div>

        <Table className={undefined}>
          <TableHeader className="">
            <TableRow className="hover:bg-transparent border-b border-border">
              <TableHead className="pl-5 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Order</TableHead>
              <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Customer</TableHead>
              <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
                {business.tableLabel || 'Table'}
              </TableHead>
              <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Note</TableHead>
              <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Items</TableHead>
              <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Total</TableHead>
              <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Status</TableHead>
              <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Payment</TableHead>
              <TableHead className="pr-5 text-right text-[10px] font-medium tracking-widest text-muted-foreground uppercase"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className={undefined}>
            {listLoading ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                  Loading orders…
                </TableCell>
              </TableRow>
            ) : listError ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={9} className="py-10 text-center text-sm text-destructive">
                  {listError}
                </TableCell>
              </TableRow>
            ) : pageOrders.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                  No orders yet.
                </TableCell>
              </TableRow>
            ) : (
              pageOrders.map((order) => (
              <TableRow
                key={order.id}
                className="border-b border-border hover:bg-muted/40 cursor-pointer"
                onClick={() => setDetailOrderId(order.id)}
              >
                <TableCell className="pl-5 py-3">
                  <p className="text-sm font-mono font-medium text-foreground">{order.id}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(order.createdAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </TableCell>
                <TableCell className={undefined}>
                  <p className="text-sm font-medium text-foreground">{order.customer.name}</p>
                </TableCell>
                <TableCell className="text-sm text-foreground">
                  {order.customer.location?.trim() || <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="max-w-[160px]">
                  {order.customer.note?.trim() ? (
                    <p className="text-sm text-foreground truncate" title={order.customer.note}>
                      {order.customer.note}
                    </p>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className={undefined}>
                  <div className="flex flex-wrap gap-1">
                    {order.items.slice(0, 2).map((item) => (
                      <Badge key={item.id} variant="secondary" className="text-[11px] font-normal">{item.quantity}× {item.name}</Badge>
                    ))}
                    {order.items.length > 2 && (
                      <Badge
                        variant="secondary"
                        className="order-items-more text-[11px] font-normal"
                        title="Tap for full order details"
                      >
                        +{order.items.length - 2} more
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm font-medium font-mono text-foreground">{currency(merchantPayoutOf(order))}</TableCell>
                <TableCell className={undefined}><StatusBadge status={order.status} /></TableCell>
                <TableCell className={undefined}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                    <PaymentBadge status={order.paymentStatus} />
                    {order.inventoryUnderStock && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                        padding: '2px 6px', borderRadius: 4,
                        background: 'oklch(0.97 0.04 50)', color: 'oklch(0.45 0.15 50)',
                        border: '1px solid oklch(0.85 0.08 50)', whiteSpace: 'nowrap',
                      }} title="One or more ingredients went below zero stock when this order was consumed">
                        ⚠ Stock–
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="pr-5 text-right" onClick={(e) => e.stopPropagation()}>
                  <OrderActionMenu
                    onViewDetails={() => setDetailOrderId(order.id)}
                  />
                </TableCell>
              </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="border-t border-border px-5 py-3">
          <PaginationBar pagination={pagination} hideWhenEmpty={false} />
        </div>
      </div>

      {/* Order detail — shadcn Sheet */}
      <Sheet open={!!detailOrderId} onOpenChange={(open) => { if (!open) setDetailOrderId('') }}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
          {detailOrder && (
            <>
              <SheetHeader className="border-b border-border px-6 py-4">
                <SheetTitle className="font-mono tracking-wide">{detailOrder.id}</SheetTitle>
                <SheetDescription className={undefined}>
                  {new Date(detailOrder.createdAt).toLocaleString([], { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {/* Customer */}
                <div>
                  <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase mb-2">Customer</p>
                  <p className="text-sm font-medium text-foreground">{detailOrder.customer.name}</p>
                  {detailOrder.customer.phone ? (
                    <p className="text-xs text-muted-foreground mt-0.5">{detailOrder.customer.phone}</p>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase mb-2">
                      {business.tableLabel || 'Table'}
                    </p>
                    <p className="text-sm text-foreground">
                      {detailOrder.customer.location?.trim() || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase mb-2">Note</p>
                    <p className="text-sm text-foreground">
                      {detailOrder.customer.note?.trim() || '—'}
                    </p>
                  </div>
                </div>

                <Separator className="" />

                {/* Items */}
                <div>
                  <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase mb-2">Items</p>
                  <ul className="space-y-2">
                    {detailOrder.items.map((item) => {
                      const removed = formatRemovedIngredients(item.removedIngredients)
                      return (
                      <li key={`${item.id}-${removed}`} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="text-sm text-foreground">{item.quantity} × {item.name}</span>
                          {removed ? <p className="text-xs text-muted-foreground mt-0.5">{removed}</p> : null}
                        </div>
                        <span className="text-sm font-medium font-mono text-foreground shrink-0">{currency(item.lineTotal)}</span>
                      </li>
                      )
                    })}
                  </ul>
                </div>

                <Separator className="" />

                {/* Total + payment */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Payment ref</span>
                    <span className="text-sm font-mono text-foreground">{detailOrder.paymentReference || '—'}</span>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="order-status">Status</Label>
                    <Select
                      value={detailOrder.status}
                      onValueChange={(value) => void handleStatusChange(detailOrder.id, value as OrderStatus)}
                    >
                      <SelectTrigger id="order-status" className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((status) => (
                          <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="order-payment">Payment</Label>
                    <Select
                      value={detailOrder.paymentStatus}
                      onValueChange={(value) => void handlePaymentChange(detailOrder.id, value as PaymentStatus)}
                    >
                      <SelectTrigger id="order-payment" className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentOptions.map((status) => (
                          <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-sm text-muted-foreground">Customer paid</span>
                    <span className="text-sm font-mono text-foreground">{currency(detailOrder.total)}</span>
                  </div>
                  {(detailOrder.serviceFee ?? 0) > 0 ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Service fee</span>
                      <span className="text-sm font-mono text-muted-foreground">{currency(detailOrder.serviceFee ?? 0)}</span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">You receive (MoMo)</span>
                    <span className="text-sm font-bold font-mono text-foreground">{currency(merchantPayoutOf(detailOrder))}</span>
                  </div>
                </div>

                <SplitBillPanel
                  businessId={business.id}
                  orderId={detailOrder.id}
                  orderTotal={detailOrder.total}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </section>
  )
}

function ReportsPage({ business, orders }: { business: Business; orders: Order[] }) {
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'all'>('week')
  const [selectedStatus, setSelectedStatus] = useState<'Pending' | 'Preparing' | 'Ready' | 'Completed' | 'Cancelled'>('Pending')

  const reportData = useMemo(() => buildReportData(orders, timeRange), [orders, timeRange])

  const totalOrders = reportData.totalOrders
  const totalRevenue = reportData.totalRevenue
  const totalCogs = reportData.totalCogs
  const grossProfit = reportData.grossProfit
  const marginPercent = reportData.marginPercent
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
  const completedOrders = reportData.completedOrders
  const completionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0
  const itemSales = reportData.itemSales
  const itemsPagination = usePagination(itemSales, {
    initialPageSize: 20,
    resetKey: timeRange,
  })
  const { pageItems: pagedItemSales } = itemsPagination
  const paymentBreakdown = reportData.paymentBreakdown
  const statusBreakdown = reportData.statusBreakdown
  const ordersByStatus = reportData.ordersByStatus
  const statusOrders = ordersByStatus[selectedStatus] ?? []
  const statusOrdersPagination = usePagination(statusOrders, {
    initialPageSize: 20,
    resetKey: `${timeRange}|${selectedStatus}`,
  })
  const paymentTotal = paymentBreakdown.Paid + paymentBreakdown.Unpaid + paymentBreakdown.Refunded

  return (
    <section className="reports-page">
      <div className="reports-filters">
        <div className="range-tabs" aria-label="Time range">
          {([
            ['today', 'Today'],
            ['week', 'Last 7 days'],
            ['month', 'This month'],
            ['all', 'All time'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              className={timeRange === value ? 'active' : ''}
              type="button"
              onClick={() => setTimeRange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <section className="metric-grid" aria-label="Sales metrics">
        <div>
          <span>TOTAL REVENUE</span>
          <strong style={{ color: '#10b981' }}>{currency(totalRevenue)}</strong>
          <span style={{ color: '#667085', fontWeight: 400 }}>Paid orders · {business.name}</span>
          <Sparkline data={reportData.revenueTrend} color="#10b981" />
        </div>
        <div>
          <span>COGS</span>
          <strong style={{ color: '#b45309' }}>{currency(totalCogs)}</strong>
          <span style={{ color: '#667085', fontWeight: 400 }}>Recipe cost on paid sales</span>
          <Sparkline data={reportData.cogsTrend} color="#b45309" />
        </div>
        <div>
          <span>GROSS PROFIT</span>
          <strong style={{ color: grossProfit >= 0 ? '#059669' : '#b91c1c' }}>{currency(grossProfit)}</strong>
          <span style={{ color: '#667085', fontWeight: 400 }}>Margin {marginPercent.toFixed(1)}%</span>
          <Sparkline data={reportData.profitTrend} color="#059669" />
        </div>
        <div>
          <span>TOTAL ORDERS</span>
          <strong>{totalOrders}</strong>
          <span style={{ color: '#667085', fontWeight: 400 }}>All statuses</span>
          <Sparkline data={reportData.ordersTrend} color="#3b82f6" />
        </div>
        <div>
          <span>AVG ORDER VALUE</span>
          <strong>{currency(averageOrderValue)}</strong>
          <span style={{ color: '#667085', fontWeight: 400 }}>Per order</span>
          <Sparkline data={reportData.avgOrderTrend} color="#f59e0b" />
        </div>
        <div>
          <span>COMPLETION RATE</span>
          <strong>{completionRate.toFixed(1)}%</strong>
          <span style={{ color: '#667085', fontWeight: 400 }}>{completedOrders} completed</span>
          <Sparkline data={reportData.completionTrend} color="#8b5cf6" />
        </div>
      </section>

      <div className="reports-grid">
        <div className="report-card">
          <div className="report-card-head">
            <h3>Top Selling Items</h3>
            <span>{itemSales.length} items</span>
          </div>
          <div className="report-card-body">
            {itemSales.length > 0 ? (
              <>
                <div className="report-list">
                  {pagedItemSales.map((item, index) => (
                    <div key={item.name} className="report-list-item">
                      <div className="report-list-rank">
                        {itemsPagination.firstItem + index}
                      </div>
                      <div className="report-list-details">
                        <strong>{item.name}</strong>
                        <span>
                          {item.quantity} sold · cost {currency(item.cogs)} · profit {currency(item.profit)}
                        </span>
                      </div>
                      <strong className="report-list-value">{currency(item.revenue)}</strong>
                    </div>
                  ))}
                </div>
                <PaginationBar
                  pagination={itemsPagination}
                  className="report-list-pagination"
                />
              </>
            ) : (
              <p className="report-empty">No sales data available for this period.</p>
            )}
          </div>
        </div>

        <div className="report-card">
          <div className="report-card-head">
            <h3>Payment Status</h3>
            <span>{currency(paymentTotal)}</span>
          </div>
          <div className="report-card-body">
            <div className="report-breakdown">
              {(['Paid', 'Unpaid', 'Refunded'] as const).map((status) => (
                paymentBreakdown[status] > 0 || status !== 'Refunded' ? (
                  <div className="report-breakdown-item" key={status}>
                    <div className="report-breakdown-bar">
                      <div
                        className={'report-breakdown-fill ' + status.toLowerCase()}
                        style={{ width: (paymentTotal > 0 ? (paymentBreakdown[status] / paymentTotal) * 100 : 0) + '%' }}
                      />
                    </div>
                    <div className="report-breakdown-details">
                      <span>{status}</span>
                      <strong>{currency(paymentBreakdown[status])}</strong>
                    </div>
                  </div>
                ) : null
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="report-card">
        <div className="report-card-head">
          <h3>Orders by Status</h3>
          <span>{totalOrders} orders</span>
        </div>
        <div className="report-card-body">
          <div className="report-status-tabs">
            {(Object.keys(statusBreakdown) as Array<keyof typeof statusBreakdown>).map((status) => (
              <button
                key={status}
                type="button"
                className={selectedStatus === status ? 'active' : ''}
                onClick={() => setSelectedStatus(status)}
              >
                <StatusBadge status={status} />
                <strong>{statusBreakdown[status]}</strong>
              </button>
            ))}
          </div>
          <div className="report-orders-list">
            {statusOrdersPagination.pageItems.length > 0 ? (
              <>
                {statusOrdersPagination.pageItems.map((order) => (
                  <div key={order.id} className="report-order-item">
                    <div className="report-order-inline">
                      <strong>{order.id}</strong>
                      <span className="report-order-customer">{order.customer}</span>
                      <div className="report-order-items">
                        {order.items.map((item, idx) => (
                          <span key={idx} className="report-order-chip">{item}</span>
                        ))}
                      </div>
                      <span className="report-order-total">{currency(order.total)}</span>
                    </div>
                  </div>
                ))}
                <PaginationBar
                  pagination={statusOrdersPagination}
                  className="report-list-pagination"
                />
              </>
            ) : (
              <p className="report-empty">No {selectedStatus.toLowerCase()} orders for this period.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}


export default App
