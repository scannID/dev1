import { useEffect, useMemo, useState } from 'react'
import { API_BASE_URL } from '../api/client'
import { adminApi } from '../api/services'
import type { ReportsOverview, RevenueOverview, TicketEventStats } from '../api/types'
import { InlineSpinner } from '../components/LoadingSpinner'
import { PaginationBar } from '../components/PaginationBar'
import Sparkline from '../components/Sparkline'
import { usePagination } from '../hooks/usePagination'

function currency(amount: number) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function ReportsPage() {
  const [ticketStats, setTicketStats] = useState<TicketEventStats[]>([])
  const [ticketSearch, setTicketSearch] = useState('')
  const [ticketLoading, setTicketLoading] = useState(false)
  const [ticketError, setTicketError] = useState<string | null>(null)
  const [overview, setOverview] = useState<ReportsOverview | null>(null)
  const [revenue, setRevenue] = useState<RevenueOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const wsUrl = useMemo(() => {
    const base = API_BASE_URL.replace(/\/api$/, '')
    if (base.startsWith('https://')) return base.replace('https://', 'wss://')
    if (base.startsWith('http://')) return base.replace('http://', 'ws://')
    return 'ws://localhost:4000'
  }, [])

  async function loadTicketStats(search?: string) {
    try {
      setTicketLoading(true)
      setTicketError(null)
      const data = await adminApi.tickets.getStats(search)
      setTicketStats(data)
    } catch (err) {
      setTicketError(err instanceof Error ? err.message : 'Failed to load ticket stats')
    } finally {
      setTicketLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [reportsResult, revenueResult] = await Promise.allSettled([
          adminApi.reports.getOverview(),
          adminApi.revenue.getOverview(),
        ])
        if (cancelled) return

        let mainError: string | null = null

        if (reportsResult.status === 'fulfilled') {
          setOverview(reportsResult.value)
        } else {
          setOverview(null)
          mainError = reportsResult.reason instanceof Error ? reportsResult.reason.message : 'Failed to load reports'
        }

        if (revenueResult.status === 'fulfilled') {
          setRevenue(revenueResult.value)
        } else {
          setRevenue(null)
          if (!mainError) {
            mainError = revenueResult.reason instanceof Error
              ? revenueResult.reason.message
              : 'Failed to load revenue overview'
          }
        }

        setError(mainError)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    loadTicketStats().catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let reconnectTimer: number | null = null
    let pollTimer: number | null = null
    let ws: WebSocket | null = null
    let attempt = 0

    const startPoll = () => {
      if (pollTimer != null) return
      pollTimer = window.setInterval(() => {
        loadTicketStats(ticketSearch).catch(() => undefined)
      }, 15000)
    }

    const connect = () => {
      ws = new WebSocket(`${wsUrl}/ws/tickets/stats`)
      ws.onopen = () => {
        attempt = 0
        if (pollTimer != null) {
          window.clearInterval(pollTimer)
          pollTimer = null
        }
      }
      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as { type?: string; stats?: TicketEventStats[]; payload?: TicketEventStats[] }
          const stats = parsed.stats ?? parsed.payload
          if (parsed.type === 'TICKET_STATS_UPDATED' && Array.isArray(stats)) {
            setTicketStats(stats)
          }
        } catch {
          // ignore malformed payloads
        }
      }
      ws.onclose = () => {
        startPoll()
        const delay = Math.min(30000, 1000 * 2 ** attempt++) + Math.floor(Math.random() * 400)
        reconnectTimer = window.setTimeout(connect, delay)
      }
      ws.onerror = () => {
        ws?.close()
      }
    }

    connect()
    return () => {
      if (reconnectTimer != null) window.clearTimeout(reconnectTimer)
      if (pollTimer != null) window.clearInterval(pollTimer)
      ws?.close()
    }
  }, [wsUrl, ticketSearch])

  const filteredTicketStats = useMemo(() => {
    const query = ticketSearch.trim().toLowerCase()
    if (!query) return ticketStats
    return ticketStats.filter((row) => row.eventName.toLowerCase().includes(query))
  }, [ticketSearch, ticketStats])

  const ticketPagination = usePagination(filteredTicketStats, {
    initialPageSize: 20,
    resetKey: ticketSearch,
  })
  const monthly = revenue?.monthly ?? []
  const monthlyPagination = usePagination(monthly, { initialPageSize: 20 })
  const growth = revenue?.currentMonth.growth

  return (
    <>
      {error && <div style={{ padding: '12px 16px', marginBottom: 16, color: 'crimson', fontSize: 13 }}>{error}</div>}
      {loading && (
        <div className="admin-loading-banner">
          <InlineSpinner label="Loading reports…" />
        </div>
      )}

      <div className="admin-metric-grid cols-3">
        {[
          { label: 'Orders This Month', value: (overview?.ordersThisMonth ?? 0).toLocaleString() },
          { label: 'Revenue This Month', value: currency(overview?.revenueThisMonth ?? 0) },
          { label: 'New Merchants (Month)', value: String(overview?.newMerchantsThisMonth ?? 0) },
        ].map((c) => (
          <div key={c.label} className="admin-metric-card">
            <span className="metric-label">{c.label}</span>
            <span className="metric-value">{c.value}</span>
          </div>
        ))}
      </div>

      <div className="admin-two-col">
        <div className="admin-card">
          <div className="admin-card-header">
            <div><h3>Ticket Purchases</h3><p>Live by event</p></div>
          </div>
          <div style={{ padding: '16px 20px', display: 'grid', gap: 10 }}>
            <input
              type="text"
              value={ticketSearch}
              onChange={(e) => {
                const value = e.target.value
                setTicketSearch(value)
                loadTicketStats(value).catch(() => undefined)
              }}
              placeholder="Search event name"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--card)', color: 'var(--foreground)' }}
            />
            {ticketLoading && <InlineSpinner label="Loading ticket stats…" />}
            {ticketError && !ticketLoading && <p style={{ margin: 0, fontSize: 12, color: 'var(--destructive)' }}>{ticketError}</p>}
            {!ticketLoading && !ticketError && (
              <div style={{ display: 'grid', gap: 8 }}>
                {ticketPagination.pageItems.map((row) => (
                  <div key={row.eventName} style={{ display: 'flex', justifyContent: 'space-between', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                    <span style={{ fontSize: 13, color: 'var(--foreground)' }}>{row.eventName}</span>
                    <strong style={{ fontSize: 13, color: 'var(--primary)' }}>{row.purchasedTickets}/{row.totalTickets}</strong>
                  </div>
                ))}
                {ticketPagination.totalItems === 0 && (
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)' }}>No ticket events found.</p>
                )}
                <PaginationBar pagination={ticketPagination} hideWhenEmpty={false} />
              </div>
            )}
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-header"><div><h3>Monthly Orders</h3><p>From revenue analytics</p></div></div>
          <div style={{ padding: '20px' }}>
            {monthly.length === 0 ? (
              <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>No monthly data yet.</p>
            ) : (
              <>
                <Sparkline
                  data={monthly.map((w) => w.transactions)}
                  color="var(--primary)"
                  className="admin-sparkline"
                  height={110}
                  strokeWidth={1.6}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  {monthly.map((w) => <span key={w.month} style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{w.month}</span>)}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-header"><div><h3>Growth Summary</h3><p>Current month vs prior</p></div></div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Order Growth', value: `${(growth?.transactions ?? 0) >= 0 ? '+' : ''}${(growth?.transactions ?? 0).toFixed(1)}%`, up: (growth?.transactions ?? 0) >= 0 },
              { label: 'Revenue Growth', value: `${(growth?.revenue ?? 0) >= 0 ? '+' : ''}${(growth?.revenue ?? 0).toFixed(1)}%`, up: (growth?.revenue ?? 0) >= 0 },
              { label: 'New Merchants', value: `+${overview?.newMerchantsThisMonth ?? 0}`, up: true },
              { label: 'Failed Payments', value: `${(growth?.failedPayments ?? 0) >= 0 ? '+' : ''}${(growth?.failedPayments ?? 0).toFixed(1)}%`, up: (growth?.failedPayments ?? 0) <= 0 },
              { label: 'Avg Order Value', value: `${(growth?.avgOrderValue ?? 0) >= 0 ? '+' : ''}${(growth?.avgOrderValue ?? 0).toFixed(1)}%`, up: (growth?.avgOrderValue ?? 0) >= 0 },
            ].map((item) => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                <span style={{ color: 'var(--muted-foreground)' }}>{item.label}</span>
                <span style={{ fontWeight: 600, color: item.up ? '#16a34a' : 'var(--destructive)' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header"><div><h3>Monthly Breakdown</h3></div></div>
        <div className="admin-table-wrap">
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Month', 'Orders', 'Revenue'].map((h) => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthlyPagination.pageItems.length === 0 ? (
                <tr><td colSpan={3} style={{ padding: 16, color: 'var(--muted-foreground)' }}>No monthly breakdown yet.</td></tr>
              ) : monthlyPagination.pageItems.map((w) => (
                <tr key={w.month} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 600 }}>{w.month}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>{w.transactions.toLocaleString()}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>{currency(w.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationBar pagination={monthlyPagination} hideWhenEmpty={false} />
      </div>
    </>
  )
}
