import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  CreditCard,
  FileText,
  LayoutGrid,
  LogOut,
  Moon,
  QrCode,
  Settings,
  ShoppingCart,
  Sun,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import OverviewPage from './pages/OverviewPage'
import MerchantsPage from './pages/MerchantsPage'
import OrdersPage from './pages/OrdersPage'
import UsersPage from './pages/UsersPage'
import RevenuePaymentsPage from './pages/RevenuePaymentsPage'
import QRActivityPage from './pages/QRActivityPage'
import ReportsPage from './pages/ReportsPage'
import SystemHealthPage from './pages/SystemHealthPage'
import AuditLogPage from './pages/AuditLogPage'
import ConfigsPage from './pages/ConfigsPage'
import { useNotifications, useSystemHealth } from './hooks/usePlatform'

type View =
  | 'overview' | 'merchants' | 'orders'
  | 'users' | 'revenue' | 'qr-activity' | 'reports'
  | 'system' | 'audit' | 'configs'

type NavItem = {
  id: View
  label: string
  icon: typeof LayoutGrid
  badge?: number
  badgeType?: 'red' | 'green'
}

const PAGE_META: Record<View, { eyebrow: string; title: string }> = {
  overview: { eyebrow: 'Admin · Platform', title: 'Overview' },
  merchants: { eyebrow: 'Admin · Platform', title: 'Merchants' },
  orders: { eyebrow: 'Admin · Platform', title: 'All Orders' },
  users: { eyebrow: 'Admin · Platform', title: 'Users' },
  revenue: { eyebrow: 'Admin · Finance', title: 'Revenue & Payments' },
  'qr-activity': { eyebrow: 'Admin · Analytics', title: 'QR Activity' },
  reports: { eyebrow: 'Admin · Analytics', title: 'Reports' },
  system: { eyebrow: 'Admin · System', title: 'System Health' },
  audit: { eyebrow: 'Admin · System', title: 'Audit Log' },
  configs: { eyebrow: 'Admin · System', title: 'Configs' },
}

function relativeTime(iso: string) {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function notifBg(type: string) {
  if (type === 'system') return 'oklch(0.96 0.02 30)'
  if (type === 'merchant') return 'oklch(0.94 0.04 145)'
  if (type === 'orders') return 'oklch(0.94 0.04 250)'
  if (type === 'qr') return 'oklch(0.94 0.04 75)'
  if (type === 'audit') return 'oklch(0.94 0.04 195)'
  return 'oklch(0.95 0.01 250)'
}

export default function AdminApp({
  kcUsername = 'Admin',
  onLogout,
}: {
  kcUsername?: string
  onLogout?: () => void
}) {
  const [view, setView] = useState<View>('overview')
  const [showNotifications, setShowNotifications] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('scanny-dark-mode')
    return saved ? JSON.parse(saved) : false
  })
  const { data: health } = useSystemHealth()
  const {
    notifications,
    unread,
    loading: notifLoading,
    error: notifError,
    markAllRead,
  } = useNotifications()

  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode)
    localStorage.setItem('scanny-dark-mode', JSON.stringify(darkMode))
  }, [darkMode])

  const openIncidents = health?.overall?.openIncidents ?? 0

  const navSections = useMemo(() => {
    const systemItem: NavItem = {
      id: 'system',
      label: 'System Health',
      icon: Activity,
      ...(openIncidents > 0 ? { badge: openIncidents, badgeType: 'red' as const } : {}),
    }
    return [
      {
        label: 'Platform',
        items: [
          { id: 'overview' as const, label: 'Overview', icon: LayoutGrid },
          { id: 'merchants' as const, label: 'Merchants', icon: Building2 },
          { id: 'orders' as const, label: 'All Orders', icon: ShoppingCart },
          { id: 'users' as const, label: 'Users', icon: Users },
        ],
      },
      {
        label: 'Finance',
        items: [
          { id: 'revenue' as const, label: 'Revenue & Payments', icon: CreditCard },
        ],
      },
      {
        label: 'Analytics',
        items: [
          { id: 'qr-activity' as const, label: 'QR Activity', icon: QrCode },
          { id: 'reports' as const, label: 'Reports', icon: BarChart3 },
        ],
      },
      {
        label: 'System',
        items: [
          systemItem,
          { id: 'audit' as const, label: 'Audit Log', icon: FileText },
          { id: 'configs' as const, label: 'Configs', icon: Settings },
        ],
      },
    ]
  }, [openIncidents])

  const meta = PAGE_META[view]
  const initials = kcUsername
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'SA'

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar" aria-label="Admin navigation">
        <div className="admin-brand">
          <img src="/qrcode1.png" alt="Scanny" className="admin-brand-logo" />
          <div className="admin-brand-text">
            <strong>Scanny</strong>
            <span>Admin Console</span>
          </div>
        </div>

        <Separator className="my-1" />

        <nav className="admin-nav" aria-label="Admin sections">
          {navSections.map((section) => (
            <div key={section.label} className="admin-nav-section">
              <p className="admin-nav-label">{section.label}</p>
              {section.items.map(({ id, label, icon: Icon, badge, badgeType }) => (
                <button
                  key={id}
                  type="button"
                  className={view === id ? 'active' : ''}
                  onClick={() => setView(id)}
                >
                  <Icon size={16} />
                  <span style={{ flex: 1 }}>{label}</span>
                  {badge ? (
                    <span className={`admin-nav-badge ${badgeType === 'green' ? 'green' : ''}`}>
                      {badge}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="admin-profile">
          <div className="admin-profile-avatar">{initials}</div>
          <div className="admin-profile-info">
            <strong>{kcUsername}</strong>
            <span>Super Admin</span>
          </div>
          <button
            type="button"
            className="admin-dark-toggle"
            title="Sign out"
            onClick={onLogout}
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      <section className="admin-workspace">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <p className="eyebrow">{meta.eyebrow}</p>
            <h2>{meta.title}</h2>
          </div>
          <div className="admin-topbar-right">
            <button
              type="button"
              className="admin-dark-toggle"
              title={darkMode ? 'Light mode' : 'Dark mode'}
              onClick={() => setDarkMode((v: boolean) => !v)}
            >
              {darkMode ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            <Button
              variant="outline"
              size="icon"
              aria-label="Notifications"
              className="relative"
              onClick={() => setShowNotifications(true)}
            >
              <Bell className="size-4" />
              {unread > 0 && (
                <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive" />
              )}
            </Button>
          </div>
        </header>

        <div className="admin-page">
          {view === 'overview' && <OverviewPage />}
          {view === 'merchants' && <MerchantsPage />}
          {view === 'orders' && <OrdersPage />}
          {view === 'users' && <UsersPage />}
          {view === 'revenue' && <RevenuePaymentsPage />}
          {view === 'qr-activity' && <QRActivityPage />}
          {view === 'reports' && <ReportsPage />}
          {view === 'system' && <SystemHealthPage />}
          {view === 'audit' && <AuditLogPage />}
          {view === 'configs' && <ConfigsPage />}
        </div>

        <Sheet open={showNotifications} onOpenChange={setShowNotifications}>
          <SheetContent side="right" className="w-full sm:max-w-sm flex flex-col gap-0 p-0">
            <SheetHeader className="border-b border-border px-6 py-4">
              <SheetTitle>Notifications</SheetTitle>
              <SheetDescription>Platform alerts and recent activity</SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto">
              <AdminNotificationsPanel
                notifications={notifications}
                unread={unread}
                loading={notifLoading}
                error={notifError}
                onMarkAllRead={markAllRead}
              />
            </div>
          </SheetContent>
        </Sheet>
      </section>
    </div>
  )
}

function AdminNotificationsPanel({
  notifications,
  unread,
  loading,
  error,
  onMarkAllRead,
}: {
  notifications: Array<{
    id: string
    icon: string
    title: string
    sub: string
    timestamp: string
    type: string
    unread: boolean
  }>
  unread: number
  loading: boolean
  error: string | null
  onMarkAllRead: () => void
}) {
  return (
    <div>
      <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
            {unread > 0
              ? <><strong style={{ color: 'var(--foreground)' }}>{unread}</strong> unread</>
              : 'All caught up'}
          </span>
        </div>
        <button
          type="button"
          onClick={onMarkAllRead}
          disabled={unread === 0}
          style={{
            fontSize: 12,
            color: unread === 0 ? 'var(--muted-foreground)' : 'var(--primary)',
            background: 'none',
            border: 'none',
            cursor: unread === 0 ? 'default' : 'pointer',
            fontWeight: 500,
          }}
        >
          Mark all read
        </button>
      </div>

      <div>
        <p style={{ margin: 0, padding: '10px 20px 4px', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>
          Recent
        </p>
        {loading && (
          <p style={{ padding: '16px 20px', fontSize: 13, color: 'var(--muted-foreground)' }}>Loading…</p>
        )}
        {error && (
          <p style={{ padding: '16px 20px', fontSize: 13, color: 'var(--destructive)' }}>{error}</p>
        )}
        {!loading && !error && notifications.length === 0 && (
          <p style={{ padding: '16px 20px', fontSize: 13, color: 'var(--muted-foreground)' }}>
            No notifications yet.
          </p>
        )}
        {notifications.map((n) => (
          <div
            key={n.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '12px 20px',
              borderBottom: '1px solid var(--border)',
              background: n.unread ? 'oklch(from var(--primary) l c h / 3%)' : 'transparent',
            }}
          >
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: notifBg(n.type),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              flexShrink: 0,
            }}>
              {n.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: n.unread ? 600 : 400, color: 'var(--foreground)', lineHeight: 1.35 }}>
                {n.title}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.4 }}>
                {n.sub}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>
                {relativeTime(n.timestamp)}
              </span>
              {n.unread && (
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--destructive)', display: 'block' }} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
