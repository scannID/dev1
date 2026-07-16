import { type CSSProperties, type FormEvent, type PointerEvent, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BarChart3, Bell, Eye, Home, LogOut, Moon, Package, Pencil, Plus, Search, ShoppingCart, Sun, Trash2 } from 'lucide-react'
import QRCode from 'qrcode'
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
import type {
  Business as ApiBusiness,
  CatalogItem as ApiCatalogItem,
  Order as ApiOrder,
  OrderStatus,
  PaymentStatus,
} from './api/types'
import './App.css'

const ORDERS_KEY = 'scanny-orders-v1'
const BUSINESSES_KEY = 'scanny-businesses-v2'

// Sparkline component with area fill - moved outside render to fix React hooks error
function Sparkline({ data, color = '#10b981' }: { data: number[]; color?: string }) {
  if (data.length === 0) return null
  
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100
    const y = 100 - ((value - min) / range) * 80 - 10
    return { x, y }
  })
  
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ')
  const areaPath = `${linePath} L 100,100 L 0,100 Z`
  
  // Generate gradient ID based on color
  const gradientId = `gradient-${color.replace('#', '')}`
  
  return (
    <svg className="sparkline-chart" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.5" />
          <stop offset="100%" stopColor={color} stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path
        d={areaPath}
        fill={`url(#${gradientId})`}
      />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
const SCAN_BASE_URL = import.meta.env.VITE_SCAN_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173')
const REQUIRED_FIELD_MESSAGE = 'Please fill out this field.'

type BusinessType = 'Restaurant' | 'Bar' | 'School' | 'Boutique'
type CatalogItem = ApiCatalogItem
type Business = ApiBusiness
type Order = ApiOrder
type CartLine = CatalogItem & {
  quantity: number
  lineTotal: number
}
type Customer = Order['customer']

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
  onBackToLanding,
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
    refreshBusinesses,
    refreshBusiness,
    loadOrders,
    setOrders,
    updateLocalItems,
  } = useBusinessData()

  const [view, setView] = useState('account')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [customer, setCustomer] = useState<Customer>({
    name: '',
    phone: '',
    location: '',
    note: '',
  })
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('scanny-dark-mode')
    return saved ? JSON.parse(saved) : false
  })
  const [actionError, setActionError] = useState<string | null>(null)

  const business = businesses[0] ?? emptyBusiness
  const catalogHook = useCatalog(business.id)
  const ordersHook = useOrders(business.id)

  // Toggle dark mode with 'D' key
  useEffect(() => {
    function handleKeyPress(e: KeyboardEvent) {
      if (e.key === 'd' || e.key === 'D') {
        // Don't toggle if user is typing in an input field
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return
        }
        setDarkMode((prev: boolean) => {
          const newMode = !prev
          localStorage.setItem('scanny-dark-mode', JSON.stringify(newMode))
          return newMode
        })
      }
    }
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])

  // Apply dark mode class to body
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark-mode')
    } else {
      document.documentElement.classList.remove('dark-mode')
    }
  }, [darkMode])

  // Poll orders while on dashboard
  useEffect(() => {
    if (!business.id || view !== 'dashboard') return
    const id = window.setInterval(() => {
      loadOrders(business.id)
    }, 15000)
    return () => window.clearInterval(id)
  }, [business.id, view, loadOrders])

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const categories = [...new Set((business.items ?? []).map((item) => item.category))]

  const cartLines = useMemo<CartLine[]>(() => {
    return Object.entries(cart)
      .map(([itemId, quantity]) => {
        const item = (business.items ?? []).find((entry) => entry.id === itemId)
        return item ? { ...item, quantity, lineTotal: item.price * quantity } : null
      })
      .filter((item): item is CartLine => Boolean(item))
  }, [business.items, cart])

  const total = cartLines.reduce((sum, item) => sum + item.lineTotal, 0)
  const businessOrders = orders.filter((order) => order.businessId === business.id)
  const pendingCount = businessOrders.filter(
    (order) => order.status !== 'Completed' && order.status !== 'Cancelled',
  ).length
  const paidTotal = businessOrders
    .filter((order) => order.paymentStatus === 'Paid')
    .reduce((sum, _order) => sum + _order.total, 0)
  const availableItems = (business.items ?? []).filter((item) => item.available).length
  const hasNetworkIssue = Boolean(
    sessionError && /failed to fetch|network error|http 0/i.test(sessionError),
  )

  useEffect(() => {
    if (!business.id || !hasNetworkIssue || !onBackToLanding) return
    const timeoutId = window.setTimeout(() => {
      onBackToLanding()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [business.id, hasNetworkIssue, onBackToLanding])

  async function handleCreateCatalogItem(data: {
    name: string
    category: string
    price: number
    description: string
    available: boolean
  }) {
    if (!business.id) return
    setActionError(null)
    const item = await catalogHook.createItem(data)
    if (!item) {
      setActionError(catalogHook.error || 'Failed to create item')
      return
    }
    await refreshBusiness(business.id)
    setShowAddItem(false)
  }

  async function handleUpdateCatalogItem(itemId: string, data: Partial<CatalogItem>) {
    if (!business.id) return
    setActionError(null)
    const item = await catalogHook.updateItem(itemId, {
      name: data.name,
      category: data.category,
      price: data.price,
      description: data.description,
      available: data.available,
    })
    if (!item) {
      setActionError(catalogHook.error || 'Failed to update item')
      return
    }
    await refreshBusiness(business.id)
  }

  async function handleDeleteCatalogItem(itemId: string) {
    if (!business.id) return
    setActionError(null)
    const ok = await catalogHook.deleteItem(itemId)
    if (!ok) {
      setActionError(catalogHook.error || 'Failed to delete item')
      return
    }
    updateLocalItems(
      business.id,
      (business.items ?? []).filter((entry) => entry.id !== itemId),
    )
  }

  function addToCart(item) {
    if (!item.available) return
    setCart((current) => ({ ...current, [item.id]: (current[item.id] ?? 0) + 1 }))
  }

  function updateQuantity(itemId, quantity) {
    setCart((current) => {
      const next = { ...current }
      if (quantity <= 0) {
        delete next[itemId]
      } else {
        next[itemId] = quantity
      }
      return next
    })
  }

  async function submitOrder(event) {
    event.preventDefault()
    if (!cartLines.length || !customer.name.trim() || !business.id) return

    setActionError(null)
    const created = await ordersHook.createOrder({
      customer: {
        name: customer.name.trim(),
        phone: customer.phone.trim(),
        location: customer.location.trim(),
        note: customer.note.trim(),
      },
      items: cartLines.map(({ id, quantity }) => ({ id, quantity })),
    })

    if (!created) {
      setActionError(ordersHook.error || 'Failed to place order')
      return
    }

    setOrders((current) => [created, ...current])
    setCart({})
    setCustomer({ name: '', phone: '', location: '', note: '' })
    setView('dashboard')
  }

  async function updateStatus(orderId: string, status: OrderStatus) {
    setActionError(null)
    const updated = await ordersHook.updateStatus(orderId, status)
    if (!updated) {
      setActionError(ordersHook.error || 'Failed to update status')
      return
    }
    setOrders((current) =>
      current.map((order) => (order.id === orderId ? updated : order)),
    )
  }

  async function updatePayment(orderId: string, paymentStatus: PaymentStatus) {
    setActionError(null)
    const updated = await ordersHook.updatePayment(orderId, paymentStatus)
    if (!updated) {
      setActionError(ordersHook.error || 'Failed to update payment')
      return
    }
    setOrders((current) =>
      current.map((order) => (order.id === orderId ? updated : order)),
    )
  }

  async function clearCompleted() {
    if (!business.id) return
    setActionError(null)
    const result = await ordersHook.clearCompleted()
    if (!result) {
      setActionError(ordersHook.error || 'Failed to clear completed orders')
      return
    }
    setOrders((current) =>
      current.filter(
        (order) =>
          order.businessId !== business.id ||
          (order.status !== 'Completed' && order.status !== 'Cancelled'),
      ),
    )
  }

  function handleLogout() {
    // Delegate to parent — parent clears storage and ends Keycloak session
    if (onLogout) {
      onLogout()
    } else {
      localStorage.removeItem(ORDERS_KEY)
      localStorage.removeItem(BUSINESSES_KEY)
      window.location.reload()
    }
  }

  function handleBackToLanding() {
    if (onBackToLanding) {
      onBackToLanding()
      return
    }
    handleLogout()
  }

  if (sessionLoading) {
    return (
      <main className="company-shell" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <p>Loading merchant portal…</p>
      </main>
    )
  }

  if (!business.id) {
    if (hasNetworkIssue) {
      return null
    }

    return (
      <main className="company-shell" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', gap: '1rem' }}>
        <p>{sessionError || 'No business linked to this merchant yet.'}</p>
        <button className="primary-action" type="button" onClick={() => refreshBusinesses()}>
          Retry
        </button>
        {hasNetworkIssue && (
          <button type="button" onClick={handleBackToLanding}>
            Back to landing
          </button>
        )}
        <button type="button" onClick={handleLogout}>Log out</button>
      </main>
    )
  }

  return (
    <main className="company-shell">
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
          kcUsername={kcUsername || ''}
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
              <p style={{ color: 'crimson', marginTop: 8, fontSize: 14 }}>{actionError || sessionError}</p>
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
                  localStorage.setItem('scanny-dark-mode', JSON.stringify(newMode))
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
                <Sparkline data={[3, 5, 4, 6, 5, 7, pendingCount]} color="#3b82f6" />
              </div>
              <div>
                <span>Published items</span>
                <strong>{availableItems}</strong>
                <Sparkline data={[12, 15, 14, 16, 18, 19, availableItems]} color="#8b5cf6" />
              </div>
              <div>
                <span>Paid sales</span>
                <strong>{currency(paidTotal)}</strong>
                <Sparkline data={[paidTotal * 0.6, paidTotal * 0.7, paidTotal * 0.75, paidTotal * 0.8, paidTotal * 0.85, paidTotal * 0.92, paidTotal]} color="#10b981" />
              </div>
            </section>
            <OverviewPage business={business} darkMode={darkMode} />
          </div>
        )}

        {view === 'catalog' && (
          <div className="page-content">
            <CatalogPage
              business={business}
              onCreateItem={handleCreateCatalogItem}
              onUpdateItem={handleUpdateCatalogItem}
              onDeleteItem={handleDeleteCatalogItem}
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
  kcUsername,
  onLogoutRequest,
}: {
  business: Business
  kcUsername: string
  onLogoutRequest: () => void
}) {
  const displayName = kcUsername || business.ownerName || business.name || 'Merchant'
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="sidebar-profile">
      <div className="sidebar-profile-avatar" style={{ background: business.accent }}>
        {initials}
      </div>
      <div className="sidebar-profile-info">
        <strong>{displayName}</strong>
        <span>{business.name || 'Business'}</span>
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

function OverviewPage({ business, darkMode }: { business: Business; darkMode: boolean }) {
  return (
    <div className="account-layout">
      <MetricsCard business={business} darkMode={darkMode} />

      <section className="account-summary">
        <QrPanel business={business} />

        <div className="link-map">
          <h3>What customers access</h3>
          <div>
            <span>Customer menu</span>
            <strong>{customerUrl(business)}</strong>
          </div>
          <div>
            <span>Orders</span>
            <strong>{business.merchantId}</strong>
          </div>
          <div>
            <span>Goods and prices</span>
            <strong>{(business.items ?? []).length} linked items</strong>
          </div>
        </div>
      </section>
    </div>
  )
}

function MetricsCard({ business, darkMode }: { business: Business; darkMode: boolean }) {
  const metricData = {
    day: {
      label: '1D',
      scansTotal: '148',
      ordersTotal: '32',
      yLabels: ['200', '150', '100', '50', '0'],
      xLabels: ['8 AM', '10 AM', '12 PM', '2 PM', '4 PM', '6 PM', '8 PM'],
      points: [
        { label: '8 AM', scans: 34, orders: 4, x: 64, y: 176 },
        { label: '10 AM', scans: 52, orders: 7, x: 154, y: 138 },
        { label: '12 PM', scans: 66, orders: 10, x: 252, y: 112 },
        { label: '2 PM', scans: 48, orders: 6, x: 348, y: 152 },
        { label: '4 PM', scans: 74, orders: 12, x: 452, y: 96 },
        { label: '6 PM', scans: 89, orders: 18, x: 570, y: 78 },
        { label: '8 PM', scans: 61, orders: 9, x: 696, y: 126 },
      ],
      areaPath: 'M0 190 C70 165 115 118 170 142 C236 170 268 91 336 128 C412 168 436 74 520 92 C612 112 660 78 760 118 L760 260 L0 260 Z',
      scansPath: 'M0 184 C70 160 112 116 170 136 C236 164 270 86 336 122 C414 162 438 70 520 86 C612 105 662 72 760 112',
      ordersPath: 'M0 210 C86 180 118 164 174 172 C246 184 286 128 344 154 C420 188 460 116 532 124 C620 136 660 104 760 130',
    },
    week: {
      label: '1W',
      scansTotal: '38h',
      ordersTotal: '80h',
      yLabels: ['40k', '30k', '20k', '10k', '0'],
      xLabels: ['13 Oct', '15 Oct', '17 Oct', '19 Oct', '21 Oct', '23 Oct', '25 Oct', '27 Oct', '29 Oct'],
      points: [
        { label: '13 Oct', scans: 21, orders: 24, x: 82, y: 166 },
        { label: '15 Oct', scans: 26, orders: 27, x: 156, y: 132 },
        { label: '17 Oct', scans: 28, orders: 25, x: 220, y: 104 },
        { label: '19 Oct', scans: 21, orders: 23, x: 300, y: 158 },
        { label: '21 Oct', scans: 25, orders: 22, x: 386, y: 132 },
        { label: '23 Oct', scans: 24, orders: 30, x: 446, y: 140 },
        { label: '25 Oct', scans: 27, orders: 31, x: 540, y: 116 },
        { label: '27 Oct', scans: 26, orders: 24, x: 650, y: 136 },
        { label: '29 Oct', scans: 30, orders: 28, x: 738, y: 112 },
      ],
      areaPath: 'M0 170 C70 115 105 92 160 112 C230 138 225 198 300 162 C362 132 390 178 448 145 C512 108 565 105 612 138 C665 176 690 105 760 118 L760 260 L0 260 Z',
      scansPath: 'M0 166 C60 116 100 82 154 104 C232 136 222 196 300 158 C362 127 389 176 448 140 C515 100 565 102 616 134 C670 169 696 101 760 112',
      ordersPath: 'M0 120 C62 156 105 122 145 92 C190 60 216 138 274 150 C326 160 348 92 395 126 C456 170 495 86 545 112 C590 140 606 194 662 148 C706 111 724 96 760 108',
    },
    month: {
      label: '1M',
      scansTotal: '12.8k',
      ordersTotal: '2.4k',
      yLabels: ['16k', '12k', '8k', '4k', '0'],
      xLabels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'],
      points: [
        { label: 'Week 1', scans: 8.2, orders: 1.2, x: 70, y: 160 },
        { label: 'Week 2', scans: 10.4, orders: 1.8, x: 210, y: 118 },
        { label: 'Week 3', scans: 7.9, orders: 1.5, x: 360, y: 170 },
        { label: 'Week 4', scans: 12.8, orders: 2.4, x: 520, y: 86 },
        { label: 'Week 5', scans: 11.1, orders: 2.1, x: 690, y: 112 },
      ],
      areaPath: 'M0 180 C95 154 132 108 216 118 C304 128 328 192 418 154 C504 118 520 72 612 92 C690 108 720 126 760 104 L760 260 L0 260 Z',
      scansPath: 'M0 176 C96 150 134 102 216 112 C304 122 330 188 418 150 C504 112 522 66 612 86 C690 102 722 120 760 98',
      ordersPath: 'M0 208 C92 178 148 158 228 166 C310 174 342 142 420 154 C500 166 542 116 620 124 C690 132 720 110 760 116',
    },
    year: {
      label: '1Y',
      scansTotal: '104k',
      ordersTotal: '19k',
      yLabels: ['120k', '90k', '60k', '30k', '0'],
      xLabels: ['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'],
      points: [
        { label: 'Jan', scans: 42, orders: 7, x: 46, y: 184 },
        { label: 'Feb', scans: 50, orders: 8, x: 112, y: 168 },
        { label: 'Mar', scans: 61, orders: 10, x: 180, y: 142 },
        { label: 'Apr', scans: 58, orders: 9, x: 246, y: 150 },
        { label: 'May', scans: 74, orders: 12, x: 316, y: 118 },
        { label: 'Jun', scans: 80, orders: 14, x: 386, y: 102 },
        { label: 'Jul', scans: 76, orders: 13, x: 456, y: 112 },
        { label: 'Aug', scans: 92, orders: 16, x: 526, y: 82 },
        { label: 'Sep', scans: 88, orders: 15, x: 596, y: 94 },
        { label: 'Oct', scans: 104, orders: 19, x: 666, y: 64 },
        { label: 'Nov', scans: 97, orders: 18, x: 724, y: 78 },
      ],
      areaPath: 'M0 204 C76 190 108 156 176 148 C244 140 270 114 336 120 C418 128 438 82 510 96 C580 110 624 56 690 72 C728 82 744 70 760 66 L760 260 L0 260 Z',
      scansPath: 'M0 198 C76 184 108 150 176 142 C244 134 270 108 336 114 C418 122 438 76 510 90 C580 104 624 50 690 66 C728 76 744 64 760 60',
      ordersPath: 'M0 220 C76 204 120 188 184 184 C260 178 294 156 354 164 C430 174 458 136 528 146 C592 156 636 112 704 124 C732 130 746 118 760 114',
    },
  }
  const [range, setRange] = useState<keyof typeof metricData>('week')
  const data = metricData[range]
  const [activeIndex, setActiveIndex] = useState(5)
  const activePoint = data.points[Math.min(activeIndex, data.points.length - 1)]

  function updateActivePoint(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const cursorX = ((event.clientX - bounds.left) / bounds.width) * 760
    const nextIndex = data.points.reduce((closestIndex, point, index) =>
      Math.abs(point.x - cursorX) < Math.abs(data.points[closestIndex].x - cursorX) ? index : closestIndex,
    0)

    setActiveIndex(nextIndex)
  }

  function selectRange(nextRange: keyof typeof metricData) {
    setRange(nextRange)
    setActiveIndex(Math.floor(metricData[nextRange].points.length / 2))
  }

  return (
    <section className="metrics-card" aria-label="QR activity metrics">
      <div className="metrics-head">
        <div>
          <p>QR activity and order readiness</p>
          <div className="metric-legend">
            <span className="new-dot"></span>
            <strong>Scans</strong>
            <b>{data.scansTotal}</b>
            <span className="resolved-dot"></span>
            <strong>Orders</strong>
            <b>{data.ordersTotal}</b>
          </div>
        </div>
        <div className="range-tabs" aria-label="Metric range">
          {Object.entries(metricData).map(([key, value]) => (
            <button
              className={range === key ? 'active' : ''}
              key={key}
              type="button"
              onClick={() => selectRange(key as keyof typeof metricData)}
            >
              {value.label}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-wrap">
        <div className="chart-y">
          {data.yLabels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <svg
          className="metrics-chart"
          viewBox="0 0 760 260"
          role="img"
          aria-label={`${business.name} QR scan and order trend`}
          onPointerMove={updateActivePoint}
          onPointerLeave={() => setActiveIndex(Math.floor(data.points.length / 2))}
        >
          <defs>
            <linearGradient id="scan-fill" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor={darkMode ? "#98c99a" : "#14b8a6"} stopOpacity={darkMode ? "0.38" : "0.25"} />
              <stop offset="55%" stopColor={darkMode ? "#d5b181" : "#fb923c"} stopOpacity={darkMode ? "0.28" : "0.18"} />
              <stop offset="100%" stopColor={darkMode ? "#1f2937" : "#f8fafc"} stopOpacity="0" />
            </linearGradient>
            <linearGradient id="scan-line" x1="0" x2="1">
              <stop offset="0%" stopColor={darkMode ? "#d7e8c5" : "#0d9488"} />
              <stop offset="100%" stopColor={darkMode ? "#84b486" : "#14b8a6"} />
            </linearGradient>
            <linearGradient id="order-line" x1="0" x2="1">
              <stop offset="0%" stopColor={darkMode ? "#d5b181" : "#f97316"} />
              <stop offset="100%" stopColor={darkMode ? "#e7c899" : "#fb923c"} />
            </linearGradient>
          </defs>
          <path
            className="chart-area"
            d={data.areaPath}
          />
          <path
            className="chart-line primary"
            d={data.scansPath}
          />
          <path
            className="chart-line secondary"
            d={data.ordersPath}
          />
          <line className="chart-marker" x1={activePoint.x} x2={activePoint.x} y1="20" y2="238" />
          <circle className="chart-point" cx={activePoint.x} cy={activePoint.y} r="5" />
          <g className="chart-tooltip">
            <rect x={Math.min(activePoint.x + 12, 648)} y="42" width="100" height="64" rx="6" />
            <text x={Math.min(activePoint.x + 26, 662)} y="63">{activePoint.label}</text>
            <text x={Math.min(activePoint.x + 26, 662)} y="81">{activePoint.scans}k scans</text>
            <text x={Math.min(activePoint.x + 26, 662)} y="97">{activePoint.orders} orders</text>
          </g>
        </svg>
        <div className="chart-x">
          {data.xLabels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
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
        <p>Scan to view prices, goods, tickets, and place orders.</p>
        {qrImage ? <img src={qrImage} alt={`${business.name} QR code`} /> : <div className="qr-loading" />}
        <strong>{url}</strong>
      </div>

      <div className="qr-details">
        <strong>{compact ? 'Customer link' : 'Auto-generated QR'}</strong>
        <p>{url}</p>
        {!compact && (
          <>
            <dl>
              <div>
                <dt>Merchant ID</dt>
                <dd>{business.merchantId}</dd>
              </div>
              <div>
                <dt>QR token</dt>
                <dd>{business.qrToken}</dd>
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

function CustomerMenu({
  business,
  categories,
  cartLines,
  customer,
  total,
  onAdd,
  onCustomerChange,
  onQuantityChange,
  onSubmit,
}: {
  business: Business
  categories: string[]
  cartLines: CartLine[]
  customer: Customer
  total: number
  onAdd: (item: CatalogItem) => void
  onCustomerChange: (customer: Customer) => void
  onQuantityChange: (itemId: string, quantity: number) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const [submitted, setSubmitted] = useState(false)
  const isCustomerNameMissing = submitted && !customer.name.trim()

  function submitOrderForm(event) {
    setSubmitted(true)

    if (!customer.name.trim()) {
      event.preventDefault()
      return
    }

    onSubmit(event)
  }

  return (
    <div className="customer-layout">
      <section className="menu-panel">
        {categories.map((category) => (
          <div className="menu-section" key={category}>
            <div className="section-heading">
              <h3>{category}</h3>
              <span>
                {business.items.filter((item) => item.category === category && item.available).length}{' '}
                available
              </span>
            </div>

            <div className="item-grid">
              {business.items
                .filter((item) => item.category === category)
                .map((item) => (
                  <article className={item.available ? 'item-card' : 'item-card muted'} key={item.id}>
                    <div>
                      <h4>{item.name}</h4>
                      <p>{item.description}</p>
                    </div>
                    <div className="item-action">
                      <strong>{currency(item.price)}</strong>
                      <button type="button" disabled={!item.available} onClick={() => onAdd(item)}>
                        {item.available ? 'Add' : 'Out'}
                      </button>
                    </div>
                  </article>
                ))}
            </div>
          </div>
        ))}
      </section>

      <aside className="cart-panel">
        <div className="cart-header">
          <h3>Your order</h3>
          <span>{cartLines.length} items</span>
        </div>

        {cartLines.length ? (
          <div className="cart-lines">
            {cartLines.map((item) => (
              <div className="cart-line" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{currency(item.lineTotal)}</span>
                </div>
                <div className="stepper">
                  <button type="button" onClick={() => onQuantityChange(item.id, item.quantity - 1)}>
                    -
                  </button>
                  <span>{item.quantity}</span>
                  <button type="button" onClick={() => onQuantityChange(item.id, item.quantity + 1)}>
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty">Add menu items or tickets to start an order.</p>
        )}

        <form className="order-form" noValidate onSubmit={submitOrderForm}>
          <label>
            Name
            <input
              required
              aria-invalid={isCustomerNameMissing}
              className={isCustomerNameMissing ? 'field-error' : undefined}
              value={customer.name}
              onChange={(event) => onCustomerChange({ ...customer, name: event.target.value })}
              placeholder="Customer name"
            />
            {isCustomerNameMissing && <span className="field-error-message">{REQUIRED_FIELD_MESSAGE}</span>}
          </label>
          <label>
            {business.tableLabel}
            <input
              value={customer.location}
              onChange={(event) => onCustomerChange({ ...customer, location: event.target.value })}
              placeholder="Table 4, counter, gate..."
            />
          </label>
          <label>
            Note
            <textarea
              value={customer.note}
              onChange={(event) => onCustomerChange({ ...customer, note: event.target.value })}
              placeholder="No onions, pickup time, delivery note..."
            />
          </label>

          <div className="total-row">
            <span>Total</span>
            <strong>{currency(total)}</strong>
          </div>
          <button className="primary-action" type="submit" disabled={!cartLines.length}>
            Place order
          </button>
        </form>
      </aside>
    </div>
  )
}

function AddItemForm({
  business,
  onCreateItem,
}: {
  business: Business
  onCreateItem: (data: {
    name: string
    category: string
    price: number
    description: string
    available: boolean
  }) => Promise<void> | void
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
  const categories = [...new Set<string>((business.items ?? []).map((entry) => entry.category))]

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
    <form className="catalog-form universal-item-form" noValidate onSubmit={submitItem}>
      <div>
        <p className="eyebrow">Add item</p>
        <h3>New item, service, or ticket</h3>
      </div>

      <label>
        Item name
        <input
          required
          aria-invalid={isItemNameMissing}
          className={isItemNameMissing ? 'field-error' : undefined}
          value={item.name}
          onChange={(event) => setItem({ ...item, name: event.target.value })}
          placeholder="Burger, cocktail, VIP ticket, uniform, school lunch..."
        />
        {isItemNameMissing && <span className="field-error-message">{REQUIRED_FIELD_MESSAGE}</span>}
      </label>

      <label>
        Category
        <input
          required
          aria-invalid={isCategoryMissing}
          className={isCategoryMissing ? 'field-error' : undefined}
          list="catalog-categories"
          value={item.category}
          onChange={(event) => setItem({ ...item, category: event.target.value })}
          placeholder="Meals, Drinks, Tickets, Services, Goods..."
        />
        {isCategoryMissing && <span className="field-error-message">{REQUIRED_FIELD_MESSAGE}</span>}
      </label>

      <datalist id="catalog-categories">
        {categories.map((category) => (
          <option value={category} key={category} />
        ))}
      </datalist>

      <label>
        Price
        <input
          required
          aria-invalid={isPriceMissing}
          className={isPriceMissing ? 'field-error' : undefined}
          min="1"
          type="number"
          value={item.price}
          onChange={(event) => setItem({ ...item, price: event.target.value })}
          placeholder="18000"
        />
        {isPriceMissing && <span className="field-error-message">{REQUIRED_FIELD_MESSAGE}</span>}
      </label>

      <label>
        Description
        <textarea
          value={item.description}
          onChange={(event) => setItem({ ...item, description: event.target.value })}
          placeholder="Size, flavor, seat type, pickup details, event date, or customer note"
        />
      </label>

      <label className="inline-check">
        <input
          checked={item.available}
          type="checkbox"
          onChange={(event) => setItem({ ...item, available: event.target.checked })}
        />
        Available to customers
      </label>

      <button className="primary-action" type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Add item'}
      </button>
    </form>
  )
}
function AddItemPage({
  business,
  onBack,
  onCreateItem,
}: {
  business: Business
  onBack: () => void
  onCreateItem: (data: {
    name: string
    category: string
    price: number
    description: string
    available: boolean
  }) => Promise<void> | void
}) {
  return (
    <section className="add-item-page">
      <button className="icon-button add-item-back-button" type="button" onClick={onBack} aria-label="Back to overview" title="Back to overview">
        <ArrowLeft size={20} strokeWidth={2.4} aria-hidden="true" />
      </button>

      <div className="dashboard-head add-item-head">
        <div>
          <p className="eyebrow">Add item</p>
          <h3>Add item</h3>
        </div>
      </div>

      <AddItemForm business={business} onCreateItem={onCreateItem} />
    </section>
  )
}

function CatalogPage({
  business,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
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
  onAddItem: () => void
  Sparkline: (props: { data: number[]; color?: string }) => React.ReactElement | null
}) {
  const PAGE_SIZE = 20
  const categories = useMemo(() => [...new Set((business.items ?? []).map((i) => i.category))], [business.items])

  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<CatalogItem>>({})
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return (business.items ?? []).filter((item) => {
      const matchSearch = !q || item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
      const matchCategory = filterCategory === 'all' || item.category === filterCategory
      const matchStatus = filterStatus === 'all' || (filterStatus === 'available' ? item.available : !item.available)
      return matchSearch && matchCategory && matchStatus
    })
  }, [business.items, search, filterCategory, filterStatus])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

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
    } finally {
      setSaving(false)
    }
  }

  async function removeItem(itemId: string) {
    setSaving(true)
    try {
      await onDeleteItem(itemId)
      if (editingId === itemId) cancelEdit()
    } finally {
      setSaving(false)
    }
  }

  function resetFilters() {
    setSearch('')
    setFilterCategory('all')
    setFilterStatus('all')
    setPage(1)
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
          <Sparkline data={[business.items.length - 6, business.items.length - 4, business.items.length - 3, business.items.length - 2, business.items.length - 1, business.items.length - 1, business.items.length]} color="#3b82f6" />
        </div>
        <div>
          <span>Available</span>
          <strong>{business.items.filter(i => i.available).length}</strong>
          <Sparkline data={[business.items.filter(i => i.available).length - 3, business.items.filter(i => i.available).length - 2, business.items.filter(i => i.available).length - 2, business.items.filter(i => i.available).length - 1, business.items.filter(i => i.available).length, business.items.filter(i => i.available).length, business.items.filter(i => i.available).length]} color="#10b981" />
        </div>
        <div>
          <span>Hidden</span>
          <strong>{business.items.filter(i => !i.available).length}</strong>
          <Sparkline data={[business.items.filter(i => !i.available).length + 2, business.items.filter(i => !i.available).length + 2, business.items.filter(i => !i.available).length + 1, business.items.filter(i => !i.available).length + 1, business.items.filter(i => !i.available).length, business.items.filter(i => !i.available).length, business.items.filter(i => !i.available).length]} color="#f59e0b" />
        </div>
        <div>
          <span>Categories</span>
          <strong>{categories.length}</strong>
          <Sparkline data={[categories.length - 1, categories.length - 1, categories.length - 1, categories.length, categories.length, categories.length, categories.length]} color="#8b5cf6" />
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
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="h-8 pl-8 text-sm"
              aria-label="Search catalog items"
            />
          </div>
          <Select value={filterCategory} onValueChange={(v) => { setFilterCategory(v); setPage(1) }}>
            <SelectTrigger className="h-8 w-[150px] text-sm" aria-label="Filter by category">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent className="">
              <SelectItem className="" value="all">All categories</SelectItem>
              {categories.map((cat) => <SelectItem className="" key={cat} value={cat}>{cat}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1) }}>
            <SelectTrigger className="h-8 w-[130px] text-sm" aria-label="Filter by status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent className="">
              <SelectItem className="" value="all">All statuses</SelectItem>
              <SelectItem className="" value="available">Available</SelectItem>
              <SelectItem className="" value="hidden">Hidden</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground ml-auto">{filtered.length} of {business.items.length} items</span>
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
            {pageItems.length === 0 ? (
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
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <span className="text-xs text-muted-foreground">{filtered.length} items</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 text-xs" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .reduce<(number | '…')[]>((acc, p, i, arr) => {
                  if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('…')
                  acc.push(p)
                  return acc
                }, [])
                .map((p, i) =>
                  p === '…' ? (
                    <span key={`e-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
                  ) : (
                    <Button key={p} variant={p === currentPage ? 'default' : 'outline'} size="sm" className="h-7 w-7 text-xs p-0" onClick={() => setPage(p as number)}>{p}</Button>
                  )
                )}
              <Button variant="outline" size="sm" className="h-7 text-xs" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* Edit item — Sheet drawer */}
      <Sheet open={!!editingId} onOpenChange={(open) => { if (!open) cancelEdit() }}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="border-b border-border px-6 py-4">
            <SheetTitle className={undefined}>Edit item</SheetTitle>
            <SheetDescription className={undefined}>{editDraft.name || 'Catalog item'}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="" htmlFor="edit-name">Name</Label>
              <Input className="" id="edit-name" value={editDraft.name ?? ''} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} type={undefined} />
            </div>
            <div className="space-y-1.5">
              <Label className="" htmlFor="edit-category">Category</Label>
              <Input className="" id="edit-category" list="edit-categories" value={editDraft.category ?? ''} onChange={(e) => setEditDraft({ ...editDraft, category: e.target.value })} type={undefined} />
              <datalist id="edit-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="space-y-1.5">
              <Label className="" htmlFor="edit-price">Price (UGX)</Label>
              <Input className="" id="edit-price" type="number" min="0" value={editDraft.price ?? ''} onChange={(e) => setEditDraft({ ...editDraft, price: e.target.value as unknown as number })} />
            </div>
            <div className="space-y-1.5">
              <Label className="" htmlFor="edit-description">Description</Label>
              <Textarea className="" id="edit-description" rows={3} value={editDraft.description ?? ''} onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })} />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input id="edit-available" type="checkbox" checked={editDraft.available ?? true} onChange={(e) => setEditDraft({ ...editDraft, available: e.target.checked })} className="size-4 rounded border-border accent-primary" />
              <Label htmlFor="edit-available" className="cursor-pointer">Available to customers</Label>
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

function OrderActionMenu({ order, onViewDetails }) {
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

function Dashboard({ business, orders, onClearCompleted, onPaymentChange, onStatusChange, Sparkline }) {
  const statusOptions = ['Pending', 'Preparing', 'Ready', 'Completed', 'Cancelled']
  const paymentOptions = ['Unpaid', 'Paid', 'Refunded']
  const pageSize = 5
  const [page, setPage] = useState(1)
  const [detailOrderId, setDetailOrderId] = useState('')

  const displayOrders = orders
  const totalPages = Math.max(1, Math.ceil(displayOrders.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageOrders = displayOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const detailOrder = displayOrders.find((order) => order.id === detailOrderId)

  const openCount = orders.filter(o => o.status !== 'Completed' && o.status !== 'Cancelled').length
  const paidSales = orders.filter(o => o.paymentStatus === 'Paid').reduce((sum, o) => sum + o.total, 0)
  const unpaidCount = orders.filter(o => o.paymentStatus === 'Unpaid' && o.status !== 'Cancelled').length
  const completedCount = orders.filter(o => o.status === 'Completed').length

  const firstItem = (currentPage - 1) * pageSize + 1
  const lastItem = Math.min(currentPage * pageSize, displayOrders.length)

  useEffect(() => {
    setPage(1)
    setDetailOrderId('')
  }, [orders.length, business.id])

  return (
    <section className="dashboard">
      {/* Metric cards */}
      <section className="metric-grid" aria-label="Orders summary">
        <div>
          <span>Open orders</span>
          <strong>{openCount}</strong>
          <Sparkline data={[openCount + 3, openCount + 5, openCount + 2, openCount + 4, openCount + 1, openCount + 2, openCount]} color="#3b82f6" />
        </div>
        <div>
          <span>Paid sales</span>
          <strong>{currency(paidSales)}</strong>
          <Sparkline data={[paidSales * 0.55, paidSales * 0.65, paidSales * 0.72, paidSales * 0.78, paidSales * 0.85, paidSales * 0.93, paidSales]} color="#10b981" />
        </div>
        <div>
          <span>Awaiting payment</span>
          <strong>{unpaidCount}</strong>
          <Sparkline data={[unpaidCount + 4, unpaidCount + 3, unpaidCount + 5, unpaidCount + 2, unpaidCount + 3, unpaidCount + 1, unpaidCount]} color="#f59e0b" />
        </div>
        <div>
          <span>Completed</span>
          <strong>{completedCount}</strong>
          <Sparkline data={[completedCount - 45, completedCount - 38, completedCount - 30, completedCount - 22, completedCount - 15, completedCount - 8, completedCount]} color="#8b5cf6" />
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
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={onClearCompleted}>
            <Trash2 className="size-3.5" />
            Clear finished
          </Button>
        </div>

        <Table className={undefined}>
          <TableHeader className="">
            <TableRow className="hover:bg-transparent border-b border-border">
              <TableHead className="pl-5 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Order</TableHead>
              <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Customer</TableHead>
              <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Items</TableHead>
              <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Total</TableHead>
              <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Status</TableHead>
              <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Payment</TableHead>
              <TableHead className="pr-5 text-right text-[10px] font-medium tracking-widest text-muted-foreground uppercase"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className={undefined}>
            {pageOrders.map((order) => (
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
                  <p className="text-xs text-muted-foreground mt-0.5">{[order.customer.phone, order.customer.location].filter(Boolean).join(' · ')}</p>
                </TableCell>
                <TableCell className={undefined}>
                  <div className="flex flex-wrap gap-1">
                    {order.items.slice(0, 2).map((item) => (
                      <Badge key={item.id} variant="secondary" className="text-[11px] font-normal">{item.quantity}× {item.name}</Badge>
                    ))}
                    {order.items.length > 2 && <Badge variant="secondary" className="text-[11px] font-normal">+{order.items.length - 2} more</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-sm font-medium font-mono text-foreground">{currency(order.total)}</TableCell>
                <TableCell className={undefined}><StatusBadge status={order.status} /></TableCell>
                <TableCell className={undefined}><PaymentBadge status={order.paymentStatus} /></TableCell>
                <TableCell className="pr-5 text-right" onClick={(e) => e.stopPropagation()}>
                  <OrderActionMenu
                    order={order}
                    onViewDetails={() => setDetailOrderId(order.id)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <span className="text-xs text-muted-foreground">Showing {firstItem}–{lastItem} of {displayOrders.length}</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .reduce<(number | '…')[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('…')
                acc.push(p)
                return acc
              }, [])
              .map((p, i) =>
                p === '…' ? (
                  <span key={`e-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
                ) : (
                  <Button key={p} variant={p === currentPage ? 'default' : 'outline'} size="sm" className="h-7 w-7 text-xs p-0" onClick={() => setPage(p as number)}>{p}</Button>
                )
              )}
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Next</Button>
          </div>
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
                  <p className="text-xs text-muted-foreground mt-0.5">{[detailOrder.customer.phone, detailOrder.customer.location].filter(Boolean).join(' · ')}</p>
                  {detailOrder.customer.note && <p className="text-xs text-muted-foreground mt-1 italic">{detailOrder.customer.note}</p>}
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
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <StatusBadge status={detailOrder.status} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Payment</span>
                    <PaymentBadge status={detailOrder.paymentStatus} />
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

  // Dummy data based on time range
  const dummyData = useMemo(() => {
    const data = {
      today: {
        totalRevenue: 145000,
        totalOrders: 8,
        completedOrders: 5,
        revenueTrend: [18000, 15000, 22000, 19000, 25000, 21000, 25000],
        ordersTrend: [1, 1, 2, 1, 2, 1, 0],
        avgOrderTrend: [18000, 15000, 11000, 19000, 12500, 21000, 0],
        completionTrend: [100, 100, 100, 100, 50, 83, 100],
        itemSales: [
          { name: 'Beef Plate', quantity: 12, revenue: 216000 },
          { name: 'Chicken Wrap', quantity: 8, revenue: 116000 },
          { name: 'Passion Juice', quantity: 15, revenue: 90000 },
          { name: 'Family Platter', quantity: 2, revenue: 84000 },
          { name: 'House Mocktail', quantity: 6, revenue: 72000 },
        ],
        paymentBreakdown: { Paid: 145000, Unpaid: 58000, Refunded: 0 },
        statusBreakdown: { Pending: 2, Preparing: 1, Ready: 0, Completed: 5, Cancelled: 0 },
        ordersByStatus: {
          Pending: [
            { id: 'ORD-001', customer: 'John M.', items: ['2x Beef Plate', '1x Passion Juice'], total: 42000 },
            { id: 'ORD-002', customer: 'Sarah K.', items: ['1x Chicken Wrap'], total: 14500 },
          ],
          Preparing: [
            { id: 'ORD-003', customer: 'David R.', items: ['1x Family Platter', '2x House Mocktail'], total: 66000 },
          ],
          Ready: [],
          Completed: [
            { id: 'ORD-004', customer: 'Amina N.', items: ['3x Beef Plate'], total: 54000 },
            { id: 'ORD-005', customer: 'Brian T.', items: ['2x Chicken Wrap', '1x Passion Juice'], total: 35000 },
            { id: 'ORD-006', customer: 'Clara M.', items: ['1x Family Platter'], total: 42000 },
            { id: 'ORD-007', customer: 'Michael S.', items: ['4x Passion Juice'], total: 24000 },
            { id: 'ORD-008', customer: 'Emma L.', items: ['1x Beef Plate', '2x House Mocktail'], total: 42000 },
          ],
          Cancelled: [],
        },
      },
      week: {
        totalRevenue: 1240000,
        totalOrders: 67,
        completedOrders: 52,
        revenueTrend: [145000, 168000, 192000, 175000, 210000, 185000, 165000],
        ordersTrend: [8, 10, 12, 9, 13, 10, 5],
        avgOrderTrend: [18125, 16800, 16000, 19444, 16154, 18500, 33000],
        completionTrend: [62.5, 70, 75, 77, 76.9, 80, 77.6],
        itemSales: [
          { name: 'Beef Plate', quantity: 89, revenue: 1602000 },
          { name: 'Chicken Wrap', quantity: 67, revenue: 971500 },
          { name: 'Family Platter', quantity: 28, revenue: 1176000 },
          { name: 'Passion Juice', quantity: 124, revenue: 744000 },
          { name: 'House Mocktail', quantity: 45, revenue: 540000 },
        ],
        paymentBreakdown: { Paid: 1240000, Unpaid: 320000, Refunded: 28000 },
        statusBreakdown: { Pending: 8, Preparing: 4, Ready: 3, Completed: 52, Cancelled: 0 },
        ordersByStatus: {
          Pending: [
            { id: 'ORD-060', customer: 'John M.', items: ['2x Beef Plate', '1x Passion Juice'], total: 42000 },
            { id: 'ORD-061', customer: 'Sarah K.', items: ['1x Chicken Wrap'], total: 14500 },
            { id: 'ORD-062', customer: 'Peter W.', items: ['1x Family Platter'], total: 42000 },
            { id: 'ORD-063', customer: 'Lisa M.', items: ['3x Passion Juice'], total: 18000 },
            { id: 'ORD-064', customer: 'Tom H.', items: ['2x Spicy Wings'], total: 44000 },
            { id: 'ORD-065', customer: 'Anna B.', items: ['1x Beef Plate', '1x House Mocktail'], total: 30000 },
            { id: 'ORD-066', customer: 'James P.', items: ['1x Chicken Wrap', '2x Passion Juice'], total: 26500 },
            { id: 'ORD-067', customer: 'Maria G.', items: ['1x Family Platter', '1x House Mocktail'], total: 54000 },
          ],
          Preparing: [
            { id: 'ORD-056', customer: 'David R.', items: ['1x Family Platter', '2x House Mocktail'], total: 66000 },
            { id: 'ORD-057', customer: 'Grace N.', items: ['2x Beef Plate'], total: 36000 },
            { id: 'ORD-058', customer: 'Paul K.', items: ['3x Chicken Wrap'], total: 43500 },
            { id: 'ORD-059', customer: 'Rachel S.', items: ['1x Spicy Wings', '2x Passion Juice'], total: 34000 },
          ],
          Ready: [
            { id: 'ORD-053', customer: 'Mark J.', items: ['1x Family Platter', '1x Passion Juice'], total: 48000 },
            { id: 'ORD-054', customer: 'Sophie L.', items: ['2x Chicken Wrap', '1x House Mocktail'], total: 41000 },
            { id: 'ORD-055', customer: 'Kevin M.', items: ['1x Beef Plate', '1x Passion Juice'], total: 24000 },
          ],
          Completed: [
            { id: 'ORD-001', customer: 'Amina N.', items: ['3x Beef Plate'], total: 54000 },
            { id: 'ORD-002', customer: 'Brian T.', items: ['2x Chicken Wrap', '1x Passion Juice'], total: 35000 },
            { id: 'ORD-003', customer: 'Clara M.', items: ['1x Family Platter'], total: 42000 },
          ],
          Cancelled: [],
        },
      },
      month: {
        totalRevenue: 4850000,
        totalOrders: 268,
        completedOrders: 234,
        revenueTrend: [620000, 680000, 750000, 720000, 810000, 740000, 730000],
        ordersTrend: [32, 38, 42, 39, 45, 40, 32],
        avgOrderTrend: [19375, 17895, 17857, 18462, 18000, 18500, 22812],
        completionTrend: [78, 82, 84, 85, 87, 88, 87.3],
        itemSales: [
          { name: 'Beef Plate', quantity: 356, revenue: 6408000 },
          { name: 'Family Platter', quantity: 124, revenue: 5208000 },
          { name: 'Chicken Wrap', quantity: 289, revenue: 4190500 },
          { name: 'Passion Juice', quantity: 478, revenue: 2868000 },
          { name: 'Spicy Wings', quantity: 167, revenue: 3674000 },
        ],
        paymentBreakdown: { Paid: 4850000, Unpaid: 890000, Refunded: 126000 },
        statusBreakdown: { Pending: 18, Preparing: 8, Ready: 8, Completed: 234, Cancelled: 0 },
        ordersByStatus: {
          Pending: [
            { id: 'ORD-260', customer: 'John M.', items: ['2x Beef Plate', '1x Passion Juice'], total: 42000 },
            { id: 'ORD-261', customer: 'Sarah K.', items: ['1x Chicken Wrap'], total: 14500 },
            { id: 'ORD-262', customer: 'Peter W.', items: ['1x Family Platter'], total: 42000 },
            { id: 'ORD-263', customer: 'Lisa M.', items: ['3x Passion Juice'], total: 18000 },
            { id: 'ORD-264', customer: 'Tom H.', items: ['2x Spicy Wings'], total: 44000 },
          ],
          Preparing: [
            { id: 'ORD-252', customer: 'David R.', items: ['1x Family Platter', '2x House Mocktail'], total: 66000 },
            { id: 'ORD-253', customer: 'Grace N.', items: ['2x Beef Plate'], total: 36000 },
            { id: 'ORD-254', customer: 'Paul K.', items: ['3x Chicken Wrap'], total: 43500 },
            { id: 'ORD-255', customer: 'Rachel S.', items: ['1x Spicy Wings', '2x Passion Juice'], total: 34000 },
          ],
          Ready: [
            { id: 'ORD-244', customer: 'Mark J.', items: ['1x Family Platter', '1x Passion Juice'], total: 48000 },
            { id: 'ORD-245', customer: 'Sophie L.', items: ['2x Chicken Wrap', '1x House Mocktail'], total: 41000 },
            { id: 'ORD-246', customer: 'Kevin M.', items: ['1x Beef Plate', '1x Passion Juice'], total: 24000 },
          ],
          Completed: [
            { id: 'ORD-001', customer: 'Amina N.', items: ['3x Beef Plate'], total: 54000 },
            { id: 'ORD-002', customer: 'Brian T.', items: ['2x Chicken Wrap', '1x Passion Juice'], total: 35000 },
            { id: 'ORD-003', customer: 'Clara M.', items: ['1x Family Platter'], total: 42000 },
          ],
          Cancelled: [],
        },
      },
      all: {
        totalRevenue: 18650000,
        totalOrders: 1024,
        completedOrders: 956,
        revenueTrend: [2100000, 2350000, 2580000, 2720000, 2950000, 3100000, 2850000],
        ordersTrend: [112, 128, 145, 152, 168, 176, 143],
        avgOrderTrend: [18750, 18359, 17793, 17895, 17560, 17614, 19930],
        completionTrend: [89, 90, 91, 92, 93, 93.4, 93.4],
        itemSales: [
          { name: 'Beef Plate', quantity: 1456, revenue: 26208000 },
          { name: 'Family Platter', quantity: 534, revenue: 22428000 },
          { name: 'Chicken Wrap', quantity: 1178, revenue: 17081000 },
          { name: 'Passion Juice', quantity: 2089, revenue: 12534000 },
          { name: 'Spicy Wings', quantity: 678, revenue: 14916000 },
        ],
        paymentBreakdown: { Paid: 18650000, Unpaid: 2340000, Refunded: 456000 },
        statusBreakdown: { Pending: 34, Preparing: 18, Ready: 16, Completed: 956, Cancelled: 0 },
        ordersByStatus: {
          Pending: [
            { id: 'ORD-1018', customer: 'John M.', items: ['2x Beef Plate', '1x Passion Juice'], total: 42000 },
            { id: 'ORD-1019', customer: 'Sarah K.', items: ['1x Chicken Wrap'], total: 14500 },
            { id: 'ORD-1020', customer: 'Peter W.', items: ['1x Family Platter'], total: 42000 },
            { id: 'ORD-1021', customer: 'Lisa M.', items: ['3x Passion Juice'], total: 18000 },
            { id: 'ORD-1022', customer: 'Tom H.', items: ['2x Spicy Wings'], total: 44000 },
          ],
          Preparing: [
            { id: 'ORD-1010', customer: 'David R.', items: ['1x Family Platter', '2x House Mocktail'], total: 66000 },
            { id: 'ORD-1011', customer: 'Grace N.', items: ['2x Beef Plate'], total: 36000 },
            { id: 'ORD-1012', customer: 'Paul K.', items: ['3x Chicken Wrap'], total: 43500 },
            { id: 'ORD-1013', customer: 'Rachel S.', items: ['1x Spicy Wings', '2x Passion Juice'], total: 34000 },
          ],
          Ready: [
            { id: 'ORD-1002', customer: 'Mark J.', items: ['1x Family Platter', '1x Passion Juice'], total: 48000 },
            { id: 'ORD-1003', customer: 'Sophie L.', items: ['2x Chicken Wrap', '1x House Mocktail'], total: 41000 },
            { id: 'ORD-1004', customer: 'Kevin M.', items: ['1x Beef Plate', '1x Passion Juice'], total: 24000 },
          ],
          Completed: [
            { id: 'ORD-001', customer: 'Amina N.', items: ['3x Beef Plate'], total: 54000 },
            { id: 'ORD-002', customer: 'Brian T.', items: ['2x Chicken Wrap', '1x Passion Juice'], total: 35000 },
            { id: 'ORD-003', customer: 'Clara M.', items: ['1x Family Platter'], total: 42000 },
          ],
          Cancelled: [],
        },
      },
    }
    return data[timeRange]
  }, [timeRange])

  // Calculate metrics from dummy data
  const totalOrders = dummyData.totalOrders
  const totalRevenue = dummyData.totalRevenue
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
  const completedOrders = dummyData.completedOrders
  const completionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0

  // Use dummy data
  const itemSales = dummyData.itemSales
  const paymentBreakdown = dummyData.paymentBreakdown
  const statusBreakdown = dummyData.statusBreakdown
  const ordersByStatus = dummyData.ordersByStatus

  return (
    <section className="reports-page">
      {/* Time range selector */}
      <div className="reports-filters">
        <div className="range-tabs" aria-label="Time range">
          <button
            className={timeRange === 'today' ? 'active' : ''}
            type="button"
            onClick={() => setTimeRange('today')}
          >
            Today
          </button>
          <button
            className={timeRange === 'week' ? 'active' : ''}
            type="button"
            onClick={() => setTimeRange('week')}
          >
            Last 7 days
          </button>
          <button
            className={timeRange === 'month' ? 'active' : ''}
            type="button"
            onClick={() => setTimeRange('month')}
          >
            This month
          </button>
          <button
            className={timeRange === 'all' ? 'active' : ''}
            type="button"
            onClick={() => setTimeRange('all')}
          >
            All time
          </button>
        </div>
      </div>

      {/* Key metrics */}
      <section className="metric-grid" aria-label="Sales metrics">
        <div>
          <span>TOTAL REVENUE</span>
          <strong style={{ color: '#10b981' }}>{currency(totalRevenue)}</strong>
          <span style={{ color: '#10b981', fontWeight: 400 }}>Paid orders</span>
          <Sparkline data={dummyData.revenueTrend} color="#10b981" />
        </div>
        <div>
          <span>TOTAL ORDERS</span>
          <strong>{totalOrders}</strong>
          <span style={{ color: '#667085', fontWeight: 400 }}>All statuses</span>
          <Sparkline data={dummyData.ordersTrend} color="#3b82f6" />
        </div>
        <div>
          <span>AVG ORDER VALUE</span>
          <strong>{currency(averageOrderValue)}</strong>
          <span style={{ color: '#667085', fontWeight: 400 }}>Per order</span>
          <Sparkline data={dummyData.avgOrderTrend} color="#f59e0b" />
        </div>
        <div>
          <span>COMPLETION RATE</span>
          <strong>{completionRate.toFixed(1)}%</strong>
          <span style={{ color: '#667085', fontWeight: 400 }}>{completedOrders} completed</span>
          <Sparkline data={dummyData.completionTrend} color="#8b5cf6" />
        </div>
      </section>

      {/* Reports grid */}
      <div className="reports-grid">
        {/* Top selling items */}
        <div className="report-card">
          <div className="report-card-head">
            <h3>Top Selling Items</h3>
            <span>{itemSales.length} items</span>
          </div>
          <div className="report-card-body">
            {itemSales.length > 0 ? (
              <div className="report-list">
                {itemSales.map((item, index) => (
                  <div key={item.name} className="report-list-item">
                    <div className="report-list-rank">{index + 1}</div>
                    <div className="report-list-details">
                      <strong>{item.name}</strong>
                      <span>{item.quantity} sold</span>
                    </div>
                    <strong className="report-list-value">{currency(item.revenue)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="report-empty">No sales data available for this period.</p>
            )}
          </div>
        </div>

        {/* Payment breakdown */}
        <div className="report-card">
          <div className="report-card-head">
            <h3>Payment Status</h3>
            <span>{currency(Object.values(paymentBreakdown).reduce((a, b) => a + b, 0))}</span>
          </div>
          <div className="report-card-body">
            <div className="report-breakdown">
              <div className="report-breakdown-item">
                <div className="report-breakdown-bar">
                  <div 
                    className="report-breakdown-fill paid" 
                    style={{ width: `${totalRevenue > 0 ? (paymentBreakdown.Paid / (paymentBreakdown.Paid + paymentBreakdown.Unpaid + paymentBreakdown.Refunded)) * 100 : 0}%` }}
                  />
                </div>
                <div className="report-breakdown-details">
                  <span>Paid</span>
                  <strong>{currency(paymentBreakdown.Paid)}</strong>
                </div>
              </div>
              <div className="report-breakdown-item">
                <div className="report-breakdown-bar">
                  <div 
                    className="report-breakdown-fill unpaid" 
                    style={{ width: `${totalRevenue > 0 ? (paymentBreakdown.Unpaid / (paymentBreakdown.Paid + paymentBreakdown.Unpaid + paymentBreakdown.Refunded)) * 100 : 0}%` }}
                  />
                </div>
                <div className="report-breakdown-details">
                  <span>Unpaid</span>
                  <strong>{currency(paymentBreakdown.Unpaid)}</strong>
                </div>
              </div>
              {paymentBreakdown.Refunded > 0 && (
                <div className="report-breakdown-item">
                  <div className="report-breakdown-bar">
                    <div 
                      className="report-breakdown-fill refunded" 
                      style={{ width: `${totalRevenue > 0 ? (paymentBreakdown.Refunded / (paymentBreakdown.Paid + paymentBreakdown.Unpaid + paymentBreakdown.Refunded)) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="report-breakdown-details">
                    <span>Refunded</span>
                    <strong>{currency(paymentBreakdown.Refunded)}</strong>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Order status breakdown */}
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
                  onClick={() => setSelectedStatus(status as typeof selectedStatus)}
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
      </div>
    </section>
  )
}

export default App
