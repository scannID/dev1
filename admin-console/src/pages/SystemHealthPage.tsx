import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CheckCircle } from 'lucide-react'
import { InlineSpinner } from '../components/LoadingSpinner'
import { useSystemHealth } from '../hooks/usePlatform'

const S_STATUS: Record<string, string> = {
  operational: 'bg-emerald-50 text-emerald-700',
  degraded: 'bg-amber-50 text-amber-700',
  down: 'bg-red-50 text-red-600',
}

export default function SystemHealthPage() {
  const { data, loading, error } = useSystemHealth()
  const services = data?.services ?? []
  const overall = data?.overall

  return (
    <>
      {error && <div style={{ padding: '12px 16px', marginBottom: 16, color: 'crimson', fontSize: 13 }}>Could not load health: {error}</div>}
      {loading && (
        <div className="admin-loading-banner">
          <InlineSpinner label="Checking services…" />
        </div>
      )}

      <div className="admin-metric-grid">
        {[
          { label: 'Overall Uptime', value: overall?.uptime ?? '—', ok: true },
          { label: 'Open Incidents', value: String(overall?.openIncidents ?? 0), ok: (overall?.openIncidents ?? 0) === 0 },
          { label: 'Avg API Latency', value: overall ? `${overall.avgLatency}ms` : '—', ok: true },
          { label: 'Error Rate (24h)', value: overall ? `${overall.errorRate}%` : '—', ok: true },
        ].map((c) => (
          <div key={c.label} className="admin-metric-card">
            <span className="metric-label">{c.label}</span>
            <span className="metric-value" style={{ color: c.ok ? 'var(--foreground)' : 'var(--destructive)' }}>{c.value}</span>
          </div>
        ))}
      </div>

      <div className="admin-card">
        <div className="admin-card-header"><div><h3>Service Status</h3><p>All platform services</p></div></div>
        <div className="admin-table-wrap">
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Service', 'Status', 'Uptime', 'Latency', 'Incidents'].map((h) => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {services.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 16, color: 'var(--muted-foreground)' }}>{loading ? <InlineSpinner label="Loading…" /> : 'No service data.'}</td></tr>
              ) : services.map((s) => (
                <tr key={s.name} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--foreground)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span className={`status-dot ${s.status === 'operational' ? 'green' : s.status === 'degraded' ? 'amber' : 'red'}`} />
                      {s.name}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px' }}><Badge variant="secondary" className={S_STATUS[s.status] ?? ''}>{s.status}</Badge></td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>{s.uptime}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>{s.latency != null ? `${s.latency}${s.unit || 'ms'}` : '—'}</td>
                  <td style={{ padding: '10px 16px', color: (s.incidents ?? 0) > 0 ? 'var(--destructive)' : 'var(--muted-foreground)' }}>{s.incidents || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header"><div><h3>Incidents</h3><p>Derived from current service health</p></div></div>
        <ul className="admin-activity-list">
          {services.filter((s) => s.status !== 'operational').length === 0 ? (
            <li>
              <div className="admin-activity-icon" style={{ background: 'oklch(0.95 0.015 145)' }}>
                <CheckCircle size={14} style={{ color: '#16a34a' }} />
              </div>
              <div className="admin-activity-body">
                <strong>All services operational</strong>
                <span>No open incidents</span>
              </div>
            </li>
          ) : (
            services.filter((s) => s.status !== 'operational').map((s) => (
              <li key={s.name}>
                <div className="admin-activity-icon" style={{ background: 'oklch(0.96 0.02 30)' }}>
                  <AlertTriangle size={14} style={{ color: 'var(--destructive)' }} />
                </div>
                <div className="admin-activity-body">
                  <strong>{s.name} is {s.status}</strong>
                  <span>Latency {s.latency ?? '—'}{s.unit || 'ms'}</span>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </>
  )
}
