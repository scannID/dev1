import { useEffect, useMemo, useState } from 'react'
import { Download, TrendingDown, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildReportData, filterOrdersByRange } from '../lib/orderAnalytics'
import type { Order } from '../api/types'

/* ─── Helpers ────────────────────────────────────────────────────────────── */

const FONT = "'Outfit Variable', ui-sans-serif, system-ui, sans-serif"

function ugx(amount: number) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0,
  }).format(amount)
}

function pct(value: number, decimals = 1) {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleString('en-UG', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function merchantPayoutOf(order: Order) {
  if (typeof order.merchantPayout === 'number' && order.merchantPayout > 0) return order.merchantPayout
  if (typeof order.subtotal === 'number' && order.subtotal > 0) return order.subtotal
  return order.total
}

/* ─── Mini sparkline ─────────────────────────────────────────────────────── */

function MiniSpark({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data)
  const range = max - min || 1
  const W = 80, H = 28, PAD = 3
  const pts: [number, number][] = data.map((v, i) => [
    (i / (data.length - 1)) * W,
    H - ((v - min) / range) * (H - PAD * 2) - PAD,
  ])
  let line = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 1; i < pts.length; i++) {
    const mx = (pts[i - 1][0] + pts[i][0]) / 2
    line += ` C${mx},${pts[i - 1][1]} ${mx},${pts[i][1]} ${pts[i][0]},${pts[i][1]}`
  }
  const last = pts[pts.length - 1], first = pts[0]
  const area = `${line} L${last[0]},${H} L${first[0]},${H} Z`
  const id = `sp-${color.replace(/[^a-z0-9]/gi, '')}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, height: H }} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ─── Export helpers ─────────────────────────────────────────────────────── */

function exportCSV(orders: Order[], rangeLabel: string) {
  const header = ['Order ID', 'Date', 'Customer', 'Items', 'Total', 'Revenue', 'COGS', 'Profit', 'Payment', 'Status']
  const rows = orders.map((o) => {
    const rev = merchantPayoutOf(o)
    const cogs = o.cogsTotal ?? 0
    return [
      o.id,
      new Date(o.createdAt).toISOString(),
      o.customer.name,
      o.items.map((i) => `${i.quantity}x ${i.name}`).join(' | '),
      o.total,
      rev,
      cogs,
      rev - cogs,
      o.paymentStatus,
      o.status,
    ]
  })
  const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sales-${rangeLabel.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/* ─── Types ──────────────────────────────────────────────────────────────── */

type Range = 'today' | 'week' | 'month' | 'all'

const RANGES: { key: Range; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Last 7 days' },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All time' },
]

/* ─── Metric card ────────────────────────────────────────────────────────── */

function MetricCard({
  label,
  value,
  sub,
  color,
  trend,
  up,
  spark,
}: {
  label: string
  value: string
  sub?: string
  color: string
  trend?: string
  up?: boolean
  spark?: number[]
}) {
  return (
    <div className="sales-metric-card">
      <div className="sales-metric-top">
        <span className="sales-metric-label">{label}</span>
        {trend !== undefined && (
          <span className="sales-metric-trend" style={{ color: up ? '#059669' : '#dc2626' }}>
            {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {trend}
          </span>
        )}
      </div>
      <strong className="sales-metric-value" style={{ color }}>{value}</strong>
      {sub ? <p className="sales-metric-sub">{sub}</p> : null}
      {spark ? <MiniSpark data={spark} color={color} /> : null}
    </div>
  )
}

/* ─── Main component ─────────────────────────────────────────────────────── */

export function SalesPage({
  orders,
  onRefresh,
}: {
  orders: Order[]
  onRefresh?: () => void
}) {
  // Default to "today" on open
  const [range, setRange] = useState<Range>('today')

  // Trigger a fresh orders fetch whenever the Sales page mounts
  useEffect(() => {
    onRefresh?.()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const d = useMemo(() => buildReportData(orders, range), [orders, range])
  const filtered = useMemo(() => filterOrdersByRange(orders, range), [orders, range])
  const paidOrders = filtered.filter((o) => o.paymentStatus === 'Paid')
  const cashOrders = paidOrders.filter((o) => o.paymentMethod === 'CASH')
  const momoOrders = paidOrders.filter((o) => o.paymentMethod !== 'CASH')
  const cashRevenue = cashOrders.reduce((s, o) => s + merchantPayoutOf(o), 0)
  const momoRevenue = momoOrders.reduce((s, o) => s + merchantPayoutOf(o), 0)
  const unpaidRevenue = filtered
    .filter((o) => o.paymentStatus === 'Unpaid')
    .reduce((s, o) => s + merchantPayoutOf(o), 0)

  const avgOrderValue = d.totalOrders > 0 ? d.totalRevenue / d.totalOrders : 0
  const completionRate = d.totalOrders > 0 ? (d.completedOrders / d.totalOrders) * 100 : 0

  const rangeLabel = RANGES.find((r) => r.key === range)?.label ?? range

  // Sort filtered orders newest first for the table
  const tableOrders = useMemo(
    () => [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [filtered],
  )

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: FONT }}>

      {/* ── Header row ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        {/* Range tabs */}
        <div className="range-tabs" aria-label="Sales range">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              className={range === r.key ? 'active' : ''}
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => exportCSV(filtered, rangeLabel)}
        >
          <Download size={13} />
          Export CSV
        </Button>
      </div>

      {/* ── KPI cards ── */}
      <div className="sales-metric-grid">
        <MetricCard
          label="Revenue"
          value={ugx(d.totalRevenue)}
          sub="Paid orders"
          color="#10b981"
          spark={d.revenueTrend}
        />
        <MetricCard
          label="COGS"
          value={ugx(d.totalCogs)}
          sub="Recipe cost"
          color="#b45309"
          spark={d.cogsTrend}
        />
        <MetricCard
          label="Gross Profit"
          value={ugx(d.grossProfit)}
          sub={`Margin ${d.marginPercent.toFixed(1)}%`}
          color={d.grossProfit >= 0 ? '#059669' : '#dc2626'}
          spark={d.profitTrend}
        />
        <MetricCard
          label="Orders"
          value={String(d.totalOrders)}
          sub="All statuses"
          color="#3b82f6"
          spark={d.ordersTrend}
        />
        <MetricCard
          label="Avg Order"
          value={ugx(avgOrderValue)}
          sub="Per paid order"
          color="#8b5cf6"
          spark={d.avgOrderTrend}
        />
        <MetricCard
          label="Completion"
          value={`${completionRate.toFixed(1)}%`}
          sub={`${d.completedOrders} completed`}
          color="#f59e0b"
          spark={d.completionTrend}
        />
        <MetricCard
          label="Cash"
          value={ugx(cashRevenue)}
          sub={`${cashOrders.length} orders`}
          color="#64748b"
        />
        <MetricCard
          label="MoMo"
          value={ugx(momoRevenue)}
          sub={`${momoOrders.length} orders`}
          color="#6366f1"
        />
        <MetricCard
          label="Unpaid"
          value={ugx(unpaidRevenue)}
          sub="Outstanding"
          color="#dc2626"
        />
      </div>

      {/* ── Two col: top items + payment breakdown ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Top selling items */}
        <div className="sales-card">
          <div className="sales-card-head">
            <h3>Top Items</h3>
            <span>{d.itemSales.length} items</span>
          </div>
          {d.itemSales.length === 0 ? (
            <p className="sales-empty">No paid sales in this range.</p>
          ) : (
            <table className="sales-table">
              <thead>
                <tr>
                  {['Item', 'Qty', 'Revenue', 'COGS', 'Profit'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.itemSales.map((row) => (
                  <tr key={row.name}>
                    <td style={{ fontWeight: 500 }}>{row.name}</td>
                    <td>{row.quantity}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{ugx(row.revenue)}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--muted-foreground)' }}>{ugx(row.cogs)}</td>
                    <td style={{
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 600,
                      color: row.profit >= 0 ? '#059669' : '#dc2626',
                    }}>
                      {ugx(row.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Payment & status breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Payment */}
          <div className="sales-card">
            <div className="sales-card-head"><h3>Payment Split</h3></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 16px' }}>
              {[
                { label: 'Paid', value: d.paymentBreakdown.Paid, color: '#10b981' },
                { label: 'Unpaid', value: d.paymentBreakdown.Unpaid, color: '#f59e0b' },
                { label: 'Refunded', value: d.paymentBreakdown.Refunded, color: '#64748b' },
              ].map(({ label, value, color }) => {
                const total = d.paymentBreakdown.Paid + d.paymentBreakdown.Unpaid + d.paymentBreakdown.Refunded || 1
                const pctVal = (value / total) * 100
                return (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12 }}>
                      <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>{label}</span>
                      <span style={{ color: 'var(--muted-foreground)' }}>{ugx(value)} · {pctVal.toFixed(0)}%</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--muted)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pctVal}%`, background: color, borderRadius: 4, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Order status */}
          <div className="sales-card">
            <div className="sales-card-head"><h3>Order Status</h3></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 16px' }}>
              {[
                { label: 'Completed', key: 'Completed' as const, color: '#10b981' },
                { label: 'Pending', key: 'Pending' as const, color: '#f59e0b' },
                { label: 'Preparing', key: 'Preparing' as const, color: '#3b82f6' },
                { label: 'Ready', key: 'Ready' as const, color: '#8b5cf6' },
                { label: 'Cancelled', key: 'Cancelled' as const, color: '#ef4444' },
              ].map(({ label, key, color }) => {
                const count = d.statusBreakdown[key]
                const total = d.totalOrders || 1
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ flex: 1, color: 'var(--foreground)' }}>{label}</span>
                    <span style={{ fontWeight: 600, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums', minWidth: 24, textAlign: 'right' }}>{count}</span>
                    <span style={{ color: 'var(--muted-foreground)', width: 40, textAlign: 'right' }}>{pct((count / total) * 100, 0)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Full order ledger ── */}
      <div className="sales-card" style={{ overflow: 'hidden' }}>
        <div className="sales-card-head">
          <h3>All Sales — {rangeLabel}</h3>
          <span>{filtered.length} orders</span>
        </div>
        {tableOrders.length === 0 ? (
          <p className="sales-empty">No orders in this range.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="sales-table sales-table--ledger">
              <thead>
                <tr>
                  {['ID', 'Date', 'Customer', 'Items', 'Total', 'Revenue', 'COGS', 'Profit', 'Payment', 'Status'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableOrders.map((order) => {
                  const rev = merchantPayoutOf(order)
                  const cogs = order.cogsTotal ?? 0
                  const profit = rev - cogs
                  return (
                    <tr key={order.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{order.id.slice(-6).toUpperCase()}</td>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--muted-foreground)' }}>{shortDate(order.createdAt)}</td>
                      <td style={{ fontWeight: 500 }}>{order.customer.name}</td>
                      <td style={{ color: 'var(--muted-foreground)', fontSize: 11 }}>
                        {order.items.slice(0, 2).map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                        {order.items.length > 2 ? ` +${order.items.length - 2}` : ''}
                      </td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{ugx(order.total)}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums', color: '#10b981' }}>{ugx(rev)}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--muted-foreground)' }}>{ugx(cogs)}</td>
                      <td style={{
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 600,
                        color: profit >= 0 ? '#059669' : '#dc2626',
                      }}>
                        {ugx(profit)}
                      </td>
                      <td>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
                          background: order.paymentStatus === 'Paid' ? 'oklch(0.97 0.04 145)' : order.paymentStatus === 'Refunded' ? 'var(--muted)' : 'oklch(0.97 0.06 75)',
                          color: order.paymentStatus === 'Paid' ? '#059669' : order.paymentStatus === 'Refunded' ? 'var(--muted-foreground)' : '#b45309',
                        }}>
                          {order.paymentStatus}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
                          background: order.status === 'Completed' ? 'oklch(0.97 0.04 145)' : order.status === 'Cancelled' ? 'oklch(0.97 0.04 30)' : 'oklch(0.96 0.03 250)',
                          color: order.status === 'Completed' ? '#059669' : order.status === 'Cancelled' ? '#dc2626' : '#3b82f6',
                        }}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
