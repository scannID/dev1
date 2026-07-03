const HOURLY_SCANS = [320, 480, 620, 540, 780, 920, 1040, 1120, 980, 840, 760, 540, 480, 560, 640, 720, 880, 960, 1040, 920, 800, 680, 560, 420]
const maxScans = Math.max(...HOURLY_SCANS)

const TOP_QR = [
  { merchant: 'Kampala Grill',  token: 'SIT-KGL-1001', scans: 1842, orders: 312, conversion: '16.9%' },
  { merchant: 'City Lounge',    token: 'SIT-CLG-1002', scans: 1540, orders: 278, conversion: '18.1%' },
  { merchant: 'Nile Cafe',      token: 'SIT-NLC-1003', scans: 1210, orders: 241, conversion: '19.9%' },
  { merchant: 'Pearl Events',   token: 'SIT-PEV-1004', scans: 980,  orders: 198, conversion: '20.2%' },
  { merchant: 'Garden Bistro',  token: 'SIT-GBR-1005', scans: 820,  orders: 167, conversion: '20.4%' },
]

export default function QRActivityPage() {
  return (
    <>
      <div className="admin-metric-grid">
        {[
          { label: 'Total Scans Today',     value: '18,304' },
          { label: 'Unique Devices',         value: '12,841' },
          { label: 'Scan → Order Rate',      value: '18.4%'  },
          { label: 'Active QR Codes',        value: '142'    },
        ].map((c) => (
          <div key={c.label} className="admin-metric-card">
            <span className="metric-label">{c.label}</span>
            <span className="metric-value">{c.value}</span>
          </div>
        ))}
      </div>

      {/* 24h scan chart */}
      <div className="admin-card">
        <div className="admin-card-header"><div><h3>QR Scans — Last 24 Hours</h3><p>Platform-wide scan volume</p></div></div>
        <div style={{ padding: '20px' }}>
          <div className="admin-bar-chart" style={{ height: 160 }}>
            {HOURLY_SCANS.map((v, i) => (
              <div
                key={i}
                className={`bar ${i >= 20 ? 'accent' : ''}`}
                style={{ height: `${(v / maxScans) * 100}%` }}
                title={`${v} scans`}
              />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: 'var(--muted-foreground)' }}>
            <span>12am</span><span>4am</span><span>8am</span><span>12pm</span><span>4pm</span><span>8pm</span><span>11pm</span>
          </div>
        </div>
      </div>

      {/* Top QR codes */}
      <div className="admin-card">
        <div className="admin-card-header"><div><h3>Top QR Codes by Scans</h3><p>Today</p></div></div>
        <div className="admin-table-wrap">
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Merchant', 'QR Token', 'Scans', 'Orders', 'Conversion'].map((h) => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TOP_QR.map((q) => (
                <tr key={q.token} style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--muted)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--foreground)' }}>{q.merchant}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--muted-foreground)' }}>{q.token}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: 'var(--foreground)' }}>{q.scans.toLocaleString()}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: 'var(--foreground)' }}>{q.orders}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--primary)', fontWeight: 500 }}>{q.conversion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
