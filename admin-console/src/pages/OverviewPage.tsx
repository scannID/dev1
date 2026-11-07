import { ArrowUpRight, Building2, ShoppingBag, Store, Ticket, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import MetricsHero from '../components/MetricsHero'
import OccupancyDonut from '../components/OccupancyDonut'
import TicketingDonut from '../components/TicketingDonut'
import { InlineSpinner } from '../components/LoadingSpinner'
import { PaginationBar } from '../components/PaginationBar'
import Sparkline from '../components/Sparkline'
import { usePagination } from '../hooks/usePagination'
import { useDashboard } from '../hooks/useDashboard'
import { useEffect, useRef, useState } from 'react'
import { rentAdminApi, ticketsApi } from '../api/services'
import type { AdminRentSummary, CreatedEventSummary } from '../api/types'
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

  // ── Ticketing summary ────────────────────────────────────────────────────
  const [events, setEvents] = useState<CreatedEventSummary[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const eventsInFlight = useRef(false)

  const loadEvents = useRef(() => {
    if (eventsInFlight.current) return
    eventsInFlight.current = true
    ticketsApi.listCreatedEvents()
      .then((e) => setEvents(e))
      .catch(() => { /* non-fatal */ })
      .finally(() => { eventsInFlight.current = false; setEventsLoading(false) })
  })

  useEffect(() => { loadEvents.current() }, [])

  const activeEvents     = events.filter((e) => e.status === 'ACTIVE').length
  // paidTickets = tickets with PaymentStatus.Paid (what the backend actually returns)
  const totalTicketsSold = events.reduce((sum, e) => sum + e.paidTickets, 0)
  const totalRedeemed    = events.reduce((s, e) => s + e.redeemedTickets, 0)
  // Sparkline: sold-ticket count per event (sorted by createdAt, most recent last)
  // Pad to ≥8 points so the line always has visible shape
  const rawSparkline = events.length > 0
    ? [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((e) => e.paidTickets)
    : [0]
  const ticketSparkline = rawSparkline.length >= 4
    ? rawSparkline
    : Array.from({ length: 8 }, (_, i) => {
        const base = rawSparkline[rawSparkline.length - 1] ?? 0
        return Math.max(0, Math.round(base * (i + 1) / 8))
      })

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

  // ── Wire ticketing + rent into the same realtime/poll cycle as dashboard ─
  useAdminMetricsRealtime(() => {
    loadEvents.current()
    loadRent.current()
  })

  // ── Hover tooltips on metric cards ───────────────────────────────────────
  const [hoveredCard, setHoveredCard] = useState<'merchants' | 'ticketing' | 'rent' | null>(null)

  // ── Ticketing period tab ──────────────────────────────────────────────────
  type TicketPeriod = 'weekly' | 'monthly' | 'yearly' | 'all'
  const [ticketPeriod, setTicketPeriod] = useState<TicketPeriod>('all')
  const TICKET_PERIODS: { key: TicketPeriod; label: string }[] = [
    { key: 'weekly',  label: 'Weekly'  },
    { key: 'monthly', label: 'Monthly' },
    { key: 'yearly',  label: 'Yearly'  },
    { key: 'all',     label: 'All'     },
  ]

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

        {/* ── Ticketing ── */}
        <div
          className="admin-metric-card admin-metric-card--detail"
          style={{ position: 'relative' }}
          onMouseEnter={() => setHoveredCard('ticketing')}
          onMouseLeave={() => setHoveredCard(null)}
        >
          <div className="amc-header">
            <div className="amc-icon" style={{ background: 'oklch(0.95 0.03 160)', color: '#10b981' }}>
              <Ticket size={18} />
            </div>
            <span className="metric-label">Ticketing</span>
          </div>
          <span className="metric-value">{eventsLoading ? '…' : activeEvents.toLocaleString()}</span>
          <p className="metric-sub" style={{ marginTop: -4 }}>active events</p>
          <div className="amc-stat-row">
            <div className="amc-stat">
              <span className="amc-stat-label">Tickets sold</span>
              <span className="amc-stat-value">{eventsLoading ? '…' : totalTicketsSold.toLocaleString()}</span>
            </div>
            <div className="amc-stat-divider" />
            <div className="amc-stat">
              <span className="amc-stat-label">Redeemed</span>
              <span className="amc-stat-value">
                {eventsLoading ? '…' : totalRedeemed.toLocaleString()}
              </span>
            </div>
            <div className="amc-stat-divider" />
            <div className="amc-stat">
              <span className="amc-stat-label">Total events</span>
              <span className="amc-stat-value">{eventsLoading ? '…' : events.length.toLocaleString()}</span>
            </div>
          </div>
          <Sparkline data={ticketSparkline} color="#10b981" />
          {hoveredCard === 'ticketing' && (
            <div className="amc-tooltip">
              <p className="amc-tooltip-title">Ticketing Breakdown</p>
              <div className="amc-tooltip-row"><span>Active events</span><strong style={{ color: '#10b981' }}>{activeEvents.toLocaleString()}</strong></div>
              <div className="amc-tooltip-row"><span>Total events</span><strong>{events.length.toLocaleString()}</strong></div>
              <div className="amc-tooltip-divider" />
              <div className="amc-tooltip-row"><span>Tickets sold</span><strong style={{ color: '#10b981' }}>{totalTicketsSold.toLocaleString()}</strong></div>
              <div className="amc-tooltip-row"><span>Redeemed</span><strong>{totalRedeemed.toLocaleString()}</strong></div>
              <div className="amc-tooltip-row"><span>Redemption rate</span><strong>{totalTicketsSold > 0 ? `${Math.round((totalRedeemed / totalTicketsSold) * 100)}%` : '—'}</strong></div>
              {events.length > 0 && (
                <>
                  <div className="amc-tooltip-divider" />
                  <div className="amc-tooltip-row"><span>Top event</span><strong style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{[...events].sort((a, b) => b.paidTickets - a.paidTickets)[0]?.eventName ?? '—'}</strong></div>
                </>
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

        {/* ── Ticketing mini chart ── */}
        <div className="admin-card overview-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="admin-card-header">
            <div>
              <h3>Ticketing</h3>
              <p>Sold · Redeemed · Events</p>
            </div>
            {/* Period tabs in header right corner */}
            <div style={{ display: 'flex', gap: 2, background: 'var(--muted)', borderRadius: 8, padding: 3 }}>
              {TICKET_PERIODS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setTicketPeriod(p.key)}
                  style={{
                    padding: '3px 9px',
                    fontSize: 11,
                    fontWeight: ticketPeriod === p.key ? 600 : 400,
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    background: ticketPeriod === p.key ? 'var(--card)' : 'transparent',
                    color: ticketPeriod === p.key ? 'var(--primary)' : 'var(--muted-foreground)',
                    transition: 'all 0.15s',
                    boxShadow: ticketPeriod === p.key ? '0 1px 3px oklch(0 0 0 / 12%)' : 'none',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, padding: '12px 16px 16px' }}>
            {eventsLoading ? (
              <InlineSpinner label="Loading…" />
            ) : (
              <TicketingDonut events={events} period={ticketPeriod} />
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
          <div style={{ flex: 1, padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
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
    </>
  )
}
