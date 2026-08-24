import { useEffect, useRef, useState } from 'react'

import { loadCreatedEvents, type LocalCreatedEvent } from './createdEventsLocal'
import { usePageMeta } from '../hooks/usePageMeta'

/* =====================================================================
   Events Discovery Page

   — same visual language as the Kodte landing page
   — warm paper background: #efe6d2
   — warm surfaces: #f7f1e3
   — warm ink + subtle brown dividers
   — real events from localStorage
   — real QR codes pointing to each event's purchaseUrl
   — Outfit + Bebas Neue

   CHANGE LOG (this pass):
   — QR codes are no longer laid out inline inside the ticket's text
     content. Each ticket now has a die-cut notch at its bottom-right
     corner (like a real ticket stub), with the QR sitting in that
     notch — visually "outside" the card's content flow, tucked into
     its own corner instead of competing with the copy/buttons.
   ===================================================================== */


/* ---------------------------------------------------------------------
   QR CODE HELPER
   --------------------------------------------------------------------- */

declare global {
  interface Window {
    QRCode?: any
  }
}

let _qrLibPromise: Promise<void> | null = null

function loadQrLib(): Promise<void> {
  if (typeof window !== 'undefined' && window.QRCode) {
    return Promise.resolve()
  }

  if (_qrLibPromise) {
    return _qrLibPromise
  }

  _qrLibPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')

    s.src =
      'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'

    s.async = true

    s.onload = () => resolve()
    s.onerror = () => reject()

    document.head.appendChild(s)
  })

  return _qrLibPromise
}

function QRWidget({
  value,
  size = 40,
  className,
  colorDark = '#26201a',
  colorLight = '#f7f1e3',
}: {
  value: string
  size?: number
  className?: string
  colorDark?: string
  colorLight?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    const node = ref.current

    if (!node || !value) return

    loadQrLib()
      .then(() => {
        if (cancelled || !node) return

        node.innerHTML = ''

        new window.QRCode(node, {
          text: value,
          width: size,
          height: size,
          colorDark,
          colorLight,
          correctLevel: window.QRCode.CorrectLevel.H,
        })
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [value, size, colorDark, colorLight])

  return (
    <div
      ref={ref}
      className={className}
      aria-label="QR code"
    />
  )
}


/* ---------------------------------------------------------------------
   GRADIENT PALETTE
   --------------------------------------------------------------------- */

const GRADIENTS = [
  'linear-gradient(160deg,#1c2a52 0%, #3a2361 55%, #0d1220 100%)',
  'linear-gradient(160deg,#3a1c2e 0%, #611f39 55%, #120d16 100%)',
  'linear-gradient(160deg,#12312c 0%, #1c5c47 55%, #0c1512 100%)',
  'linear-gradient(160deg,#3a2b12 0%, #5c3b1c 55%, #120c04 100%)',
  'linear-gradient(160deg,#7a2b3a 0%, #2b0f16 55%, #120408 100%)',
  'linear-gradient(160deg,#1f6b5e 0%, #0d2b26 55%, #04120f 100%)',
  'linear-gradient(160deg,#4a2c8a 0%, #150d33 55%, #07041a 100%)',
  'linear-gradient(160deg,#1a3a6b 0%, #0d1e3a 55%, #040a18 100%)',
]

function gradientFor(index: number) {
  return GRADIENTS[index % GRADIENTS.length]
}


/* ---------------------------------------------------------------------
   DATE HELPERS
   --------------------------------------------------------------------- */

function formatDateLabel(iso?: string | null): string | null {
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

function dayMonth(
  iso?: string | null,
): { day: string; month: string } | null {
  if (!iso) return null

  try {
    const d = new Date(iso)

    return {
      day: d.getDate().toString(),
      month: d
        .toLocaleString(undefined, { month: 'short' })
        .toUpperCase(),
    }
  } catch {
    return null
  }
}

function timeFromSnapshot(event: LocalCreatedEvent): string {
  const t = event.formSnapshot?.time

  if (!t) return ''

  try {
    const [h, m] = t.split(':').map(Number)

    const d = new Date()

    d.setHours(h, m)

    return d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return t
  }
}

function resolvePurchaseUrl(ev: LocalCreatedEvent): string {
  return ev.purchaseUrl.startsWith('http')
    ? ev.purchaseUrl
    : `${window.location.origin}${ev.purchaseUrl}`
}


/* ---------------------------------------------------------------------
   CAROUSEL
   --------------------------------------------------------------------- */

function EventCarousel({
  events,
}: {
  events: LocalCreatedEvent[]
}) {
  const [index, setIndex] = useState(0)

  const timerRef =
    useRef<ReturnType<typeof setInterval> | null>(null)

  const count = events.length

  function goTo(i: number) {
    if (!count) return

    setIndex(((i % count) + count) % count)
  }

  useEffect(() => {
    if (!count) return

    if (timerRef.current) {
      clearInterval(timerRef.current)
    }

    timerRef.current = setInterval(() => {
      setIndex((p) => (p + 1) % count)
    }, 5000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [index, count])

  if (count === 0) {
    return (
      <div
        className="carousel carousel-empty"
        style={{
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <div className="empty-state">
          <div className="empty-state-mark">K</div>

          <p>No events yet.</p>

          <span>
            Create an event to see it appear here.
          </span>
        </div>
      </div>
    )
  }

  const current = events[index]
  const currentPurchaseUrl = resolvePurchaseUrl(current)

  return (
    <div className="carousel">
      {/* carousel-frame is the clipped, rounded photo/track layer.
          It has a diagonal notch cut out of its bottom-right corner
          (clip-path), so the ticket-stub sitting behind it shows
          through that corner only — nothing else about the layout
          needs to know about the QR. */}
      <div className="carousel-frame">
        <div
          className="carousel-track"
          style={{
            transform: `translateX(-${index * 100}%)`,
          }}
        >
          {events.map((ev, i) => {
            const bg = ev.formSnapshot?.eventImageUrl
              ? `url(${ev.formSnapshot.eventImageUrl}) center/cover`
              : gradientFor(i)

            const dateLabel = formatDateLabel(ev.eventDate)
            const timeLabel = timeFromSnapshot(ev)

            return (
              <div className="slide" key={ev.eventId}>
                <div
                  className="slide-bg"
                  style={{ background: bg }}
                />

                <div className="slide-tag">
                  <span className="slide-tag-dot" />
                  Trending
                </div>

                <div className="slide-content">
                  <div className="cat">
                    {ev.host || 'Live Event'}
                  </div>

                  <h3>{ev.eventName}</h3>

                  <div className="slide-meta">
                    {dateLabel && (
                      <span>
                        <span className="meta-icon">◷</span>
                        {dateLabel}
                      </span>
                    )}

                    {timeLabel && (
                      <span>
                        <span className="meta-icon">◴</span>
                        {timeLabel}
                      </span>
                    )}
                  </div>

                  {ev.location && (
                    <div className="slide-loc">
                      <span>⌖</span>
                      {ev.location}
                    </div>
                  )}

                  <div className="slide-actions">
                    <a
                      href={ev.purchaseUrl}
                      className="btn btn-ghost-white"
                    >
                      Buy Tickets
                    </a>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* QR badge — a circular chip overlapping the bottom-right
          corner of the ticket, half on / half off the card, always
          reflecting whichever slide is currently showing. */}
      <div className="ticket-stub">
        <div className="ticket-stub-qr">
          <QRWidget
            value={currentPurchaseUrl}
            size={100}
            colorDark="#0E1521"
            colorLight="#ffffff"
          />
        </div>
        <span className="ticket-stub-label">Scan to book</span>
      </div>

      <div className="carousel-arrows">
        <button
          type="button"
          className="arrow"
          aria-label="Previous"
          onClick={() => goTo(index - 1)}
        >
          ‹
        </button>

        <button
          type="button"
          className="arrow"
          aria-label="Next"
          onClick={() => goTo(index + 1)}
        >
          ›
        </button>
      </div>

      <div className="carousel-dots">
        {events.map((ev, i) => (
          <button
            key={ev.eventId}
            type="button"
            aria-label={`Slide ${i + 1}`}
            className={`dot${i === index ? ' active' : ''}`}
            onClick={() => goTo(i)}
          />
        ))}
      </div>
    </div>
  )
}


/* ---------------------------------------------------------------------
   CATEGORIES
   --------------------------------------------------------------------- */

const CATEGORIES = [
  'Music, Arts & Culture',
  'Wildlife & Nature',
  'Conferences',
  'Launch Parties',
  'Networking Events',
  'Retreats',
  'Product Launches',
  'Expos & Fairs',
  'Performances',
  'Membership Tickets',
  'Netball Games',
]


/* ---------------------------------------------------------------------
   PAGE
   --------------------------------------------------------------------- */

export default function EventsDiscoveryPage() {
  usePageMeta({
    title: 'Kodte — Discover Events',
    description:
      'Tickets, venues and experiences — search, book and walk in with a QR code.',
    robots: 'noindex, nofollow',
  })

  const [events, setEvents] = useState<LocalCreatedEvent[]>(() =>
    loadCreatedEvents(),
  )

  const [query, setQuery] = useState('')

  const [activeCategory, setActiveCategory] =
    useState(CATEGORIES[0])

  useEffect(() => {
    const refresh = () =>
      setEvents(loadCreatedEvents())

    window.addEventListener('focus', refresh)
    window.addEventListener(
      'kodte-created-events',
      refresh,
    )

    return () => {
      window.removeEventListener('focus', refresh)

      window.removeEventListener(
        'kodte-created-events',
        refresh,
      )
    }
  }, [])

  const q = query.trim().toLowerCase()

  const filtered = q
    ? events.filter(
        (e) =>
          e.eventName.toLowerCase().includes(q) ||
          (e.location ?? '')
            .toLowerCase()
            .includes(q) ||
          (e.host ?? '').toLowerCase().includes(q),
      )
    : events

  const carouselEvents = filtered.slice(0, 3)

  const listEvents = filtered.slice(0, 4)

  // Explore shows everything beyond the first 4; if fewer than 5 events exist,
  // fall back to showing all events so the section is never empty.
  const exploreEvents = filtered.length > 4
    ? filtered.slice(4)
    : filtered

  return (
    <div className="kodte-page">
      <style>{STYLES}</style>

      {/* ============================================================
          HERO
          ============================================================ */}

      <div className="hero">
        <div className="nav-row">
          <div className="logo">
            <img
              src="/kodte-icon.svg"
              alt=""
              className="logo-icon"
            />

            <span className="logo-word">
              kodte
            </span>
          </div>

          <div className="nav-actions">
            <a
              href="/create-event"
              className="btn btn-outline"
            >
              Upload Your Event
              <span className="upload-icon">⇪</span>
            </a>
          </div>
        </div>

        <div className="hero-stage">
          <div className="hero-copy">
            <div className="eyebrow">
              Discover
            </div>

            <h1>
              Find what's
              <br />
              happening tonight.
            </h1>

            <p>
              Tickets, venues and experiences — all on
              Kodte. Search, book and walk in with a QR
              code, no printouts, no queues.
            </p>
          </div>

          <div className="search-bar">
            <div className="search-field">
              <div className="label">
                Search events
              </div>

              <input
                className="search-input"
                type="search"
                value={query}
                onChange={(e) =>
                  setQuery(e.target.value)
                }
                placeholder="Event name, location, host…"
                aria-label="Search events"
              />
            </div>

            <button
              type="button"
              className="search-go"
            >
              <span>⌕</span>
              Search
            </button>
          </div>
        </div>
      </div>


      {/* ============================================================
          TRENDING
          ============================================================ */}

      <div className="section first-section">
        <div className="section-rule" />

        <div className="section-head">
          <div>
            <div className="section-kicker">
              What's happening
            </div>

            <h2>
              Get a glimpse of events
              <br className="desktop-break" />
              trending now
            </h2>

            <p>
              Handpicked and heating up across the
              country this week.
            </p>
          </div>

          <a
            href="#explore"
            className="btn btn-light"
          >
            See More Events
            <span>→</span>
          </a>
        </div>

        <div className="trending-grid">
          <EventCarousel events={carouselEvents} />

          <div className="list-col">
            {listEvents.length === 0 ? (
              <div className="empty-list">
                <p>
                  No events yet.
                </p>

                <a href="/create-event">
                  Create one →
                </a>
              </div>
            ) : (
              listEvents.map((ev, i) => {
                const dateLabel =
                  formatDateLabel(ev.eventDate)

                const timeLabel =
                  timeFromSnapshot(ev)

                const purchaseUrl = resolvePurchaseUrl(ev)

                return (
                  <div
                    className="list-card"
                    key={ev.eventId}
                  >
                    <div
                      className="list-thumb"
                      style={{
                        background:
                          gradientFor(i),
                      }}
                    >
                      {ev.formSnapshot
                        ?.eventImageUrl && (
                        <img
                          src={
                            ev.formSnapshot
                              .eventImageUrl
                          }
                          alt=""
                        />
                      )}

                      <div className="num">
                        0{i + 1}
                      </div>
                    </div>

                    <div className="list-body">
                      <div className="list-date">
                        {dateLabel && (
                          <span>
                            {dateLabel}
                          </span>
                        )}

                        {timeLabel && (
                          <>
                            <span className="date-divider">
                              /
                            </span>

                            <span className="time">
                              {timeLabel}
                            </span>
                          </>
                        )}
                      </div>

                      <h4>{ev.eventName}</h4>

                      {ev.location && (
                        <div className="list-loc">
                          {ev.location}
                        </div>
                      )}

                      {ev.host && (
                        <div className="list-desc">
                          By {ev.host}
                        </div>
                      )}

                      <div className="list-actions">
                        <a
                          href={ev.purchaseUrl}
                          className="btn btn-solid btn-sm"
                        >
                          Buy Ticket
                        </a>
                        <div className="list-qr-wrap">
                          <QRWidget
                            value={purchaseUrl}
                            size={96}
                            colorDark="#0E1521"
                            colorLight="#ffffff"
                          />
                        </div>
                      </div>
                    </div>

                    {/* removed floating badge */}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>


      {/* ============================================================
          EXPLORE MORE
          ============================================================ */}

      <div id="explore" className="section explore-section">
        <div className="section-rule" />

        <div className="section-head">
          <div>
            <div className="section-kicker">
              Find your thing
            </div>

            <h2>
              Explore More
            </h2>

            <p>
              Explore more events on Kodte by searching
              with categories below.
            </p>
          </div>
        </div>

        <div className="filter-row">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`chip${
                activeCategory === cat
                  ? ' active'
                  : ''
              }`}
              onClick={() =>
                setActiveCategory(cat)
              }
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="explore-grid">
          {exploreEvents.length === 0 ? (
            <div className="explore-empty">
              Create more events to fill this section.
            </div>
          ) : (
            exploreEvents.map((ev, i) => {
              const dm = dayMonth(ev.eventDate)

              const timeLabel =
                timeFromSnapshot(ev)

              const purchaseUrl = resolvePurchaseUrl(ev)

              return (
                <div
                  className="grid-card"
                  key={ev.eventId}
                >
                  <div
                    className="grid-thumb"
                    style={{
                      background:
                        gradientFor(i + 4),
                    }}
                  >
                    {ev.formSnapshot
                      ?.eventImageUrl && (
                      <img
                        src={
                          ev.formSnapshot
                            .eventImageUrl
                        }
                        alt=""
                      />
                    )}

                    {dm && (
                      <div className="date-badge">
                        <div className="d">
                          {dm.day}
                        </div>

                        <div className="m">
                          {dm.month}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid-body">
                    {ev.location && (
                      <div className="grid-loc">
                        <span>⌖</span>
                        {ev.location}
                      </div>
                    )}

                    <h4>{ev.eventName}</h4>

                    {timeLabel && (
                      <div className="grid-time">
                        <span>◴</span>
                        {timeLabel}
                      </div>
                    )}

                    {ev.host && (
                      <div className="grid-desc">
                        Hosted by {ev.host}
                      </div>
                    )}

                    <div className="grid-foot">
                      <a
                        href={ev.purchaseUrl}
                        className="btn btn-solid btn-sm"
                      >
                        Buy Ticket
                      </a>
                      <div className="grid-qr-inline">
                        <QRWidget
                          value={purchaseUrl}
                          size={96}
                          colorDark="#0E1521"
                          colorLight="#ffffff"
                        />
                      </div>
                    </div>
                  </div>

                  {/* no floating badge */}
                </div>
              )
            })
          )}
        </div>
      </div>


      {/* ============================================================
          FOOTER
          ============================================================ */}

      <footer>
        <div className="footer-rule" />

        <div className="footer-inner">
          <div className="footer-brand">
            kodte<span>.</span>
          </div>

          <div>
            © {new Date().getFullYear()} Kodte.
            All events, all in one place.
          </div>
        </div>
      </footer>
    </div>
  )
}


/* =====================================================================
   STYLES
   ===================================================================== */

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@400;500;600;700;800&display=swap');


/* ---------------------------------------------------------------------
   DESIGN TOKENS
   --------------------------------------------------------------------- */

.kodte-page {
  --ink: #26201a;
  --ink-soft: #6b5e4e;

  /* Landing page paper */
  --paper: #efe6d2;

  /* Landing page light surface */
  --white: #f7f1e3;

  /* Warm landing-page divider */
  --line: rgba(38, 32, 26, 0.14);

  --line-strong: rgba(38, 32, 26, 0.22);

  --blue: #1B5FE0;
  --blue-deep: #123E96;

  --amber: #F2A93B;

  --card-shadow:
    0 10px 30px rgba(38, 32, 26, 0.07);

  --soft-shadow:
    0 4px 16px rgba(38, 32, 26, 0.055);

  font-family:
    'Outfit',
    'Inter',
    sans-serif;

  background: var(--paper);

  color: var(--ink);

  min-height: 100vh;

  -webkit-font-smoothing: antialiased;
}


/* ---------------------------------------------------------------------
   RESET
   --------------------------------------------------------------------- */

.kodte-page *,
.kodte-page *::before,
.kodte-page *::after {
  box-sizing: border-box;
}

.kodte-page h1,
.kodte-page h2,
.kodte-page h3 {
  font-family: 'Bebas Neue', sans-serif;
  letter-spacing: 0.5px;
  line-height: 1;
  margin: 0;
}

.kodte-page a {
  text-decoration: none;
  color: inherit;
}

.kodte-page button {
  font-family: inherit;
  cursor: pointer;
  border: none;
  background: none;
}

.kodte-page img {
  display: block;
  max-width: 100%;
}


/* ---------------------------------------------------------------------
   HERO
   --------------------------------------------------------------------- */

.kodte-page .hero {
  position: relative;

  min-height: 560px;

  background:
    linear-gradient(
      180deg,
      rgba(6,10,20,0.55) 0%,
      rgba(6,10,20,0.35) 40%,
      rgba(6,10,20,0.85) 100%
    ),
    radial-gradient(
      circle at 20% 20%,
      #3a2f6b 0%,
      transparent 45%
    ),
    radial-gradient(
      circle at 80% 10%,
      #7a2b6b 0%,
      transparent 40%
    ),
    linear-gradient(
      120deg,
      #101625 0%,
      #1a1f33 55%,
      #241b3a 100%
    );

  color: #fff;

  overflow: hidden;

  padding-bottom: 60px;
}

.kodte-page .hero::after {
  content: "";

  position: absolute;

  inset: 0;

  background-image:
    repeating-linear-gradient(
      115deg,
      rgba(255,255,255,0.03) 0 2px,
      transparent 2px 60px
    );

  pointer-events: none;
}


/* ---------------------------------------------------------------------
   NAV
   --------------------------------------------------------------------- */

.kodte-page .nav-row {
  display: flex;

  align-items: center;

  justify-content: space-between;

  max-width: 1240px;

  margin: 0 auto;

  padding: 26px 24px 0;

  position: relative;

  z-index: 3;
}

.kodte-page .logo {
  display: flex;

  align-items: center;

  gap: 10px;
}

.kodte-page .logo-icon {
  width: 32px;

  height: 32px;

  object-fit: contain;

  display: block;

  flex-shrink: 0;
}

.kodte-page .logo-word {
  font-family: 'Outfit', sans-serif;

  font-size: 26px;

  font-weight: 800;

  letter-spacing: -0.02em;

  text-transform: lowercase;
}

.kodte-page .logo-word span {
  color: var(--amber);
}

.kodte-page .nav-actions {
  display: flex;

  gap: 12px;

  align-items: center;
}


/* ---------------------------------------------------------------------
   BUTTONS
   --------------------------------------------------------------------- */

.kodte-page .btn {
  display: inline-flex;

  align-items: center;

  justify-content: center;

  gap: 8px;

  padding: 11px 20px;

  border-radius: 9px;

  font-size: 14px;

  font-weight: 600;

  border: 1px solid transparent;

  transition:
    transform .15s ease,
    background .15s ease,
    box-shadow .15s ease,
    border-color .15s ease;

  white-space: nowrap;
}

.kodte-page .btn:hover {
  transform: translateY(-1px);
}

.kodte-page .btn-outline {
  background: rgba(255,255,255,0.08);

  border-color: rgba(255,255,255,0.35);

  color: #fff;

  backdrop-filter: blur(6px);
}

.kodte-page .btn-outline:hover {
  background: rgba(255,255,255,0.16);
}

.kodte-page .upload-icon {
  font-size: 16px;

  line-height: 1;
}

.kodte-page .btn-solid {
  background: var(--blue);

  color: #fff;
}

.kodte-page .btn-solid:hover {
  background: var(--blue-deep);

  box-shadow:
    0 8px 20px rgba(27,95,224,0.25);
}

.kodte-page .btn-ghost-white {
  background: #fff;

  color: var(--ink);
}

.kodte-page .btn-ghost-white:hover {
  box-shadow:
    0 8px 20px rgba(0,0,0,0.15);
}

.kodte-page .btn-light {
  background: var(--white);

  border-color: var(--line);

  color: var(--ink);

  box-shadow:
    0 2px 6px rgba(38,32,26,0.025);
}

.kodte-page .btn-light:hover {
  background: #fbf5e9;

  border-color: var(--line-strong);
}

.kodte-page .btn-sm {
  padding: 8px 14px;

  font-size: 12.5px;

  border-radius: 7px;
}


/* ---------------------------------------------------------------------
   HERO STAGE
   --------------------------------------------------------------------- */

.kodte-page .hero-stage {
  max-width: 1240px;

  margin: 70px auto 0;

  padding: 0 24px;

  position: relative;

  z-index: 3;
}

.kodte-page .hero-copy {
  max-width: 600px;

  margin-bottom: 34px;
}

.kodte-page .eyebrow {
  display: inline-flex;

  align-items: center;

  gap: 8px;

  font-size: 12px;

  font-weight: 700;

  letter-spacing: 1.8px;

  text-transform: uppercase;

  color: var(--amber);

  margin-bottom: 14px;
}

.kodte-page .eyebrow::before {
  content: "";

  width: 22px;

  height: 2px;

  background: var(--amber);

  display: inline-block;
}

.kodte-page .hero-copy h1 {
  font-size: 56px;

  margin: 0 0 14px;
}

.kodte-page .hero-copy p {
  font-size: 16px;

  color: rgba(255,255,255,0.78);

  line-height: 1.55;

  font-family: 'Outfit', sans-serif;

  max-width: 570px;

  margin: 0;
}


/* ---------------------------------------------------------------------
   SEARCH
   --------------------------------------------------------------------- */

.kodte-page .search-bar {
  background: rgba(255,255,255,0.94);

  border-radius: 14px;

  max-width: 920px;

  padding: 6px;

  display: flex;

  align-items: center;

  box-shadow:
    0 10px 30px rgba(0,0,0,0.12);
}

.kodte-page .search-field {
  flex: 1;

  padding: 10px 18px;
}

.kodte-page .search-field .label {
  font-weight: 700;

  font-size: 13px;

  color: var(--ink-soft);

  margin-bottom: 4px;
}

.kodte-page .search-input {
  width: 100%;

  border: none;

  outline: none;

  background: transparent;

  font-family: 'Outfit', sans-serif;

  font-size: 15px;

  font-weight: 600;

  color: var(--ink);
}

.kodte-page .search-input::placeholder {
  color: var(--ink-soft);

  font-weight: 400;
}

.kodte-page .search-go {
  background: var(--blue);

  color: #fff;

  padding: 14px 26px;

  border-radius: 10px;

  font-weight: 700;

  font-size: 14px;

  display: flex;

  align-items: center;

  gap: 8px;

  margin: 0 4px;

  flex-shrink: 0;

  transition:
    background .15s ease,
    transform .15s ease;
}

.kodte-page .search-go:hover {
  background: var(--blue-deep);

  transform: translateY(-1px);
}

.kodte-page .search-go span {
  font-size: 18px;

  line-height: 1;
}


/* ---------------------------------------------------------------------
   SECTIONS
   --------------------------------------------------------------------- */

.kodte-page .section {
  max-width: 1240px;

  margin: 0 auto;

  padding:
    70px 24px
    10px;
}

.kodte-page .section-rule {
  width: 100%;

  height: 1px;

  background:
    linear-gradient(
      90deg,
      transparent 0%,
      var(--line) 8%,
      var(--line) 92%,
      transparent 100%
    );

  margin-bottom: 48px;
}

.kodte-page .section-head {
  display: flex;

  align-items: flex-end;

  justify-content: space-between;

  margin-bottom: 32px;

  gap: 20px;

  flex-wrap: wrap;
}

.kodte-page .section-kicker {
  font-size: 11px;

  font-weight: 800;

  letter-spacing: 1.7px;

  text-transform: uppercase;

  color: var(--blue);

  margin-bottom: 8px;
}

.kodte-page .section-head h2 {
  font-size: 38px;

  color: var(--ink);
}

.kodte-page .section-head p {
  color: var(--ink-soft);

  font-size: 14px;

  margin: 8px 0 0;

  line-height: 1.5;
}


/* ---------------------------------------------------------------------
   TRENDING GRID
   --------------------------------------------------------------------- */

.kodte-page .trending-grid {
  display: grid;

  grid-template-columns:
    1.55fr 1fr;

  gap: 24px;

  align-items: stretch;
}


/* ---------------------------------------------------------------------
   CAROUSEL

   Structure: .carousel (unclipped, position:relative) contains
   .carousel-frame (the clipped, rounded photo+track layer, with a
   diagonal notch cut out of its bottom-right corner) and the
   .ticket-stub, which sits at that exact corner. Because the frame
   has a literal hole there, the stub reads as tucked in behind the
   ticket rather than laid over the top of it.
   --------------------------------------------------------------------- */

.kodte-page .carousel {
  position: relative;

  min-height: 420px;
}

.kodte-page .carousel-frame {
  position: relative;

  height: 100%;

  min-height: 420px;

  border-radius: 20px;

  overflow: hidden;

  box-shadow: var(--card-shadow);

  background: #111;
}

.kodte-page .carousel-empty {
  border-radius: 20px;

  background: var(--white);

  border: 1px solid var(--line);
}

.kodte-page .carousel-track {
  display: flex;

  height: 100%;

  transition:
    transform .55s
    cubic-bezier(.65,0,.35,1);
}

.kodte-page .slide {
  min-width: 100%;

  position: relative;

  display: flex;

  flex-direction: column;

  justify-content: flex-end;

  padding: 28px;

  color: #fff;

  min-height: 420px;
}

.kodte-page .slide-bg {
  position: absolute;

  inset: 0;

  z-index: 0;
}

.kodte-page .slide-bg::after {
  content: "";

  position: absolute;

  inset: 0;

  background:
    linear-gradient(
      180deg,
      rgba(10,12,20,0.05) 20%,
      rgba(8,10,16,0.92) 92%
    );
}

.kodte-page .slide-tag {
  position: absolute;

  top: 24px;

  left: 24px;

  z-index: 2;

  background: var(--white);

  color: var(--ink);

  font-size: 11.5px;

  font-weight: 800;

  letter-spacing: 1px;

  padding: 6px 12px;

  border-radius: 999px;

  display: flex;

  align-items: center;

  gap: 6px;
}

.kodte-page .slide-tag-dot {
  width: 7px;

  height: 7px;

  border-radius: 50%;

  background: var(--blue);

  display: block;
}

.kodte-page .slide-content {
  position: relative;

  z-index: 2;

  padding-right: 140px;
}

.kodte-page .slide-content .cat {
  font-size: 13px;

  font-weight: 700;

  color: var(--amber);

  text-transform: uppercase;

  letter-spacing: 1px;

  margin-bottom: 10px;
}

.kodte-page .slide-content h3 {
  font-size: 34px;

  margin: 0 0 10px;

  max-width: 80%;
}

.kodte-page .slide-meta {
  display: flex;

  gap: 18px;

  font-size: 13.5px;

  color: rgba(255,255,255,0.85);

  margin-bottom: 18px;

  flex-wrap: wrap;
}

.kodte-page .slide-meta span {
  display: flex;

  align-items: center;

  gap: 6px;
}

.kodte-page .meta-icon {
  opacity: 0.75;
}

.kodte-page .slide-loc {
  font-size: 14px;

  color: #8FB6FF;

  margin-bottom: 20px;

  font-weight: 600;
}

.kodte-page .slide-loc span {
  margin-right: 5px;
}

.kodte-page .slide-actions {
  display: flex;

  align-items: center;

  gap: 16px;

  flex-wrap: wrap;
}

.kodte-page .ticket-stub {
  position: absolute;

  right: 20px;

  bottom: 20px;

  z-index: 5;

  width: 120px;

  display: flex;

  flex-direction: column;

  align-items: center;

  gap: 6px;

  padding: 10px 10px 8px;

  background: #fff;

  border-radius: 14px;

  box-shadow:
    0 8px 24px rgba(0,0,0,0.32),
    0 2px 6px rgba(0,0,0,0.18);
}

.kodte-page .ticket-stub-qr {
  width: 100px;

  height: 100px;

  border-radius: 6px;

  overflow: hidden;

  background: #fff;
}

.kodte-page .ticket-stub-qr canvas,
.kodte-page .ticket-stub-qr img {
  width: 100px !important;

  height: 100px !important;

  display: block;
}

.kodte-page .ticket-stub-label {
  font-size: 9px;

  font-weight: 800;

  letter-spacing: 0.14em;

  text-transform: uppercase;

  color: #6b7280;

  white-space: nowrap;
}


/* ---------------------------------------------------------------------
   CAROUSEL CONTROLS
   --------------------------------------------------------------------- */

.kodte-page .carousel-dots {
  position: absolute;

  bottom: 34px;

  right: 34px;

  z-index: 3;

  display: flex;

  gap: 8px;
}

.kodte-page .dot {
  width: 8px;

  height: 8px;

  border-radius: 50%;

  background: rgba(255,255,255,0.4);

  transition: all .2s ease;

  padding: 0;
}

.kodte-page .dot.active {
  width: 24px;

  background: #fff;
}

.kodte-page .carousel-arrows {
  position: absolute;

  top: 50%;

  left: 0;

  right: 0;

  display: flex;

  justify-content: space-between;

  padding: 0 16px;

  transform: translateY(-50%);

  z-index: 3;
}

.kodte-page .arrow {
  width: 38px;

  height: 38px;

  border-radius: 50%;

  background: rgba(255,255,255,0.15);

  border: 1px solid rgba(255,255,255,0.4);

  color: #fff;

  display: flex;

  align-items: center;

  justify-content: center;

  backdrop-filter: blur(4px);

  font-size: 22px;

  line-height: 1;

  transition:
    background .15s ease,
    transform .15s ease;
}

.kodte-page .arrow:hover {
  background: rgba(255,255,255,0.3);

  transform: scale(1.05);
}


/* ---------------------------------------------------------------------
   LIST CARDS
   --------------------------------------------------------------------- */

.kodte-page .list-col {
  display: flex;

  flex-direction: column;

  gap: 16px;
}

.kodte-page .list-card {
  position: relative;

  background: var(--white);

  border: 1px solid var(--line);

  border-radius: 16px;

  padding: 18px;

  display: flex;

  gap: 16px;

  min-height: 160px;

  box-shadow: var(--soft-shadow);

  transition:
    transform .18s ease,
    box-shadow .18s ease,
    border-color .18s ease;
}

.kodte-page .list-card:hover {
  transform: translateY(-2px);

  border-color: var(--line-strong);

  box-shadow: var(--card-shadow);
}

.kodte-page .list-thumb {
  width: 120px;

  min-height: 140px;

  border-radius: 11px;

  flex-shrink: 0;

  position: relative;

  overflow: hidden;
}

.kodte-page .list-thumb img {
  width: 100%;

  height: 100%;

  object-fit: cover;

  position: absolute;

  inset: 0;
}

.kodte-page .list-thumb .num {
  position: absolute;

  top: 6px;

  left: 6px;

  background: rgba(0,0,0,0.55);

  color: #fff;

  font-size: 10px;

  font-weight: 800;

  padding: 2px 6px;

  border-radius: 5px;

  z-index: 1;
}

.kodte-page .list-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.kodte-page .list-date {
  display: flex;

  align-items: center;

  gap: 7px;

  font-size: 11.5px;

  color: var(--ink-soft);

  font-weight: 600;

  margin-bottom: 5px;

  flex-wrap: wrap;
}

.kodte-page .date-divider {
  opacity: 0.4;
}

.kodte-page .list-date .time {
  color: var(--blue);
}

.kodte-page .list-body h4 {
  font-size: 15px;

  font-weight: 800;

  margin: 0 0 3px;

  line-height: 1.25;

  font-family: 'Outfit', sans-serif;
}

.kodte-page .list-loc {
  font-size: 12px;

  color: var(--blue);

  font-weight: 600;

  margin-bottom: 5px;
}

.kodte-page .list-desc {
  font-size: 12px;

  color: var(--ink-soft);

  line-height: 1.4;

  margin-bottom: 10px;

  display: -webkit-box;

  -webkit-line-clamp: 2;

  -webkit-box-orient: vertical;

  overflow: hidden;
}

.kodte-page .list-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: auto;
  padding-top: 10px;
}

.kodte-page .list-qr-wrap {
  width: 96px;
  height: 96px;
  flex-shrink: 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.kodte-page .list-qr-wrap canvas,
.kodte-page .list-qr-wrap img {
  width: 96px !important;
  height: 96px !important;
  display: block;
}


/* ---------------------------------------------------------------------
   QR
   --------------------------------------------------------------------- */

.kodte-page .qr-mini {
  width: 72px !important;
  height: 72px !important;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
}

.kodte-page .qr-mini canvas,
.kodte-page .qr-mini img {
  width: 72px !important;
  height: 72px !important;
  display: block;
}


/* ---------------------------------------------------------------------
   EMPTY STATES
   --------------------------------------------------------------------- */

.kodte-page .empty-state {
  text-align: center;

  color: var(--ink-soft);
}

.kodte-page .empty-state-mark {
  width: 42px;

  height: 42px;

  border: 1px solid var(--line-strong);

  border-radius: 50%;

  display: grid;

  place-items: center;

  margin: 0 auto 12px;

  font-family: 'Bebas Neue';

  font-size: 22px;

  color: var(--ink);
}

.kodte-page .empty-state p {
  margin: 0 0 4px;

  color: var(--ink);

  font-weight: 700;
}

.kodte-page .empty-state span {
  font-size: 13px;
}

.kodte-page .empty-list {
  padding: 30px;

  background: var(--white);

  border: 1px solid var(--line);

  border-radius: 16px;

  color: var(--ink-soft);
}

.kodte-page .empty-list p {
  margin: 0 0 8px;

  color: var(--ink);

  font-weight: 700;
}

.kodte-page .empty-list a {
  color: var(--blue);

  font-weight: 600;

  font-size: 13px;
}


/* ---------------------------------------------------------------------
   CATEGORY CHIPS
   --------------------------------------------------------------------- */

.kodte-page .filter-row {
  display: flex;

  gap: 9px;

  flex-wrap: wrap;

  margin: 26px 0 34px;
}

.kodte-page .chip {
  padding: 9px 16px;

  border-radius: 999px;

  border: 1px solid var(--line);

  background: var(--white);

  font-size: 12.5px;

  font-weight: 600;

  color: var(--ink-soft);

  transition:
    all .15s ease;
}

.kodte-page .chip.active {
  background: var(--ink);

  border-color: var(--ink);

  color: var(--white);
}

.kodte-page .chip:hover:not(.active) {
  border-color: var(--line-strong);

  color: var(--ink);

  background: #fbf5e9;
}


/* ---------------------------------------------------------------------
   EXPLORE GRID
   --------------------------------------------------------------------- */

.kodte-page .explore-grid {
  display: grid;

  grid-template-columns:
    repeat(3, 1fr);

  gap: 22px;
}

.kodte-page .grid-card {
  position: relative;

  background: var(--white);

  border: 1px solid var(--line);

  border-radius: 16px;

  overflow: hidden;

  box-shadow: var(--soft-shadow);

  display: flex;

  flex-direction: column;

  transition:
    transform .18s ease,
    box-shadow .18s ease,
    border-color .18s ease;
}

.kodte-page .grid-card:hover {
  transform: translateY(-3px);

  border-color: var(--line-strong);

  box-shadow: var(--card-shadow);
}

.kodte-page .grid-thumb {
  height: 180px;

  position: relative;

  overflow: hidden;
}

.kodte-page .grid-thumb img {
  width: 100%;

  height: 100%;

  object-fit: cover;

  position: absolute;

  inset: 0;
}

.kodte-page .grid-thumb::after {
  content: "";

  position: absolute;

  inset: 0;

  pointer-events: none;

  background:
    linear-gradient(
      180deg,
      transparent 55%,
      rgba(0,0,0,0.12)
    );
}

.kodte-page .grid-thumb .date-badge {
  position: absolute;

  top: 12px;

  left: 12px;

  z-index: 2;

  background: var(--white);

  border-radius: 9px;

  padding: 6px 10px;

  text-align: center;

  box-shadow:
    0 4px 10px rgba(38,32,26,0.12);
}

.kodte-page .date-badge .d {
  font-family: 'Bebas Neue';

  font-size: 18px;

  line-height: 1;

  color: var(--ink);
}

.kodte-page .date-badge .m {
  font-size: 9px;

  font-weight: 800;

  letter-spacing: 0.5px;

  color: var(--ink-soft);
}

.kodte-page .grid-body {
  padding: 18px;

  display: flex;

  flex-direction: column;

  gap: 8px;

  flex: 1;
}

.kodte-page .grid-loc {
  display: flex;

  align-items: center;

  gap: 5px;

  font-size: 12px;

  color: var(--blue);

  font-weight: 600;
}

.kodte-page .grid-body h4 {
  font-size: 18px;

  margin: 0;

  line-height: 1.15;

  font-weight: 800;

  font-family: 'Outfit', sans-serif;

  color: var(--ink);
}

.kodte-page .grid-time {
  display: flex;

  align-items: center;

  gap: 5px;

  font-size: 12px;

  color: var(--ink-soft);

  font-weight: 600;
}

.kodte-page .grid-desc {
  font-size: 12.5px;

  color: var(--ink-soft);

  line-height: 1.5;

  display: -webkit-box;

  -webkit-line-clamp: 2;

  -webkit-box-orient: vertical;

  overflow: hidden;
}

.kodte-page .grid-foot {
  margin-top: auto;

  display: flex;

  align-items: center;

  justify-content: space-between;

  gap: 10px;

  padding-top: 12px;

  border-top: 1px dashed var(--line);
}

.kodte-page .grid-qr-inline {
  width: 96px;
  height: 96px;
  flex-shrink: 0;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  border: 1px solid var(--line);
}

.kodte-page .grid-qr-inline canvas,
.kodte-page .grid-qr-inline img {
  width: 96px !important;
  height: 96px !important;
  display: block;
}


/* ---------------------------------------------------------------------
   FOOTER
   --------------------------------------------------------------------- */

.kodte-page footer {
  margin-top: 80px;

  padding:
    0 24px
    40px;

  color: var(--ink-soft);

  font-size: 12.5px;
}

.kodte-page .footer-rule {
  max-width: 1192px;

  height: 1px;

  margin:
    0 auto
    28px;

  background:
    linear-gradient(
      90deg,
      transparent,
      var(--line),
      transparent
    );
}

.kodte-page .footer-inner {
  max-width: 1192px;

  margin: 0 auto;

  display: flex;

  align-items: center;

  justify-content: space-between;

  gap: 20px;
}

.kodte-page .footer-brand {
  font-size: 18px;

  font-weight: 800;

  color: var(--ink);

  letter-spacing: -0.02em;
}

.kodte-page .footer-brand span {
  color: var(--amber);
}


/* ---------------------------------------------------------------------
   RESPONSIVE
   --------------------------------------------------------------------- */

@media (max-width: 980px) {
  .kodte-page .trending-grid {
    grid-template-columns: 1fr;
  }

  .kodte-page .explore-grid {
    grid-template-columns:
      repeat(2, 1fr);
  }

  .kodte-page .hero-copy h1 {
    font-size: 46px;
  }

  .kodte-page .nav-row {
    flex-wrap: wrap;

    gap: 12px;
  }
}


@media (max-width: 640px) {
  .kodte-page .hero {
    min-height: 600px;

    padding-bottom: 45px;
  }

  .kodte-page .nav-row {
    padding-left: 18px;

    padding-right: 18px;
  }

  .kodte-page .hero-stage {
    margin-top: 58px;

    padding-left: 18px;

    padding-right: 18px;
  }

  .kodte-page .hero-copy h1 {
    font-size: 40px;
  }

  .kodte-page .hero-copy p {
    font-size: 14px;
  }

  .kodte-page .search-bar {
    flex-direction: column;

    align-items: stretch;

    padding: 8px;
  }

  .kodte-page .search-field {
    padding:
      10px 12px
      12px;
  }

  .kodte-page .search-go {
    justify-content: center;

    margin: 0;

    width: 100%;
  }

  .kodte-page .section {
    padding:
      52px 18px
      8px;
  }

  .kodte-page .section-rule {
    margin-bottom: 36px;
  }

  .kodte-page .section-head h2 {
    font-size: 32px;
  }

  .kodte-page .desktop-break {
    display: none;
  }

  .kodte-page .trending-grid {
    gap: 18px;
  }

  .kodte-page .carousel,
  .kodte-page .carousel-frame,
  .kodte-page .slide {
    min-height: 520px;
  }

  .kodte-page .carousel-frame {
    clip-path: polygon(
      0 0,
      100% 0,
      100% calc(100% - 84px),
      calc(100% - 84px) 100%,
      0 100%
    );
  }

  .kodte-page .ticket-stub {
    right: 16px;

    bottom: 16px;

    width: 78px;

    height: 78px;

    padding: 8px;
  }

  .kodte-page .slide-content {
    padding-right: 106px;
  }

  .kodte-page .slide {
    padding: 24px;
  }

  .kodte-page .slide-content h3 {
    font-size: 38px;

    max-width: 95%;
  }

  .kodte-page .list-card {
    padding: 11px;

    gap: 11px;
  }

  .kodte-page .list-thumb {
    width: 76px;

    height: 76px;
  }

  .kodte-page .list-qr-badge {
    left: 60px;
  }

  .kodte-page .explore-grid {
    grid-template-columns: 1fr;

    gap: 16px;
  }

  .kodte-page .filter-row {
    margin-top: 20px;
  }

  .kodte-page .chip {
    font-size: 12px;

    padding:
      8px 13px;
  }

  .kodte-page .footer-inner {
    flex-direction: column;

    align-items: flex-start;
  }
}
`