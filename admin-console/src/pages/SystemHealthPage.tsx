import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

const SERVICES = [
  { name: 'API Gateway',        status: 'operational', uptime: '99.98%', latency: '42ms',  incidents: 0 },
  { name: 'Database (Primary)', status: 'operational', uptime: '99.99%', latency: '8ms',   incidents: 0 },
  { name: 'Database (Replica)', status: 'operational', uptime: '99.97%', latency: '12ms',  incidents: 0 },
  { name: 'QR Engine',          status: 'operational', uptime: '99.95%', latency: '18ms',  incidents: 0 },
  { name: 'Payment Gateway',    status: 'degraded',    uptime: '98.12%', latency: '340ms', incidents: 3 },
  { name: 'Notification Queue', status: 'operational', uptime: '99.90%', latency: '24ms',  incidents: 0 },
  { name: 'File Storage',       status: 'operational', uptime: '100%',   latency: '55ms',  incidents: 0 },
  { name: 'Auth Service',       status: 'operational', uptime: '99.99%', latency: '28ms',  incidents: 0 },
]

const INCIDENTS = [
  { id: 'INC-042', service: 'Payment Gateway', description: 'Elevated failure rate on MTN Mobile Money', severity: 'high',   status: 'investigating', time: '08:14 today' },
  { id: 'INC-041', service: 'Payment Gateway', description: 'Timeout on card processing endpoint',       severity: 'medium', status: 'monitoring',    time: '06:02 today' },
  { id: 'INC-040', service: 'API Gateway',     description: 'Brief latency spike (resolved)',            severity: 'low',    status: 'resolved',      time: 'Yesterday'   },
]

const S_STATUS: Record<string, string> = {
  operational: 'bg-emerald-50 text-emerald-700',
  degraded:    'bg-amber-50 text-amber-700',
  down:        'bg-red-50 text-red-600',
}
const S_SEV: Record<string, string> = {
  high:   'bg-red-50 text-red-600',
  medium: 'bg-amber-50 text-amber-700',
  low:    'bg-muted text-muted-foreground',
}

export default function SystemHealthPage() {
  return (
    <>
      <div className="admin-metric-grid">
        {[
          { label: 'Overall Uptime',    value: '99.84%', ok: true  },
          { label: 'Open Incidents',    value: '2',      ok: false },
          { label: 'Avg API Latency',   value: '42ms',   ok: true  },
          { label: 'Error Rate (24h)',  value: '0.16%',  ok: true  },
        ].map((c) => (
          <div key={c.label} className="admin-metric-card">
            <span className="metric-label">{c.label}</span>
            <span className="metric-value" style={{ color: c.ok ? 'var(--foreground)' : 'var(--destructive)' }}>{c.value}</span>
          </div>
        ))}
      </div>

      {/* Services table */}
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
              {SERVICES.map((s) => (
                <tr key={s.name} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`status-dot ${s.status === 'operational' ? 'green' : s.status === 'degraded' ? 'amber' : 'red'}`} />
                    {s.name}
                  </td>
                  <td style={{ padding: '10px 16px' }}><Badge variant="secondary" className={S_STATUS[s.status]}>{s.status}</Badge></td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: 'var(--foreground)' }}>{s.uptime}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: s.status === 'degraded' ? 'var(--destructive)' : 'var(--foreground)' }}>{s.latency}</td>
                  <td style={{ padding: '10px 16px', color: s.incidents > 0 ? 'var(--destructive)' : 'var(--muted-foreground)' }}>{s.incidents || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Incidents */}
      <div className="admin-card">
        <div className="admin-card-header"><div><h3>Incidents</h3><p>Recent and active</p></div></div>
        <ul className="admin-activity-list">
          {INCIDENTS.map((inc) => (
            <li key={inc.id}>
              <div className="admin-activity-icon" style={{ background: inc.severity === 'high' ? 'oklch(0.96 0.02 30)' : inc.severity === 'medium' ? 'oklch(0.96 0.04 75)' : 'var(--muted)' }}>
                {inc.status === 'resolved' ? <CheckCircle size={14} style={{ color: '#16a34a' }} /> : <AlertTriangle size={14} style={{ color: inc.severity === 'high' ? 'var(--destructive)' : '#d97706' }} />}
              </div>
              <div className="admin-activity-body">
                <strong>{inc.description}</strong>
                <span>{inc.service} · {inc.id}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                <Badge variant="secondary" className={S_SEV[inc.severity]}>{inc.severity}</Badge>
                <span className="admin-activity-time">{inc.time}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
