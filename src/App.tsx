import { type ChangeEvent, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BarChart3, Bell, Eye, Home, ImagePlus, LogOut, Moon, Package, Pencil, Plus, Search, ShoppingCart, Sun, Trash2 } from 'lucide-react'
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
import { LoadingSpinner } from './components/LoadingSpinner'
import CategoryField from './components/CategoryField'
import { PaginationBar } from './components/PaginationBar'
import { businessCategories } from './lib/catalogCategories'
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
import { useBusinessData } from './hooks/useBusinessData'
import { useCatalog } from './hooks/useCatalog'
import { useOrders } from './hooks/useOrders'
import { usePagination } from './hooks/usePagination'
import { useServerPagination } from './hooks/useServerPagination'
import type {
  Business as ApiBusiness,
  CatalogItem as ApiCatalogItem,
  Order as ApiOrder,
  OrderStatus,
  PaymentStatus,
} from './api/types'
import { scannyApi } from './api/services'
import { resizeImageFile } from './lib/resizeImage'
import { buildMetricSeries, buildReportData, dailySeries, type MetricRange } from './lib/orderAnalytics'
import { applyDarkMode, persistDarkMode, readDarkMode } from './lib/theme'
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
const SCAN_BASE_URL = import.meta.env.VITE_SCAN_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173')
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

function customerUrl(business: Business) {
  if (business.customerUrl) return business.customerUrl
  if (!business.id || !business.qrToken) return SCAN_BASE_URL
  return `${SCAN_BASE_URL}/b/${business.id}?qr=${business.qrToken}`
}

function App({
  onLogout,
  onBackToLanding: _onBackToLanding,
  kcUsername,
}: {
  onLogout?: () => void
  onBackToLanding?: () => void
  kcUsername?: string
}) {
  const {
    businesses,
    orders,
    merchant,
    loading: sessionLoading,
    error: sessionError,
    refreshBusiness,
    refreshBusinesses,
    loadOrders,
    setOrders,
    updateLocalItems,
  } = useBusinessData()

  const [view, setView] = useState('account')
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [darkMode, setDarkMode] = useState(() => readDarkMode())
  const [actionError, setActionError] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)

  const business = businesses[0] ?? emptyBusiness
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
            .reduce((sum, order) => sum + order.total, 0),
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

  // Realtime orders with polling fallback
  useEffect(() => {
    if (!business.id) return
    let client: { close: () => void } | null = null
    let cancelled = false

    async function start() {
      const { createRealtimeClient } = await import('./lib/realtime')
      const keycloak = (await import('./keycloak')).default
      if (cancelled) return
      client = createRealtimeClient({
        channels: [`orders:${business.id}`, `catalog:${business.id}`],
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
            void loadOrders(business.id)
          }
        },
      })
    }

    void start()
    return () => {
      cancelled = true
      client?.close()
    }
  }, [business.id, loadOrders])

  const businessOrders = orders.filter((order) => order.businessId === business.id)
  const pendingCount = businessOrders.filter(
    (order) => order.status !== 'Completed' && order.status !== 'Cancelled',
  ).length
  const paidTotal = businessOrders
    .filter((order) => order.paymentStatus === 'Paid')
    .reduce((sum, _order) => sum + _order.total, 0)
  const availableItems = (business.items ?? []).filter((item) => item.available).length

  async function handleCreateCatalogItem(data: {
    name: string
    category: string
    price: number
    description: string
    available: boolean
  }) {
    if (!business.id) return
    setActionError(null)
    try {
      await catalogHook.createItem(data)
      await refreshBusiness(business.id)
      setShowAddItem(false)
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
        available: data.available,
      })
      await refreshBusiness(business.id)
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
    if (onLogout) {
      onLogout()
    } else {
      window.location.reload()
    }
  }

  if (sessionLoading) {
    return (
      <main className="company-shell" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <LoadingSpinner label="Loading merchant portal…" />
      </main>
    )
  }

  if (!business.id) return null

  return (
    <main className="company-shell">
      <Toaster />
      <aside className="company-sidebar" aria-label="Company workspace navigation">
        <div className="sidebar-brand">
          <img
            src="/qrcode1.png"
            alt="Scanny"
            className="sidebar-brand-logo"
          />
          <div className="sidebar-brand-text">
            <strong>Scanny</strong>
            <span>Merchant Portal</span>
          </div>
        </div>

        <nav className="side-nav" aria-label="Workspace sections">
          {[
            { id: 'account', label: 'Overview', icon: Home },
            { id: 'catalog', label: 'Catalog', icon: Package },
            { id: 'dashboard', label: 'Orders', icon: ShoppingCart, count: pendingCount },
            { id: 'reports', label: 'Reports', icon: BarChart3 },
          ].map(({ id, label, icon: Icon, count }) => (
            <button
              type="button"
              className={view === id ? 'active' : ''}
              key={id}
              onClick={() => setView(id)}
            >
              <Icon size={20} />
              <span style={{ flex: 1 }}>{label}</span>
              {count ? (
                <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px]">
                  {count}
                </Badge>
              ) : null}
            </button>
          ))}
        </nav>

        <SidebarProfile
          business={business}
          businessName={merchant?.businessName || business.name || 'Business'}
          logoUrl={business.logoUrl ?? merchant?.businessLogoUrl}
          onLogoUpload={handleLogoUpload}
          logoUploading={logoUploading}
          onLogoutRequest={() => setShowLogoutDialog(true)}
        />

        <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Log out of Scanny?</AlertDialogTitle>
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
              {view === 'account' && 'Merchant · Overview'}
              {view === 'catalog' && 'Merchant · Catalog'}
              {view === 'dashboard' && 'Merchant · Orders'}
              {view === 'reports' && 'Merchant · Reports'}
            </p>
            <h2>
              {view === 'account' && `Welcome back, ${merchant?.businessName || business.ownerName || business.name || 'Merchant'}`}
              {view === 'catalog' && 'Catalog'}
              {view === 'dashboard' && 'Orders'}
              {view === 'reports' && 'Reports'}
            </h2>
            {(actionError || sessionError) && (
              <p className="scanny-error" role="alert" style={{ marginTop: 8 }}>{actionError || sessionError}</p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {view === 'account' && (
              <Button className="" size="sm" onClick={() => setShowAddItem(true)}>
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
            {/* Notifications */}
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Notifications"
              className="relative"
              onClick={() => setShowNotifications(true)}
            >
              <Bell className="size-3.5" />
              <span className="absolute top-1 right-1 size-1.5 rounded-full bg-destructive" />
            </Button>
          </div>
        </header>

        {view === 'account' && (
          <div className="page-content">
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

        {view === 'catalog' && (
          <div className="page-content">
            <CatalogPage
              business={business}
              onCreateItem={handleCreateCatalogItem}
              onUpdateItem={handleUpdateCatalogItem}
              onDeleteItem={handleDeleteCatalogItem}
              onAddCategory={handleAddCategory}
              onAddItem={() => setShowAddItem(true)}
              Sparkline={Sparkline}
            />
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

        {view === 'reports' && (
          <div className="page-content">
            <ReportsPage business={business} orders={businessOrders} />
          </div>
        )}

        {/* Add item — Sheet drawer (accessible from overview & catalog) */}
        <Sheet open={showAddItem} onOpenChange={setShowAddItem}>
          <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
            <SheetHeader className="border-b border-border px-6 py-4">
              <SheetTitle className="">Add item</SheetTitle>
              <SheetDescription className="">Add a new item to {business.name || 'your catalog'}.</SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto">
              <AddItemForm
                business={business}
                onCreateItem={handleCreateCatalogItem}
                onAddCategory={handleAddCategory}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Notifications drawer */}
        <Sheet open={showNotifications} onOpenChange={setShowNotifications}>
          <SheetContent side="right" className="w-full sm:max-w-sm flex flex-col gap-0 p-0">
            <SheetHeader className="border-b border-border px-6 py-4">
              <SheetTitle className="">Notifications</SheetTitle>
              <SheetDescription className="">Recent activity for {business.name || 'your business'}</SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto">
              <NotificationsPanel businessName={business.name} orders={businessOrders} />
            </div>
          </SheetContent>
        </Sheet>
      </section>
    </main>
  )
}
function NotificationsPanel({ businessName, orders }: { businessName: string; orders: Order[] }) {
  const recentOrders = [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5)
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
        {recentOrders.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>No orders yet for {businessName || 'your business'}.</p>
          </div>
        ) : (
          recentOrders.map((order) => (
            <div key={order.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: order.status === 'Pending' ? 'oklch(0.96 0.04 75)' : order.status === 'Completed' ? 'oklch(0.94 0.04 145)' : 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
                {order.status === 'Pending' ? '🕐' : order.status === 'Completed' ? '✅' : order.status === 'Preparing' ? '👨‍🍳' : order.status === 'Ready' ? '🛎' : '❌'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>{order.id} · {order.customer.name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted-foreground)' }}>
                  {order.status} · {order.paymentStatus} · {currency(order.total)}
                </p>
              </div>
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)', flexShrink: 0 }}>
                {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function SidebarProfile({
  business,
  businessName,
  logoUrl,
  onLogoUpload,
  logoUploading,
  onLogoutRequest,
}: {
  business: Business
  businessName: string
  logoUrl?: string | null
  onLogoUpload: (dataUrl: string) => Promise<void>
  logoUploading?: boolean
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

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setUploadError('Please choose an image file (PNG, JPG, or WebP).')
      return
    }
    if (file.size > 512 * 1024) {
      setUploadError('Image must be 512KB or smaller.')
      return
    }
    setUploadError(null)

    try {
      const dataUrl = await resizeImageFile(file)
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
        disabled={logoUploading}
        onClick={() => inputRef.current?.click()}
      >
        {logoUrl ? (
          <img src={logoUrl} alt="" className="sidebar-profile-avatar-img" />
        ) : (
          initials
        )}
        <span className="sidebar-profile-avatar-badge" aria-hidden="true">
          <ImagePlus size={10} />
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        onChange={handleFileChange}
        disabled={logoUploading}
      />
      <div className="sidebar-profile-info">
        <strong>{businessName}</strong>
        {uploadError ? <span className="sidebar-profile-error">{uploadError}</span> : null}
      </div>
      <button
        type="button"
        className="sidebar-profile-logout"
        title="Log out"
        onClick={onLogoutRequest}
      >
        <LogOut size={16} />
      </button>
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
      <MetricsCard business={business} orders={orders} />

      <section className="account-summary">
        <QrPanel business={business} />

        <div className="link-map">
          <h3>At a glance</h3>
          <div>
            <span>Customer menu</span>
            <strong>Open by scanning your QR code</strong>
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

function MetricsCard({
  business,
  orders,
}: {
  business: Business
  orders: Order[]
}) {
  const RANGE_META: { key: MetricRange; label: string; span: string }[] = [
    { key: 'day', label: 'Daily', span: 'today by hour' },
    { key: 'week', label: 'Weekly', span: 'last 7 days' },
    { key: 'month', label: 'Monthly', span: 'last 5 weeks' },
    { key: 'year', label: 'Yearly', span: 'last 12 months' },
  ]

  const VW = 600
  const VH = 220
  const PL = 40
  const PR = 10
  const PT = 16
  const PB = 28
  const CW = VW - PL - PR
  const CH = VH - PT - PB

  const tx = (i: number, n: number) => PL + (i / Math.max(n - 1, 1)) * CW
  const ty = (v: number, max: number) => PT + CH - (v / Math.max(max, 1)) * CH

  function smooth(pts: [number, number][]) {
    if (pts.length < 2) return ''
    let d = `M${pts[0][0]},${pts[0][1]}`
    for (let i = 1; i < pts.length; i++) {
      const mx = (pts[i - 1][0] + pts[i][0]) / 2
      d += ` C${mx},${pts[i - 1][1]} ${mx},${pts[i][1]} ${pts[i][0]},${pts[i][1]}`
    }
    return d
  }

  function areaPath(pts: [number, number][]) {
    const last = pts[pts.length - 1]
    const first = pts[0]
    return `${smooth(pts)} L${last[0]},${VH - PB} L${first[0]},${VH - PB} Z`
  }

  function fmt(v: number) {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`
    return String(v)
  }

  const metricData = useMemo(
    () => ({
      day: buildMetricSeries(orders, 'day'),
      week: buildMetricSeries(orders, 'week'),
      month: buildMetricSeries(orders, 'month'),
      year: buildMetricSeries(orders, 'year'),
    }),
    [orders],
  )
  const [range, setRange] = useState<MetricRange>('week')
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  const data = metricData[range]
  const n = data.points.length
  const yMax = data.yMax

  const orderPts = data.points.map((p, i): [number, number] => [tx(i, n), ty(p.orders, yMax)])
  const paidPts = data.points.map((p, i): [number, number] => [tx(i, n), ty(p.paidCount, yMax)])
  const orderLine = smooth(orderPts)
  const orderArea = areaPath(orderPts)
  const paidLine = smooth(paidPts)
  const paidArea = areaPath(paidPts)
  const yTicks = [0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f))
  const xStep = n <= 7 ? 1 : n <= 16 ? 2 : Math.ceil(n / 7)
  const rangeSpan = RANGE_META.find((r) => r.key === range)?.span ?? ''

  const indexFromClientX = useCallback(
    (clientX: number) => {
      const el = chartRef.current
      if (!el || n < 1) return null
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0) return null
      const svgX = ((clientX - rect.left) / rect.width) * VW
      const plotX = Math.min(Math.max(svgX, PL), VW - PR)
      const t = (plotX - PL) / Math.max(CW, 1)
      return Math.min(n - 1, Math.max(0, Math.round(t * (n - 1))))
    },
    [n],
  )

  const onChartPointer = useCallback(
    (e: ReactPointerEvent) => {
      const idx = indexFromClientX(e.clientX)
      if (idx !== null) setActiveIndex(idx)
    },
    [indexFromClientX],
  )

  const clearActive = useCallback(() => setActiveIndex(null), [])

  const active =
    activeIndex !== null && activeIndex >= 0 && activeIndex < n
      ? {
          i: activeIndex,
          label: data.points[activeIndex]?.label ?? '—',
          orders: data.points[activeIndex]?.orders ?? 0,
          paidCount: data.points[activeIndex]?.paidCount ?? 0,
          paid: data.points[activeIndex]?.paid ?? 0,
          x: orderPts[activeIndex]?.[0] ?? PL,
          orderY: orderPts[activeIndex]?.[1] ?? PT,
          paidY: paidPts[activeIndex]?.[1] ?? PT,
        }
      : null

  const conversion =
    active && active.orders > 0
      ? Math.round((active.paidCount / active.orders) * 1000) / 10
      : active
        ? 0
        : null

  const tooltipLeftPct = active ? (active.x / VW) * 100 : 0
  const tooltipSide = tooltipLeftPct > 62 ? 'right' : 'left'

  return (
    <section
      aria-label={`${business.name} activity metrics`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        minHeight: 360,
        background: 'var(--card)',
        borderRadius: 10,
        overflow: 'hidden',
        border: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          padding: '12px 16px 0',
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--muted-foreground)',
            }}
          >
            Platform Activity
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
            Active Scans &amp; Orders
          </p>
        </div>

        <div style={{ display: 'flex', gap: 2, background: 'var(--muted)', borderRadius: 8, padding: 3 }}>
          {RANGE_META.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => {
                setRange(r.key)
                setActiveIndex(null)
              }}
              style={{
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: range === r.key ? 600 : 400,
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                background: range === r.key ? 'var(--card)' : 'transparent',
                color: range === r.key ? 'var(--primary)' : 'var(--muted-foreground)',
                transition: 'all 0.15s',
                boxShadow: range === r.key ? '0 1px 3px oklch(0 0 0 / 12%)' : 'none',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '8px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 20, height: 2, borderRadius: 2, background: '#5ac8fa', display: 'inline-block' }} />
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Orders</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#5ac8fa', marginLeft: 2 }}>
            {fmt(data.ordersTotalRaw)}
          </span>
          <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>· {rangeSpan}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 20, height: 2, borderRadius: 2, background: '#f07848', display: 'inline-block' }} />
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Paid</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#f07848', marginLeft: 2 }}>
            {fmt(data.paidCountTotal)}
          </span>
          <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>· {currency(data.paidRevenueTotal)}</span>
        </div>
      </div>

      <div
        ref={chartRef}
        style={{
          flex: 1,
          minHeight: 0,
          padding: '4px 0 0',
          position: 'relative',
          touchAction: 'none',
          cursor: 'crosshair',
        }}
        onPointerMove={onChartPointer}
        onPointerDown={onChartPointer}
        onPointerLeave={clearActive}
        role="img"
        aria-label="Orders and paid activity over time. Hover or tap a point to see details."
      >
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="mh-m-fill-order" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5ac8fa" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#5ac8fa" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="mh-m-fill-paid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f07848" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#f07848" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {yTicks.map((v) => {
            const y = ty(v, yMax)
            return (
              <g key={v}>
                <line
                  x1={PL}
                  y1={y}
                  x2={VW - PR}
                  y2={y}
                  stroke="var(--border)"
                  strokeWidth="1"
                  strokeDasharray="4 5"
                />
                <text
                  x={PL - 5}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize="8"
                  fill="var(--muted-foreground)"
                  fontFamily="'Outfit Variable', ui-sans-serif, sans-serif"
                >
                  {fmt(v)}
                </text>
              </g>
            )
          })}

          {data.xLabels.map((label, i) => {
            if (i % xStep !== 0 && i !== data.xLabels.length - 1) return null
            return (
              <text
                key={`${label}-${i}`}
                x={tx(i, n)}
                y={VH - 6}
                textAnchor="middle"
                fontSize="8"
                fill="var(--muted-foreground)"
                fontFamily="'Outfit Variable', ui-sans-serif, sans-serif"
              >
                {label}
              </text>
            )
          })}

          <path d={orderArea} fill="url(#mh-m-fill-order)" />
          <path d={paidArea} fill="url(#mh-m-fill-paid)" />
          <path d={orderLine} fill="none" stroke="#5ac8fa" strokeWidth="2" strokeLinejoin="round" />
          <path d={paidLine} fill="none" stroke="#f07848" strokeWidth="1.8" strokeLinejoin="round" />

          {active && (
            <g pointerEvents="none">
              <line
                x1={active.x}
                y1={PT}
                x2={active.x}
                y2={VH - PB}
                stroke="var(--foreground)"
                strokeOpacity="0.18"
                strokeWidth="1"
                strokeDasharray="3 4"
              />
              <circle cx={active.x} cy={active.orderY} r="6" fill="#5ac8fa" opacity="0.18" />
              <circle cx={active.x} cy={active.orderY} r="3.4" fill="#5ac8fa" stroke="#e8f8ff" strokeWidth="1.2" />
              <circle cx={active.x} cy={active.paidY} r="5.5" fill="#f07848" opacity="0.18" />
              <circle cx={active.x} cy={active.paidY} r="3.1" fill="#f07848" stroke="#ffe0c8" strokeWidth="1.2" />
            </g>
          )}
        </svg>

        {active && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              ...(tooltipSide === 'left'
                ? { left: `calc(${tooltipLeftPct}% + 10px)` }
                : { right: `calc(${100 - tooltipLeftPct}% + 10px)` }),
              zIndex: 2,
              minWidth: 148,
              maxWidth: 210,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'color-mix(in oklch, var(--card) 92%, var(--foreground) 8%)',
              border: '1px solid var(--border)',
              boxShadow: '0 8px 24px oklch(0 0 0 / 14%)',
              pointerEvents: 'none',
              backdropFilter: 'blur(8px)',
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--muted-foreground)',
              }}
            >
              {RANGE_META.find((r) => r.key === range)?.label ?? 'Period'}
            </p>
            <p style={{ margin: '2px 0 8px', fontSize: 13, fontWeight: 650, color: 'var(--foreground)' }}>
              {active.label}
            </p>
            <div style={{ display: 'grid', gap: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted-foreground)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#5ac8fa' }} />
                  Orders
                </span>
                <span style={{ fontSize: 12, fontWeight: 650, color: '#5ac8fa', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(active.orders)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted-foreground)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f07848' }} />
                  Paid
                </span>
                <span style={{ fontSize: 12, fontWeight: 650, color: '#f07848', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(active.paidCount)}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  paddingTop: 5,
                  borderTop: '1px solid var(--border)',
                }}
              >
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Revenue</span>
                <span style={{ fontSize: 12, fontWeight: 650, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>
                  {currency(active.paid)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Paid rate</span>
                <span style={{ fontSize: 12, fontWeight: 650, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>
                  {conversion === null ? '—' : `${conversion}%`}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function QrPanel({ business, compact = false }: { business: Business; compact?: boolean }) {
  const [qrImage, setQrImage] = useState('')
  const url = customerUrl(business)

  useEffect(() => {
    let cancelled = false

    QRCode.toDataURL(url, {
      color: {
        dark: '#18211f',
        light: '#ffffff',
      },
      margin: 1,
      width: compact ? 110 : 220,
    }).then((image) => {
      if (!cancelled) setQrImage(image)
    })

    return () => {
      cancelled = true
    }
  }, [business.id, compact, url])

  return (
    <div className={compact ? 'qr-panel compact' : 'qr-panel large'} style={{ '--accent': business.accent } as QrStyle}>
      <div className="print-card">
        <div className="print-brand">Scanny</div>
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
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function AddItemForm({
  business,
  onCreateItem,
  onAddCategory,
}: {
  business: Business
  onCreateItem: (data: {
    name: string
    category: string
    price: number
    description: string
    available: boolean
  }) => Promise<void> | void
  onAddCategory: (name: string) => Promise<string[] | void>
}) {
  const emptyItem = {
    name: '',
    category: '',
    price: '',
    description: '',
    available: true,
  }
  const [item, setItem] = useState(emptyItem)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const categories = businessCategories(business)

  async function submitItem(event) {
    event.preventDefault()

    const name = item.name.trim()
    const category = item.category.trim()
    const price = Number(item.price)

    setSubmitted(true)

    if (!name || !category || !Number.isFinite(price) || price <= 0) return

    setSaving(true)
    try {
      await onCreateItem({
        name,
        category,
        price,
        description: item.description.trim() || 'No description added yet.',
        available: item.available,
      })
      setItem(emptyItem)
      setSubmitted(false)
    } finally {
      setSaving(false)
    }
  }

  const isItemNameMissing = submitted && !item.name.trim()
  const isCategoryMissing = submitted && !item.category.trim()
  const price = Number(item.price)
  const isPriceMissing = submitted && (!Number.isFinite(price) || price <= 0)

  return (
    <form className="flex flex-col gap-4 px-6 py-5" noValidate onSubmit={submitItem}>
      <div className="grid gap-1.5">
        <Label htmlFor="add-item-name">Item name</Label>
        <Input
          id="add-item-name"
          required
          aria-invalid={isItemNameMissing}
          className={isItemNameMissing ? 'border-destructive' : undefined}
          value={item.name}
          onChange={(event) => setItem({ ...item, name: event.target.value })}
          placeholder="Burger, cocktail, uniform..."
        />
        {isItemNameMissing && <span className="text-xs text-destructive">{REQUIRED_FIELD_MESSAGE}</span>}
      </div>

      <div className="grid gap-1.5">
        <CategoryField
          id="add-item-category"
          categories={categories}
          value={item.category}
          onChange={(category) => setItem({ ...item, category })}
          onAddCategory={onAddCategory}
          error={isCategoryMissing}
          disabled={saving}
        />
        {isCategoryMissing && <span className="text-xs text-destructive">{REQUIRED_FIELD_MESSAGE}</span>}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="add-item-price">Price (UGX)</Label>
        <Input
          id="add-item-price"
          required
          aria-invalid={isPriceMissing}
          className={isPriceMissing ? 'border-destructive' : undefined}
          min="1"
          type="number"
          value={item.price}
          onChange={(event) => setItem({ ...item, price: event.target.value })}
          placeholder="18000"
        />
        {isPriceMissing && <span className="text-xs text-destructive">{REQUIRED_FIELD_MESSAGE}</span>}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="add-item-description">Description</Label>
        <Textarea
          id="add-item-description"
          rows={3}
          value={item.description}
          onChange={(event) => setItem({ ...item, description: event.target.value })}
          placeholder="Size, flavor, seat type, pickup details..."
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="add-item-available"
          checked={item.available}
          type="checkbox"
          className="size-4 rounded border-border accent-primary"
          onChange={(event) => setItem({ ...item, available: event.target.checked })}
        />
        <Label htmlFor="add-item-available" className="cursor-pointer font-normal">
          Available to customers
        </Label>
      </div>

      <div className="border-t border-border pt-4">
        <Button className="w-full" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Add item'}
        </Button>
      </div>
    </form>
  )
}
function CatalogPage({
  business,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
  onAddCategory,
  onAddItem,
  Sparkline,
}: {
  business: Business
  onCreateItem: (data: {
    name: string
    category: string
    price: number
    description: string
    available: boolean
  }) => Promise<void> | void
  onUpdateItem: (itemId: string, data: Partial<CatalogItem>) => Promise<void> | void
  onDeleteItem: (itemId: string) => Promise<void> | void
  onAddCategory: (name: string) => Promise<string[] | void>
  onAddItem: () => void
  Sparkline: (props: { data: number[]; color?: string }) => ReactElement | null
}) {
  const categories = useMemo(() => businessCategories(business), [business])

  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<CatalogItem>>({})
  const [saving, setSaving] = useState(false)
  const [pageItems, setPageItems] = useState<CatalogItem[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const filterResetKey = `${search}|${filterCategory}|${filterStatus}`
  const pagination = useServerPagination({
    totalItems,
    initialPageSize: 20,
    resetKey: filterResetKey,
  })

  useEffect(() => {
    if (!business.id) return
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
    reloadToken,
    business.items.length,
  ])

  function startEdit(item: CatalogItem) {
    setEditingId(item.id)
    setEditDraft({ ...item })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft({})
  }

  async function saveEdit() {
    if (!editDraft.name?.trim() || !editDraft.category?.trim() || !editingId) return
    setSaving(true)
    try {
      await onUpdateItem(editingId, {
        ...editDraft,
        price: Number(editDraft.price) || 0,
      })
      cancelEdit()
      setReloadToken((n) => n + 1)
    } finally {
      setSaving(false)
    }
  }

  async function removeItem(itemId: string) {
    setSaving(true)
    try {
      await onDeleteItem(itemId)
      if (editingId === itemId) cancelEdit()
      setReloadToken((n) => n + 1)
    } finally {
      setSaving(false)
    }
  }

  function resetFilters() {
    setSearch('')
    setFilterCategory('all')
    setFilterStatus('all')
  }

  const isFiltered = search || filterCategory !== 'all' || filterStatus !== 'all'

  // silence unused until bulk-create UI needs it
  void onCreateItem

  return (
    <section className="catalog-page">
      <section className="metric-grid" aria-label="Catalog summary">
        <div>
          <span>Total items</span>
          <strong>{business.items.length}</strong>
          <Sparkline data={Array.from({ length: 7 }, () => business.items.length)} color="#3b82f6" />
        </div>
        <div>
          <span>Available</span>
          <strong>{business.items.filter(i => i.available).length}</strong>
          <Sparkline data={Array.from({ length: 7 }, () => business.items.filter(i => i.available).length)} color="#10b981" />
        </div>
        <div>
          <span>Hidden</span>
          <strong>{business.items.filter(i => !i.available).length}</strong>
          <Sparkline data={Array.from({ length: 7 }, () => business.items.filter(i => !i.available).length)} color="#f59e0b" />
        </div>
        <div>
          <span>Categories</span>
          <strong>{categories.length}</strong>
          <Sparkline data={Array.from({ length: 7 }, () => categories.length)} color="#8b5cf6" />
        </div>
      </section>

      {/* Table card */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search items…"
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
            {totalItems} of {business.items.length} items
          </span>
          {isFiltered && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 text-xs">
              Clear filters
            </Button>
          )}
          <Button size="sm" className="h-8" onClick={onAddItem}>
            <Plus className="size-3.5" />
            Add item
          </Button>
        </div>

        {/* Table */}
        <Table className={undefined}>
          <TableHeader className={undefined}>
            <TableRow className="hover:bg-transparent border-b border-border">
              <TableHead className="pl-5 text-[10px] font-medium tracking-widest text-muted-foreground uppercase w-[40%]">Name</TableHead>
              <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Category</TableHead>
              <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Price</TableHead>
              <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Status</TableHead>
              <TableHead className="pr-5 text-right text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="">
            {listLoading ? (
              <TableRow className="">
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  Loading catalog…
                </TableCell>
              </TableRow>
            ) : listError ? (
              <TableRow className="">
                <TableCell colSpan={5} className="py-10 text-center text-sm text-destructive">
                  {listError}
                </TableCell>
              </TableRow>
            ) : pageItems.length === 0 ? (
              <TableRow className="">
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No items match your search.{' '}
                  <button type="button" className="text-primary underline" onClick={resetFilters}>Clear filters</button>
                </TableCell>
              </TableRow>
            ) : (
              pageItems.map((entry) => (
                <TableRow key={entry.id} className="border-b border-border hover:bg-muted/40 cursor-default">
                  <TableCell className="pl-5 py-3">
                    <p className="text-sm font-medium text-foreground">{entry.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{entry.description}</p>
                  </TableCell>
                  <TableCell className="text-sm text-foreground">{entry.category}</TableCell>
                  <TableCell className="text-sm font-medium text-foreground font-mono">{currency(entry.price)}</TableCell>
                  <TableCell className={undefined}>
                    <Badge variant="secondary" className={entry.available
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-muted text-muted-foreground'
                    }>
                      {entry.available ? 'Available' : 'Hidden'}
                    </Badge>
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => startEdit(entry)}>
                      <Pencil className="size-3" />
                      Edit
                    </Button>
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

      {/* Edit item — Sheet drawer */}
      <Sheet open={!!editingId} onOpenChange={(open) => { if (!open) cancelEdit() }}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="border-b border-border px-6 py-4">
            <SheetTitle className={undefined}>Edit item</SheetTitle>
            <SheetDescription className={undefined}>{editDraft.name || 'Catalog item'}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="flex flex-col gap-4">
              <div className="grid gap-1.5">
                <Label className="" htmlFor="edit-name">Name</Label>
                <Input className="" id="edit-name" value={editDraft.name ?? ''} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} type={undefined} />
              </div>
              <div className="grid gap-1.5">
                <CategoryField
                  id="edit-category"
                  categories={categories}
                  value={editDraft.category ?? ''}
                  onChange={(category) => setEditDraft({ ...editDraft, category })}
                  onAddCategory={onAddCategory}
                  disabled={saving}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="" htmlFor="edit-price">Price (UGX)</Label>
                <Input className="" id="edit-price" type="number" min="0" value={editDraft.price ?? ''} onChange={(e) => setEditDraft({ ...editDraft, price: e.target.value as unknown as number })} />
              </div>
              <div className="grid gap-1.5">
                <Label className="" htmlFor="edit-description">Description</Label>
                <Textarea className="" id="edit-description" rows={3} value={editDraft.description ?? ''} onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <input id="edit-available" type="checkbox" checked={editDraft.available ?? true} onChange={(e) => setEditDraft({ ...editDraft, available: e.target.checked })} className="size-4 rounded border-border accent-primary" />
                <Label htmlFor="edit-available" className="cursor-pointer font-normal">Available to customers</Label>
              </div>
            </div>
          </div>
          <div className="border-t border-border px-6 py-4 flex items-center gap-2">
            <Button className="flex-1" onClick={saveEdit} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
            <Button className="" variant="outline" onClick={cancelEdit} disabled={saving}>Cancel</Button>
            <Button className="" variant="destructive" size="icon" onClick={() => removeItem(editingId!)} title="Delete item" disabled={saving}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  )
}

function OrderActionMenu({ onViewDetails }: { onViewDetails: () => void }) {
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
    initialPageSize: 5,
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
                <TableCell className="text-sm font-medium font-mono text-foreground">{currency(order.total)}</TableCell>
                <TableCell className={undefined}><StatusBadge status={order.status} /></TableCell>
                <TableCell className={undefined}><PaymentBadge status={order.paymentStatus} /></TableCell>
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
                    {detailOrder.items.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3">
                        <span className="text-sm text-foreground">{item.quantity} × {item.name}</span>
                        <span className="text-sm font-medium font-mono text-foreground">{currency(item.lineTotal)}</span>
                      </li>
                    ))}
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
                    <span className="text-sm font-semibold text-foreground">Total</span>
                    <span className="text-sm font-bold font-mono text-foreground">{currency(detailOrder.total)}</span>
                  </div>
                </div>
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
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
  const completedOrders = reportData.completedOrders
  const completionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0
  const itemSales = reportData.itemSales
  const itemsPagination = usePagination(itemSales, {
    initialPageSize: 5,
    resetKey: timeRange,
  })
  const { pageItems: pagedItemSales } = itemsPagination
  const paymentBreakdown = reportData.paymentBreakdown
  const statusBreakdown = reportData.statusBreakdown
  const ordersByStatus = reportData.ordersByStatus
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
                        <span>{item.quantity} sold</span>
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
            {ordersByStatus[selectedStatus].length > 0 ? (
              ordersByStatus[selectedStatus].map((order) => (
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
              ))
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
