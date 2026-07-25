import { InlineSpinner } from '../components/LoadingSpinner'
import { PaginationBar } from '../components/PaginationBar'
import { usePagination } from '../hooks/usePagination'
import { useQrActivity } from '../hooks/usePlatform'

export default function QRActivityPage() {
  const { data, loading, error } = useQrActivity()
  const summary = data?.summary
  const hourly = data?.hourly ?? []
  const topCodes = data?.topCodes ?? []
  const codesPagination = usePagination(topCodes, { initialPageSize: 20 })
  const maxScans = Math.max(...hourly.map((h) => h.scans), 1)

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
        <div className="admin-card-header"><div><h3>QR Scans — Last 24 Hours</h3><p>Platform-wide scan volume</p></div></div>
        <div style={{ padding: '20px' }}>
          {hourly.every((h) => h.scans === 0) ? (
            <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>No scans recorded today yet.</p>
          ) : (
            <>
              <div className="admin-bar-chart" style={{ height: 160 }}>
                {hourly.map((point) => (
                  <div
                    key={point.hour}
                    className={`bar ${point.hour >= 20 ? 'accent' : ''}`}
                    style={{ height: `${(point.scans / maxScans) * 100}%` }}
                    title={`${point.scans} scans at ${point.hour}:00`}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: 'var(--muted-foreground)' }}>
                <span>12am</span><span>4am</span><span>8am</span><span>12pm</span><span>4pm</span><span>8pm</span><span>11pm</span>
              </div>
            </>
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
