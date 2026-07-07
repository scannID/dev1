import { useState } from 'react'
import { Search, Plus, MoreHorizontal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const MERCHANTS = [
  { id: 'MER-001', name: 'Kampala Grill',   owner: 'James Okello',   type: 'Restaurant', plan: 'Pro',   orders: 1240, revenue: 'UGX 22.4M', status: 'active',    joined: '12 Jan 2024' },
  { id: 'MER-002', name: 'City Lounge',     owner: 'Aisha Nakato',   type: 'Bar',        plan: 'Pro',   orders: 980,  revenue: 'UGX 18.1M', status: 'active',    joined: '3 Feb 2024'  },
  { id: 'MER-003', name: 'Nile Cafe',       owner: 'Peter Ssempa',   type: 'Restaurant', plan: 'Basic', orders: 741,  revenue: 'UGX 11.2M', status: 'active',    joined: '19 Feb 2024' },
  { id: 'MER-004', name: 'Pearl Events',    owner: 'Grace Nambi',    type: 'Events',     plan: 'Pro',   orders: 580,  revenue: 'UGX 9.6M',  status: 'warning',   joined: '5 Mar 2024'  },
  { id: 'MER-005', name: 'Garden Bistro',   owner: 'David Mwesige',  type: 'Restaurant', plan: 'Basic', orders: 430,  revenue: 'UGX 7.1M',  status: 'active',    joined: '14 Mar 2024' },
  { id: 'MER-006', name: 'Sky Bar',         owner: 'Rose Atuhaire',  type: 'Bar',        plan: 'Pro',   orders: 390,  revenue: 'UGX 6.4M',  status: 'suspended', joined: '22 Apr 2024' },
  { id: 'MER-007', name: 'Ugandan Kitchen', owner: 'Sam Byaruhanga', type: 'Restaurant', plan: 'Basic', orders: 210,  revenue: 'UGX 3.8M',  status: 'active',    joined: '1 May 2024'  },
  { id: 'MER-008', name: 'Fusion Hub',      owner: 'Mary Nalwoga',   type: 'Restaurant', plan: 'Basic', orders: 124,  revenue: 'UGX 2.1M',  status: 'pending',   joined: '15 Jun 2024' },
]

const STATUS_STYLE: Record<string, string> = {
  active:    'bg-emerald-50 text-emerald-700',
  warning:   'bg-amber-50 text-amber-700',
  suspended: 'bg-red-50 text-red-600',
  pending:   'bg-muted text-muted-foreground',
}

export default function MerchantsPage() {
  const [query, setQuery] = useState('')
  const filtered = MERCHANTS.filter((m) =>
    [m.name, m.owner, m.type, m.id].join(' ').toLowerCase().includes(query.toLowerCase())
  )

  return (
    <>
      {/* Summary cards */}
      <div className="admin-metric-grid">
        {[
          { label: 'Total',     value: '142', sub: 'All time' },
          { label: 'Active',    value: '128', sub: 'Currently live' },
          { label: 'Pending',   value: '9',   sub: 'Awaiting approval' },
          { label: 'Suspended', value: '5',   sub: 'Violations / issues' },
        ].map((c) => (
          <div key={c.label} className="admin-metric-card">
            <span className="metric-label">{c.label} Merchants</span>
            <span className="metric-value">{c.value}</span>
            <span className="metric-sub">{c.sub}</span>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div className="admin-card">
        <div className="admin-card-header">
          <div><h3>All Merchants</h3><p>{filtered.length} of {MERCHANTS.length} shown</p></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search merchants…" className="h-8 pl-8 w-56 text-sm" />
            </div>
            <Button size="sm" className="h-8"><Plus size={13} />Add merchant</Button>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['ID', 'Merchant', 'Owner', 'Type', 'Plan', 'Orders', 'Revenue', 'Status', 'Joined', ''].map((h) => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s', cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--muted)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 11, color: 'var(--muted-foreground)' }}>{m.id}</td>
                  <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--foreground)' }}>{m.name}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)' }}>{m.owner}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)' }}>{m.type}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <Badge variant="secondary" className={m.plan === 'Pro' ? 'bg-primary/10 text-primary' : ''}>
                      {m.plan}
                    </Badge>
                  </td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: 'var(--foreground)' }}>{m.orders.toLocaleString()}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: 'var(--foreground)' }}>{m.revenue}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <Badge variant="secondary" className={STATUS_STYLE[m.status]}>
                      {m.status.charAt(0).toUpperCase() + m.status.slice(1)}
                    </Badge>
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>{m.joined}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <Button variant="ghost" size="icon-sm"><MoreHorizontal size={14} /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
