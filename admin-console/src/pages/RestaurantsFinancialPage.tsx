import { useState } from 'react'
import { Store } from 'lucide-react'
import { InlineSpinner } from '../components/LoadingSpinner'
import { useRevenue } from '../hooks/usePlatform'
import MonthlyRevenueDonut from '../components/MonthlyRevenueDonut'

/**
 * Financial Ledger page for restaurant operations.
 * Shows merchant revenue, service fees, and COGS from financial_ledger_entries table.
 */
export default function RestaurantsFinancialPage() {
  const { loading, error, overview } = useRevenue()

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
        <InlineSpinner label="Loading restaurant financials…" />
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

  if (!overview) {
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
          background: 'oklch(0.95 0.05 145 / 0.5)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'oklch(0.5 0.15 145)'
        }}>
          <Store size={20} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Restaurant Financials</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted-foreground)' }}>
            Revenue tracking from financial ledger (restaurants only)
          </p>
        </div>
      </div>

      <div className="admin-card">
        <MonthlyRevenueDonut monthly={overview.monthly} currency={overview.currentMonth.currency} />
      </div>
    </div>
  )
}
