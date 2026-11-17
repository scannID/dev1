import { useEffect, useState } from 'react'
import { Building2, TrendingUp } from 'lucide-react'
import { InlineSpinner } from '../components/LoadingSpinner'
import { rentAdminApi } from '../api/services'
import type { RentAccountingSummary } from '../api/types'

function ugx(n: number) {
  return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(n)
}

/**
 * Financial tracking for rent/properties module.
 * Shows rent payments, outstanding charges, and property revenue.
 */
export default function PropertiesFinancialPage() {
  const [summary, setSummary] = useState<RentAccountingSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    rentAdminApi.getAccounting()
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
        <InlineSpinner label="Loading properties financials…" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="admin-card" style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: 'var(--destructive)', fontSize: 14, margin: 0 }}>{error}</p>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="admin-card" style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>No data available</p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ 
          width: 40, height: 40, borderRadius: 12, 
          background: 'oklch(0.95 0.05 30 / 0.5)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'oklch(0.5 0.15 30)'
        }}>
          <Building2 size={20} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Properties Financials</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted-foreground)' }}>
            Rent payments and property revenue tracking
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="admin-metric-card" style={{ borderTop: '3px solid oklch(0.6 0.18 145)' }}>
          <span className="metric-label">Total Rent Collected</span>
          <span className="metric-value" style={{ color: 'oklch(0.6 0.18 145)' }}>
            {ugx(summary.totalCollectedAllTime)}
          </span>
          <span className="metric-sub">All time</span>
        </div>
        <div className="admin-metric-card" style={{ borderTop: '3px solid oklch(0.65 0.15 30)' }}>
          <span className="metric-label">This Month</span>
          <span className="metric-value" style={{ color: 'oklch(0.65 0.15 30)' }}>
            {ugx(summary.collectedThisMonth)}
          </span>
          <span className="metric-sub">{summary.currentPeriod}</span>
        </div>
        <div className="admin-metric-card" style={{ borderTop: '3px solid oklch(0.5 0.12 200)' }}>
          <span className="metric-label">Properties</span>
          <span className="metric-value" style={{ color: 'oklch(0.5 0.12 200)' }}>
            {summary.totalProperties}
          </span>
          <span className="metric-sub">{summary.activeTenants} active tenants</span>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h3>Summary</h3>
          <p>Rent accounting overview</p>
        </div>
        <div style={{ padding: '0 20px 16px' }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Collected this month</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary)' }}>
                {ugx(summary.collectedThisMonth)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Collected last month</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                {ugx(summary.collectedLastMonth)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Total payments</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{summary.totalPayments}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Overdue charges</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--destructive)' }}>
                {ugx(summary.overdueCharges)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
              <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Unpaid charges</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                {ugx(summary.unpaidCharges)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
