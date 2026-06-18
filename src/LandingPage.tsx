import { useState, useEffect } from 'react'

/* ─── Design tokens ─────────────────────────────────────────────────── */
const C = {
  dark:    '#14201d',
  darker:  '#0d1612',
  teal:    '#0f766e',
  tealLt:  '#14b8a6',
  tealXlt: '#ccfbf1',
  border:  '#1e332e',
  muted:   '#6b9e96',
  white:   '#ffffff',
}

/* ─── Inline styles ─────────────────────────────────────────────────── */
const S: Record<string, React.CSSProperties> = {
  page: { fontFamily: "'Inter', sans-serif", background: C.dark, color: C.dark, overflowX: 'hidden', minHeight: '100vh' },
  nav: { background: C.darker, borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 50 },
  navInner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', maxWidth: 1160, margin: '0 auto', height: 60 },
  logo: { display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' },
  logoMark: { width: 32, height: 32, background: C.teal, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  logoText: { color: C.white, fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em' },
  navLinks: { display: 'flex', gap: 32, listStyle: 'none', margin: 0, padding: 0 },
  navLink: { color: C.muted, fontSize: 14, textDecoration: 'none' },
  navCta: { background: C.teal, color: C.white, padding: '8px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none', cursor: 'pointer', border: 'none' },
  hero: { background: C.dark, padding: '100px 24px 100px', position: 'relative', overflow: 'hidden' },
  heroInner: { maxWidth: 1160, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' },
  eyebrow: { display: 'inline-flex', alignItems: 'center', gap: 6, background: `${C.teal}22`, border: `1px solid ${C.teal}44`, color: C.tealLt, fontSize: 13, fontWeight: 600, padding: '5px 12px', borderRadius: 20, marginBottom: 24, letterSpacing: '0.02em' },
  heroH1: { color: C.white, fontSize: 'clamp(36px,5vw,60px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.03em', margin: '0 0 20px' },
  heroSub: { color: C.muted, fontSize: 'clamp(16px,2vw,19px)', lineHeight: 1.6, margin: '0 0 40px', maxWidth: 460 },
  ctaRow: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  ctaPrimary: { background: C.teal, color: C.white, padding: '13px 28px', borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', cursor: 'pointer' },
  ctaSecondary: { background: 'transparent', color: C.white, padding: '13px 28px', borderRadius: 10, fontSize: 15, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, border: `1.5px solid ${C.border}`, cursor: 'pointer' },
}

/* ─── QR Mockup ─────────────────────────────────────────────────────── */
function QRMockup() {
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

  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ position: 'absolute', width: 340, height: 340, background: `radial-gradient(circle, ${C.teal}33 0%, transparent 70%)`, borderRadius: '50%', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }} />
      <div style={{ background: '#fff', borderRadius: 20, padding: '36px 36px 28px', boxShadow: '0 32px 80px rgba(0,0,0,0.5)', position: 'relative', zIndex: 2 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.teal, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Scan to Order</span>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Brew House Café</div>
        </div>
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 8 }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
            {qrPattern.map((row, ri) =>
              row.map((val, ci) =>
                val ? <rect key={`${ri}-${ci}`} x={ci * cell + 1} y={ri * cell + 1} width={cell - 2} height={cell - 2} rx={1.5} fill="#0d1612" /> : null
              )
            )}
          </svg>
          <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${C.teal}, transparent)`, top: `${scanLine}%`, opacity: 0.9, transition: 'top 18ms linear', boxShadow: `0 0 8px ${C.teal}` }} />
          {([[0,0],[0,1],[1,0],[1,1]] as [number,number][]).map(([y,x], i) => (
            <div key={i} style={{ position: 'absolute', width: 20, height: 20, ...(y===0 ? { top: -1 } : { bottom: -1 }), ...(x===0 ? { left: -1 } : { right: -1 }), borderTop: y===0 ? `3px solid ${C.teal}` : undefined, borderBottom: y===1 ? `3px solid ${C.teal}` : undefined, borderLeft: x===0 ? `3px solid ${C.teal}` : undefined, borderRight: x===1 ? `3px solid ${C.teal}` : undefined, borderRadius: y===0&&x===0?'4px 0 0 0':y===0&&x===1?'0 4px 0 0':y===1&&x===0?'0 0 0 4px':'0 0 4px 0' }} />
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.teal }} />
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>scanit.app/menu/brewhousecafe</span>
        </div>
      </div>

      {/* Floating live orders chip */}
      <div style={{ position: 'absolute', right: -24, top: 24, background: C.darker, border: `1px solid ${C.border}`, borderRadius: 14, padding: '14px 18px', zIndex: 3, boxShadow: '0 16px 40px rgba(0,0,0,0.4)', minWidth: 180 }}>
        <div style={{ fontSize: 10, color: C.muted, marginBottom: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Live Orders</div>
        {[
          { id: '#0041', item: 'Latte + Croissant', status: 'New',   color: '#f59e0b' },
          { id: '#0040', item: 'Espresso x2',       status: 'Ready', color: C.teal },
          { id: '#0039', item: 'Matcha + Muffin',   status: 'Done',  color: '#64748b' },
        ].map(o => (
          <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 12 }}>
            <div>
              <div style={{ color: C.white, fontSize: 11, fontWeight: 600 }}>{o.item}</div>
              <div style={{ color: C.muted, fontSize: 10 }}>{o.id}</div>
            </div>
            <span style={{ background: `${o.color}22`, color: o.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>{o.status}</span>
          </div>
        ))}
        <div style={{ marginTop: 6, paddingTop: 8, borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: C.muted, fontSize: 10 }}>Today's revenue</span>
          <span style={{ color: C.tealLt, fontSize: 11, fontWeight: 700 }}>UGX 312,400</span>
        </div>
      </div>
    </div>
  )
}

/* ─── How it works section ──────────────────────────────────────────── */
const steps = [
  { n: '01', title: 'Add your items', body: 'Create your catalog — meals, drinks, tickets, or goods. Each item gets a name, price, and availability toggle.' },
  { n: '02', title: 'Share your QR', body: 'Print or display your auto-generated QR code. Customers scan it and browse your live menu from their phone.' },
  { n: '03', title: 'Manage from dashboard', body: 'New orders appear instantly. Update statuses, track payments, and clear completed orders — all in one place.' },
]

function HowItWorks() {
  return (
    <section style={{ background: C.darker, padding: '80px 24px', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <p style={{ color: C.tealLt, fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 12px' }}>How it works</p>
          <h2 style={{ color: C.white, fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Up and running in minutes</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
          {steps.map(s => (
            <div key={s.n} style={{ background: C.dark, border: `1px solid ${C.border}`, borderRadius: 16, padding: '32px 28px' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${C.teal}22`, border: `1px solid ${C.teal}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <span style={{ color: C.tealLt, fontSize: 13, fontWeight: 800 }}>{s.n}</span>
              </div>
              <h3 style={{ color: C.white, fontSize: 18, fontWeight: 700, margin: '0 0 10px', letterSpacing: '-0.01em' }}>{s.title}</h3>
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

function Features() {
  return (
    <section style={{ background: C.dark, padding: '80px 24px' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <p style={{ color: C.tealLt, fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 12px' }}>Features</p>
          <h2 style={{ color: C.white, fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Everything you need, nothing you don't</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {features.map(f => (
            <div key={f.title} style={{ background: C.darker, border: `1px solid ${C.border}`, borderRadius: 14, padding: '24px 22px', transition: 'border-color 0.2s' }}>
              <div style={{ fontSize: 28, marginBottom: 14 }}>{f.icon}</div>
              <h3 style={{ color: C.white, fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>{f.title}</h3>
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

function BusinessTypes() {
  return (
    <section style={{ background: C.darker, padding: '80px 24px', borderTop: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <p style={{ color: C.tealLt, fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 12px' }}>Business types</p>
          <h2 style={{ color: C.white, fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Built for your kind of business</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
          {bizTypes.map(b => (
            <div key={b.type} style={{ background: C.dark, border: `1px solid ${C.border}`, borderRadius: 16, padding: '32px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>{b.emoji}</div>
              <h3 style={{ color: C.white, fontSize: 17, fontWeight: 700, margin: '0 0 10px' }}>{b.type}</h3>
              <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6, margin: 0 }}>{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── CTA section ────────────────────────────────────────────────────── */
function CtaSection({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <section style={{ background: C.dark, padding: '80px 24px', borderTop: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${C.teal}22`, border: `1px solid ${C.teal}44`, color: C.tealLt, fontSize: 13, fontWeight: 600, padding: '5px 12px', borderRadius: 20, marginBottom: 24, letterSpacing: '0.02em' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.tealLt, display: 'inline-block' }} />
          Free to start
        </div>
        <h2 style={{ color: C.white, fontSize: 'clamp(28px,4vw,44px)', fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 16px' }}>Ready to go live?</h2>
        <p style={{ color: C.muted, fontSize: 17, lineHeight: 1.6, margin: '0 0 36px' }}>
          Set up your QR menu in under 5 minutes. No credit card, no installs, no friction.
        </p>
        <button onClick={onGetStarted} style={{ ...S.ctaPrimary, fontSize: 16, padding: '15px 36px', margin: '0 auto' }}>
          Get started free
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <p style={{ color: '#3d6b63', fontSize: 13, margin: '18px 0 0' }}>Free plan available · No credit card required · Set up in 5 minutes</p>
      </div>
    </section>
  )
}

/* ─── Footer ─────────────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer style={{ background: C.darker, borderTop: `1px solid ${C.border}`, padding: '36px 24px' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, background: C.teal, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <rect x="1"  y="1"  width="6" height="6" rx="1" fill="white"/>
              <rect x="11" y="1"  width="6" height="6" rx="1" fill="white"/>
              <rect x="1"  y="11" width="6" height="6" rx="1" fill="white"/>
              <rect x="11" y="11" width="3" height="3" rx="0.5" fill="white"/>
              <rect x="15" y="11" width="2" height="2" rx="0.5" fill="white"/>
              <rect x="11" y="15" width="2" height="2" rx="0.5" fill="white"/>
              <rect x="14" y="14" width="3" height="3" rx="0.5" fill="white"/>
            </svg>
          </div>
          <span style={{ color: C.white, fontWeight: 700, fontSize: 16 }}>ScanIT</span>
          <span style={{ color: C.muted, fontSize: 13, marginLeft: 8 }}>QR-powered ordering for every business</span>
        </div>
        <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>© {new Date().getFullYear()} ScanIT. All rights reserved.</p>
      </div>
    </footer>
  )
}

/* ─── Main export ────────────────────────────────────────────────────── */
export default function LandingPage({ onGetStarted, onCreateTicket }: { onGetStarted: () => void; onCreateTicket: () => void }) {
  return (
    <div style={S.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        a:hover { opacity: 0.85; }
        .cta-primary:hover  { background: #0d6460 !important; transform: translateY(-1px); }
        .cta-secondary:hover { border-color: #2d4a45 !important; color: #cce8e4 !important; }
        @media (max-width: 768px) {
          .hero-grid   { grid-template-columns: 1fr !important; }
          .hero-visual { display: none !important; }
          .nav-links-desktop { display: none !important; }
        }
      `}</style>

      {/* NAV */}
      <nav style={S.nav}>
        <div style={S.navInner}>
          <a href="#" style={S.logo}>
            <div style={S.logoMark}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="1"  y="1"  width="6" height="6" rx="1" fill="white"/>
                <rect x="11" y="1"  width="6" height="6" rx="1" fill="white"/>
                <rect x="1"  y="11" width="6" height="6" rx="1" fill="white"/>
                <rect x="11" y="11" width="3" height="3" rx="0.5" fill="white"/>
                <rect x="15" y="11" width="2" height="2" rx="0.5" fill="white"/>
                <rect x="11" y="15" width="2" height="2" rx="0.5" fill="white"/>
                <rect x="14" y="14" width="3" height="3" rx="0.5" fill="white"/>
              </svg>
            </div>
            <span style={S.logoText}>ScanIT</span>
          </a>
          <ul style={S.navLinks} className="nav-links-desktop">
            {['How it works', 'Features', 'Business types', 'Pricing'].map(l => (
              <li key={l}><a href="#" style={S.navLink}>{l}</a></li>
            ))}
            <li>
              <button onClick={onCreateTicket} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', ...S.navLink, color: '#c4b5fd' }}>
                🎟 Event Tickets
              </button>
            </li>
          </ul>
          <button onClick={onGetStarted} style={S.navCta} className="cta-primary">Get started free</button>
        </div>
      </nav>

      {/* HERO */}
      <section style={S.hero}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(${C.border} 1px, transparent 1px), linear-gradient(90deg, ${C.border} 1px, transparent 1px)`, backgroundSize: '48px 48px', opacity: 0.3, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, background: `linear-gradient(to top, ${C.dark}, transparent)`, pointerEvents: 'none' }} />
        <div style={{ ...S.heroInner, position: 'relative', zIndex: 1 }} className="hero-grid">
          <div>
            <div style={S.eyebrow}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.tealLt, display: 'inline-block' }} />
              QR-powered ordering
            </div>
            <h1 style={S.heroH1}>
              Let customers<br />order by scanning<br />
              <span style={{ color: C.tealLt }}>a code.</span>
            </h1>
            <p style={S.heroSub}>
              ScanIT turns your menu or catalog into a scannable QR experience. Customers browse and order from their phone — you manage everything from one live dashboard.
            </p>
            <button
              onClick={onCreateTicket}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 14, background: '#1e1040', border: '1.5px solid #7c3aed66', borderRadius: 14, padding: '16px 24px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s' }}
            >
              <span style={{ fontSize: 32, lineHeight: 1 }}>🎟</span>
              <div>
                <p style={{ margin: '0 0 3px', color: '#c4b5fd', fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em' }}>Create event tickets — free</p>
                <p style={{ margin: 0, color: '#7c3aed99', fontSize: 13 }}>Add classes, tables, payment info &amp; get a printable QR ticket. No account needed.</p>
              </div>
              <svg style={{ marginLeft: 4, flexShrink: 0 }} width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="#c4b5fd" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', paddingRight: 48 }} className="hero-visual">
            <QRMockup />
          </div>
        </div>
      </section>

      <span id="how" />
      <HowItWorks />
      <Features />
      <BusinessTypes />
      <CtaSection onGetStarted={onGetStarted} />
      <Footer />
    </div>
  )
}
