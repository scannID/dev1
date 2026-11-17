
import { useEffect, useState } from 'react'
import { Ticket, TrendingUp } from 'lucide-react'
import { InlineSpinner } from '../components/LoadingSpinner'
import { ticketsApi } from '../api/services'
import type { CreatedEventSummary } from '../api/types'

function ugx(n: number) {
  return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(n)
}

/**
 * Financial tracking for ticketing module.
 * Shows event revenue, tickets sold, and platform commissions.
 */
export default function TicketingFinancialPage() {
  const [events, setEvents] = useState<CreatedEventSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ticketsApi.listCreatedEvents()
      .then((res) => setEvents(res))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
        <InlineSpinner label="Loading ticketing financials…" />
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

  const totalTickets = events.reduce((sum, e) => sum + e.paidTickets, 0)
  const totalAttendee = events.reduce((sum, e) => sum + e.attendeeTickets, 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ 
          width: 40, height: 40, borderRadius: 12, 
          background: 'oklch(0.95 0.08 290 / 0.5)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'oklch(0.5 0.18 290)'
        }}>
          <Ticket size={20} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Ticketing Financials</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted-foreground)' }}>
            Event revenue and ticket sales tracking
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="admin-metric-card" style={{ borderTop: '3px solid oklch(0.5 0.18 290)' }}>
          <span className="metric-label">Paid Tickets</span>
          <span className="metric-value" style={{ color: 'oklch(0.5 0.18 290)' }}>{totalTickets.toLocaleString()}</span>
          <span className="metric-sub">{events.length} events</span>
        </div>
        <div className="admin-metric-card" style={{ borderTop: '3px solid oklch(0.6 0.15 200)' }}>
          <span className="metric-label">Total Tickets</span>
          <span className="metric-value" style={{ color: 'oklch(0.6 0.15 200)' }}>{totalAttendee.toLocaleString()}</span>
          <span className="metric-sub">Including attendee</span>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h3>Events</h3>
          <p>Ticket sales by event</p>
        </div>
        <div style={{ padding: '0 20px 16px' }}>
          {events.length === 0 ? (
            <p style={{ textAlign: 'center', padding: 40, color: 'var(--muted-foreground)', fontSize: 13 }}>
              No events created yet
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {events.map((event) => (
                <div key={event.eventId} style={{
                  padding: 14,
                  background: 'var(--muted)',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{event.eventName}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>
                      {event.paidTickets} paid • {event.attendeeTickets} total • {event.redeemedTickets} redeemed
                    </p>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                    {event.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
