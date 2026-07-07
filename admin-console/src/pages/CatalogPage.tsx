import { Badge } from '@/components/ui/badge'

const ITEMS = [
  { merchant: 'Kampala Grill', name: 'Beef Plate',     category: 'Meals',   price: 'UGX 18,000', available: true,  orders: 892 },
  { merchant: 'Kampala Grill', name: 'Chicken Wrap',   category: 'Meals',   price: 'UGX 14,500', available: true,  orders: 641 },
  { merchant: 'City Lounge',   name: 'House Mocktail', category: 'Drinks',  price: 'UGX 12,000', available: true,  orders: 520 },
  { merchant: 'City Lounge',   name: 'Spicy Wings',    category: 'Bites',   price: 'UGX 22,000', available: true,  orders: 480 },
  { merchant: 'Nile Cafe',     name: 'Passion Juice',  category: 'Drinks',  price: 'UGX 6,000',  available: false, orders: 390 },
  { merchant: 'Pearl Events',  name: 'VIP Ticket',     category: 'Tickets', price: 'UGX 50,000', available: true,  orders: 210 },
  { merchant: 'Garden Bistro', name: 'Family Platter', category: 'Meals',   price: 'UGX 42,000', available: false, orders: 178 },
]

export default function CatalogPage() {
  return (
    <>
      <div className="admin-metric-grid">
        {[
          { label: 'Total Items',      value: '1,204' },
          { label: 'Available',        value: '1,089' },
          { label: 'Hidden / Paused',  value: '115'   },
          { label: 'Categories',       value: '38'    },
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
              {ITEMS.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--muted)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--foreground)' }}>{item.name}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)' }}>{item.merchant}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)' }}>{item.category}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: 'var(--foreground)' }}>{item.price}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <Badge variant="secondary" className={item.available ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'}>
                      {item.available ? 'Available' : 'Hidden'}
                    </Badge>
                  </td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: 'var(--foreground)' }}>{item.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
