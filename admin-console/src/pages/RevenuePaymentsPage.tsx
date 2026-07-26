import { TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { InlineSpinner } from '../components/LoadingSpinner'
import { PaginationBar } from '../components/PaginationBar'
import { usePagination } from '../hooks/usePagination'
import { useRevenue } from '../hooks/usePlatform'

const STATUS_STYLE: Record<string, string> = {
  Settled: 'bg-emerald-50 text-emerald-700',
  Failed: 'bg-red-50 text-red-600',
  Pending: 'bg-amber-50 text-amber-700',
}

function currency(amount: number) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0,
  }).format(amount)
}

function pct(value: number) {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

export default function RevenuePaymentsPage() {
  const { overview, transactions, loading, error } = useRevenue()
  const monthly = overview?.monthly ?? []
  const txPagination = usePagination(transactions, { initialPageSize: 20 })
  const maxRev = Math.max(...monthly.map((m) => m.revenue), 1)
  const current = overview?.currentMonth

  return (
    <>
      {error && <div style={{ padding: '12px 16px', marginBottom: 16, color: 'crimson', fontSize: 13 }}>Could not load revenue: {error}</div>}
      {loading && (
        <div className="admin-loading-banner">
          <InlineSpinner label="Loading revenue…" />
        </div>
      )}

      <div className="admin-metric-grid">
        {[
          { label: 'Total Revenue (MTD)', value: currency(current?.revenue ?? 0), delta: current?.growth.revenue ?? 0 },
          { label: 'Merchant GMV (MoMo)', value: currency(current?.merchantGmv ?? 0), delta: current?.growth.revenue ?? 0 },
          { label: 'Kode fees', value: currency(current?.platformFees ?? 0), delta: current?.growth.revenue ?? 0 },
          { label: 'PSO fees', value: currency(current?.psoFees ?? 0), delta: current?.growth.revenue ?? 0 },
          { label: 'Transactions (MTD)', value: String(current?.transactions ?? 0), delta: current?.growth.transactions ?? 0 },
          { label: 'Failed Payments', value: String(current?.failedPayments ?? 0), delta: current?.growth.failedPayments ?? 0 },
          { label: 'Avg Order Value', value: currency(current?.avgOrderValue ?? 0), delta: current?.growth.avgOrderValue ?? 0 },
        ].map((c) => {
          const up = c.delta >= 0
          return (
            <div key={c.label} className="admin-metric-card">
              <span className="metric-label">{c.label}</span>
              <span className="metric-value">{c.value}</span>
              <span
                className={`metric-delta ${up ? 'up' : 'down'}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: 11,
                  fontWeight: 500,
                  color: up ? '#16a34a' : '#dc2626',
                }}
              >
                <TrendingUp size={10} style={{ transform: up ? undefined : 'rotate(180deg)' }} />
                {pct(c.delta)}
              </span>
            </div>
          )
        })}
      </div>

      <div className="admin-two-col">
        <div className="admin-card">
          <div className="admin-card-header"><div><h3>Monthly Revenue</h3><p>{current?.currency || 'UGX'}</p></div></div>
          <div style={{ padding: '20px' }}>
            {monthly.length === 0 ? (
              <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>No monthly revenue data yet.</p>
            ) : (
              <>
                <div className="admin-bar-chart" style={{ height: 140 }}>
                  {monthly.map((m, i) => (
                    <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{Math.round(m.revenue / 1000)}k</span>
                      <div
                        className={`bar ${i === monthly.length - 1 ? 'accent' : ''}`}
                        style={{ width: '100%', height: `${(m.revenue / maxRev) * 100}%`, borderRadius: '4px 4px 0 0' }}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 8 }}>
                  {monthly.map((m) => (
                    <span key={m.month} style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{m.month}</span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-header"><div><h3>Payment Methods</h3><p>This month</p></div></div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(overview?.paymentMethods ?? []).length === 0 ? (
              <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>No payment method breakdown yet.</p>
            ) : (
              overview!.paymentMethods.map((p) => (
                <div key={p.method}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                    <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>{p.method}</span>
                    <span style={{ color: 'var(--muted-foreground)' }}>{p.percentage.toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--muted)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${p.percentage}%`, background: 'var(--primary)', borderRadius: 4 }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header"><div><h3>Recent Transactions</h3></div></div>
        <div className="admin-table-wrap">
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['TXN ID', 'Merchant', 'Amount', 'Method', 'Status', 'Date'].map((h) => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {txPagination.pageItems.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 16, color: 'var(--muted-foreground)' }}>{loading ? <InlineSpinner label="Loading…" /> : 'No transactions yet.'}</td></tr>
              ) : txPagination.pageItems.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12, fontWeight: 500 }}>{t.id}</td>
                  <td style={{ padding: '10px 16px' }}>{t.merchant}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>{currency(t.amount)}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)' }}>{t.method}</td>
                  <td style={{ padding: '10px 16px' }}><Badge variant="secondary" className={STATUS_STYLE[t.status] ?? ''}>{t.status}</Badge></td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)' }}>
                    {new Date(t.date).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationBar pagination={txPagination} hideWhenEmpty={false} />
      </div>
    </>
  )
}
