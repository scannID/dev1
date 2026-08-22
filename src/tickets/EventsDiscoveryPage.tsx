import { useEffect, useRef, useState } from 'react'
import { loadCreatedEvents, type LocalCreatedEvent } from './createdEventsLocal'
import { usePageMeta } from '../hooks/usePageMeta'

/* =====================================================================
   Events Discovery Page
   — same layout as the HTML mockup
   — real events from localStorage via loadCreatedEvents()
   — real QR codes pointing to each event's purchaseUrl
   — uses app fonts (Outfit + Bebas Neue) and --tk-* color tokens
   ===================================================================== */

/* ----------- QR code helper (lazy-loads qrcodejs from CDN) ----------- */

declare global {
  interface Window { QRCode?: any }
}

let _qrLibPromise: Promise<void> | null = null

function loadQrLib(): Promise<void> {
  if (typeof window !== 'undefined' && window.QRCode) return Promise.resolve()
  if (_qrLibPromise) return _qrLibPromise
  _qrLibPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
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
  colorDark = '#0E1521',
  colorLight = '#ffffff',
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
    loadQrLib().then(() => {
      if (cancelled || !node) return
      node.innerHTML = ''
      new window.QRCode(node, {
        text: value,
        width: size,
        height: size,
        colorDark,
        colorLight,
        correctLevel: window.QRCode.CorrectLevel.M,
      })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [value, size, colorDark, colorLight])

  return <div ref={ref} className={className} aria-label={`QR code`} />
}

/* ----------- Gradient palette — assigned by index so each event gets its own colour ----------- */

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

/* ----------- Date helpers ----------- */

function formatDateLabel(iso?: string | null): string | null {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch { return null }
}

function dayMonth(iso?: string | null): { day: string; month: string } | null {
  if (!iso) return null
  try {
    const d = new Date(iso)
    return {
      day: d.getDate().toString(),
      month: d.toLocaleString(undefined, { month: 'short' }).toUpperCase(),
    }
  } catch { return null }
}

function timeFromSnapshot(event: LocalCreatedEvent): string {
  const t = event.formSnapshot?.time
  if (!t) return ''
  try {
    const [h, m] = t.split(':').map(Number)
    const d = new Date()
    d.setHours(h, m)
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  } catch { return t }
}

/* ----------- Carousel ----------- */

function EventCarousel({ events }: { events: LocalCreatedEvent[] }) {
  const [index, setIndex] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const count = events.length

  function goTo(i: number) {
    setIndex(((i % count) + count) % count)
  }

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setIndex(p => (p + 1) % count), 5000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [index, count])

  if (count === 0) {
    return (
      <div className="carousel" style={{ display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>
        No events yet — create one to see it here.
      </div>
    )
  }

  return (
    <div className="carousel">
      <div className="carousel-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {events.map((ev, i) => {
          const bg = ev.formSnapshot?.eventImageUrl
            ? `url(${ev.formSnapshot.eventImageUrl}) center/cover`
            : gradientFor(i)
          const dateLabel = formatDateLabel(ev.eventDate)
          const timeLabel = timeFromSnapshot(ev)
          const purchaseUrl = ev.purchaseUrl.startsWith('http')
            ? ev.purchaseUrl
            : `${window.location.origin}${ev.purchaseUrl}`

          return (
            <div className="slide" key={ev.eventId}>
              <div className="slide-bg" style={{ background: bg }} />
              <div className="slide-tag">● Trending</div>
              <div className="slide-content">
                <div className="cat">{ev.host || 'Live Event'}</div>
                <h3>{ev.eventName}</h3>
                <div className="slide-meta">
                  {dateLabel && <span>📅 {dateLabel}</span>}
                  {timeLabel && <span>🕐 {timeLabel}</span>}
                </div>
                {ev.location && <div className="slide-loc">📍 {ev.location}</div>}
                <div className="slide-actions">
                  <a href={ev.purchaseUrl} className="btn btn-ghost-white">Buy Tickets</a>
                  <div className="qr-chip">
                    <QRWidget value={purchaseUrl} size={56} colorDark="#0E1521" colorLight="#ffffff" />
                    <span className="qr-label">Scan to<br />book</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="carousel-arrows">
        <button type="button" className="arrow" aria-label="Previous" onClick={() => goTo(index - 1)}>‹</button>
        <button type="button" className="arrow" aria-label="Next" onClick={() => goTo(index + 1)}>›</button>
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

/* ----------- Page ----------- */

const CATEGORIES = [
  'Music, Arts & Culture', 'Wildlife & Nature', 'Conferences',
  'Launch Parties', 'Networking Events', 'Retreats', 'Product Launches',
  'Expos & Fairs', 'Performances', 'Membership Tickets', 'Netball Games',
]

export default function EventsDiscoveryPage() {
  usePageMeta({
    title: 'Kodte — Discover Events',
    description: 'Tickets, venues and experiences — search, book and walk in with a QR code.',
    robots: 'noindex, nofollow',
  })

  const [events, setEvents] = useState<LocalCreatedEvent[]>(() => loadCreatedEvents())
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0])

  useEffect(() => {
    const refresh = () => setEvents(loadCreatedEvents())
    window.addEventListener('focus', refresh)
    window.addEventListener('kodte-created-events', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('kodte-created-events', refresh)
    }
  }, [])

  // Filter by search query
  const q = query.trim().toLowerCase()
  const filtered = q
    ? events.filter(e =>
        e.eventName.toLowerCase().includes(q) ||
        (e.location ?? '').toLowerCase().includes(q) ||
        (e.host ?? '').toLowerCase().includes(q)
      )
    : events

  const carouselEvents = filtered.slice(0, 3)
  const listEvents = filtered.slice(0, 4)
  const exploreEvents = filtered.length > 4 ? filtered.slice(4, 7) : filtered.slice(0, 3)

  return (
    <div className="kodte-page">
      <style>{STYLES}</style>

      {/* ===== HERO ===== */}
      <div className="hero">
        <div className="nav-row">
          <div className="logo">kodte<span>.</span></div>
          <div className="nav-actions">
            <a href="/create-event" className="btn btn-outline">Upload Your Event ⇪</a>
          </div>
        </div>

        <div className="hero-stage">
          <div className="hero-copy">
         
            <h1>Find what's<br />happening tonight.</h1>
            <p>Tickets, venues and experiences — all on Kodte. Search, book and walk in with a QR code, no printouts, no queues.</p>
          </div>

          <div className="search-bar">
            <div className="search-field">
              <div className="label">Search events</div>
              <input
                className="search-input"
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Event name, location, host…"
                aria-label="Search events"
              />
            </div>
            <button type="button" className="search-go">🔍 Search</button>
          </div>
        </div>
      </div>


      <div className="section">
        <div className="section-head">
          <div>
            <h2>Get a glimpse of events trending now</h2>
            <p>Handpicked and heating up across the country this week.</p>
          </div>
          <a href="/events" className="btn btn-light">See More Events →</a>
        </div>

        <div className="trending-grid">
          <EventCarousel events={carouselEvents} />

          <div className="list-col">
            {listEvents.length === 0 ? (
              <p style={{ color: '#4B5768', fontSize: 13, padding: '20px 0' }}>
                No events yet. <a href="/create-event" style={{ color: '#1B5FE0' }}>Create one →</a>
              </p>
            ) : listEvents.map((ev, i) => {
              const dateLabel = formatDateLabel(ev.eventDate)
              const timeLabel = timeFromSnapshot(ev)
              const purchaseUrl = ev.purchaseUrl.startsWith('http')
                ? ev.purchaseUrl
                : `${window.location.origin}${ev.purchaseUrl}`

              return (
                <div className="list-card" key={ev.eventId}>
                  <div className="list-thumb" style={{ background: gradientFor(i) }}>
                    {ev.formSnapshot?.eventImageUrl && (
                      <img src={ev.formSnapshot.eventImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                    )}
                    <div className="num">0{i + 1}</div>
                  </div>
                  <div className="list-body">
                    <div className="list-date">
                      {dateLabel && <>📅 {dateLabel}</>}
                      {timeLabel && <> · <span className="time">{timeLabel}</span></>}
                    </div>
                    <h4>{ev.eventName}</h4>
                    {ev.location && <div className="list-loc">{ev.location}</div>}
                    {ev.host && <div className="list-desc">By {ev.host}</div>}
                    <div className="list-actions">
                      <a href={ev.purchaseUrl} className="btn btn-solid btn-sm">Buy Ticket</a>
                      <QRWidget value={purchaseUrl} size={34} className="qr-mini" colorDark="#0E1521" colorLight="#ffffff" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ===== EXPLORE MORE ===== */}
      <div className="section">
        <div className="section-head">
          <div>
            <h2>Explore More</h2>
            <p>Explore more events on Kodte by searching with categories below.</p>
          </div>
          <a href="/events" className="btn btn-light">See More Events →</a>
        </div>

        <div className="filter-row">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`chip${activeCategory === cat ? ' active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="explore-grid">
          {exploreEvents.length === 0 ? (
            <p style={{ color: '#4B5768', fontSize: 13, gridColumn: '1/-1', padding: '20px 0' }}>
              Create more events to fill this section.
            </p>
          ) : exploreEvents.map((ev, i) => {
            const dm = dayMonth(ev.eventDate)
            const timeLabel = timeFromSnapshot(ev)
            const purchaseUrl = ev.purchaseUrl.startsWith('http')
              ? ev.purchaseUrl
              : `${window.location.origin}${ev.purchaseUrl}`

            return (
              <div className="grid-card" key={ev.eventId}>
                <div className="grid-thumb" style={{ background: gradientFor(i + 4) }}>
                  {ev.formSnapshot?.eventImageUrl && (
                    <img src={ev.formSnapshot.eventImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                  )}
                  {dm && (
                    <div className="date-badge">
                      <div className="d">{dm.day}</div>
                      <div className="m">{dm.month}</div>
                    </div>
                  )}
                </div>
                <div className="grid-body">
                  {ev.location && <div className="grid-loc">📍 {ev.location}</div>}
                  <h4>{ev.eventName}</h4>
                  {timeLabel && <div className="grid-time">🕐 {timeLabel}</div>}
                  {ev.host && <div className="grid-desc">Hosted by {ev.host}</div>}
                  <div className="grid-foot">
                    <a href={ev.purchaseUrl} className="btn btn-solid btn-sm">Buy Ticket</a>
                    <QRWidget value={purchaseUrl} size={34} className="qr-mini" colorDark="#0E1521" colorLight="#ffffff" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <footer>© {new Date().getFullYear()} Kodte. All events, all in one place.</footer>
    </div>
  )
}

/* ----------- Nav pill icons ----------- */

/* ----------- Styles (scoped to .kodte-page) ----------- */

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@400;500;600;700;800&display=swap');

.kodte-page {
  --ink: #0E1521;
  --ink-soft: #4B5768;
  --line: #E4E8EF;
  --paper: #F4F6FA;
  --white: #ffffff;
  --blue: #1B5FE0;
  --blue-deep: #123E96;
  --amber: #F2A93B;
  --card-shadow: 0 10px 30px rgba(14,21,33,0.06);
  font-family: 'Outfit', 'Inter', sans-serif;
  background: var(--paper);
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
}
.kodte-page * { box-sizing: border-box; }
.kodte-page h1, .kodte-page h2, .kodte-page h3 {
  font-family: 'Bebas Neue', sans-serif;
  letter-spacing: 0.5px;
  line-height: 1;
  margin: 0;
}
.kodte-page a { text-decoration: none; color: inherit; }
.kodte-page button { font-family: inherit; cursor: pointer; border: none; background: none; }
.kodte-page img { display: block; max-width: 100%; }

/* HERO */
.kodte-page .hero {
  position: relative; min-height: 560px;
  background:
    linear-gradient(180deg, rgba(6,10,20,0.55) 0%, rgba(6,10,20,0.35) 40%, rgba(6,10,20,0.85) 100%),
    radial-gradient(circle at 20% 20%, #3a2f6b 0%, transparent 45%),
    radial-gradient(circle at 80% 10%, #7a2b6b 0%, transparent 40%),
    linear-gradient(120deg, #101625 0%, #1a1f33 55%, #241b3a 100%);
  color: var(--white); overflow: hidden; padding-bottom: 60px;
}
.kodte-page .hero::after {
  content: ""; position: absolute; inset: 0;
  background-image: repeating-linear-gradient(115deg, rgba(255,255,255,0.03) 0 2px, transparent 2px 60px);
  pointer-events: none;
}
.kodte-page .nav-row { display: flex; align-items: center; justify-content: space-between; max-width: 1240px; margin: 0 auto; padding: 26px 24px 0; position: relative; z-index: 3; }
.kodte-page .logo { font-family: 'Bebas Neue', sans-serif; font-size: 30px; letter-spacing: 1px; }
.kodte-page .logo span { color: var(--amber); }
.kodte-page .nav-actions { display: flex; gap: 12px; align-items: center; }

/* Buttons */
.kodte-page .btn { display: inline-flex; align-items: center; gap: 8px; padding: 11px 20px; border-radius: 9px; font-size: 14px; font-weight: 600; border: 1px solid transparent; transition: transform .15s ease, background .15s ease, box-shadow .15s ease; white-space: nowrap; }
.kodte-page .btn:hover { transform: translateY(-1px); }
.kodte-page .btn-outline { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.35); color: #fff; backdrop-filter: blur(6px); }
.kodte-page .btn-outline:hover { background: rgba(255,255,255,0.16); }
.kodte-page .btn-solid { background: var(--blue); color: #fff; }
.kodte-page .btn-solid:hover { background: var(--blue-deep); box-shadow: 0 8px 20px rgba(27,95,224,0.35); }
.kodte-page .btn-ghost-white { background: #fff; color: var(--ink); }
.kodte-page .btn-ghost-white:hover { box-shadow: 0 8px 20px rgba(0,0,0,0.15); }
.kodte-page .btn-light { background: #fff; border-color: var(--line); color: var(--blue); }
.kodte-page .btn-sm { padding: 8px 14px; font-size: 12.5px; border-radius: 7px; }

/* Hero stage */
.kodte-page .hero-stage { max-width: 1240px; margin: 70px auto 0; padding: 0 24px; position: relative; z-index: 3; }
.kodte-page .hero-copy { max-width: 600px; margin-bottom: 34px; }
.kodte-page .eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--amber); margin-bottom: 14px; }
.kodte-page .eyebrow::before { content: ""; width: 22px; height: 2px; background: var(--amber); display: inline-block; }
.kodte-page .hero-copy h1 { font-size: 56px; margin: 0 0 14px; }
.kodte-page .hero-copy p { font-size: 16px; color: rgba(255,255,255,0.78); line-height: 1.55; font-family: 'Outfit', sans-serif; }

/* Search bar */
.kodte-page .search-bar { background: rgba(255,255,255,0.94); border-radius: 14px; max-width: 920px; padding: 6px; display: flex; align-items: center; box-shadow: var(--card-shadow); }
.kodte-page .search-field { flex: 1; padding: 10px 18px; }
.kodte-page .search-field .label { font-weight: 700; font-size: 13px; color: var(--ink-soft); margin-bottom: 4px; }
.kodte-page .search-input { width: 100%; border: none; outline: none; background: transparent; font-family: 'Outfit', sans-serif; font-size: 15px; font-weight: 600; color: var(--ink); }
.kodte-page .search-input::placeholder { color: var(--ink-soft); font-weight: 400; }
.kodte-page .search-go { background: var(--blue); color: #fff; padding: 14px 26px; border-radius: 10px; font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 8px; margin: 0 4px; flex-shrink: 0; }
.kodte-page .search-go:hover { background: var(--blue-deep); }

/* Promo */
.kodte-page .promo { max-width: 1240px; margin: -30px auto 0; padding: 0 24px; position: relative; z-index: 4; }
.kodte-page .promo-inner { background: linear-gradient(100deg,#1B5FE0 0%, #22B7C8 100%); border-radius: 16px; padding: 22px 32px; display: flex; align-items: center; justify-content: space-between; color: #fff; box-shadow: 0 14px 34px rgba(27,95,224,0.28); flex-wrap: wrap; gap: 16px; }
.kodte-page .promo-text b { font-size: 19px; display: block; margin-bottom: 2px; }
.kodte-page .promo-text span { font-size: 13.5px; opacity: 0.9; }
.kodte-page .promo-code { background: rgba(255,255,255,0.16); border: 1px dashed rgba(255,255,255,0.6); padding: 10px 22px; border-radius: 10px; font-family: 'Bebas Neue'; font-size: 26px; letter-spacing: 1px; }

/* Sections */
.kodte-page .section { max-width: 1240px; margin: 0 auto; padding: 70px 24px 10px; }
.kodte-page .section-head { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 32px; gap: 20px; flex-wrap: wrap; }
.kodte-page .section-head h2 { font-size: 38px; }
.kodte-page .section-head p { color: var(--ink-soft); font-size: 14px; margin: 6px 0 0; }

/* Trending grid */
.kodte-page .trending-grid { display: grid; grid-template-columns: 1.55fr 1fr; gap: 24px; align-items: stretch; }

/* Carousel */
.kodte-page .carousel { position: relative; border-radius: 20px; overflow: hidden; box-shadow: var(--card-shadow); background: #111; min-height: 640px; }
.kodte-page .carousel-track { display: flex; height: 100%; transition: transform .55s cubic-bezier(.65,0,.35,1); }
.kodte-page .slide { min-width: 100%; position: relative; display: flex; flex-direction: column; justify-content: flex-end; padding: 34px; color: #fff; min-height: 640px; }
.kodte-page .slide-bg { position: absolute; inset: 0; z-index: 0; }
.kodte-page .slide-bg::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(10,12,20,0.05) 20%, rgba(8,10,16,0.92) 92%); }
.kodte-page .slide-tag { position: absolute; top: 24px; left: 24px; z-index: 2; background: #fff; color: var(--ink); font-size: 11.5px; font-weight: 800; letter-spacing: 1px; padding: 6px 12px; border-radius: 999px; display: flex; align-items: center; gap: 6px; }
.kodte-page .slide-tag::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--blue); }
.kodte-page .slide-content { position: relative; z-index: 2; }
.kodte-page .slide-content .cat { font-size: 13px; font-weight: 700; color: var(--amber); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
.kodte-page .slide-content h3 { font-size: 46px; margin: 0 0 12px; max-width: 80%; }
.kodte-page .slide-meta { display: flex; gap: 18px; font-size: 13.5px; color: rgba(255,255,255,0.85); margin-bottom: 18px; flex-wrap: wrap; }
.kodte-page .slide-meta span { display: flex; align-items: center; gap: 6px; }
.kodte-page .slide-loc { font-size: 14px; color: #8FB6FF; margin-bottom: 20px; font-weight: 600; }
.kodte-page .slide-actions { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.kodte-page .qr-chip { background: #fff; padding: 6px 12px 6px 6px; border-radius: 10px; display: flex; align-items: center; gap: 8px; }
.kodte-page .qr-chip canvas, .kodte-page .qr-chip img { border-radius: 5px; display: block; }
.kodte-page .qr-chip .qr-label { font-size: 10px; color: var(--ink-soft); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
.kodte-page .carousel-dots { position: absolute; bottom: 34px; right: 34px; z-index: 3; display: flex; gap: 8px; }
.kodte-page .dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.4); transition: all .2s ease; padding: 0; }
.kodte-page .dot.active { width: 24px; background: #fff; }
.kodte-page .carousel-arrows { position: absolute; top: 50%; left: 0; right: 0; display: flex; justify-content: space-between; padding: 0 16px; transform: translateY(-50%); z-index: 3; }
.kodte-page .arrow { width: 38px; height: 38px; border-radius: 50%; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.4); color: #fff; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); font-size: 16px; }
.kodte-page .arrow:hover { background: rgba(255,255,255,0.3); }

/* List cards */
.kodte-page .list-col { display: flex; flex-direction: column; gap: 16px; }
.kodte-page .list-card { background: var(--white); border: 1px solid var(--line); border-radius: 16px; padding: 14px; display: flex; gap: 14px; box-shadow: var(--card-shadow); }
.kodte-page .list-thumb { width: 88px; height: 88px; border-radius: 11px; flex-shrink: 0; position: relative; overflow: hidden; }
.kodte-page .list-thumb .num { position: absolute; top: 6px; left: 6px; background: rgba(0,0,0,0.55); color: #fff; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 5px; z-index: 1; }
.kodte-page .list-body { flex: 1; min-width: 0; }
.kodte-page .list-date { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--ink-soft); font-weight: 600; margin-bottom: 5px; flex-wrap: wrap; }
.kodte-page .list-date .time { color: var(--blue); }
.kodte-page .list-body h4 { font-size: 15px; font-weight: 800; margin: 0 0 3px; line-height: 1.25; font-family: 'Outfit', sans-serif; }
.kodte-page .list-loc { font-size: 12px; color: var(--blue); font-weight: 600; margin-bottom: 5px; }
.kodte-page .list-desc { font-size: 12px; color: var(--ink-soft); line-height: 1.4; margin-bottom: 10px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.kodte-page .list-actions { display: flex; align-items: center; gap: 10px; }
.kodte-page .qr-mini { width: 34px !important; height: 34px !important; border: 1px solid var(--line); border-radius: 6px; padding: 2px; flex-shrink: 0; overflow: hidden; }
.kodte-page .qr-mini canvas, .kodte-page .qr-mini img { width: 100% !important; height: 100% !important; display: block; }

/* Category chips */
.kodte-page .filter-row { display: flex; gap: 10px; flex-wrap: wrap; margin: 26px 0 34px; }
.kodte-page .chip { padding: 10px 18px; border-radius: 999px; border: 1px solid var(--line); background: #fff; font-size: 13px; font-weight: 600; color: var(--ink-soft); transition: all .15s ease; }
.kodte-page .chip.active { background: var(--blue); border-color: var(--blue); color: #fff; }
.kodte-page .chip:hover:not(.active) { border-color: var(--blue); color: var(--blue); }

/* Explore grid */
.kodte-page .explore-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
.kodte-page .grid-card { background: #fff; border: 1px solid var(--line); border-radius: 16px; overflow: hidden; box-shadow: var(--card-shadow); display: flex; flex-direction: column; }
.kodte-page .grid-thumb { height: 180px; position: relative; }
.kodte-page .grid-thumb .date-badge { position: absolute; top: 12px; left: 12px; background: #fff; border-radius: 9px; padding: 6px 10px; text-align: center; box-shadow: 0 4px 10px rgba(0,0,0,0.15); }
.kodte-page .date-badge .d { font-family: 'Bebas Neue'; font-size: 18px; line-height: 1; color: var(--blue); }
.kodte-page .date-badge .m { font-size: 9px; font-weight: 800; letter-spacing: 0.5px; color: var(--ink-soft); }
.kodte-page .grid-body { padding: 18px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
.kodte-page .grid-loc { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--blue); font-weight: 600; }
.kodte-page .grid-body h4 { font-size: 18px; margin: 0; line-height: 1.15; font-weight: 800; font-family: 'Outfit', sans-serif; }
.kodte-page .grid-time { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--ink-soft); font-weight: 600; }
.kodte-page .grid-desc { font-size: 12.5px; color: var(--ink-soft); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.kodte-page .grid-foot { margin-top: auto; display: flex; align-items: center; justify-content: space-between; padding-top: 12px; border-top: 1px dashed var(--line); }

/* Footer */
.kodte-page footer { margin-top: 80px; padding: 34px 24px 40px; text-align: center; color: var(--ink-soft); font-size: 12.5px; }

/* Responsive */
@media (max-width: 980px) {
  .kodte-page .trending-grid { grid-template-columns: 1fr; }
  .kodte-page .explore-grid { grid-template-columns: repeat(2, 1fr); }
  .kodte-page .hero-copy h1 { font-size: 40px; }
  .kodte-page .nav-row { flex-wrap: wrap; gap: 12px; }
}
@media (max-width: 640px) {
  .kodte-page .explore-grid { grid-template-columns: 1fr; }
}
`
