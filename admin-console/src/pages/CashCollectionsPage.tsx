import { Banknote, RefreshCw, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InlineSpinner } from '../components/LoadingSpinner'
import { useCashCollections } from '../hooks/usePlatform'

function currency(amount: number) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function CashCollectionsPage() {
  const { data, loading, error, refresh } = useCashCollections()
  const rows = data?.rows ?? []
  const grandTotal = data?.grandTotalCash ?? 0
  const grandCut = data?.grandKoddlyCut ?? 0

  return (
    <>
      {error && (
        <div style={{ padding: '12px 16px', marginBottom: 16, background: 'oklch(0.96 0.02 30 / 0.15)', border: '1px solid oklch(0.577 0.245 27.325 / 0.4)', borderRadius: 10, color: 'oklch(0.577 0.245 27.325)', fontSize: 13, fontWeight: 500 }}>
          Could not load cash collections: {error}
        </div>
      )}

      {loading && (
        <div className="admin-loading-banner">
          <InlineSpinner label="Loading cash collections…" />
        </div>
      )}

      {/* ── Summary metrics ── */}
      <div className="admin-metric-grid">
        {[
          {
            label: 'Total Cash Collected',
            value: currency(grandTotal),
            sub: 'Across all merchants',
          },
          {
            label: "Koddly's Cut (owed)",
            value: currency(grandCut),
            sub: 'Platform fees from cash orders',
          },
          {
            label: 'Merchants with Cash Orders',
            value: rows.length.toLocaleString(),
            sub: 'Active this period',
          },
          {
            label: 'Total Cash Orders',
            value: rows.reduce((s, r) => s + r.orderCount, 0).toLocaleString(),
            sub: 'All-time paid cash orders',
          },
        ].map((c) => (
          <div key={c.label} className="admin-metric-card">
            <span className="metric-label">{c.label}</span>
            <span className="metric-value">{c.value}</span>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>{c.sub}</span>
          </div>
        ))}
      </div>

      {/* ── Per-merchant table ── */}
      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <h3>Per-merchant Cash Breakdown</h3>
            <p>Platform fee Koddly is owed from each merchant's cash orders</p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>

        <div className="admin-table-wrap">
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Merchant', 'Cash Orders', 'Total Cash Collected', "Koddly's Cut", '% of Cash'].map((h) => (
                  <th
                    key={h}
                    style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 24, color: 'var(--muted-foreground)', textAlign: 'center' }}>
                    {loading ? (
                      <InlineSpinner label="Loading…" />
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <Banknote size={16} />
                        No cash orders recorded yet.
                      </span>
                    )}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const pct = grandTotal > 0
                    ? ((row.totalCash / grandTotal) * 100).toFixed(1)
                    : '0.0'
                  return (
                    <tr
                      key={row.merchantId}
                      style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--muted)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    >
                      {/* Merchant name */}
                      <td style={{ padding: '10px 16px', fontWeight: 500 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Banknote size={14} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
                          {row.merchantName}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2, display: 'block', fontFamily: 'monospace' }}>
                          {row.merchantId}
                        </span>
                      </td>

                      {/* Order count */}
                      <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: 'var(--foreground)' }}>
                        {row.orderCount.toLocaleString()}
                      </td>

                      {/* Total cash collected by merchant */}
                      <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontWeight: 600 }}>
                        {currency(row.totalCash)}
                      </td>

                      {/* Koddly's cut (platform fee owed) */}
                      <td style={{ padding: '10px 16px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            color: 'oklch(0.527 0.154 150)',
                            background: 'oklch(0.95 0.04 150 / 0.35)',
                            borderRadius: 6,
                            padding: '2px 8px',
                            fontSize: 12,
                          }}
                        >
                          <TrendingUp size={11} />
                          {currency(row.koddlyCut)}
                        </span>
                      </td>

                      {/* % share of total cash */}
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, maxWidth: 80, height: 5, background: 'var(--muted)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--primary)', borderRadius: 4 }} />
                          </div>
                          <span style={{ fontSize: 12, color: 'var(--muted-foreground)', minWidth: 36 }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>

            {/* Totals footer */}
            {rows.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--muted)' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 700, fontSize: 12 }}>
                    TOTALS ({rows.length} merchant{rows.length !== 1 ? 's' : ''})
                  </td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontWeight: 700 }}>
                    {rows.reduce((s, r) => s + r.orderCount, 0).toLocaleString()}
                  </td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontWeight: 700 }}>
                    {currency(grandTotal)}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        color: 'oklch(0.527 0.154 150)',
                        background: 'oklch(0.95 0.04 150 / 0.35)',
                        borderRadius: 6,
                        padding: '2px 8px',
                        fontSize: 12,
                      }}
                    >
                      <TrendingUp size={11} />
                      {currency(grandCut)}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px' }} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </>
  )
}
