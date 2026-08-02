import { type CSSProperties, useState, useEffect, useRef } from 'react'
import { KodeDeviceStack } from './KodeDeviceStack'
import { SiteFooter } from './marketing/SiteFooter'

/* ─── Design tokens (follow global light/dark via CSS vars) ─────────── */
type LandingTokens = {
  bg: string
  bgAlt: string
  text: string
  textAlt: string
  muted: string
  border: string
  teal: string
  tealLt: string
  tealXlt: string
}

const C: LandingTokens = {
  bg:      '#ffffff',
  bgAlt:   '#ffffff',
  text:    'var(--foreground)',
  textAlt: 'var(--foreground)',
  muted:   'var(--muted-foreground)',
  border:  'transparent',
  teal:    'var(--primary)',
  tealLt:  'var(--primary)',
  tealXlt: 'var(--accent)',
}

/* ─── Inline styles ─────────────────────────────────────────────────── */
const getStyles = (tokens: LandingTokens): Record<string, CSSProperties> => ({
  page: { fontFamily: "'Outfit Variable', sans-serif", background: 'transparent', color: tokens.text, overflowX: 'hidden', minHeight: '100vh', position: 'relative' },
  nav: { background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: 'none', position: 'sticky', top: 0, zIndex: 50, overflow: 'visible' },
  navInner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', maxWidth: 1160, margin: '0 auto', height: 60, gap: 16, overflow: 'visible' },
  logo: { display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' },
  logoMark: { width: 32, height: 32, borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  logoText: { color: tokens.text, fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em' },
  navLinks: { display: 'flex', gap: 32, listStyle: 'none', margin: 0, padding: 0 },
  navLink: { color: tokens.muted, fontSize: 14, textDecoration: 'none' },
  navCta: { background: '#ffffff', color: tokens.teal, padding: '8px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none', cursor: 'pointer', border: '1px solid color-mix(in srgb, var(--primary) 28%, transparent)', display: 'inline-flex', alignItems: 'center', gap: 8 },
  hero: { background: 'transparent', padding: '100px 48px 100px', position: 'relative', overflow: 'hidden' },
  heroInner: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, alignItems: 'center', maxWidth: '100%' },
  eyebrow: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'color-mix(in srgb, var(--primary) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)', color: tokens.tealLt, fontSize: 12, fontWeight: 600, padding: '4px 11px', borderRadius: 20, marginBottom: 20, letterSpacing: '0.02em' },
  heroH1: { color: tokens.text, fontSize: 'clamp(30px,4vw,48px)', fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.03em', margin: '0 0 16px' },
  heroSub: { color: tokens.muted, fontSize: 'clamp(14px,1.7vw,17px)', lineHeight: 1.6, margin: '0 0 36px', maxWidth: 420 },
  ctaRow: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  ctaPrimary: { background: '#ffffff', color: tokens.teal, padding: '13px 28px', borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid color-mix(in srgb, var(--primary) 28%, transparent)', cursor: 'pointer' },
  ctaSecondary: { background: 'transparent', color: tokens.text, padding: '13px 28px', borderRadius: 10, fontSize: 15, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, border: `1.5px solid ${tokens.border}`, cursor: 'pointer' },
})

/* ─── Stripe-style fluid mesh gradient background ───────────────────── */
function MeshGradientBackground() {
  return (
    <div className="scanny-mesh" aria-hidden>
      <div className="scanny-mesh__base" />
      <div className="scanny-mesh__blob scanny-mesh__blob--violet" />
      <div className="scanny-mesh__blob scanny-mesh__blob--pink" />
      <div className="scanny-mesh__blob scanny-mesh__blob--blue" />
      <div className="scanny-mesh__blob scanny-mesh__blob--peach" />
      <div className="scanny-mesh__blob scanny-mesh__blob--lilac" />
      <div className="scanny-mesh__wash" />
      <style>{`
        .scanny-mesh {
          position: fixed;
          inset: 0;
          z-index: 0;
          overflow: hidden;
          pointer-events: none;
        }
        .scanny-mesh__base {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(120% 80% at 10% 0%, #fce7f3 0%, transparent 55%),
            radial-gradient(100% 70% at 90% 10%, #e0e7ff 0%, transparent 50%),
            radial-gradient(90% 60% at 50% 100%, #ffedd5 0%, transparent 55%),
            linear-gradient(160deg, #faf5ff 0%, #f0f9ff 45%, #fff7ed 100%);
        }
        .scanny-mesh__blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          mix-blend-mode: multiply;
          opacity: 0.72;
          will-change: transform;
        }
        .scanny-mesh__blob--violet {
          width: min(58vw, 720px);
          height: min(58vw, 720px);
          top: -12%;
          left: -8%;
          background: radial-gradient(circle, #8b5cf6 0%, #a78bfa 35%, transparent 70%);
          animation: KodeMeshA 22s ease-in-out infinite;
        }
        .scanny-mesh__blob--pink {
          width: min(52vw, 640px);
          height: min(52vw, 640px);
          top: 8%;
          right: -10%;
          background: radial-gradient(circle, #ec4899 0%, #f472b6 40%, transparent 72%);
          animation: KodeMeshB 26s ease-in-out infinite;
        }
        .scanny-mesh__blob--blue {
          width: min(60vw, 760px);
          height: min(60vw, 760px);
          bottom: -18%;
          left: 18%;
          background: radial-gradient(circle, #38bdf8 0%, #7dd3fc 38%, transparent 70%);
          animation: KodeMeshC 24s ease-in-out infinite;
        }
        .scanny-mesh__blob--peach {
          width: min(48vw, 580px);
          height: min(48vw, 580px);
          bottom: 10%;
          right: 5%;
          background: radial-gradient(circle, #fdba74 0%, #fed7aa 42%, transparent 72%);
          animation: KodeMeshD 20s ease-in-out infinite;
        }
        .scanny-mesh__blob--lilac {
          width: min(40vw, 480px);
          height: min(40vw, 480px);
          top: 38%;
          left: 36%;
          background: radial-gradient(circle, #c4b5fd 0%, #ddd6fe 45%, transparent 70%);
          opacity: 0.55;
          animation: KodeMeshE 28s ease-in-out infinite;
        }
        .scanny-mesh__wash {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.12) 40%, rgba(255,255,255,0.35) 100%);
        }
        @keyframes KodeMeshA {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(12%, 18%) scale(1.12); }
          66% { transform: translate(22%, 6%) scale(0.94); }
        }
        @keyframes KodeMeshB {
          0%, 100% { transform: translate(0, 0) scale(1.05); }
          40% { transform: translate(-16%, 14%) scale(0.92); }
          70% { transform: translate(-8%, 22%) scale(1.1); }
        }
        @keyframes KodeMeshC {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(14%, -18%) scale(1.15); }
        }
        @keyframes KodeMeshD {
          0%, 100% { transform: translate(0, 0) scale(0.96); }
          35% { transform: translate(-18%, -12%) scale(1.08); }
          65% { transform: translate(-6%, -22%) scale(1); }
        }
        @keyframes KodeMeshE {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-20%, 10%) scale(1.2); }
        }
        @media (prefers-reduced-motion: reduce) {
          .scanny-mesh__blob { animation: none !important; }
        }
      `}</style>
    </div>
  )
}

/* ─── QR Mockup ─────────────────────────────────────────────────────── */
function _QRMockup({ C: tokens }: { C: LandingTokens }) {
  const [scanLine, setScanLine] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setScanLine(v => (v + 1) % 100), 18)
    return () => clearInterval(id)
  }, [])

  const qrPattern = [
    [1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1,0,0,1,0,1,0,0,1,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,0,1,0,1,0,1,0,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,0,1,1,0,0,0,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,1,1,0,1,1,0,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,0,1,1,0,1,0,0,0,0,0,0,0,0,0],
    [1,1,0,1,1,0,1,1,1,0,1,0,1,1,0,1,1,0,1,1,0],
    [0,1,0,0,1,0,0,0,0,1,0,1,0,0,0,1,0,0,0,1,0],
    [1,0,1,1,0,1,1,0,1,0,1,0,1,0,1,0,1,1,0,0,1],
    [0,0,1,0,1,0,0,1,1,1,0,1,1,0,0,1,0,0,1,0,0],
    [1,1,0,1,0,1,1,0,1,0,0,0,1,1,0,1,1,0,1,1,0],
    [0,0,0,0,0,0,0,0,1,0,1,1,0,0,0,0,0,0,0,0,0],
    [1,1,1,1,1,1,1,0,1,1,0,0,1,0,1,0,0,1,1,0,1],
    [1,0,0,0,0,0,1,0,0,0,1,0,0,1,0,1,0,0,0,1,0],
    [1,0,1,1,1,0,1,1,1,0,0,1,1,0,1,0,1,1,0,0,1],
    [1,0,1,1,1,0,1,0,0,1,1,0,0,0,0,1,0,0,1,0,0],
    [1,0,1,1,1,0,1,0,1,0,1,0,1,0,1,0,0,1,0,1,0],
    [1,0,0,0,0,0,1,0,0,1,0,1,0,1,0,1,0,0,0,1,0],
    [1,1,1,1,1,1,1,0,1,0,0,0,1,1,0,0,1,1,1,0,1],
  ]
  const cell = 10
  const size = qrPattern.length * cell
  const isDark = typeof document !== 'undefined' && document.body.classList.contains('dark-mode')
  const qrFill = isDark ? '#e7ece4' : '#0d1612'

  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ position: 'absolute', width: 340, height: 340, background: `radial-gradient(circle, color-mix(in srgb, ${tokens.teal} 20%, transparent) 0%, transparent 70%)`, borderRadius: '50%', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }} />
      <div style={{ background: tokens.bgAlt, borderRadius: 20, padding: '36px 36px 28px', boxShadow: '0 32px 80px rgba(0,0,0,0.5)', position: 'relative', zIndex: 2, border: `1px solid ${tokens.border}` }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: tokens.teal, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Scan to Order</span>
          <div style={{ fontSize: 12, color: tokens.muted, marginTop: 2 }}>Brew House Café</div>
        </div>
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 8 }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
            {qrPattern.map((row, ri) =>
              row.map((val, ci) =>
                val ? <rect key={`${ri}-${ci}`} x={ci * cell + 1} y={ri * cell + 1} width={cell - 2} height={cell - 2} rx={1.5} fill={qrFill} /> : null
              )
            )}
          </svg>
          <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${tokens.teal}, transparent)`, top: `${scanLine}%`, opacity: 0.9, transition: 'top 18ms linear', boxShadow: `0 0 8px ${tokens.teal}` }} />
        </div>
        <div style={{ textAlign: 'center', marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: tokens.teal }} />
          <span style={{ fontSize: 11, color: tokens.muted, fontWeight: 500 }}>kode.com/menu/brewhousecafe</span>
        </div>
      </div>
    </div>
  )
}

/* ─── Interactive cursor field (blank-area hover) ───────────────────── */
function isBlankHoverTarget(el: Element | null) {
  if (!el) return true
  const interactive = el.closest(
    'a, button, input, textarea, select, label, [role="button"], .scanny-device-stack, .scanny-footer, nav, img, svg'
  )
  return !interactive
}

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  base: number
}

function CursorField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const coarse = window.matchMedia('(pointer: coarse)').matches
    const canvas = canvasRef.current
    if (reduce || coarse || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const mouse = { x: -9999, y: -9999, active: false }
    let raf = 0
    let w = 0
    let h = 0
    let particles: Particle[] = []

    const colors = [
      '139, 92, 246',
      '236, 72, 153',
      '56, 189, 248',
      '251, 146, 60',
    ]

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const count = Math.min(90, Math.floor((w * h) / 18000))
      particles = Array.from({ length: count }, () => {
        const base = 1.2 + Math.random() * 1.8
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.25,
          vy: (Math.random() - 0.5) * 0.25,
          r: base,
          base,
        }
      })
    }

    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
      mouse.active = isBlankHoverTarget(e.target as Element)
    }
    const onLeave = () => {
      mouse.active = false
    }

    const draw = () => {
      ctx.clearRect(0, 0, w, h)

      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy

        if (p.x < -20) p.x = w + 20
        if (p.x > w + 20) p.x = -20
        if (p.y < -20) p.y = h + 20
        if (p.y > h + 20) p.y = -20

        if (mouse.active) {
          const dx = mouse.x - p.x
          const dy = mouse.y - p.y
          const dist = Math.hypot(dx, dy) || 1
          const radius = 160
          if (dist < radius) {
            const force = (1 - dist / radius) * 0.085
            // Soft swirl + attract
            p.vx += dx * force * 0.04 - dy * force * 0.03
            p.vy += dy * force * 0.04 + dx * force * 0.03
            p.r = p.base + (1 - dist / radius) * 2.2
          } else {
            p.r += (p.base - p.r) * 0.08
          }
        } else {
          p.r += (p.base - p.r) * 0.08
        }

        p.vx *= 0.96
        p.vy *= 0.96
        p.vx += (Math.random() - 0.5) * 0.02
        p.vy += (Math.random() - 0.5) * 0.02
      }

      // Links near cursor / between close particles
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i]
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.hypot(dx, dy)
          if (dist > 110) continue
          const nearCursor =
            mouse.active &&
            Math.hypot((a.x + b.x) / 2 - mouse.x, (a.y + b.y) / 2 - mouse.y) < 180
          if (!nearCursor && dist > 70) continue
          const alpha = nearCursor ? 0.22 * (1 - dist / 110) : 0.08 * (1 - dist / 70)
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.strokeStyle = `rgba(99, 102, 241, ${alpha})`
          ctx.lineWidth = nearCursor ? 1.2 : 0.7
          ctx.stroke()
        }
      }

      particles.forEach((p, i) => {
        const near =
          mouse.active ? Math.max(0, 1 - Math.hypot(p.x - mouse.x, p.y - mouse.y) / 160) : 0
        const rgb = colors[i % colors.length]
        const alpha = 0.2 + near * 0.55
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${rgb}, ${alpha})`
        ctx.fill()
        if (near > 0.35) {
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r * 3.2, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${rgb}, ${near * 0.12})`
          ctx.fill()
        }
      })

      // Soft core at cursor when blank
      if (mouse.active) {
        const g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 90)
        g.addColorStop(0, 'rgba(255,255,255,0.35)')
        g.addColorStop(0.35, 'rgba(167,139,250,0.16)')
        g.addColorStop(1, 'rgba(167,139,250,0)')
        ctx.beginPath()
        ctx.fillStyle = g
        ctx.arc(mouse.x, mouse.y, 90, 0, Math.PI * 2)
        ctx.fill()
      }

      raf = requestAnimationFrame(draw)
    }

    resize()
    draw()
    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', onMove, { passive: true })
    document.documentElement.addEventListener('mouseleave', onLeave)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
      document.documentElement.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="scanny-cursor-field"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2,
        pointerEvents: 'none',
        width: '100%',
        height: '100%',
      }}
    />
  )
}

/* ─── Venue marquee (Uganda restaurants & hotels) ───────────────────── */
type Venue = { name: string; logo: string }

const venueRowA: Venue[] = [
  { name: 'Serena Hotel Kampala', logo: '/venues/serena.svg' },
  { name: 'Cafe Javas', logo: '/venues/javas.svg' },
  { name: 'Speke Resort Munyonyo', logo: '/venues/speke.png' },
  { name: 'Yujo Izakaya', logo: '/venues/yujo.svg' },
  { name: 'Sheraton Kampala', logo: '/venues/sheraton.png' },
  { name: 'The Lawns', logo: '/venues/lawns.svg' },
  { name: 'Protea Hotel Kampala', logo: '/venues/protea.svg' },
  { name: 'Faze 2', logo: '/venues/faze2.svg' },
]

const venueRowB: Venue[] = [
  { name: 'Kampala Hilton', logo: '/venues/hilton.png' },
  { name: 'Prunes Restaurant', logo: '/venues/prunes.svg' },
  { name: 'Four Points by Sheraton', logo: '/venues/fourpoints.png' },
  { name: 'Mediterraneo', logo: '/venues/mediterraneo.svg' },
  { name: 'Hotel Africana', logo: '/venues/africana.png' },
  { name: 'Cayenne', logo: '/venues/cayenne.svg' },
  { name: 'Lake Victoria Serena', logo: '/venues/serena.svg' },
  { name: 'Mama Ashanti', logo: '/venues/mamaashanti.svg' },
]

function VenuePill({ venue }: { venue: Venue }) {
  const [failed, setFailed] = useState(false)
  const initial = venue.name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()

  return (
    <div
      style={{
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 18px',
        whiteSpace: 'nowrap',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 7,
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.9)',
          boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {!failed ? (
          <img
            src={venue.logo}
            alt=""
            width={28}
            height={28}
            onError={() => setFailed(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.02em' }}>
            {initial}
          </span>
        )}
      </div>
      <span
        style={{
          fontSize: 'clamp(12px, 1.4vw, 15px)',
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: 'var(--foreground)',
          opacity: 0.78,
        }}
      >
        {venue.name}
      </span>
    </div>
  )
}

function MarqueeRow({
  items,
  reverse = false,
  duration = 40,
}: {
  items: Venue[]
  reverse?: boolean
  duration?: number
}) {
  const loop = [...items, ...items]
  return (
    <div className="scanny-marquee-track" style={{ overflow: 'hidden', width: '100%' }}>
      <div
        className={`scanny-marquee-strip${reverse ? ' scanny-marquee-strip--reverse' : ''}`}
        style={{ animationDuration: `${duration}s` }}
      >
        {loop.map((venue, i) => (
          <VenuePill key={`${venue.name}-${i}`} venue={venue} />
        ))}
      </div>
    </div>
  )
}

function VenueCarousel({ C }: { C: LandingTokens }) {
  return (
    <section
      style={{
        position: 'relative',
        zIndex: 1,
        padding: '28px 0 48px',
        overflow: 'hidden',
      }}
    >
      <style>{`
        .scanny-marquee-strip {
          display: flex;
          width: max-content;
          animation: KodeMarqueeLeft linear infinite;
        }
        .scanny-marquee-strip--reverse {
          animation-name: KodeMarqueeRight;
        }
        @keyframes KodeMarqueeLeft {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes KodeMarqueeRight {
          from { transform: translateX(-50%); }
          to { transform: translateX(0); }
        }
        .scanny-marquee-fade {
          pointer-events: none;
          position: absolute;
          inset: 0;
          z-index: 2;
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0.55) 0%,
            transparent 12%,
            transparent 88%,
            rgba(255,255,255,0.55) 100%
          );
        }
        @media (prefers-reduced-motion: reduce) {
          .scanny-marquee-strip {
            animation: none !important;
          }
        }
      `}</style>

      <p
        style={{
          textAlign: 'center',
          color: C.muted,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          margin: '0 0 28px',
        }}
      >
        Trusted by leading venues across Uganda
      </p>

      <div style={{ position: 'relative' }}>
        <div className="scanny-marquee-fade" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <MarqueeRow items={venueRowA} duration={38} />
          <MarqueeRow items={venueRowB} reverse duration={44} />
        </div>
      </div>
    </section>
  )
}

/* ─── How it works section ──────────────────────────────────────────── */
const steps = [
  { n: '01', title: 'Build your catalog', body: 'Add items with prices and availability. Changes go live instantly.' },
  { n: '02', title: 'Share your QR', body: 'Display your code. Customers scan and order from their phone.' },
  { n: '03', title: 'Run your dashboard', body: 'Track orders, update status, and manage payments in real time.' },
]

function HowItWorks({ C }: { C: LandingTokens }) {
  return (
    <section style={{ background: 'transparent', padding: '80px 24px', position: 'relative', zIndex: 1 }}>
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <p style={{ color: C.tealLt, fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 12px' }}>How it works</p>
          <h2 style={{ color: C.text, fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Live in minutes</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 40 }}>
          {steps.map(s => (
            <div key={s.n} style={{ padding: '8px 4px' }}>
              <span style={{ color: C.tealLt, fontSize: 13, fontWeight: 800, display: 'block', marginBottom: 16 }}>{s.n}</span>
              <h3 style={{ color: C.text, fontSize: 18, fontWeight: 700, margin: '0 0 10px', letterSpacing: '-0.01em' }}>{s.title}</h3>
              <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.65, margin: 0 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Features section ───────────────────────────────────────────────── */
const features = [
  { icon: '⚡', title: 'Instant QR generation',    body: 'Every business gets a unique QR code and customer URL the moment they sign up.' },
  { icon: '📋', title: 'Live order dashboard',      body: 'Orders arrive in real time. Update status from Pending to Ready with one click.' },
  { icon: '🛍️', title: 'Catalog management',       body: 'Add, edit, or hide items anytime. Changes go live immediately for customers.' },
  { icon: '💳', title: 'Payment tracking',          body: 'Mark orders as Paid, Unpaid, or Refunded. See revenue at a glance.' },
  { icon: '📊', title: 'Order analytics',           body: 'Track open orders, paid sales, and completed orders from summary cards.' },
  { icon: '📱', title: 'Mobile-first experience',   body: 'Customers order from any phone browser — no app download needed.' },
]

function Features({ C }: { C: LandingTokens }) {
  return (
    <section style={{ background: C.bg, padding: '80px 24px' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <p style={{ color: C.tealLt, fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 12px' }}>Features</p>
          <h2 style={{ color: C.text, fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Everything you need, nothing you don't</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {features.map(f => (
            <div key={f.title} style={{ background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: 14, padding: '24px 22px', transition: 'border-color 0.2s' }}>
              <div style={{ fontSize: 28, marginBottom: 14 }}>{f.icon}</div>
              <h3 style={{ color: C.text, fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>{f.title}</h3>
              <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6, margin: 0 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Business types section ─────────────────────────────────────────── */
const bizTypes = [
  { emoji: '🍽️', type: 'Restaurant', desc: 'Table-side ordering with real-time kitchen updates and payment tracking.' },
  { emoji: '🍹', type: 'Bar',        desc: 'Seat or area ordering. Perfect for high-volume venues and late nights.' },
  { emoji: '🎓', type: 'School',     desc: 'Canteen menus, lunch orders, and uniform or supply catalogs.' },
  { emoji: '👗', type: 'Boutique',   desc: 'Product catalogs with delivery or pickup notes built in.' },
]

function BusinessTypes({ C }: { C: LandingTokens }) {
  return (
    <section style={{ background: C.bgAlt, padding: '80px 24px', borderTop: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <p style={{ color: C.tealLt, fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 12px' }}>Business types</p>
          <h2 style={{ color: C.text, fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Built for your kind of business</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
          {bizTypes.map(b => (
            <div key={b.type} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 16, padding: '32px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>{b.emoji}</div>
              <h3 style={{ color: C.text, fontSize: 17, fontWeight: 700, margin: '0 0 10px' }}>{b.type}</h3>
              <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6, margin: 0 }}>{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── CTA section ────────────────────────────────────────────────────── */
function CtaSection({ onGetStarted, C }: { onGetStarted: () => void; C: LandingTokens }) {
  const S = getStyles(C)
  return (
    <section style={{ background: C.bg, padding: '80px 24px', borderTop: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${C.teal}22`, border: `1px solid ${C.teal}44`, color: C.tealLt, fontSize: 13, fontWeight: 600, padding: '5px 12px', borderRadius: 20, marginBottom: 24, letterSpacing: '0.02em' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.tealLt, display: 'inline-block' }} />
          Ready to start
        </div>
        <h2 style={{ color: C.text, fontSize: 'clamp(28px,4vw,44px)', fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 16px' }}>Ready to go live?</h2>
        <p style={{ color: C.muted, fontSize: 17, lineHeight: 1.6, margin: '0 0 36px' }}>
          Set up your QR menu in under 5 minutes. No credit card, no installs, no friction.
        </p>
        <button onClick={onGetStarted} style={{ ...S.ctaPrimary, fontSize: 16, padding: '15px 36px', margin: '0 auto' }} className="cta-primary">
          <span className="cta-primary__label">Get started</span>
          <svg className="cta-primary__arrow" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <p style={{ color: C.muted, fontSize: 13, margin: '18px 0 0', opacity: 0.7 }}>No credit card required · Set up in 5 minutes</p>
      </div>
    </section>
  )
}

/* ─── Top nav ────────────────────────────────────────────────────────── */
function TopNav({
  onGetStarted,
  onCreateEventTicket,
  S,
}: {
  onGetStarted: () => void
  onCreateEventTicket: () => void
  S: Record<string, CSSProperties>
}) {
  return (
    <nav style={S.nav}>
      <style>{`
        .scanny-nav-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
          margin-left: auto;
        }
        .scanny-nav-event {
          background: transparent;
          color: var(--foreground);
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
          border: 1px solid color-mix(in srgb, var(--foreground) 16%, transparent);
          white-space: nowrap;
          font-family: inherit;
          display: inline-flex;
          flex-direction: row;
          align-items: center;
          gap: 8px;
        }
        .scanny-nav-event:hover {
          background: color-mix(in srgb, var(--foreground) 5%, transparent);
        }
        .scanny-nav-event__ticket {
          display: inline-flex;
          flex-shrink: 0;
          order: 1;
          position: relative;
          z-index: 1;
          color: #ea580c;
          transform-origin: center;
          animation: KodeTicketFloat 1.8s ease-in-out infinite;
        }
        .scanny-nav-event__label {
          order: 0;
        }
        .scanny-nav-event:hover .scanny-nav-event__ticket {
          animation: KodeTicketPop 0.55s cubic-bezier(0.34, 1.4, 0.64, 1) both;
        }
        @keyframes KodeTicketFloat {
          0%, 100% { transform: translateY(0) rotate(-6deg); }
          50% { transform: translateY(-2px) rotate(4deg); }
        }
        @keyframes KodeTicketPop {
          0% { transform: translateY(0) rotate(-6deg) scale(1); }
          45% { transform: translateY(-3px) rotate(10deg) scale(1.12); }
          100% { transform: translateY(0) rotate(-4deg) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .scanny-nav-event__ticket { animation: none !important; }
        }
      `}</style>
      <div style={S.navInner}>
        <a href="#" style={S.logo}>
          <div style={S.logoMark}>
            <img src="/kode-icon.svg" alt="" width={32} height={32} style={{ width: '100%', height: '100%', display: 'block' }} />
          </div>
          <span style={S.logoText}>Kode</span>
        </a>

        <div className="scanny-nav-actions">
          <button type="button" onClick={onCreateEventTicket} className="scanny-nav-event">
            <span className="scanny-nav-event__label">Create event ticket</span>
            <span className="scanny-nav-event__ticket" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M2.5 4.25C2.5 3.56 3.06 3 3.75 3H12.25C12.94 3 13.5 3.56 13.5 4.25V6.1a1.35 1.35 0 0 0 0 2.55v1.85c0 .69-.56 1.25-1.25 1.25H3.75C3.06 11.75 2.5 11.19 2.5 10.5V8.65a1.35 1.35 0 0 0 0-2.55V4.25Z"
                  stroke="currentColor"
                  strokeWidth="1.35"
                  strokeLinejoin="round"
                />
                <path d="M9.75 3.35v8.05" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeDasharray="1.6 1.7" />
                <path d="M4.5 5.5h3M4.5 7.5h2.25" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </span>
          </button>
          <button onClick={onGetStarted} style={S.navCta} className="cta-primary">
            <span className="cta-primary__label">Get started</span>
            <svg className="cta-primary__arrow" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </nav>
  )
}

/* ─── Main export ────────────────────────────────────────────────────── */
export default function LandingPage({
  onGetStarted,
  onCreateEventTicket,
}: {
  onGetStarted: () => void
  onCreateEventTicket: () => void
}) {
  const S = getStyles(C)
  
  return (
    <div style={S.page} className="scanny-force-light">
      <MeshGradientBackground />
      <CursorField />
      <style>{`
        * { box-sizing: border-box; }
        a:hover { opacity: 0.85; }
        .cta-primary {
          display: inline-flex !important;
          flex-direction: row;
          align-items: center;
          gap: 8px;
        }
        .cta-primary:hover  { filter: brightness(0.95); transform: translateY(-1px); }
        .cta-primary__arrow {
          display: block;
          flex-shrink: 0;
          order: 1;
          position: relative;
          z-index: 1;
          animation: ctaArrowNudge 1.1s ease-in-out infinite;
        }
        .cta-primary__label {
          order: 0;
        }
        @keyframes ctaArrowNudge {
          0%, 100% { transform: translateX(0); opacity: 0.85; }
          50% { transform: translateX(3px); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cta-primary__arrow { animation: none !important; }
        }
        .cta-secondary:hover { border-color: ${C.border} !important; }
        @media (max-width: 768px) {
          .hero-grid   { grid-template-columns: 1fr !important; }
          .hero-visual { display: none !important; }
          .nav-links-desktop { display: none !important; }
        }
      `}</style>

      <div style={{ position: 'relative', zIndex: 1 }}>
      {/* NAV */}
      <TopNav onGetStarted={onGetStarted} onCreateEventTicket={onCreateEventTicket} S={S} />

      {/* HERO */}
      <section style={S.hero}>
        <div style={{ ...S.heroInner, position: 'relative', zIndex: 1 }} className="hero-grid">
          <div>
            <h1 style={S.heroH1}>
              One scan.<br />
              <span style={{ color: C.tealLt }}>Total control.</span>
            </h1>
            <p style={{ ...S.heroSub, fontWeight: 600 }}>
              Gone are the days.
            </p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }} className="hero-visual">
            <KodeDeviceStack />
          </div>
        </div>
      </section>

      <VenueCarousel C={C} />

      <span id="how" />
      <HowItWorks C={C} />
      <SiteFooter />
      </div>
    </div>
  )
}
