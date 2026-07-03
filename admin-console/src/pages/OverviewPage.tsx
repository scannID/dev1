import { ArrowUpRight, Building2, QrCode, ShoppingCart, TrendingUp, Users, DollarSign, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { Badge } from '../../../src/components/ui/badge'
import MetricsHero from '../components/MetricsHero'

function Sparkline({ data, color = 'var(--primary)' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const w = 100, h = 40
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 6) - 3}`)
  const area = `M${pts.join('L')}L${w},${h}L0,${h}Z`
  const line = `M${pts.join('L')}`
  const id = `sg-${color.replace(/[^a-z0-9]/gi, '')}`
  return (
    <svg className="admin-sparkline" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const METRICS = [
  { label: 'Total Merchants',   value: '142',      sub: '+3 this week',  delta: '+2.2%',  up: true,  color: '#3b82f6', data: [110,118,124,128,133,138,142] },
  { label: 'Orders Today',      value: '1,847',    sub: 'across all merchants', delta: '+14.3%', up: true,  color: '#10b981', data: [1200,1340,1180,1560,1420,1690,1847] },
  { label: 'Active QR Scans',   value: '8,304',    sub: 'last 24 hours', delta: '+8.1%',  up: true,  color: '#8b5cf6', data: [6100,6800,7200,6900,7600,8000,8304] },
  { label: 'Platform Revenue',  value: 'UGX 4.2M', sub: 'this month',    delta: '+19.4%', up: true,  color: '#f59e0b', data: [2.1,2.4,2.8,3.1,3.5,3.9,4.2] },
]

const RECENT_ACTIVITY = [
  { icon: '🏪', bg: 'oklch(0.95 0.015 145)', title: 'New merchant registered',     sub: 'Kampala Grill · just now',       time: 'now' },
  { icon: '📦', bg: 'oklch(0.95 0.01 250)',  title: '284 orders placed',            sub: 'across 38 merchants · today',    time: '2m'  },
  { icon: '⚠️', bg: 'oklch(0.96 0.02 30)',   title: 'Payment failure spike',        sub: 'Merchant MER-004 · 3 failed',    time: '8m'  },
  { icon: '📱', bg: 'oklch(0.95 0.015 280)', title: 'QR scan milestone',            sub: '10k scans this week · platform', time: '1h'  },
  { icon: '✅', bg: 'oklch(0.95 0.015 145)', title: 'System backup completed',      sub: 'All data safe · automated',      time: '2h'  },
  { icon: '👤', bg: 'oklch(0.95 0.01 250)',  title: '14 new user accounts',         sub: 'Customer registrations',         time: '3h'  },
  { icon: '💳', bg: 'oklch(0.95 0.015 75)',  title: 'Payout processed',             sub: 'UGX 1.8M to 12 merchants',       time: '5h'  },
]

const TOP_MERCHANTS = [
  { name: 'Kampala Grill',    type: 'Restaurant', orders: 312, revenue: 'UGX 5.6M', status: 'active' },
  { name: 'City Lounge',      type: 'Bar',        orders: 278, revenue: 'UGX 4.1M', status: 'active' },
  { name: 'Nile Cafe',        type: 'Restaurant', orders: 241, revenue: 'UGX 3.8M', status: 'active' },
  { name: 'Pearl Events',     type: 'Events',     orders: 198, revenue: 'UGX 3.2M', status: 'active' },
  { name: 'Garden Bistro',    type: 'Restaurant', orders: 167, revenue: 'UGX 2.9M', status: 'warning'},
]

const ORDERS_BY_HOUR = [480,620,540,780,920,1040,1120,980,840,760,680,540]

export default function OverviewPage() {
  return (
    <>
      {/* Metric cards */}
      <div className="admin-metric-grid">
        {METRICS.map((m) => (
          <div key={m.label} className="admin-metric-card">
            <span className="metric-label">{m.label}</span>
            <span className="metric-value">{m.value}</span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="metric-sub">{m.sub}</span>
              <span className={`metric-delta ${m.up ? 'up' : 'down'}`}>
                <TrendingUp size={10} />
                {m.delta}
              </span>
            </div>
            <Sparkline data={m.data} color={m.color} />
          </div>
        ))}
      </div>

      {/* Platform status strip */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          { label: 'API', status: 'Operational', dot: 'green' },
          { label: 'Database', status: 'Operational', dot: 'green' },
          { label: 'QR Engine', status: 'Operational', dot: 'green' },
          { label: 'Payments', status: 'Degraded', dot: 'amber' },
          { label: 'Notifications', status: 'Operational', dot: 'green' },
        ].map((s) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}>
            <span className={`status-dot ${s.dot}`} />
            <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{s.label}</span>
            <span style={{ color: 'var(--muted-foreground)' }}>{s.status}</span>
          </div>
        ))}
      </div>

      <div className="admin-two-col">
        {/* MetricsHero — replaces orders-by-hour chart */}
        <MetricsHero />

        {/* Recent activity */}
        <div className="admin-card">
          <div className="admin-card-header">
            <div><h3>Platform Activity</h3><p>Latest events across the system</p></div>
          </div>
          <ul className="admin-activity-list">
            {RECENT_ACTIVITY.map((a, i) => (
              <li key={i}>
                <div className="admin-activity-icon" style={{ background: a.bg }}>{a.icon}</div>
                <div className="admin-activity-body">
                  <strong>{a.title}</strong>
                  <span>{a.sub}</span>
                </div>
                <span className="admin-activity-time">{a.time}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Top merchants */}
      <div className="admin-card">
        <div className="admin-card-header">
          <div><h3>Top Merchants by Orders</h3><p>This month</p></div>
          <button type="button" style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            View all <ArrowUpRight size={12} />
          </button>
        </div>
        <div className="admin-table-wrap">
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Merchant', 'Type', 'Orders', 'Revenue', 'Status'].map((h) => (
                  <th key={h} style={{ padding: '8px 20px', textAlign: 'left', fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TOP_MERCHANTS.map((m) => (
                <tr key={m.name} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 20px', fontWeight: 500, color: 'var(--foreground)' }}>{m.name}</td>
                  <td style={{ padding: '10px 20px', color: 'var(--muted-foreground)' }}>{m.type}</td>
                  <td style={{ padding: '10px 20px', fontFamily: 'monospace', color: 'var(--foreground)' }}>{m.orders}</td>
                  <td style={{ padding: '10px 20px', fontFamily: 'monospace', color: 'var(--foreground)' }}>{m.revenue}</td>
                  <td style={{ padding: '10px 20px' }}>
                    <Badge variant="secondary" className={m.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}>
                      {m.status === 'active' ? 'Active' : 'Warning'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
