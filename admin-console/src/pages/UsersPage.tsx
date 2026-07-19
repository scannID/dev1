import { Badge } from '@/components/ui/badge'
import { useUsers } from '../hooks/usePlatform'

const ROLE_STYLE: Record<string, string> = {
  Admin: 'bg-primary/10 text-primary',
  Merchant: 'bg-blue-50 text-blue-700',
  Customer: 'bg-muted text-muted-foreground',
}
const STATUS_STYLE: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  suspended: 'bg-red-50 text-red-600',
  pending: 'bg-muted text-muted-foreground',
}

export default function UsersPage() {
  const { data, loading, error } = useUsers()
  const users = data?.users ?? []
  const summary = data?.summary

  return (
    <>
      {error && <div style={{ padding: '12px 16px', marginBottom: 16, color: 'crimson', fontSize: 13 }}>Could not load users: {error}</div>}
      {loading && <div style={{ padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>Loading users…</div>}

      <div className="admin-metric-grid">
        {[
          { label: 'Total Users', value: String(summary?.total ?? 0) },
          { label: 'Customers', value: String(summary?.customers ?? 0) },
          { label: 'Merchants', value: String(summary?.merchants ?? 0) },
          { label: 'Admins', value: String(summary?.admins ?? 0) },
        ].map((c) => (
          <div key={c.label} className="admin-metric-card">
            <span className="metric-label">{c.label}</span>
            <span className="metric-value">{c.value}</span>
          </div>
        ))}
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <div><h3>All Users</h3><p>Platform accounts across all roles</p></div>
        </div>
        <div className="admin-table-wrap">
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Name', 'Email', 'Role', 'Orders', 'Joined', 'Status'].map((h) => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 16, color: 'var(--muted-foreground)' }}>{loading ? 'Loading…' : 'No users found.'}</td></tr>
              ) : users.map((u) => {
                const status = (u.status || 'active').toLowerCase()
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 500 }}>{u.name}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)' }}>{u.email}</td>
                    <td style={{ padding: '10px 16px' }}><Badge variant="secondary" className={ROLE_STYLE[u.role] ?? ''}>{u.role}</Badge></td>
                    <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)' }}>{u.orders || '—'}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)' }}>
                      {new Date(u.joinedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <Badge variant="secondary" className={STATUS_STYLE[status] ?? STATUS_STYLE.active}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
