import { Badge } from '@/components/ui/badge'
import { InlineSpinner } from '../components/LoadingSpinner'
import { useCatalog } from '../hooks/usePlatform'

function currency(amount: number) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function CatalogPage() {
  const { data, loading, error } = useCatalog()
  const items = data?.items ?? []
  const summary = data?.summary

  return (
    <>
      {error && (
        <div style={{ padding: '12px 16px', marginBottom: '16px', color: 'oklch(0.577 0.245 27.325)', fontSize: 13 }}>
          Could not load catalog: {error}
        </div>
      )}
      {loading && (
        <div className="admin-loading-banner">
          <InlineSpinner label="Loading catalog…" />
        </div>
      )}

      <div className="admin-metric-grid">
        {[
          { label: 'Total Items', value: String(summary?.total ?? 0) },
          { label: 'Available', value: String(summary?.available ?? 0) },
          { label: 'Hidden / Paused', value: String(summary?.hidden ?? 0) },
          { label: 'Categories', value: String(summary?.categories ?? 0) },
        ].map((c) => (
          <div key={c.label} className="admin-metric-card">
            <span className="metric-label">{c.label}</span>
            <span className="metric-value">{c.value}</span>
          </div>
        ))}
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <div><h3>All Catalog Items</h3><p>Every item across all merchants</p></div>
        </div>
        <div className="admin-table-wrap">
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Item', 'Merchant', 'Category', 'Price', 'Status', 'Orders'].map((h) => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 16, color: 'var(--muted-foreground)' }}>{loading ? <InlineSpinner label="Loading…" /> : 'No catalog items yet.'}</td></tr>
              ) : items.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 500 }}>{item.name}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)' }}>{item.merchant}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)' }}>{item.category}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>{currency(item.price)}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <Badge variant="secondary" className={item.available ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'}>
                      {item.available ? 'Available' : 'Hidden'}
                    </Badge>
                  </td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>{item.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
