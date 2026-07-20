import { useState } from 'react'
import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { InlineSpinner } from '../components/LoadingSpinner'
import { useOrders } from '../hooks/useOrders'

const S_STATUS: Record<string, string> = {
  Completed: 'bg-muted text-muted-foreground',
  Pending: 'bg-amber-50 text-amber-700',
  Preparing: 'bg-blue-50 text-blue-700',
  Ready: 'bg-emerald-50 text-emerald-700',
  Cancelled: 'bg-red-50 text-red-600',
}
const S_PAY: Record<string, string> = {
  Paid: 'bg-emerald-50 text-emerald-700',
  Unpaid: 'bg-red-50 text-red-600',
  Refunded: 'bg-muted text-muted-foreground',
}

function currency(amount: number) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function OrdersPage() {
  const { orders, summary, loading, error } = useOrders()
  const [q, setQ] = useState('')

  const displayOrders = orders.map((o) => ({
    id: o.id,
    merchant: o.merchantName,
    customer: o.customerName,
    items: o.items,
    total: currency(o.total),
    payment: String(o.paymentStatus),
    status: String(o.status),
    time: new Date(o.createdAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
  }))

  const filtered = displayOrders.filter((o) =>
    [o.id, o.merchant, o.customer].join(' ').toLowerCase().includes(q.toLowerCase())
  )

  return (
    <>
      {error && (
        <div style={{ padding: '12px 16px', marginBottom: '16px', background: 'oklch(0.96 0.02 30 / 0.15)', border: '1px solid oklch(0.577 0.245 27.325 / 0.4)', borderRadius: '10px', color: 'oklch(0.577 0.245 27.325)', fontSize: '13px', fontWeight: '500' }}>
          Could not load orders: {error}
        </div>
      )}
      {loading && (
        <div className="admin-loading-banner">
          <InlineSpinner label="Loading orders…" />
        </div>
      )}

      <div className="admin-metric-grid">
        {[
          { label: 'Total Orders Today', value: (summary?.today ?? 0).toLocaleString() },
          { label: 'Completed', value: (summary?.completed ?? 0).toLocaleString() },
          { label: 'Pending / Active', value: (summary?.pending ?? 0).toLocaleString() },
          { label: 'Cancelled', value: (summary?.cancelled ?? 0).toLocaleString() },
        ].map((c) => (
          <div key={c.label} className="admin-metric-card">
            <span className="metric-label">{c.label}</span>
            <span className="metric-value">{c.value}</span>
          </div>
        ))}
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <div><h3>All Orders</h3><p>Platform-wide order feed</p></div>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search orders…" className="h-8 pl-8 w-56 text-sm" />
          </div>
        </div>
        <div className="admin-table-wrap">
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Order', 'Merchant', 'Customer', 'Items', 'Total', 'Payment', 'Status', 'Time'].map((h) => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '16px', color: 'var(--muted-foreground)' }}>
                    {loading ? <InlineSpinner label="Loading…" /> : 'No orders found.'}
                  </td>
                </tr>
              ) : (
                filtered.map((o) => (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--muted)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--foreground)', fontWeight: 500 }}>{o.id}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--foreground)' }}>{o.merchant}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)' }}>{o.customer}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)' }}>{o.items}</td>
                    <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: 'var(--foreground)' }}>{o.total}</td>
                    <td style={{ padding: '10px 16px' }}><Badge variant="secondary" className={S_PAY[o.payment] ?? ''}>{o.payment}</Badge></td>
                    <td style={{ padding: '10px 16px' }}><Badge variant="secondary" className={S_STATUS[o.status] ?? ''}>{o.status}</Badge></td>
                    <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)' }}>{o.time}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
