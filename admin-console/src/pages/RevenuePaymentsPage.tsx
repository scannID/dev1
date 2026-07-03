import { TrendingUp } from 'lucide-react'
import { Badge } from '../../../src/components/ui/badge'

const MONTHLY = [
  { month: 'Jan', revenue: 42, txns: 1820 },
  { month: 'Feb', revenue: 58, txns: 2340 },
  { month: 'Mar', revenue: 71, txns: 2910 },
  { month: 'Apr', revenue: 65, txns: 2680 },
  { month: 'May', revenue: 84, txns: 3420 },
  { month: 'Jun', revenue: 96, txns: 3890 },
]
const maxRev = Math.max(...MONTHLY.map((m) => m.revenue))

const TRANSACTIONS = [
  { id: 'TXN-8812', merchant: 'Kampala Grill',  amount: 'UGX 18,000', method: 'Mobile Money', status: 'Settled',  date: 'Today 14:22' },
  { id: 'TXN-8811', merchant: 'City Lounge',    amount: 'UGX 34,000', method: 'Card',         status: 'Settled',  date: 'Today 13:58' },
  { id: 'TXN-8810', merchant: 'Pearl Events',   amount: 'UGX 50,000', method: 'Mobile Money', status: 'Failed',   date: 'Today 12:41' },
  { id: 'TXN-8809', merchant: 'Nile Cafe',      amount: 'UGX 12,000', method: 'Cash',         status: 'Settled',  date: 'Today 11:30' },
  { id: 'TXN-8808', merchant: 'Garden Bistro',  amount: 'UGX 42,000', method: 'Mobile Money', status: 'Pending',  date: 'Today 10:15' },
]

const STATUS_STYLE: Record<string, string> = {
  Settled: 'bg-emerald-50 text-emerald-700',
  Failed:  'bg-red-50 text-red-600',
  Pending: 'bg-amber-50 text-amber-700',
}

export default function RevenuePaymentsPage() {
  return (
    <>
      <div className="admin-metric-grid">
        {[
          { label: 'Total Revenue (MTD)',   value: 'UGX 96M',  delta: '+14.2%' },
          { label: 'Transactions (MTD)',    value: '3,890',    delta: '+9.8%'  },
          { label: 'Failed Payments',       value: '47',       delta: '-12.3%' },
          { label: 'Avg Order Value',       value: 'UGX 24.7K',delta: '+3.1%'  },
        ].map((c) => (
          <div key={c.label} className="admin-metric-card">
            <span className="metric-label">{c.label}</span>
            <span className="metric-value">{c.value}</span>
            <span className="metric-delta up" style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 500, color: '#16a34a' }}>
              <TrendingUp size={10} />{c.delta}
            </span>
          </div>
        ))}
      </div>

      <div className="admin-two-col">
        {/* Revenue bar chart */}
        <div className="admin-card">
          <div className="admin-card-header"><div><h3>Monthly Revenue</h3><p>UGX millions</p></div></div>
          <div style={{ padding: '20px' }}>
            <div className="admin-bar-chart" style={{ height: 140 }}>
              {MONTHLY.map((m, i) => (
                <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{m.revenue}M</span>
                  <div
                    className={`bar ${i === MONTHLY.length - 1 ? 'accent' : ''}`}
                    style={{ width: '100%', height: `${(m.revenue / maxRev) * 100}%`, borderRadius: '4px 4px 0 0' }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 8 }}>
              {MONTHLY.map((m) => (
                <span key={m.month} style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{m.month}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Payment methods breakdown */}
        <div className="admin-card">
          <div className="admin-card-header"><div><h3>Payment Methods</h3><p>This month</p></div></div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { method: 'Mobile Money', pct: 64, color: 'var(--primary)' },
              { method: 'Card',         pct: 22, color: '#3b82f6'        },
              { method: 'Cash',         pct: 14, color: 'var(--muted-foreground)' },
            ].map((p) => (
              <div key={p.method}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                  <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>{p.method}</span>
                  <span style={{ color: 'var(--muted-foreground)' }}>{p.pct}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--muted)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${p.pct}%`, background: p.color, borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent transactions */}
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
              {TRANSACTIONS.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--muted)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--foreground)', fontWeight: 500 }}>{t.id}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--foreground)' }}>{t.merchant}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: 'var(--foreground)' }}>{t.amount}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)' }}>{t.method}</td>
                  <td style={{ padding: '10px 16px' }}><Badge variant="secondary" className={STATUS_STYLE[t.status]}>{t.status}</Badge></td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)' }}>{t.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
