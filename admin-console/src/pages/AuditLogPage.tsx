import { Badge } from '../../../src/components/ui/badge'

const LOGS = [
  { actor: 'admin@scanny.app', action: 'SUSPEND_MERCHANT',   target: 'MER-006 · Sky Bar',         ip: '196.0.2.1',  time: '14:32:01' },
  { actor: 'admin@scanny.app', action: 'UPDATE_PLAN',        target: 'MER-003 → Pro',             ip: '196.0.2.1',  time: '13:44:18' },
  { actor: 'system',           action: 'AUTO_BACKUP',        target: 'Full DB snapshot',          ip: '10.0.0.1',   time: '12:00:00' },
  { actor: 'james@grill.co',   action: 'ADD_CATALOG_ITEM',   target: 'Beef Plate · MER-001',      ip: '41.210.4.8', time: '11:28:44' },
  { actor: 'admin@scanny.app', action: 'RESET_PASSWORD',     target: 'grace@pearl.co',            ip: '196.0.2.1',  time: '10:55:30' },
  { actor: 'aisha@lounge.co',  action: 'UPDATE_BUSINESS',    target: 'City Lounge name change',   ip: '41.210.5.2', time: '09:40:12' },
  { actor: 'system',           action: 'PAYMENT_RETRY',      target: 'TXN-8810 · 3rd attempt',   ip: '10.0.0.2',   time: '08:22:07' },
  { actor: 'admin@scanny.app', action: 'VIEW_AUDIT_LOG',     target: 'Full log export',           ip: '196.0.2.1',  time: '08:01:55' },
]

const ACTION_STYLE: Record<string, string> = {
  SUSPEND_MERCHANT: 'bg-red-50 text-red-600',
  UPDATE_PLAN:      'bg-blue-50 text-blue-700',
  AUTO_BACKUP:      'bg-muted text-muted-foreground',
  ADD_CATALOG_ITEM: 'bg-emerald-50 text-emerald-700',
  RESET_PASSWORD:   'bg-amber-50 text-amber-700',
  UPDATE_BUSINESS:  'bg-blue-50 text-blue-700',
  PAYMENT_RETRY:    'bg-amber-50 text-amber-700',
  VIEW_AUDIT_LOG:   'bg-muted text-muted-foreground',
}

export default function AuditLogPage() {
  return (
    <>
      <div className="admin-metric-grid cols-3">
        {[
          { label: 'Events Today',    value: '284'  },
          { label: 'Admin Actions',   value: '42'   },
          { label: 'System Events',   value: '138'  },
        ].map((c) => (
          <div key={c.label} className="admin-metric-card">
            <span className="metric-label">{c.label}</span>
            <span className="metric-value">{c.value}</span>
          </div>
        ))}
      </div>

      <div className="admin-card">
        <div className="admin-card-header"><div><h3>Audit Log</h3><p>All platform actions — today</p></div></div>
        <div className="admin-table-wrap">
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Actor', 'Action', 'Target', 'IP', 'Time'].map((h) => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LOGS.map((log, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--muted)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--foreground)' }}>{log.actor}</td>
                  <td style={{ padding: '10px 16px' }}><Badge variant="secondary" className={ACTION_STYLE[log.action] ?? ''}>{log.action}</Badge></td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.target}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--muted-foreground)' }}>{log.ip}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--muted-foreground)' }}>{log.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
