import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { InlineSpinner } from '../components/LoadingSpinner'
import { PaginationBar } from '../components/PaginationBar'
import { usePagination } from '../hooks/usePagination'
import { loadEventTickets, useTicketing } from '../hooks/useTicketing'
import type { AdminTicket, TicketEventStats } from '../api/types'

function currency(amount: number, currencyCode = 'UGX') {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: currencyCode || 'UGX',
    maximumFractionDigits: 0,
  }).format(amount)
}

function parseMeta(raw?: string): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function formatDate(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const STATUS_CLASS: Record<string, string> = {
  Active: 'bg-emerald-50 text-emerald-700',
  Redeemed: 'bg-blue-50 text-blue-700',
  Cancelled: 'bg-red-50 text-red-600',
  Expired: 'bg-muted text-muted-foreground',
  Paid: 'bg-emerald-50 text-emerald-700',
  Unpaid: 'bg-amber-50 text-amber-700',
  Refunded: 'bg-muted text-muted-foreground',
}

export default function TicketingPage() {
  const { events, analytics, loading, error } = useTicketing()
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<TicketEventStats | null>(null)
  const [detailTickets, setDetailTickets] = useState<AdminTicket[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return events
    return events.filter((e) => e.eventName.toLowerCase().includes(needle))
  }, [events, q])
  const eventsPagination = usePagination(filtered, {
    initialPageSize: 20,
    resetKey: q,
  })

  const metrics = [
    { label: 'Total tickets', value: analytics?.summary.totalTickets ?? 0 },
    { label: 'Active', value: analytics?.summary.activeTickets ?? 0 },
    { label: 'Redeemed', value: analytics?.summary.redeemedTickets ?? 0 },
    { label: 'Events', value: events.length },
  ]

  async function openEvent(event: TicketEventStats) {
    setSelected(event)
    setDetailLoading(true)
    setDetailError(null)
    setDetailTickets([])
    try {
      const tickets = await loadEventTickets(event.eventName)
      setDetailTickets(tickets)
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Failed to load event tickets')
    } finally {
      setDetailLoading(false)
    }
  }

  const master = detailTickets.find((t) => {
    const meta = parseMeta(t.metadata)
    return meta.reusable === true || t.usageLimit >= 1_000_000
  })
  const attendees = detailTickets.filter((t) => t.id !== master?.id)
  const attendeesPagination = usePagination(attendees, {
    initialPageSize: 20,
    resetKey: selected?.eventName ?? '',
  })
  const sold = attendees.filter((t) => t.paymentStatus === 'Paid').length
  const unpaid = attendees.filter((t) => t.paymentStatus !== 'Paid').length
  const redeemed = attendees.filter((t) => t.status === 'Redeemed').length
  const revenue = attendees
    .filter((t) => t.paymentStatus === 'Paid')
    .reduce((sum, t) => sum + (t.price || 0), 0)
  const meta = parseMeta(master?.metadata || attendees[0]?.metadata)
  const host = typeof meta.host === 'string' ? meta.host : ''
  const location = typeof meta.location === 'string' ? meta.location : ''
  const payTo = typeof meta.payTo === 'string' ? meta.payTo : ''
  const eventDate = master?.eventDate || attendees[0]?.eventDate

  return (
    <>
      {error && (
        <div style={{ padding: '12px 16px', marginBottom: '16px', background: 'oklch(0.96 0.02 30 / 0.15)', border: '1px solid oklch(0.577 0.245 27.325 / 0.4)', borderRadius: '10px', color: 'oklch(0.577 0.245 27.325)', fontSize: '13px', fontWeight: '500' }}>
          Could not load ticketing: {error}
        </div>
      )}
      {loading && (
        <div className="admin-loading-banner">
          <InlineSpinner label="Loading ticketing…" />
        </div>
      )}

      <div className="admin-metric-grid">
        {metrics.map((c) => (
          <div key={c.label} className="admin-metric-card">
            <span className="metric-label">{c.label}</span>
            <span className="metric-value">{c.value.toLocaleString()}</span>
          </div>
        ))}
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <h3>Events</h3>
            <p>{filtered.length} of {events.length} shown</p>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search events…"
              className="h-8 pl-8 w-56 text-sm"
            />
          </div>
        </div>
        <div className="admin-table-wrap">
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Event', 'Total tickets', 'Sold / paid', 'Sell-through', ''].map((h) => (
                  <th
                    key={h || 'action'}
                    style={{
                      padding: '8px 16px',
                      textAlign: h === 'Sell-through' || h === 'Total tickets' || h === 'Sold / paid' ? 'right' : 'left',
                      fontSize: 10,
                      fontWeight: 500,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'var(--muted-foreground)',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {eventsPagination.pageItems.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '16px', color: 'var(--muted-foreground)' }}>
                    {loading ? <InlineSpinner label="Loading…" /> : 'No events found.'}
                  </td>
                </tr>
              ) : (
                eventsPagination.pageItems.map((event) => {
                  const rate =
                    event.totalTickets > 0
                      ? Math.round((event.purchasedTickets / event.totalTickets) * 100)
                      : 0
                  return (
                    <tr
                      key={event.eventName}
                      style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                      onClick={() => void openEvent(event)}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--muted)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    >
                      <td style={{ padding: '10px 16px', color: 'var(--foreground)', fontWeight: 600 }}>
                        {event.eventName}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace' }}>
                        {event.totalTickets.toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace' }}>
                        {event.purchasedTickets.toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--muted-foreground)' }}>
                        {rate}%
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--muted-foreground)', fontSize: 12 }}>
                        Details →
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar pagination={eventsPagination} hideWhenEmpty={false} />
      </div>

      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null)
            setDetailTickets([])
            setDetailError(null)
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
          <SheetHeader className="border-b border-border px-6 py-4">
            <SheetTitle>{selected?.eventName || 'Event details'}</SheetTitle>
            <SheetDescription>
              Tickets sold, payments, and attendees for this event.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {detailLoading ? (
              <InlineSpinner label="Loading event…" />
            ) : detailError ? (
              <p style={{ color: 'var(--destructive)', fontSize: 13 }}>{detailError}</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Tickets sold', value: String(sold || selected?.purchasedTickets || 0) },
                    { label: 'Unpaid', value: String(unpaid) },
                    { label: 'Redeemed', value: String(redeemed) },
                    { label: 'Revenue', value: currency(revenue) },
                  ].map((card) => (
                    <div
                      key={card.label}
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        padding: '12px 14px',
                        background: 'var(--card)',
                      }}
                    >
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>
                        {card.label}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{card.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gap: 10, fontSize: 13 }}>
                  <DetailRow label="Event date" value={formatDate(eventDate)} />
                  <DetailRow label="Host" value={host || '—'} />
                  <DetailRow label="Location" value={location || '—'} />
                  <DetailRow label="Pay to" value={payTo || '—'} />
                  <DetailRow
                    label="Master QR"
                    value={master ? (master.status === 'Cancelled' ? 'Revoked' : 'Active') : '—'}
                  />
                  <DetailRow
                    label="Total issued"
                    value={String(detailTickets.length || selected?.totalTickets || 0)}
                  />
                </div>

                <div>
                  <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700 }}>Attendee tickets</h4>
                  {attendees.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>
                      No attendee purchases yet.
                    </p>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {attendeesPagination.pageItems.map((t) => (
                          <div
                            key={t.id}
                            style={{
                              border: '1px solid var(--border)',
                              borderRadius: 12,
                              padding: '12px 14px',
                              display: 'grid',
                              gap: 6,
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                              <strong style={{ fontSize: 13 }}>{t.holderName || 'Guest'}</strong>
                              <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                                {currency(t.price, t.currency)}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                              {t.ticketType}
                              {t.holderEmail ? ` · ${t.holderEmail}` : ''}
                              {t.holderPhone ? ` · ${t.holderPhone}` : ''}
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <Badge variant="secondary" className={STATUS_CLASS[t.paymentStatus] ?? ''}>
                                {t.paymentStatus}
                              </Badge>
                              <Badge variant="secondary" className={STATUS_CLASS[t.status] ?? ''}>
                                {t.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                      <PaginationBar pagination={attendeesPagination} />
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: 'var(--muted-foreground)' }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  )
}
