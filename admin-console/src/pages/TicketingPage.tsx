import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { DateTimePicker } from '@/components/ui/date-picker'
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
import { adminApi } from '../api/services'
import type { AdminTicket, CreatedEventSummary, UpdateCreatedEventRequest } from '../api/types'

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

function formatDate(iso?: string | null) {
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

function autoDeleteLabel(iso?: string | null) {
  if (!iso) return '—'
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return '—'
  const ms = at.getTime() - Date.now()
  if (ms <= 0) return 'Due for cleanup'
  const hours = Math.ceil(ms / (60 * 60 * 1000))
  if (hours < 48) return `in ${hours}h`
  const days = Math.ceil(hours / 24)
  return `in ${days}d`
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

type EditableClass = { name: string; fee: string; capacity: string }
type EditableTable = { name: string; seats: string; price: string; capacity: string }
type EventEditForm = {
  eventName: string
  eventDate: string
  host: string
  hostContact: string
  location: string
  payTo: string
  template: string
  eventImageUrl: string
  ticketType: string
  basePrice: string
  classes: EditableClass[]
  tables: EditableTable[]
}

function toDateTimeLocal(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day}T${h}:${min}`
}

function toIntString(value: unknown) {
  if (value == null) return ''
  const n = Number(value)
  return Number.isFinite(n) ? String(Math.trunc(n)) : ''
}

function buildEditForm(
  selected: CreatedEventSummary | null,
  master: AdminTicket | undefined,
  meta: Record<string, unknown>,
): EventEditForm {
  const rawClasses = Array.isArray(meta.ticketClasses) ? meta.ticketClasses : []
  const rawTables = Array.isArray(meta.tables) ? meta.tables : []
  const classes: EditableClass[] = rawClasses
    .map((c) => {
      const item = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>
      return {
        name: typeof item.name === 'string' ? item.name : '',
        fee: toIntString(item.fee),
        capacity: toIntString(item.capacity),
      }
    })
    .filter((c) => c.name.trim())
  const tables: EditableTable[] = rawTables
    .map((t) => {
      const item = (t && typeof t === 'object' ? t : {}) as Record<string, unknown>
      return {
        name: typeof item.name === 'string' ? item.name : '',
        seats: toIntString(item.seats),
        price: toIntString(item.price),
        capacity: toIntString(item.capacity),
      }
    })
    .filter((t) => t.name.trim())

  return {
    eventName: selected?.eventName ?? master?.eventName ?? '',
    eventDate: toDateTimeLocal(selected?.eventDate ?? master?.eventDate ?? null),
    host: typeof meta.host === 'string' ? meta.host : selected?.host ?? '',
    hostContact: typeof meta.hostContact === 'string' ? meta.hostContact : '',
    location: typeof meta.location === 'string' ? meta.location : selected?.location ?? '',
    payTo: typeof meta.payTo === 'string' ? meta.payTo : '',
    template: typeof meta.template === 'string' ? meta.template : 'classic',
    eventImageUrl: typeof meta.eventImageUrl === 'string' ? meta.eventImageUrl : '',
    ticketType: master?.ticketType ?? classes[0]?.name ?? 'EVENT',
    basePrice: String(master?.price ?? Number(classes[0]?.fee || 0)),
    classes: classes.length > 0 ? classes : [{ name: master?.ticketType ?? 'Ordinary', fee: String(master?.price ?? 0), capacity: '' }],
    tables,
  }
}

export default function TicketingPage() {
  const { createdEvents, analytics, loading, error, refresh } = useTicketing()
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<CreatedEventSummary | null>(null)
  const [detailTickets, setDetailTickets] = useState<AdminTicket[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EventEditForm | null>(null)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return createdEvents
    return createdEvents.filter(
      (e) =>
        e.eventName.toLowerCase().includes(needle) ||
        e.eventId.toLowerCase().includes(needle) ||
        e.host.toLowerCase().includes(needle),
    )
  }, [createdEvents, q])
  const eventsPagination = usePagination(filtered, {
    initialPageSize: 20,
    resetKey: q,
  })

  const metrics = [
    { label: 'Total tickets', value: analytics?.summary.totalTickets ?? 0 },
    { label: 'Active', value: analytics?.summary.activeTickets ?? 0 },
    { label: 'Redeemed', value: analytics?.summary.redeemedTickets ?? 0 },
    { label: 'Created events', value: createdEvents.length },
  ]

  async function openEvent(event: CreatedEventSummary) {
    setSelected(event)
    setDetailLoading(true)
    setDetailError(null)
    setDetailTickets([])
    setEditing(false)
    setSaveMessage(null)
    setEditForm(null)
    try {
      const tickets = await loadEventTickets(event.eventName)
      setDetailTickets(tickets)
      const selectedMaster = tickets.find((t) => {
        const meta = parseMeta(t.metadata)
        return meta.reusable === true || t.usageLimit >= 1_000_000 || t.id === event.eventId
      })
      const selectedMeta = parseMeta(selectedMaster?.metadata || tickets[0]?.metadata)
      setEditForm(buildEditForm(event, selectedMaster, selectedMeta))
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Failed to load event tickets')
    } finally {
      setDetailLoading(false)
    }
  }

  const master = detailTickets.find((t) => {
    const meta = parseMeta(t.metadata)
    return meta.reusable === true || t.usageLimit >= 1_000_000 || t.id === selected?.eventId
  })
  const attendees = detailTickets.filter((t) => t.id !== master?.id)
  const attendeesPagination = usePagination(attendees, {
    initialPageSize: 20,
    resetKey: selected?.eventId ?? '',
  })
  const sold = selected?.paidTickets ?? attendees.filter((t) => t.paymentStatus === 'Paid').length
  const unpaid = attendees.filter((t) => t.paymentStatus !== 'Paid').length
  const redeemed = selected?.redeemedTickets ?? attendees.filter((t) => t.status === 'Redeemed').length
  const revenue = attendees
    .filter((t) => t.paymentStatus === 'Paid')
    .reduce((sum, t) => sum + (t.price || 0), 0)
  const meta = parseMeta(master?.metadata || attendees[0]?.metadata)
  const host = selected?.host || (typeof meta.host === 'string' ? meta.host : '')
  const hostContact = typeof meta.hostContact === 'string' ? meta.hostContact : ''
  const location = selected?.location || (typeof meta.location === 'string' ? meta.location : '')
  const payTo = typeof meta.payTo === 'string' ? meta.payTo : ''
  const eventDate = selected?.eventDate || master?.eventDate || attendees[0]?.eventDate

  function updateEditField<K extends keyof EventEditForm>(key: K, value: EventEditForm[K]) {
    setEditForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function saveEventEdits() {
    if (!selected || !editForm) return
    const classes = editForm.classes
      .map((c) => ({
        name: c.name.trim(),
        fee: Number(c.fee || 0),
        capacity: c.capacity.trim() ? Number(c.capacity) : null,
      }))
      .filter((c) => c.name.length > 0)
    if (classes.length === 0) {
      setSaveMessage('Add at least one ticket class before saving.')
      return
    }
    if (classes.some((c) => Number.isNaN(c.fee) || c.fee < 0)) {
      setSaveMessage('Each ticket class needs a valid non-negative fee.')
      return
    }
    if (classes.some((c) => c.capacity != null && (!Number.isFinite(c.capacity) || c.capacity <= 0))) {
      setSaveMessage('Class capacity must be greater than 0 when provided.')
      return
    }
    const tables = editForm.tables
      .map((t) => ({
        name: t.name.trim(),
        seats: Number(t.seats || 0),
        price: Number(t.price || 0),
        capacity: t.capacity.trim() ? Number(t.capacity) : null,
      }))
      .filter((t) => t.name.length > 0)
    if (tables.some((t) => Number.isNaN(t.seats) || t.seats < 0 || Number.isNaN(t.price) || t.price < 0)) {
      setSaveMessage('Each table needs valid non-negative seats and price values.')
      return
    }
    if (tables.some((t) => t.capacity != null && (!Number.isFinite(t.capacity) || t.capacity <= 0))) {
      setSaveMessage('Table capacity must be greater than 0 when provided.')
      return
    }

    const payload: UpdateCreatedEventRequest = {
      eventName: editForm.eventName.trim(),
      eventDate: editForm.eventDate ? new Date(editForm.eventDate).toISOString() : null,
      ticketType: editForm.ticketType.trim() || classes[0]?.name || 'EVENT',
      price: Number(editForm.basePrice || classes[0]?.fee || 0),
      currency: master?.currency || 'UGX',
      template: editForm.template.trim() || 'classic',
      payTo: editForm.payTo.trim(),
      location: editForm.location.trim(),
      time: editForm.eventDate ? editForm.eventDate.split('T')[1] || '' : '',
      host: editForm.host.trim(),
      hostContact: editForm.hostContact.trim(),
      eventImageUrl: editForm.eventImageUrl.trim(),
      ticketClasses: classes.map((c) => ({
        name: c.name,
        fee: Math.max(0, Math.trunc(c.fee)),
        ...(c.capacity != null ? { capacity: Math.trunc(c.capacity) } : {}),
      })),
      tables: tables.map((t) => ({
        name: t.name,
        seats: Math.max(0, Math.trunc(t.seats)),
        price: Math.max(0, Math.trunc(t.price)),
        ...(t.capacity != null ? { capacity: Math.trunc(t.capacity) } : {}),
      })),
    }
    if (!payload.eventName) {
      setSaveMessage('Event name is required.')
      return
    }
    if (Number.isNaN(payload.price) || payload.price < 0) {
      setSaveMessage('Base event price must be a valid non-negative number.')
      return
    }

    try {
      setSavingEdit(true)
      setSaveMessage(null)
      await adminApi.tickets.updateCreatedEvent(selected.eventId, payload)
      await Promise.all([openEvent(selected), refresh()])
      setEditing(false)
      setSaveMessage('Event updated successfully.')
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Failed to save event changes.')
    } finally {
      setSavingEdit(false)
    }
  }

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
            <h3>Created events</h3>
            <p>
              {filtered.length} of {createdEvents.length} shown · auto-deleted 24h after event date
            </p>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search events or ID…"
              className="h-8 pl-8 w-56 text-sm"
            />
          </div>
        </div>
        <div className="admin-table-wrap">
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Event', 'Event ID', 'Date', 'Sold', 'Redeemed', 'Auto-delete', ''].map((h) => (
                  <th
                    key={h || 'action'}
                    style={{
                      padding: '8px 16px',
                      textAlign:
                        h === 'Sold' || h === 'Redeemed' || h === 'Auto-delete' ? 'right' : 'left',
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
                  <td colSpan={7} style={{ padding: '16px', color: 'var(--muted-foreground)' }}>
                    {loading ? <InlineSpinner label="Loading…" /> : 'No created events yet.'}
                  </td>
                </tr>
              ) : (
                eventsPagination.pageItems.map((event) => (
                  <tr
                    key={event.eventId}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    onClick={() => void openEvent(event)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--muted)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '10px 16px', color: 'var(--foreground)', fontWeight: 600 }}>
                      <div>{event.eventName}</div>
                      {event.host ? (
                        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 400, marginTop: 2 }}>
                          {event.host}
                          {event.location ? ` · ${event.location}` : ''}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12 }}>
                      {event.eventId}
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>
                      {formatDate(event.eventDate)}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace' }}>
                      {event.paidTickets.toLocaleString()}
                      <span style={{ color: 'var(--muted-foreground)' }}>
                        /{event.attendeeTickets.toLocaleString()}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace' }}>
                      {event.redeemedTickets.toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--muted-foreground)', fontSize: 12 }}>
                      {autoDeleteLabel(event.autoDeleteAt)}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--muted-foreground)', fontSize: 12 }}>
                      Details →
                    </td>
                  </tr>
                ))
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
            setEditing(false)
            setEditForm(null)
            setSaveMessage(null)
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
          <SheetHeader className="border-b border-border px-6 py-4">
            <SheetTitle>{selected?.eventName || 'Event details'}</SheetTitle>
            <SheetDescription>
              Created event #{selected?.eventId} · tickets auto-delete 24h after event date.
            </SheetDescription>
            {!detailLoading && !detailError && selected ? (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                {editing ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(false)
                        setSaveMessage(null)
                        setEditForm(buildEditForm(selected, master, meta))
                      }}
                      style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}
                      disabled={savingEdit}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveEventEdits()}
                      style={{ border: '1px solid #111827', background: '#111827', color: '#fff', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}
                      disabled={savingEdit}
                    >
                      {savingEdit ? 'Saving…' : 'Save changes'}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(true)
                      setSaveMessage(null)
                    }}
                    style={{ border: '1px solid #111827', background: '#111827', color: '#fff', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}
                  >
                    Edit event
                  </button>
                )}
              </div>
            ) : null}
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {detailLoading ? (
              <InlineSpinner label="Loading event…" />
            ) : detailError ? (
              <p style={{ color: 'var(--destructive)', fontSize: 13 }}>{detailError}</p>
            ) : (
              editing && editForm ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  {saveMessage ? (
                    <p style={{ margin: 0, fontSize: 12, color: saveMessage.includes('success') ? 'var(--foreground)' : 'var(--destructive)' }}>
                      {saveMessage}
                    </p>
                  ) : null}
                  <label style={{ display: 'grid', gap: 6, fontSize: 12 }}>
                    Event name
                    <Input value={editForm.eventName} onChange={(e) => updateEditField('eventName', e.target.value)} />
                  </label>
                  <label style={{ display: 'grid', gap: 6, fontSize: 12 }}>
                    Event date/time
                    <DateTimePicker
                      value={editForm.eventDate}
                      onChange={(v) => updateEditField('eventDate', v)}
                      placeholder="Pick date & time"
                      aria-label="Event date and time"
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 6, fontSize: 12 }}>
                    Host
                    <Input value={editForm.host} onChange={(e) => updateEditField('host', e.target.value)} />
                  </label>
                  <label style={{ display: 'grid', gap: 6, fontSize: 12 }}>
                    Host contact
                    <Input value={editForm.hostContact} onChange={(e) => updateEditField('hostContact', e.target.value)} />
                  </label>
                  <label style={{ display: 'grid', gap: 6, fontSize: 12 }}>
                    Location
                    <Input value={editForm.location} onChange={(e) => updateEditField('location', e.target.value)} />
                  </label>
                  <label style={{ display: 'grid', gap: 6, fontSize: 12 }}>
                    Pay to
                    <Input value={editForm.payTo} onChange={(e) => updateEditField('payTo', e.target.value)} />
                  </label>
                  <label style={{ display: 'grid', gap: 6, fontSize: 12 }}>
                    Ticket type
                    <Input value={editForm.ticketType} onChange={(e) => updateEditField('ticketType', e.target.value)} />
                  </label>
                  <label style={{ display: 'grid', gap: 6, fontSize: 12 }}>
                    Base event price (UGX)
                    <Input value={editForm.basePrice} onChange={(e) => updateEditField('basePrice', e.target.value)} />
                  </label>
                  <label style={{ display: 'grid', gap: 6, fontSize: 12 }}>
                    Event image URL
                    <Input value={editForm.eventImageUrl} onChange={(e) => updateEditField('eventImageUrl', e.target.value)} />
                  </label>

                  <div style={{ display: 'grid', gap: 8 }}>
                    <strong style={{ fontSize: 12 }}>Ticket classes</strong>
                    {editForm.classes.map((cls, i) => (
                      <div key={`cls-${i}`} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, display: 'grid', gap: 8 }}>
                        <Input value={cls.name} onChange={(e) => {
                          const next = [...editForm.classes]
                          next[i] = { ...next[i], name: e.target.value }
                          updateEditField('classes', next)
                        }} placeholder="Class name" />
                        <Input value={cls.fee} onChange={(e) => {
                          const next = [...editForm.classes]
                          next[i] = { ...next[i], fee: e.target.value }
                          updateEditField('classes', next)
                        }} placeholder="Fee" />
                        <Input value={cls.capacity} onChange={(e) => {
                          const next = [...editForm.classes]
                          next[i] = { ...next[i], capacity: e.target.value }
                          updateEditField('classes', next)
                        }} placeholder="Capacity (optional)" />
                      </div>
                    ))}
                    <button type="button" onClick={() => updateEditField('classes', [...editForm.classes, { name: '', fee: '', capacity: '' }])} style={{ border: '1px dashed var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}>
                      + Add class
                    </button>
                  </div>

                  <div style={{ display: 'grid', gap: 8 }}>
                    <strong style={{ fontSize: 12 }}>Tables</strong>
                    {editForm.tables.map((tbl, i) => (
                      <div key={`tbl-${i}`} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, display: 'grid', gap: 8 }}>
                        <Input value={tbl.name} onChange={(e) => {
                          const next = [...editForm.tables]
                          next[i] = { ...next[i], name: e.target.value }
                          updateEditField('tables', next)
                        }} placeholder="Table name" />
                        <Input value={tbl.seats} onChange={(e) => {
                          const next = [...editForm.tables]
                          next[i] = { ...next[i], seats: e.target.value }
                          updateEditField('tables', next)
                        }} placeholder="Seats" />
                        <Input value={tbl.price} onChange={(e) => {
                          const next = [...editForm.tables]
                          next[i] = { ...next[i], price: e.target.value }
                          updateEditField('tables', next)
                        }} placeholder="Price" />
                        <Input value={tbl.capacity} onChange={(e) => {
                          const next = [...editForm.tables]
                          next[i] = { ...next[i], capacity: e.target.value }
                          updateEditField('tables', next)
                        }} placeholder="Capacity (optional)" />
                      </div>
                    ))}
                    <button type="button" onClick={() => updateEditField('tables', [...editForm.tables, { name: '', seats: '', price: '', capacity: '' }])} style={{ border: '1px dashed var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}>
                      + Add table
                    </button>
                  </div>
                </div>
              ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Tickets sold', value: String(sold) },
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
                  <DetailRow label="Event ID" value={selected?.eventId || '—'} />
                  <DetailRow label="Event date" value={formatDate(eventDate)} />
                  <DetailRow label="Auto-delete" value={formatDate(selected?.autoDeleteAt)} />
                  <DetailRow label="Host name" value={host || '—'} />
                  <DetailRow label="Host contact" value={hostContact || '—'} />
                  <DetailRow label="Location" value={location || '—'} />
                  <DetailRow label="Pay to" value={payTo || '—'} />
                  <DetailRow
                    label="Master QR"
                    value={master ? (master.status === 'Cancelled' ? 'Revoked' : 'Active') : selected?.status || '—'}
                  />
                  <DetailRow
                    label="Purchase link"
                    value={selected?.purchaseUrl || master?.qrCodeUrl || '—'}
                  />
                  <DetailRow
                    label="Total issued"
                    value={String(detailTickets.length || (selected?.attendeeTickets ?? 0) + 1)}
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
              )
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
      <span style={{ fontWeight: 600, textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
    </div>
  )
}
