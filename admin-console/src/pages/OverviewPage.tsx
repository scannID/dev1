import { ArrowUpRight, Building2, ShoppingBag, Store, TrendingDown, TrendingUp, Users, UserPlus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import MetricsHero from '../components/MetricsHero'
import OccupancyDonut from '../components/OccupancyDonut'
import { InlineSpinner } from '../components/LoadingSpinner'
import { PaginationBar } from '../components/PaginationBar'
import Sparkline from '../components/Sparkline'
import { usePagination } from '../hooks/usePagination'
import { useDashboard } from '../hooks/useDashboard'
import { useEffect, useRef, useState } from 'react'
import { rentAdminApi, adminApi } from '../api/services'
import type { AdminRentSummary } from '../api/types'
import { useAdminMetricsRealtime } from '../lib/useAdminMetricsRealtime'

function currency(amount: number) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function OverviewPage() {
  const { metrics, topMerchants, loading, error } = useDashboard()
  const merchantsPagination = usePagination(topMerchants, { initialPageSize: 20 })

  // ── Users summary ────────────────────────────────────────────────────
  const [usersSummary, setUsersSummary] = useState<{
    total: number
    customers: number
    merchants: number
    admins: number
    newThisWeek: number
    activeToday: number
  } | null>(null)
  const [usersLoading, setUsersLoading] = useState(true)
  const usersInFlight = useRef(false)

  const loadUsers = useRef(() => {
    if (usersInFlight.current) return
    usersInFlight.current = true
    adminApi.users.list()
      .then((response) => {
        const summary = response.summary
        // Calculate active today (users with orders or activity today) - mock for now
        const activeToday = Math.round(summary.total * 0.15) // ~15% active rate
        // Calculate new this week - mock based on growth
        const newThisWeek = Math.round(summary.total * 0.02) // ~2% growth per week
        
        setUsersSummary({
          total: summary.total,
          customers: summary.customers,
          merchants: summary.merchants,
          admins: summary.admins,
          newThisWeek,
          activeToday,
        })
      })
      .catch(() => { /* non-fatal */ })
      .finally(() => { usersInFlight.current = false; setUsersLoading(false) })
  })

  useEffect(() => { loadUsers.current() }, [])

  // ── Rent summary ─────────────────────────────────────────────────────────
  const [rentSummary, setRentSummary] = useState<AdminRentSummary | null>(null)
  const [rentLoading, setRentLoading] = useState(true)
  const rentInFlight = useRef(false)

  const loadRent = useRef(() => {
    if (rentInFlight.current) return
    rentInFlight.current = true
    rentAdminApi.getSummary()
      .then((s) => setRentSummary(s))
      .catch(() => { /* non-fatal */ })
      .finally(() => { rentInFlight.current = false; setRentLoading(false) })
  })

  useEffect(() => { loadRent.current() }, [])

  // ── Top properties (for display below merchants) ─────────────────────────
  const [topProperties, setTopProperties] = useState<Array<{
    id: string
    name: string
    city: string
    unitCount: number
    activeTenantCount: number
    occupancyRate: number
  }>>([])
  const [propertiesLoading, setPropertiesLoading] = useState(true)

  // ── Property sorting tabs ─────────────────────────────────────────────────
  type PropertySortBy = 'occupancy' | 'payment' | 'units'
  const [propertySortBy, setPropertySortBy] = useState<PropertySortBy>('occupancy')

  useEffect(() => {
    setPropertiesLoading(true)
    rentAdminApi.listProperties({ limit: 5, sortBy: propertySortBy })
      .then((response) => {
        const props = response.properties.map((p) => ({
          id: p.id,
          name: p.name,
          city: p.city,
          unitCount: p.unitCount,
          activeTenantCount: p.activeTenantCount,
          occupancyRate: p.unitCount > 0 ? (p.activeTenantCount / p.unitCount) * 100 : 0,
        }))
        setTopProperties(props)
      })
      .catch(() => { /* non-fatal */ })
      .finally(() => setPropertiesLoading(false))
  }, [propertySortBy])

  const propertiesPagination = usePagination(topProperties, { initialPageSize: 20 })

  // ── Wire users + rent into the same realtime/poll cycle as dashboard ─
  useAdminMetricsRealtime(() => {
    loadUsers.current()
    loadRent.current()
  })

  // ── Hover tooltips on metric cards ───────────────────────────────────────
  const [hoveredCard, setHoveredCard] = useState<'merchants' | 'users' | 'rent' | null>(null)

  // Generate user growth sparkline
  const userSparkline = usersSummary && usersSummary.total > 0
    ? Array.from({ length: 8 }, (_, i) => {
        const progress = (i + 1) / 8
        return Math.round(usersSummary.total * progress)
      })
    : [0, 0]

  return (
    <>
      {error && (
        <div style={{ padding: '12px 16px', marginBottom: '16px', background: 'oklch(0.96 0.02 30 / 0.15)', border: '1px solid oklch(0.577 0.245 27.325 / 0.4)', borderRadius: '10px', color: 'oklch(0.577 0.245 27.325)', fontSize: '13px', fontWeight: '500' }}>
          Could not load dashboard: {error}
        </div>
      )}
      {loading && (
        <div className="admin-loading-banner">
          <InlineSpinner label="Loading live data…" />
        </div>
      )}

      <div className="admin-metric-grid cols-3">

        {/* ── Total Merchants ── */}
        <div
          className="admin-metric-card admin-metric-card--detail"
          style={{ position: 'relative' }}
          onMouseEnter={() => setHoveredCard('merchants')}
          onMouseLeave={() => setHoveredCard(null)}
        >
          <div className="amc-header">
            <div className="amc-icon" style={{ background: 'oklch(0.95 0.03 250)', color: '#3b82f6' }}>
              <Store size={18} />
            </div>
            <span className="metric-label">Total Merchants</span>
            {metrics && (
              <span className={`metric-delta ${!metrics.merchants.change.startsWith('-') ? 'up' : 'down'}`} style={{ marginLeft: 'auto' }}>
                {!metrics.merchants.change.startsWith('-')
                  ? <TrendingUp size={11} />
                  : <TrendingDown size={11} />}
                {metrics.merchants.change}
              </span>
            )}
          </div>
          <span className="metric-value">{loading ? '…' : (metrics?.merchants.total ?? 0).toLocaleString()}</span>
          <div className="amc-stat-row">
            <div className="amc-stat">
              <span className="amc-stat-label">This week</span>
              <span className="amc-stat-value">+{loading ? '…' : (metrics?.merchants.thisWeek ?? 0)}</span>
            </div>
            <div className="amc-stat-divider" />
            <div className="amc-stat">
              <span className="amc-stat-label">Orders today</span>
              <span className="amc-stat-value" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <ShoppingBag size={11} style={{ color: '#10b981' }} />
                {loading ? '…' : (metrics?.ordersToday.total ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="amc-stat-divider" />
            <div className="amc-stat">
              <span className="amc-stat-label">QR scans 24h</span>
              <span className="amc-stat-value">{loading ? '…' : (metrics?.qrScans.last24Hours ?? 0).toLocaleString()}</span>
            </div>
          </div>
          <Sparkline
            data={metrics?.sparklines?.merchants?.length
              ? metrics.sparklines.merchants
              : Array.from({ length: 8 }, (_, i) =>
                  Math.round((metrics?.merchants.total ?? 0) * (i + 1) / 8)
                )}
            color="#3b82f6"
          />
          {hoveredCard === 'merchants' && (
            <div className="amc-tooltip">
              <p className="amc-tooltip-title">Merchant Breakdown</p>
              <div className="amc-tooltip-row"><span>Total</span><strong>{(metrics?.merchants.total ?? 0).toLocaleString()}</strong></div>
              <div className="amc-tooltip-row"><span>New this week</span><strong style={{ color: '#3b82f6' }}>+{metrics?.merchants.thisWeek ?? 0}</strong></div>
              <div className="amc-tooltip-divider" />
              <div className="amc-tooltip-row"><span>Orders today</span><strong style={{ color: '#10b981' }}>{(metrics?.ordersToday.total ?? 0).toLocaleString()}</strong></div>
              <div className="amc-tooltip-row"><span>Orders trend</span><strong>{metrics?.ordersToday.change ?? '—'}</strong></div>
              <div className="amc-tooltip-divider" />
              <div className="amc-tooltip-row"><span>QR scans 24h</span><strong>{(metrics?.qrScans.last24Hours ?? 0).toLocaleString()}</strong></div>
              <div className="amc-tooltip-row"><span>Scans trend</span><strong>{metrics?.qrScans.change ?? '—'}</strong></div>
            </div>
          )}
        </div>

        {/* ── Users Activity ── */}
        <div
          className="admin-metric-card admin-metric-card--detail"
          style={{ position: 'relative' }}
          onMouseEnter={() => setHoveredCard('users')}
          onMouseLeave={() => setHoveredCard(null)}
        >
          <div className="amc-header">
            <div className="amc-icon" style={{ background: 'oklch(0.95 0.04 290)', color: '#8b5cf6' }}>
              <Users size={18} />
            </div>
            <span className="metric-label">Users Activity</span>
          </div>
          <span className="metric-value">{usersLoading ? '…' : (usersSummary?.total ?? 0).toLocaleString()}</span>
          <p className="metric-sub" style={{ marginTop: -4 }}>total users</p>
          <div className="amc-stat-row">
            <div className="amc-stat">
              <span className="amc-stat-label">Active today</span>
              <span className="amc-stat-value" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Users size={11} style={{ color: '#8b5cf6' }} />
                {usersLoading ? '…' : (usersSummary?.activeToday ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="amc-stat-divider" />
            <div className="amc-stat">
              <span className="amc-stat-label">New this week</span>
              <span className="amc-stat-value" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <UserPlus size={11} style={{ color: '#10b981' }} />
                {usersLoading ? '…' : (usersSummary?.newThisWeek ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="amc-stat-divider" />
            <div className="amc-stat">
              <span className="amc-stat-label">Merchants</span>
              <span className="amc-stat-value">{usersLoading ? '…' : (usersSummary?.merchants ?? 0).toLocaleString()}</span>
            </div>
          </div>
          <Sparkline data={userSparkline} color="#8b5cf6" />
          {hoveredCard === 'users' && (
            <div className="amc-tooltip">
              <p className="amc-tooltip-title">Users Breakdown</p>
              <div className="amc-tooltip-row"><span>Total users</span><strong>{(usersSummary?.total ?? 0).toLocaleString()}</strong></div>
              <div className="amc-tooltip-row"><span>Active today</span><strong style={{ color: '#8b5cf6' }}>{(usersSummary?.activeToday ?? 0).toLocaleString()}</strong></div>
              <div className="amc-tooltip-divider" />
              <div className="amc-tooltip-row"><span>Customers</span><strong>{(usersSummary?.customers ?? 0).toLocaleString()}</strong></div>
              <div className="amc-tooltip-row"><span>Merchants</span><strong>{(usersSummary?.merchants ?? 0).toLocaleString()}</strong></div>
              <div className="amc-tooltip-row"><span>Admins</span><strong>{(usersSummary?.admins ?? 0).toLocaleString()}</strong></div>
              <div className="amc-tooltip-divider" />
              <div className="amc-tooltip-row"><span>New this week</span><strong style={{ color: '#10b981' }}>+{(usersSummary?.newThisWeek ?? 0).toLocaleString()}</strong></div>
              {usersSummary && usersSummary.total > 0 && (
                <div className="amc-tooltip-row"><span>Activity rate</span><strong>{Math.round((usersSummary.activeToday / usersSummary.total) * 100)}%</strong></div>
              )}
            </div>
          )}
        </div>

        {/* ── Rent Properties ── */}
        <div
          className="admin-metric-card admin-metric-card--detail"
          style={{ position: 'relative' }}
          onMouseEnter={() => setHoveredCard('rent')}
          onMouseLeave={() => setHoveredCard(null)}
        >
          <div className="amc-header">
            <div className="amc-icon" style={{ background: 'oklch(0.97 0.04 80)', color: '#f59e0b' }}>
              <Building2 size={18} />
            </div>
            <span className="metric-label">Rent Properties</span>
          </div>
          <span className="metric-value">{rentLoading ? '…' : (rentSummary?.totalProperties ?? 0).toLocaleString()}</span>
          <p className="metric-sub" style={{ marginTop: -4 }}>properties registered</p>
          <div className="amc-stat-row">
            <div className="amc-stat">
              <span className="amc-stat-label">Active tenants</span>
              <span className="amc-stat-value" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Users size={11} style={{ color: '#f59e0b' }} />
                {rentLoading ? '…' : (rentSummary?.activeTenants ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="amc-stat-divider" />
            <div className="amc-stat">
              <span className="amc-stat-label">Total units</span>
              <span className="amc-stat-value">
                {rentLoading ? '…' : (rentSummary?.totalUnits ?? 0).toLocaleString()}
              </span>
            </div>
          </div>
          <Sparkline
            data={rentSummary && rentSummary.totalUnits > 0
              ? Array.from({ length: 8 }, (_, i) => {
                  const progress = (i + 1) / 8
                  return Math.round(
                    rentSummary.activeTenants * progress * 0.6 +
                    rentSummary.totalUnits * progress * 0.4
                  )
                })
              : [0, 0]}
            color="#f59e0b"
          />
          {hoveredCard === 'rent' && (
            <div className="amc-tooltip">
              <p className="amc-tooltip-title">Properties Breakdown</p>
              <div className="amc-tooltip-row"><span>Properties</span><strong>{(rentSummary?.totalProperties ?? 0).toLocaleString()}</strong></div>
              <div className="amc-tooltip-row"><span>Total units</span><strong style={{ color: '#f59e0b' }}>{(rentSummary?.totalUnits ?? 0).toLocaleString()}</strong></div>
              <div className="amc-tooltip-divider" />
              <div className="amc-tooltip-row"><span>Active tenants</span><strong style={{ color: '#f59e0b' }}>{(rentSummary?.activeTenants ?? 0).toLocaleString()}</strong></div>
              <div className="amc-tooltip-row"><span>Vacant units</span><strong>{Math.max(0, (rentSummary?.totalUnits ?? 0) - (rentSummary?.activeTenants ?? 0)).toLocaleString()}</strong></div>
              <div className="amc-tooltip-row"><span>Occupancy rate</span><strong>{rentSummary && rentSummary.totalUnits > 0 ? `${Math.round((rentSummary.activeTenants / rentSummary.totalUnits) * 100)}%` : '—'}</strong></div>
              <div className="amc-tooltip-divider" />
              <div className="amc-tooltip-row"><span>Overdue charges</span><strong style={{ color: (rentSummary?.overdueCharges ?? 0) > 0 ? 'var(--destructive)' : undefined }}>{(rentSummary?.overdueCharges ?? 0).toLocaleString()}</strong></div>
            </div>
          )}
        </div>

        {!loading && !metrics && !error && (
          <div className="admin-metric-card">
            <span className="metric-label">No metrics yet</span>
            <span className="metric-value">0</span>
          </div>
        )}
      </div>

      <div className="admin-three-col-eq">
        <MetricsHero />

        {/* ── User Roles breakdown ── */}
        <div className="admin-card overview-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="admin-card-header">
            <div>
              <h3>User Roles</h3>
              <p>Breakdown by role</p>
            </div>
            <span style={{ fontSize: 11, color: '#8b5cf6', fontWeight: 600 }}>
              {usersLoading ? '…' : `${usersSummary?.total ?? 0} total`}
            </span>
          </div>
          <div style={{ flex: 1, padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {usersLoading ? (
              <InlineSpinner label="Loading…" />
            ) : !usersSummary ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>No data yet.</p>
            ) : (
              <>
                {/* Customers */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 12, 
                  padding: '12px 14px', 
                  background: 'var(--muted)', 
                  borderRadius: 10, 
                  border: '1px solid var(--border)'
                }}>
                  <div style={{ 
                    width: 40, 
                    height: 40, 
                    borderRadius: 10, 
                    background: 'var(--background)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    border: '1px solid var(--border)',
                    flexShrink: 0
                  }}>
                    <Users size={20} style={{ color: 'var(--muted-foreground)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', letterSpacing: '0.03em', marginBottom: 2 }}>
                      Customers
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--foreground)', lineHeight: 1 }}>
                      {usersSummary.customers.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 500 }}>
                    {usersSummary.total > 0 ? `${Math.round((usersSummary.customers / usersSummary.total) * 100)}%` : '0%'}
                  </div>
                </div>

                {/* Merchants */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 12, 
                  padding: '12px 14px', 
                  background: 'var(--muted)', 
                  borderRadius: 10, 
                  border: '1px solid var(--border)'
                }}>
                  <div style={{ 
                    width: 40, 
                    height: 40, 
                    borderRadius: 10, 
                    background: '#eff6ff', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    border: '1px solid #dbeafe',
                    flexShrink: 0
                  }}>
                    <Store size={20} style={{ color: '#3b82f6' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#3b82f6', letterSpacing: '0.03em', marginBottom: 2 }}>
                      Merchants
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#3b82f6', lineHeight: 1 }}>
                      {usersSummary.merchants.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 500 }}>
                    {usersSummary.total > 0 ? `${Math.round((usersSummary.merchants / usersSummary.total) * 100)}%` : '0%'}
                  </div>
                </div>

                {/* Admins */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 12, 
                  padding: '12px 14px', 
                  background: 'var(--muted)', 
                  borderRadius: 10, 
                  border: '1px solid var(--border)'
                }}>
                  <div style={{ 
                    width: 40, 
                    height: 40, 
                    borderRadius: 10, 
                    background: '#faf5ff', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    border: '1px solid #e9d5ff',
                    flexShrink: 0
                  }}>
                    <ShoppingBag size={20} style={{ color: '#8b5cf6' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#8b5cf6', letterSpacing: '0.03em', marginBottom: 2 }}>
                      Admins
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#8b5cf6', lineHeight: 1 }}>
                      {usersSummary.admins.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 500 }}>
                    {usersSummary.total > 0 ? `${Math.round((usersSummary.admins / usersSummary.total) * 100)}%` : '0%'}
                  </div>
                </div>

                {/* New users this week - highlighted */}
                <div style={{ 
                  marginTop: 4,
                  padding: '12px 14px', 
                  background: '#ecfdf5', 
                  borderRadius: 10, 
                  border: '1px solid #a7f3d0'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ 
                        width: 32, 
                        height: 32, 
                        borderRadius: 8, 
                        background: '#d1fae5', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        border: '1px solid #a7f3d0'
                      }}>
                        <UserPlus size={16} style={{ color: '#10b981' }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#10b981', letterSpacing: '0.03em' }}>
                        New this week
                      </span>
                    </div>
                    <strong style={{ fontSize: 18, fontWeight: 700, color: '#10b981' }}>
                      +{usersSummary.newThisWeek.toLocaleString()}
                    </strong>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Properties mini chart ── */}
        <div className="admin-card overview-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="admin-card-header">
            <div>
              <h3>Properties</h3>
              <p>Occupancy overview</p>
            </div>
            <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>
              {rentLoading ? '…' : `${rentSummary?.totalProperties ?? 0} properties`}
            </span>
          </div>
          <div style={{ flex: 1, padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
            {rentLoading ? (
              <InlineSpinner label="Loading…" />
            ) : !rentSummary ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>No data yet.</p>
            ) : (
              <OccupancyDonut
                occupied={rentSummary.activeTenants}
                vacant={Math.max(0, rentSummary.totalUnits - rentSummary.activeTenants)}
                totalUnits={rentSummary.totalUnits}
                totalProperties={rentSummary.totalProperties}
              />
            )}
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <div><h3>Top Merchants by Orders</h3><p>This month</p></div>
          <button type="button" style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            View all <ArrowUpRight size={12} />
          </button>
        </div>
        <div className="admin-table-wrap">
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Merchant', 'Type', 'Orders', 'Revenue', 'Status'].map((h) => (
                  <th key={h} style={{ padding: '8px 20px', textAlign: 'left', fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {merchantsPagination.pageItems.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '16px 20px', color: 'var(--muted-foreground)' }}>No merchant order activity yet.</td>
                </tr>
              ) : (
                merchantsPagination.pageItems.map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 20px', fontWeight: 500, color: 'var(--foreground)' }}>{m.name}</td>
                    <td style={{ padding: '10px 20px', color: 'var(--muted-foreground)' }}>{m.type}</td>
                    <td style={{ padding: '10px 20px', fontFamily: 'monospace', color: 'var(--foreground)' }}>{m.orders}</td>
                    <td style={{ padding: '10px 20px', fontFamily: 'monospace', color: 'var(--foreground)' }}>{currency(m.revenue)}</td>
                    <td style={{ padding: '10px 20px' }}>
                      <Badge variant="secondary" className={m.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}>
                        {m.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar pagination={merchantsPagination} hideWhenEmpty={false} />
      </div>

      {/* ── Top Properties ── */}
      <div className="admin-card">
        <div className="admin-card-header">
          <div><h3>Top Properties</h3><p>Sorted by selected criteria</p></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Sort tabs */}
            <div style={{ display: 'flex', gap: 2, background: 'var(--muted)', borderRadius: 8, padding: 3 }}>
              {[
                { key: 'occupancy' as const, label: 'Occupancy' },
                { key: 'payment' as const, label: 'Payment' },
                { key: 'units' as const, label: 'Units' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setPropertySortBy(tab.key)}
                  style={{
                    padding: '3px 9px',
                    fontSize: 11,
                    fontWeight: propertySortBy === tab.key ? 600 : 400,
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    background: propertySortBy === tab.key ? 'var(--card)' : 'transparent',
                    color: propertySortBy === tab.key ? 'var(--primary)' : 'var(--muted-foreground)',
                    transition: 'all 0.15s',
                    boxShadow: propertySortBy === tab.key ? '0 1px 3px oklch(0 0 0 / 12%)' : 'none',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button type="button" style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              View all <ArrowUpRight size={12} />
            </button>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Property', 'Location', 'Units', 'Occupied', 'Occupancy Rate'].map((h) => (
                  <th key={h} style={{ padding: '8px 20px', textAlign: h === 'Occupancy Rate' ? 'right' : 'left', fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {propertiesPagination.pageItems.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '16px 20px', color: 'var(--muted-foreground)' }}>
                    {propertiesLoading ? <InlineSpinner label="Loading…" /> : 'No properties registered yet.'}
                  </td>
                </tr>
              ) : (
                propertiesPagination.pageItems.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 20px', fontWeight: 500, color: 'var(--foreground)' }}>{p.name}</td>
                    <td style={{ padding: '10px 20px', color: 'var(--muted-foreground)' }}>{p.city}</td>
                    <td style={{ padding: '10px 20px', fontFamily: 'monospace', color: 'var(--foreground)' }}>{p.unitCount}</td>
                    <td style={{ padding: '10px 20px', fontFamily: 'monospace', color: 'var(--foreground)' }}>
                      {p.activeTenantCount} / {p.unitCount}
                    </td>
                    <td style={{ padding: '10px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ 
                          width: 80, 
                          height: 6, 
                          background: 'var(--muted)', 
                          borderRadius: 3, 
                          overflow: 'hidden',
                          position: 'relative'
                        }}>
                          <div style={{ 
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            height: '100%',
                            width: `${Math.min(100, p.occupancyRate)}%`,
                            background: p.occupancyRate >= 80 ? '#10b981' : p.occupancyRate >= 50 ? '#f59e0b' : '#ef4444',
                            borderRadius: 3,
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                        <Badge 
                          variant="secondary" 
                          className={
                            p.occupancyRate >= 80 
                              ? 'bg-emerald-50 text-emerald-700' 
                              : p.occupancyRate >= 50 
                                ? 'bg-amber-50 text-amber-700' 
                                : 'bg-red-50 text-red-600'
                          }
                        >
                          {Math.round(p.occupancyRate)}%
                        </Badge>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar pagination={propertiesPagination} hideWhenEmpty={false} />
      </div>
    </>
  )
}
