import { useState } from 'react'
import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useOrders } from '../hooks/useOrders'

const ORDERS = Array.from({ length: 20 }, (_, i) => ({
  id: `ORD-${String(3800 + i).padStart(5, '0')}`,
  merchant: ['Kampala Grill', 'City Lounge', 'Nile Cafe', 'Garden Bistro', 'Pearl Events'][i % 5],
  customer: ['Amina N.', 'Brian K.', 'Clara M.', 'David R.', 'Eve S.'][i % 5],
  items: (i % 3) + 1,
  total: `UGX ${((i + 1) * 12500).toLocaleString()}`,
  payment: ['Paid', 'Unpaid', 'Paid', 'Paid', 'Refunded'][i % 5],
  status: ['Completed', 'Pending', 'Preparing', 'Ready', 'Cancelled'][i % 5],
  time: `${String(8 + (i % 12)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}`,
}))

const S_STATUS: Record<string, string> = {
  Completed: 'bg-muted text-muted-foreground',
  Pending:   'bg-amber-50 text-amber-700',
  Preparing: 'bg-blue-50 text-blue-700',
  Ready:     'bg-emerald-50 text-emerald-700',
  Cancelled: 'bg-red-50 text-red-600',
}
const S_PAY: Record<string, string> = {
  Paid:     'bg-emerald-50 text-emerald-700',
  Unpaid:   'bg-red-50 text-red-600',
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
  const { orders, loading, error } = useOrders()
  const [q, setQ] = useState('')

  // Use API data if available, fallback to static data
  const displayOrders = orders.length > 0 ? orders.map(o => ({
    id: o.id,
    merchant: o.businessName,
    customer: o.customerName,
    items: o.items.length,
    total: currency(o.total),
    payment: o.paymentStatus,
    status: o.status,
    time: new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  })) : ORDERS

  const filtered = displayOrders.filter((o) =>
    [o.id, o.merchant, o.customer].join(' ').toLowerCase().includes(q.toLowerCase())
  )

  const totalToday = displayOrders.length
  const completed = displayOrders.filter(o => o.status === 'Completed').length
  const pending = displayOrders.filter(o => o.status === 'Pending' || o.status === 'Preparing' || o.status === 'Ready').length
  const cancelled = displayOrders.filter(o => o.status === 'Cancelled').length

  return (
    <>
      {/* Show error/loading banner if needed */}
      {error && (
        <div style={{ padding: '12px 16px', marginBottom: '16px', background: 'oklch(0.96 0.02 30 / 0.15)', border: '1px solid oklch(0.577 0.245 27.325 / 0.4)', borderRadius: '10px', color: 'oklch(0.577 0.245 27.325)', fontSize: '13px', fontWeight: '500' }}>
          ⚠️ Could not load live data. Showing fallback data.
        </div>
      )}
      {loading && (
        <div style={{ padding: '12px 16px', marginBottom: '16px', background: 'oklch(0.95 0.01 250 / 0.15)', border: '1px solid oklch(0.60 0.15 250 / 0.4)', borderRadius: '10px', color: 'oklch(0.50 0.15 250)', fontSize: '13px', fontWeight: '500' }}>
          🔄 Loading live data...
        </div>
      )}
      <div className="admin-metric-grid">
        {[
          { label: 'Total Orders Today', value: totalToday.toLocaleString() },
          { label: 'Completed',          value: completed.toLocaleString() },
          { label: 'Pending / Active',   value: pending.toLocaleString()   },
          { label: 'Cancelled',          value: cancelled.toLocaleString()   },
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
              {filtered.map((o) => (
                <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--muted)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--foreground)', fontWeight: 500 }}>{o.id}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--foreground)' }}>{o.merchant}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)' }}>{o.customer}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)' }}>{o.items}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: 'var(--foreground)' }}>{o.total}</td>
                  <td style={{ padding: '10px 16px' }}><Badge variant="secondary" className={S_PAY[o.payment]}>{o.payment}</Badge></td>
                  <td style={{ padding: '10px 16px' }}><Badge variant="secondary" className={S_STATUS[o.status]}>{o.status}</Badge></td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)' }}>{o.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
