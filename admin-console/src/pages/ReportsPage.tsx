const WEEKLY = [
  { week: 'W1', merchants: 128, orders: 7840, revenue: 62 },
  { week: 'W2', merchants: 131, orders: 8920, revenue: 74 },
  { week: 'W3', merchants: 135, orders: 9410, revenue: 81 },
  { week: 'W4', merchants: 142, orders: 10240, revenue: 96 },
]
const maxOrders = Math.max(...WEEKLY.map((w) => w.orders))

export default function ReportsPage() {
  return (
    <>
      <div className="admin-metric-grid cols-3">
        {[
          { label: 'Orders This Month',     value: '36,410' },
          { label: 'Revenue This Month',    value: 'UGX 313M' },
          { label: 'New Merchants (Month)', value: '14'      },
        ].map((c) => (
          <div key={c.label} className="admin-metric-card">
            <span className="metric-label">{c.label}</span>
            <span className="metric-value">{c.value}</span>
          </div>
        ))}
      </div>

      <div className="admin-two-col">
        {/* Weekly orders chart */}
        <div className="admin-card">
          <div className="admin-card-header"><div><h3>Weekly Orders</h3><p>This month</p></div></div>
          <div style={{ padding: '20px' }}>
            <div className="admin-bar-chart" style={{ height: 120 }}>
              {WEEKLY.map((w, i) => (
                <div key={w.week} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{(w.orders / 1000).toFixed(1)}k</span>
                  <div className={`bar ${i === WEEKLY.length - 1 ? 'accent' : ''}`}
                    style={{ width: '100%', height: `${(w.orders / maxOrders) * 100}%`, borderRadius: '4px 4px 0 0' }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 8 }}>
              {WEEKLY.map((w) => <span key={w.week} style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{w.week}</span>)}
            </div>
          </div>
        </div>

        {/* Growth summary */}
        <div className="admin-card">
          <div className="admin-card-header"><div><h3>Growth Summary</h3><p>Week over week</p></div></div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Order Growth',    value: '+8.8%',  up: true  },
              { label: 'Revenue Growth',  value: '+18.5%', up: true  },
              { label: 'New Merchants',   value: '+3',     up: true  },
              { label: 'Failed Payments', value: '-12.3%', up: false },
              { label: 'Avg Order Value', value: '+4.2%',  up: true  },
            ].map((item) => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                <span style={{ color: 'var(--muted-foreground)' }}>{item.label}</span>
                <span style={{ fontWeight: 600, color: item.up ? '#16a34a' : 'var(--destructive)' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Weekly table */}
      <div className="admin-card">
        <div className="admin-card-header"><div><h3>Weekly Breakdown</h3></div></div>
        <div className="admin-table-wrap">
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Week', 'Active Merchants', 'Orders', 'Revenue (UGX M)'].map((h) => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WEEKLY.map((w) => (
                <tr key={w.week} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--foreground)' }}>{w.week}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--foreground)' }}>{w.merchants}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: 'var(--foreground)' }}>{w.orders.toLocaleString()}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: 'var(--foreground)' }}>{w.revenue}M</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
