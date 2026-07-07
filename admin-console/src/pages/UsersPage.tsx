import { Badge } from '@/components/ui/badge'

const USERS = [
  { name: 'Amina Nakato',    email: 'amina@mail.com',   role: 'Customer',  orders: 14, joined: '2 Jan 2024',  status: 'active'   },
  { name: 'Brian Kato',      email: 'brian@mail.com',   role: 'Customer',  orders: 9,  joined: '14 Jan 2024', status: 'active'   },
  { name: 'James Okello',    email: 'james@grill.co',   role: 'Merchant',  orders: 0,  joined: '12 Jan 2024', status: 'active'   },
  { name: 'Grace Nambi',     email: 'grace@pearl.co',   role: 'Merchant',  orders: 0,  joined: '5 Mar 2024',  status: 'warning'  },
  { name: 'Clara Mugisha',   email: 'clara@mail.com',   role: 'Customer',  orders: 22, joined: '20 Feb 2024', status: 'active'   },
  { name: 'Admin User',      email: 'admin@scanny.app', role: 'Admin',     orders: 0,  joined: '1 Jan 2024',  status: 'active'   },
  { name: 'David Rwema',     email: 'david@mail.com',   role: 'Customer',  orders: 7,  joined: '3 Apr 2024',  status: 'suspended'},
]

const ROLE_STYLE: Record<string, string> = {
  Admin:    'bg-primary/10 text-primary',
  Merchant: 'bg-blue-50 text-blue-700',
  Customer: 'bg-muted text-muted-foreground',
}
const STATUS_STYLE: Record<string, string> = {
  active:    'bg-emerald-50 text-emerald-700',
  warning:   'bg-amber-50 text-amber-700',
  suspended: 'bg-red-50 text-red-600',
}

export default function UsersPage() {
  return (
    <>
      <div className="admin-metric-grid">
        {[
          { label: 'Total Users',    value: '4,812' },
          { label: 'Customers',      value: '4,660' },
          { label: 'Merchants',      value: '142'   },
          { label: 'Admins',         value: '10'    },
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
              {USERS.map((u, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--muted)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--foreground)' }}>{u.name}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)' }}>{u.email}</td>
                  <td style={{ padding: '10px 16px' }}><Badge variant="secondary" className={ROLE_STYLE[u.role]}>{u.role}</Badge></td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)' }}>{u.orders || '—'}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)' }}>{u.joined}</td>
                  <td style={{ padding: '10px 16px' }}><Badge variant="secondary" className={STATUS_STYLE[u.status]}>{u.status.charAt(0).toUpperCase() + u.status.slice(1)}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
