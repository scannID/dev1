import { InlineSpinner } from '../components/LoadingSpinner'
import { PaginationBar } from '../components/PaginationBar'
import Sparkline from '../components/Sparkline'
import { usePagination } from '../hooks/usePagination'
import { useQrActivity } from '../hooks/usePlatform'

export default function QRActivityPage() {
  const { data, loading, error } = useQrActivity()
  const summary = data?.summary
  const hourly = data?.hourly ?? []
  const topCodes = data?.topCodes ?? []
  const codesPagination = usePagination(topCodes, { initialPageSize: 20 })
  const hasActivity = hourly.some((h) => h.scans > 0 || h.orders > 0)
  const scanSeries = hourly.map((point) => point.scans)
  const orderSeries = hourly.map((point) => point.orders)
  const peakScans = hourly.reduce((best, point) => (point.scans > best.scans ? point : best), { hour: 0, scans: 0, orders: 0 })
  const peakOrders = hourly.reduce((best, point) => (point.orders > best.orders ? point : best), { hour: 0, scans: 0, orders: 0 })

  const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`

  return (
    <>
      {error && <div style={{ padding: '12px 16px', marginBottom: 16, color: 'crimson', fontSize: 13 }}>Could not load QR activity: {error}</div>}
      {loading && (
        <div className="admin-loading-banner">
          <InlineSpinner label="Loading QR activity…" />
        </div>
      )}

      <div className="admin-metric-grid">
        {[
          { label: 'Total Scans Today', value: (summary?.totalScansToday ?? 0).toLocaleString() },
          { label: 'Unique Devices', value: (summary?.uniqueDevices ?? 0).toLocaleString() },
          { label: 'Scan → Order Rate', value: `${summary?.conversionRate ?? 0}%` },
          { label: 'Active QR Codes', value: String(summary?.activeQrCodes ?? 0) },
        ].map((c) => (
          <div key={c.label} className="admin-metric-card">
            <span className="metric-label">{c.label}</span>
            <span className="metric-value">{c.value}</span>
          </div>
        ))}
      </div>

      <div className="admin-card">
        <div className="admin-card-header"><div><h3>QR Scans + Orders — Last 24 Hours</h3><p>Track peaks to improve busy-hour performance</p></div></div>
        <div style={{ padding: '20px' }}>
          {hasActivity ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, fontSize: 12, color: 'var(--muted-foreground)', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span className="status-dot" style={{ background: 'var(--primary)' }} />
                    Scans
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span className="status-dot" style={{ background: '#16a34a' }} />
                    Orders
                  </span>
                </div>
                <span>Peak scans: {hourLabel(peakScans.hour)} ({peakScans.scans})</span>
                <span>Peak orders: {hourLabel(peakOrders.hour)} ({peakOrders.orders})</span>
              </div>
              <div className="admin-monthly-chart" style={{ height: 130 }}>
                <Sparkline
                  data={scanSeries}
                  color="var(--primary)"
                  className="admin-sparkline admin-sparkline-overlay admin-sparkline-animated"
                  height={120}
                  strokeWidth={1.8}
                />
                <Sparkline
                  data={orderSeries}
                  color="#16a34a"
                  className="admin-sparkline admin-sparkline-overlay admin-sparkline-animated admin-sparkline-secondary"
                  height={120}
                  strokeWidth={1.6}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: 'var(--muted-foreground)' }}>
                <span>12am</span><span>4am</span><span>8am</span><span>12pm</span><span>4pm</span><span>8pm</span><span>11pm</span>
              </div>
            </>
          ) : (
            <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>No scans or orders recorded today yet.</p>
          )}
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header"><div><h3>Top QR Codes by Scans</h3><p>Estimated from order activity</p></div></div>
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
              {codesPagination.pageItems.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 16, color: 'var(--muted-foreground)' }}>{loading ? <InlineSpinner label="Loading…" /> : 'No QR codes yet.'}</td></tr>
              ) : codesPagination.pageItems.map((q) => (
                <tr key={q.token} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 500 }}>{q.merchant}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--muted-foreground)' }}>{q.token}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>{q.scans.toLocaleString()}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>{q.orders}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--primary)', fontWeight: 500 }}>{q.conversion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationBar pagination={codesPagination} hideWhenEmpty={false} />
      </div>
    </>
  )
}
