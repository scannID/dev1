import { useEffect, useState } from 'react'
import { loadCreatedEvents, type LocalCreatedEvent } from './createdEventsLocal'
import { usePageMeta } from '../hooks/usePageMeta'
import './TicketCustomer.css'
import './EventsDiscovery.css'

function formatEventDate(iso?: string | null) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return null
  }
}

function dayMonth(iso?: string | null): { day: string; month: string } | null {
  if (!iso) return null
  try {
    const d = new Date(iso)
    return {
      day: d.getDate().toString(),
      month: d.toLocaleString(undefined, { month: 'short' }).toUpperCase(),
    }
  } catch {
    return null
  }
}

function isUpcoming(iso?: string | null) {
  if (!iso) return true
  return new Date(iso).getTime() >= Date.now() - 1000 * 60 * 60 * 6 // within 6h past still "on"
}

export default function EventsDiscoveryPage() {
  usePageMeta({
    title: 'Events — Kodte',
    description: 'Discover and manage events on Kodte. Buy tickets, scan QR codes at the gate.',
    robots: 'noindex, nofollow',
  })

  const [events, setEvents] = useState<LocalCreatedEvent[]>(() => loadCreatedEvents())
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all')

  useEffect(() => {
    document.documentElement.classList.add('tk-app')
    document.body.classList.add('tk-app')
    return () => {
      document.documentElement.classList.remove('tk-app')
      document.body.classList.remove('tk-app')
    }
  }, [])

  useEffect(() => {
    const refresh = () => setEvents(loadCreatedEvents())
    window.addEventListener('focus', refresh)
    window.addEventListener('kodte-created-events', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('kodte-created-events', refresh)
    }
  }, [])

  const filtered = events.filter((e) => {
    if (filter === 'upcoming') return isUpcoming(e.eventDate)
    if (filter === 'past') return !isUpcoming(e.eventDate)
    return true
  })

  return (
    <div className="tk-shell ed-shell">
      {/* ── Topbar ── */}
      <header className="tk-topbar">
        <div className="tk-brand">
          <strong>Kodte</strong>
          <span>Events</span>
        </div>
        <a
          href="/create-event"
          className="ed-upload-btn"
        >
          Upload Event ↑
        </a>
      </header>

      {/* ── Hero ── */}
      <div className="ed-hero">
        <p className="ed-hero-eyebrow">Live · Malawi</p>
        <h1 className="ed-hero-title">Find what's<br />happening tonight.</h1>
        <p className="ed-hero-sub">
          Tickets, venues and experiences — search, book and walk in with a QR code.
        </p>
      </div>

      {/* ── Filter tabs ── */}
      <div className="ed-tabs">
        {(['all', 'upcoming', 'past'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`ed-tab${filter === t ? ' is-active' : ''}`}
            onClick={() => setFilter(t)}
          >
            {t === 'all' ? 'All Events' : t === 'upcoming' ? 'Upcoming' : 'Past'}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <main className="ed-main">
        {filtered.length === 0 ? (
          <div className="ed-empty">
            <div className="ed-empty-icon">🎟️</div>
            <h2>No events yet</h2>
            <p>Create your first event and it will appear here.</p>
            <a href="/create-event" className="ed-upload-btn" style={{ marginTop: 16 }}>
              Upload Event ↑
            </a>
          </div>
        ) : (
          <div className="ed-grid">
            {filtered.map((event) => (
              <EventCard key={event.eventId} event={event} />
            ))}
          </div>
        )}
      </main>

      <footer className="ed-footer">
        © {new Date().getFullYear()} Kodte · All events, all in one place.
      </footer>
    </div>
  )
}

function EventCard({ event }: { event: LocalCreatedEvent }) {
  const dm = dayMonth(event.eventDate)
  const dateLabel = formatEventDate(event.eventDate)
  const upcoming = isUpcoming(event.eventDate)

  return (
    <div className="ed-card tk-enter">
      {/* Coloured thumb */}
      <div className="ed-card-thumb">
        {event.formSnapshot?.eventImageUrl ? (
          <img src={event.formSnapshot.eventImageUrl} alt="" className="ed-card-img" />
        ) : (
          <div className="ed-card-thumb-placeholder" />
        )}
        {dm && (
          <div className="ed-date-badge">
            <span className="ed-date-day">{dm.day}</span>
            <span className="ed-date-month">{dm.month}</span>
          </div>
        )}
        {!upcoming && (
          <span className="ed-past-chip">Past</span>
        )}
      </div>

      {/* Body */}
      <div className="ed-card-body">
        {event.location && (
          <p className="ed-card-loc">📍 {event.location}</p>
        )}
        <h3 className="ed-card-title">{event.eventName}</h3>
        {dateLabel && (
          <p className="ed-card-date">🗓 {dateLabel}</p>
        )}
        {event.host && (
          <p className="ed-card-host">By {event.host}</p>
        )}

        <div className="ed-card-foot">
          <a
            href={event.purchaseUrl}
            className="ed-buy-btn"
          >
            Buy Ticket
          </a>
          <a
            href={`/create-event?edit=${encodeURIComponent(event.eventId)}`}
            className="ed-manage-btn"
          >
            Manage
          </a>
        </div>
      </div>
    </div>
  )
}
