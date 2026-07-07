import { useEffect, useState } from 'react'
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
  Package,
  QrCode,
  Settings,
  ShoppingCart,
  Sun,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
import CatalogPage from './pages/CatalogPage'
import UsersPage from './pages/UsersPage'
import RevenuePaymentsPage from './pages/RevenuePaymentsPage'
import QRActivityPage from './pages/QRActivityPage'
import ReportsPage from './pages/ReportsPage'
import SystemHealthPage from './pages/SystemHealthPage'
import AuditLogPage from './pages/AuditLogPage'
import ConfigsPage from './pages/ConfigsPage'

type View =
  | 'overview' | 'merchants' | 'orders' | 'catalog'
  | 'users' | 'revenue' | 'qr-activity' | 'reports'
  | 'system' | 'audit' | 'configs'

const NAV_SECTIONS = [
  {
    label: 'Platform',
    items: [
      { id: 'overview',    label: 'Overview',          icon: LayoutGrid   },
      { id: 'merchants',   label: 'Merchants',          icon: Building2,   badge: 3, badgeType: 'green' },
      { id: 'orders',      label: 'All Orders',         icon: ShoppingCart },
      { id: 'catalog',     label: 'Catalog Items',      icon: Package      },
      { id: 'users',       label: 'Users',              icon: Users        },
    ],
  },
  {
    label: 'Finance',
    items: [
      { id: 'revenue',     label: 'Revenue & Payments', icon: CreditCard   },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { id: 'qr-activity', label: 'QR Activity',        icon: QrCode       },
      { id: 'reports',     label: 'Reports',             icon: BarChart3    },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'system',      label: 'System Health',       icon: Activity,    badge: 1, badgeType: 'red' },
      { id: 'audit',       label: 'Audit Log',           icon: FileText     },
      { id: 'configs',     label: 'Configs',             icon: Settings     },
    ],
  },
]

const PAGE_META: Record<View, { eyebrow: string; title: string }> = {
  overview:      { eyebrow: 'Admin · Platform',    title: 'Overview'           },
  merchants:     { eyebrow: 'Admin · Platform',    title: 'Merchants'          },
  orders:        { eyebrow: 'Admin · Platform',    title: 'All Orders'         },
  catalog:       { eyebrow: 'Admin · Platform',    title: 'Catalog Items'      },
  users:         { eyebrow: 'Admin · Platform',    title: 'Users'              },
  revenue:       { eyebrow: 'Admin · Finance',     title: 'Revenue & Payments' },
  'qr-activity': { eyebrow: 'Admin · Analytics',  title: 'QR Activity'        },
  reports:       { eyebrow: 'Admin · Analytics',   title: 'Reports'            },
  system:        { eyebrow: 'Admin · System',      title: 'System Health'      },
  audit:         { eyebrow: 'Admin · System',      title: 'Audit Log'          },
  configs:       { eyebrow: 'Admin · System',      title: 'Configs'            },
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

  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode)
    localStorage.setItem('scanny-dark-mode', JSON.stringify(darkMode))
  }, [darkMode])

  const meta = PAGE_META[view]
  const initials = kcUsername
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'SA'

  return (
    <div className="admin-shell">
      {/* ── Sidebar ── */}
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
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="admin-nav-section">
              <p className="admin-nav-label">{section.label}</p>
              {section.items.map(({ id, label, icon: Icon, badge, badgeType }) => (
                <button
                  key={id}
                  type="button"
                  className={view === id ? 'active' : ''}
                  onClick={() => setView(id as View)}
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

      {/* ── Workspace ── */}
      <section className="admin-workspace">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <p className="eyebrow">{meta.eyebrow}</p>
            <h2>{meta.title}</h2>
          </div>
          <div className="admin-topbar-right">
            {/* Dark mode toggle */}
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
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive" />
            </Button>
          </div>
        </header>

        <div className="admin-page">
          {view === 'overview'    && <OverviewPage />}
          {view === 'merchants'   && <MerchantsPage />}
          {view === 'orders'      && <OrdersPage />}
          {view === 'catalog'     && <CatalogPage />}
          {view === 'users'       && <UsersPage />}
          {view === 'revenue'     && <RevenuePaymentsPage />}
          {view === 'qr-activity' && <QRActivityPage />}
          {view === 'reports'     && <ReportsPage />}
          {view === 'system'      && <SystemHealthPage />}
          {view === 'audit'       && <AuditLogPage />}
          {view === 'configs'     && <ConfigsPage />}
        </div>

        {/* Notifications drawer */}
        <Sheet open={showNotifications} onOpenChange={setShowNotifications}>
          <SheetContent side="right" className="w-full sm:max-w-sm flex flex-col gap-0 p-0">
            <SheetHeader className="border-b border-border px-6 py-4">
              <SheetTitle>Notifications</SheetTitle>
              <SheetDescription>Platform alerts and recent activity</SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto">
              <AdminNotificationsPanel />
            </div>
          </SheetContent>
        </Sheet>
      </section>
    </div>
  )
}

const ADMIN_NOTIFICATIONS = [
  { icon: '⚠️', bg: 'oklch(0.96 0.02 30)',   dot: true,  title: 'Payment gateway degraded',       sub: '3 failed transactions · MER-004',         time: '8m ago'  },
  { icon: '🏪', bg: 'oklch(0.94 0.04 145)',   dot: true,  title: 'New merchant registered',         sub: 'Kampala Grill · awaiting approval',        time: '14m ago' },
  { icon: '📦', bg: 'oklch(0.94 0.04 250)',   dot: true,  title: '284 orders placed today',         sub: 'Across 38 active merchants',               time: '1h ago'  },
  { icon: '👤', bg: 'oklch(0.94 0.04 320)',   dot: false, title: '14 new user accounts',            sub: 'Customer registrations this morning',      time: '2h ago'  },
  { icon: '💳', bg: 'oklch(0.94 0.04 75)',    dot: false, title: 'Payout processed',                sub: 'UGX 1.8M to 12 merchants',                 time: '5h ago'  },
  { icon: '🔒', bg: 'oklch(0.94 0.04 195)',   dot: false, title: 'Admin login from new IP',         sub: '196.0.2.44 · Uganda',                      time: '6h ago'  },
  { icon: '✅', bg: 'oklch(0.94 0.04 145)',   dot: false, title: 'System backup completed',         sub: 'Full DB snapshot · all data safe',         time: '12h ago' },
  { icon: '📊', bg: 'oklch(0.94 0.04 250)',   dot: false, title: 'Weekly report ready',             sub: 'Platform analytics for this week',         time: '1d ago'  },
]

function AdminNotificationsPanel() {
  const unread = ADMIN_NOTIFICATIONS.filter(n => n.dot).length

  return (
    <div>
      {/* Header summary */}
      <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
            {unread > 0 ? <><strong style={{ color: 'var(--foreground)' }}>{unread}</strong> unread</> : 'All caught up'}
          </span>
        </div>
        <button type="button" style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
          Mark all read
        </button>
      </div>

      {/* Alerts section */}
      <div>
        <p style={{ margin: 0, padding: '10px 20px 4px', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>
          Recent
        </p>
        {ADMIN_NOTIFICATIONS.map((n, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '12px 20px',
              borderBottom: '1px solid var(--border)',
              background: n.dot ? 'oklch(from var(--primary) l c h / 3%)' : 'transparent',
              transition: 'background 0.1s',
              cursor: 'default',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--muted)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = n.dot ? 'oklch(from var(--primary) l c h / 3%)' : 'transparent')}
          >
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: n.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              flexShrink: 0,
            }}>
              {n.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: n.dot ? 600 : 400, color: 'var(--foreground)', lineHeight: 1.35 }}>
                {n.title}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.4 }}>
                {n.sub}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>{n.time}</span>
              {n.dot && (
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--destructive)', display: 'block' }} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
