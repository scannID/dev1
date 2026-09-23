import { useEffect, useRef, useState } from 'react'
import { CalendarDays, MapPin, Tag, Ticket, X } from 'lucide-react'
import { promotionsApi } from '../api/services'
import type { NearbyPromotedEvent } from '../api/types'

// ── helpers ───────────────────────────────────────────────────────────────────

function formatEventDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return null
  }
}

function formatPrice(lowestPrice: number, classNames: string[]): string {
  if (lowestPrice === 0) return classNames.length ? 'Free entry' : 'Check tickets'
  return `From ${lowestPrice.toLocaleString()} UGX`
}

function formatDist(km: number): string | null {
  if (km < 0) return null
  if (km < 1) return `${Math.round(km * 1000)} m away`
  return `${km.toFixed(1)} km away`
}

// ── EventCard ─────────────────────────────────────────────────────────────────

function EventCard({
  event,
  onBuy,
}: {
  event: NearbyPromotedEvent
  onBuy: (event: NearbyPromotedEvent) => void
}) {
  const dateLabel = formatEventDate(event.eventDate)
  const distLabel = formatDist(event.distanceKm)
  const priceLabel = formatPrice(event.lowestPrice, event.ticketClassNames)

  return (
    <div className="en-card" role="article">
      {event.eventImageUrl ? (
        <div className="en-card-img">
          <img src={event.eventImageUrl} alt={event.eventName} loading="lazy" />
          <span className="en-card-category-badge">{event.category}</span>
        </div>
      ) : (
        <div className="en-card-img en-card-img--placeholder">
          <Ticket size={28} aria-hidden="true" />
          <span className="en-card-category-badge">{event.category}</span>
        </div>
      )}

      <div className="en-card-body">
        <p className="en-card-host">{event.host || 'Live Event'}</p>
        <h3 className="en-card-title">{event.eventName}</h3>

        <div className="en-card-meta">
          {dateLabel && (
            <span className="en-card-meta-item">
              <CalendarDays size={11} aria-hidden="true" />
              {dateLabel}
            </span>
          )}
          {event.venueAddress && (
            <span className="en-card-meta-item">
              <MapPin size={11} aria-hidden="true" />
              {distLabel ? `${distLabel} · ${event.venueAddress}` : event.venueAddress}
            </span>
          )}
          <span className="en-card-meta-item">
            <Tag size={11} aria-hidden="true" />
            {priceLabel}
          </span>
        </div>

        <button
          type="button"
          className="en-card-cta"
          onClick={() => onBuy(event)}
          aria-label={`Buy tickets for ${event.eventName}`}
        >
          Buy Tickets
        </button>
      </div>
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function EventsNearbyPanel({
  open,
  venueLat,
  venueLng,
  onClose,
}: {
  open: boolean
  venueLat?: number | null
  venueLng?: number | null
  onClose: () => void
}) {
  const [events, setEvents] = useState<NearbyPromotedEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!open || fetchedRef.current) return
    fetchedRef.current = true
    setLoading(true)
    setError(null)

    promotionsApi
      .nearby(venueLat, venueLng)
      .then((res) => {
        setEvents(res.events)
        // Record impressions for all returned events (best-effort, fire-and-forget)
        res.events.forEach((ev) => {
          promotionsApi.impression(ev.promotionId)
        })
      })
      .catch(() => setError('Could not load events right now.'))
      .finally(() => setLoading(false))
  }, [open, venueLat, venueLng])

  function handleBuy(event: NearbyPromotedEvent) {
    promotionsApi.click(event.promotionId)
    window.open(event.purchaseUrl, '_blank', 'noopener,noreferrer')
  }

  if (!open) return null

  return (
    <div className="cm-track-overlay en-overlay" role="dialog" aria-modal="true" aria-label="What's happening nearby">
      <button
        type="button"
        className="cm-track-backdrop"
        aria-label="Close events panel"
        onClick={onClose}
      />

      <div className="cm-track-sheet en-sheet">
        {/* Header */}
        <div className="cm-track-sheet-header">
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>What's Happening 🎟️</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--cm-muted)' }}>
              Events &amp; shows near you
            </p>
          </div>
          <button type="button" className="cm-track-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        {loading && (
          <div className="en-loading" aria-live="polite" aria-busy="true">
            <span className="en-loading-dots">
              <span /><span /><span />
            </span>
            <p>Loading events…</p>
          </div>
        )}

        {!loading && error && (
          <div className="en-empty">
            <Ticket size={26} aria-hidden="true" />
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && events.length === 0 && (
          <div className="en-empty">
            <Ticket size={26} aria-hidden="true" />
            <p>No events found near this location right now.</p>
            <span>Check back soon — events are added daily.</span>
          </div>
        )}

        {!loading && events.length > 0 && (
          <div className="en-list">
            {events.map((ev) => (
              <EventCard key={ev.promotionId} event={ev} onBuy={handleBuy} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Compact post-order card (shown on DoneStep) ───────────────────────────────

export function NearbyEventsBanner({
  venueLat,
  venueLng,
}: {
  venueLat?: number | null
  venueLng?: number | null
}) {
  const [events, setEvents] = useState<NearbyPromotedEvent[]>([])
  const [dismissed, setDismissed] = useState(false)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    promotionsApi
      .nearby(venueLat, venueLng)
      .then((res) => {
        const top = res.events.slice(0, 3)
        setEvents(top)
        top.forEach((ev) => promotionsApi.impression(ev.promotionId))
      })
      .catch(() => {/* silent */})
  }, [venueLat, venueLng])

  if (dismissed || events.length === 0) return null

  return (
    <div className="en-banner" role="region" aria-label="Events near you">
      <div className="en-banner-header">
        <span className="en-banner-title">🎟️ What's happening near you</span>
        <button
          type="button"
          className="en-banner-dismiss"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>

      <div className="en-banner-cards">
        {events.map((ev) => {
          const dateLabel = formatEventDate(ev.eventDate)
          const priceLabel = formatPrice(ev.lowestPrice, ev.ticketClassNames)
          return (
            <a
              key={ev.promotionId}
              href={ev.purchaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="en-banner-card"
              onClick={() => promotionsApi.click(ev.promotionId)}
              aria-label={`${ev.eventName} — ${priceLabel}`}
            >
              {ev.eventImageUrl ? (
                <img src={ev.eventImageUrl} alt="" className="en-banner-card-img" loading="lazy" />
              ) : (
                <div className="en-banner-card-img en-banner-card-img--empty">
                  <Ticket size={20} aria-hidden="true" />
                </div>
              )}
              <div className="en-banner-card-body">
                <p className="en-banner-card-name">{ev.eventName}</p>
                {dateLabel && <p className="en-banner-card-date">{dateLabel}</p>}
                <p className="en-banner-card-price">{priceLabel}</p>
              </div>
            </a>
          )
        })}
      </div>
    </div>
  )
}
