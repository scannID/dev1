import { ArrowUpRight, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import MetricsHero from '../components/MetricsHero'
import { InlineSpinner } from '../components/LoadingSpinner'
import { PaginationBar } from '../components/PaginationBar'
import Sparkline from '../components/Sparkline'
import { usePagination } from '../hooks/usePagination'
import { useDashboard } from '../hooks/useDashboard'

function currency(amount: number) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0,
  }).format(amount)
}

function activityIcon(type: string) {
  if (type.includes('merchant')) return { icon: '🏪', bg: 'oklch(0.95 0.015 145)' }
  if (type.includes('order')) return { icon: '📦', bg: 'oklch(0.95 0.01 250)' }
  return { icon: '✅', bg: 'oklch(0.95 0.015 145)' }
}

export default function OverviewPage() {
  const { metrics, recentActivity, topMerchants, loading, error } = useDashboard()
  const merchantsPagination = usePagination(topMerchants, { initialPageSize: 20 })
  const activityPagination = usePagination(recentActivity, { initialPageSize: 20 })

  const displayMetrics = metrics
    ? [
        {
          label: 'Total Merchants',
          value: metrics.merchants.total.toString(),
          sub: `+${metrics.merchants.thisWeek} this week`,
          delta: metrics.merchants.change,
          up: !metrics.merchants.change.startsWith('-'),
          color: '#3b82f6',
          data: metrics.sparklines?.merchants?.length
            ? metrics.sparklines.merchants
            : [metrics.merchants.total],
        },
        {
          label: 'Orders Today',
          value: metrics.ordersToday.total.toLocaleString(),
          sub: 'across all merchants',
          delta: metrics.ordersToday.change,
          up: !metrics.ordersToday.change.startsWith('-'),
          color: '#10b981',
          data: metrics.sparklines?.ordersToday?.length
            ? metrics.sparklines.ordersToday
            : [metrics.ordersToday.total],
        },
        {
          label: 'QR Scans',
          value: metrics.qrScans.last24Hours.toLocaleString(),
          sub: 'last 24 hours',
          delta: metrics.qrScans.change,
          up: !metrics.qrScans.change.startsWith('-'),
          color: '#8b5cf6',
          data: metrics.sparklines?.qrScans?.length
            ? metrics.sparklines.qrScans
            : [metrics.qrScans.last24Hours],
        },
        {
          label: 'Platform Revenue',
          value: currency(metrics.revenue.thisMonth),
          sub: 'this month',
          delta: metrics.revenue.change,
          up: !metrics.revenue.change.startsWith('-'),
          color: '#f59e0b',
          data: metrics.sparklines?.revenue?.length
            ? metrics.sparklines.revenue.map(Number)
            : [metrics.revenue.thisMonth],
        },
      ]
    : []

  return (
    <>
      {error && (
        <div style={{ padding: '12px 16px', marginBottom: '16px', background: 'oklch(0.96 0.02 30 / 0.15)', border: '1px solid oklch(0.577 0.245 27.325 / 0.4)', borderRadius: '10px', color: 'oklch(0.577 0.245 27.325)', fontSize: '13px', fontWeight: '500' }}>
          Could not load dashboard: {error}
        </div>
      )}
      {loading && (
        <div className="admin-loading-banner">
          <InlineSpinner label="Loading live data…" />
        </div>
      )}

      <div className="admin-metric-grid">
        {displayMetrics.map((m) => (
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
        {!loading && !displayMetrics.length && !error && (
          <div className="admin-metric-card">
            <span className="metric-label">No metrics yet</span>
            <span className="metric-value">0</span>
          </div>
        )}
      </div>

      <div className="admin-two-col">
        <MetricsHero />

        <div className="admin-card">
          <div className="admin-card-header">
            <div><h3>Platform Activity</h3><p>Latest events across the system</p></div>
          </div>
          <ul className="admin-activity-list">
            {activityPagination.pageItems.length === 0 ? (
              <li>
                <div className="admin-activity-body">
                  <strong>No recent activity</strong>
                  <span>New merchants and orders will appear here</span>
                </div>
              </li>
            ) : (
              activityPagination.pageItems.map((a) => {
                const visual = activityIcon(a.type)
                return (
                  <li key={a.id}>
                    <div className="admin-activity-icon" style={{ background: visual.bg }}>{visual.icon}</div>
                    <div className="admin-activity-body">
                      <strong>{a.title}</strong>
                      <span>{a.description}</span>
                    </div>
                    <span className="admin-activity-time">
                      {new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </li>
                )
              })
            )}
          </ul>
          <PaginationBar pagination={activityPagination} hideWhenEmpty={false} />
        </div>
      </div>

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
              {merchantsPagination.pageItems.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '16px 20px', color: 'var(--muted-foreground)' }}>No merchant order activity yet.</td>
                </tr>
              ) : (
                merchantsPagination.pageItems.map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 20px', fontWeight: 500, color: 'var(--foreground)' }}>{m.name}</td>
                    <td style={{ padding: '10px 20px', color: 'var(--muted-foreground)' }}>{m.type}</td>
                    <td style={{ padding: '10px 20px', fontFamily: 'monospace', color: 'var(--foreground)' }}>{m.orders}</td>
                    <td style={{ padding: '10px 20px', fontFamily: 'monospace', color: 'var(--foreground)' }}>{currency(m.revenue)}</td>
                    <td style={{ padding: '10px 20px' }}>
                      <Badge variant="secondary" className={m.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}>
                        {m.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar pagination={merchantsPagination} hideWhenEmpty={false} />
      </div>
    </>
  )
}
