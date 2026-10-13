import { InlineSpinner } from '../components/LoadingSpinner'
import { PaginationBar } from '../components/PaginationBar'
import QRActivityChart from '../components/QRActivityChart'
import { usePagination } from '../hooks/usePagination'
import { useQrActivity } from '../hooks/usePlatform'

export default function QRActivityPage() {
  const { data, loading, error } = useQrActivity()
  const summary = data?.summary
  const hourly = data?.hourly ?? []
  const topCodes = data?.topCodes ?? []
  const codesPagination = usePagination(topCodes, { initialPageSize: 20 })

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
        <div className="admin-card-header">
          <div>
            <h3>QR Scans + Orders — Last 24 Hours</h3>
            <p>Track peaks to improve busy-hour performance</p>
          </div>
        </div>
        <div style={{ padding: '4px 20px 20px' }}>
          <QRActivityChart hourly={hourly} />
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
