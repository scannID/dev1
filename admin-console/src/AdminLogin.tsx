import { Shield, BarChart3, Building2, QrCode, Users, Activity } from 'lucide-react'
import { Button } from '../../src/components/ui/button'

export default function AdminLogin({ onLogin }: { onLogin: () => void }) {
  return (
    <div style={S.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>

      {/* ── Top nav ── */}
      <nav style={S.nav}>
        <div style={S.navBrand}>
          <img src="/qrcode1.png" alt="Scanny" style={S.navLogo} />
          <div>
            <span style={S.navName}>Scanny</span>
            <span style={S.navSub}>Admin Console</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={S.navBadge}>Restricted Access</span>
          <Button size="sm" onClick={onLogin} style={S.navBtn}>
            <Shield size={13} />
            Sign in
          </Button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={S.hero}>
        {/* Grid bg */}
        <div style={S.heroBg} />

        <div style={S.heroInner}>
          <div style={S.eyebrow}>
            <span style={S.eyebrowDot} />
            Platform Administration
          </div>

          <h1 style={S.heroH1}>
            Full platform<br />
            oversight for<br />
            <span style={S.heroAccent}>Scanny.</span>
          </h1>

          <p style={S.heroSub}>
            Monitor merchants, orders, revenue, QR activity, and system health — all from one place. Restricted to authorised administrators.
          </p>

          <Button onClick={onLogin} style={S.heroBtn}>
            <Shield size={16} />
            Sign in with SSO
          </Button>

          <p style={S.heroHint}>
            Single sign-on via Keycloak · Authorised personnel only
          </p>
        </div>
      </section>

      {/* ── Feature cards ── */}
      <section style={S.features}>
        {FEATURES.map((f) => {
          const Icon = f.icon
          return (
            <div key={f.label} style={S.featureCard}>
              <div style={{ ...S.featureIcon, background: f.bg }}>
                <Icon size={18} style={{ color: f.color }} />
              </div>
              <div>
                <p style={S.featureLabel}>{f.label}</p>
                <p style={S.featureDesc}>{f.desc}</p>
              </div>
            </div>
          )
        })}
      </section>

      {/* ── Stats strip ── */}
      <section style={S.statsStrip}>
        {STATS.map((s) => (
          <div key={s.label} style={S.stat}>
            <span style={S.statValue}>{s.value}</span>
            <span style={S.statLabel}>{s.label}</span>
          </div>
        ))}
      </section>

      {/* ── CTA ── */}
      <section style={S.cta}>
        <h2 style={S.ctaH2}>Ready to manage the platform?</h2>
        <p style={S.ctaSub}>Sign in with your admin credentials to access the console.</p>
        <Button onClick={onLogin} style={S.ctaBtn}>
          <Shield size={16} />
          Sign in with SSO
        </Button>
      </section>

      {/* ── Footer ── */}
      <footer style={S.footer}>
        <span>© {new Date().getFullYear()} Scanny · Admin Console</span>
        <span>Restricted access — unauthorised use is prohibited</span>
      </footer>
    </div>
  )
}

const FEATURES = [
  { label: 'Merchant Management',  desc: 'Onboard, monitor, and manage all merchants and their catalogs.',        icon: Building2,  bg: 'oklch(0.94 0.04 145)', color: '#166534' },
  { label: 'Orders & Revenue',     desc: 'Track every order and payment across the entire platform in real time.', icon: BarChart3,  bg: 'oklch(0.94 0.04 250)', color: '#1d4ed8' },
  { label: 'QR Activity',          desc: 'See scan volumes, conversion rates, and device analytics per QR code.',  icon: QrCode,    bg: 'oklch(0.94 0.04 75)',  color: '#92400e' },
  { label: 'User Administration',  desc: 'Manage customer accounts, merchant users, and admin roles.',             icon: Users,     bg: 'oklch(0.94 0.04 320)', color: '#6b21a8' },
  { label: 'System Health',        desc: 'Monitor uptime, latency, incidents, and service status live.',           icon: Activity,  bg: 'oklch(0.94 0.04 15)',  color: '#9f1239' },
  { label: 'Audit Logs',           desc: 'Full trail of every admin action with actor, IP, and timestamp.',        icon: Shield,    bg: 'oklch(0.94 0.04 195)', color: '#0e7490' },
]

const STATS = [
  { value: '142',    label: 'Active merchants'    },
  { value: '18,304', label: 'QR scans today'      },
  { value: '1,847',  label: 'Orders today'        },
  { value: '99.98%', label: 'Platform uptime'     },
]

/* ── Styles ── */
const TEAL = '#166534'

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100svh',
    display: 'flex',
    flexDirection: 'column',
    background: '#f8faf8',
    fontFamily: "'Outfit Variable', ui-sans-serif, system-ui, sans-serif",
    color: '#111827',
  },

  /* Nav */
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 40px',
    height: 60,
    background: '#ffffff',
    borderBottom: '1px solid #e5e7eb',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  navBrand: { display: 'flex', alignItems: 'center', gap: 10 },
  navLogo: { width: 30, height: 30, borderRadius: 8, objectFit: 'contain', background: '#f3f4f6', padding: 3 },
  navName: { display: 'block', fontSize: 14, fontWeight: 700, color: '#111827', lineHeight: 1.2 },
  navSub: { display: 'block', fontSize: 9, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280' },
  navBadge: { fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 999, background: 'oklch(0.94 0.04 30)', color: '#9f1239' },
  navBtn: { background: TEAL, color: '#fff', border: 'none', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 },

  /* Hero */
  hero: {
    position: 'relative',
    padding: '80px 40px 64px',
    overflow: 'hidden',
  },
  heroBg: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)`,
    backgroundSize: '48px 48px',
    opacity: 0.4,
    pointerEvents: 'none',
  },
  heroInner: {
    position: 'relative',
    zIndex: 1,
    maxWidth: 560,
    margin: '0 auto',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 20,
  },
  eyebrow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: TEAL,
    background: 'oklch(0.94 0.04 145)',
    padding: '5px 14px',
    borderRadius: 999,
  },
  eyebrowDot: { width: 6, height: 6, borderRadius: '50%', background: TEAL, display: 'inline-block' },
  heroH1: {
    margin: 0,
    fontSize: 52,
    fontWeight: 800,
    lineHeight: 1.06,
    letterSpacing: '-0.03em',
    color: '#0f172a',
  },
  heroAccent: { color: TEAL },
  heroSub: {
    margin: 0,
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 1.6,
    maxWidth: 440,
  },
  heroBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    height: 44,
    padding: '0 28px',
    background: TEAL,
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  heroHint: {
    margin: 0,
    fontSize: 12,
    color: '#9ca3af',
  },

  /* Features */
  features: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
    padding: '0 40px 60px',
    maxWidth: 1100,
    margin: '0 auto',
    width: '100%',
  },
  featureCard: {
    display: 'flex',
    gap: 14,
    padding: '20px',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureLabel: { margin: 0, fontSize: 14, fontWeight: 600, color: '#111827' },
  featureDesc: { margin: '4px 0 0', fontSize: 12, color: '#6b7280', lineHeight: 1.5 },

  /* Stats strip */
  statsStrip: {
    display: 'flex',
    justifyContent: 'center',
    gap: 0,
    background: TEAL,
    padding: '32px 40px',
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    maxWidth: 200,
    borderRight: '1px solid rgba(255,255,255,0.15)',
    padding: '0 32px',
  },
  statValue: { fontSize: 32, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.04em' },

  /* CTA */
  cta: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 14,
    padding: '64px 40px',
    background: '#ffffff',
    borderTop: '1px solid #e5e7eb',
    textAlign: 'center',
  },
  ctaH2: { margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: '#0f172a' },
  ctaSub: { margin: 0, fontSize: 14, color: '#6b7280' },
  ctaBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    height: 44,
    padding: '0 28px',
    background: TEAL,
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 4,
  },

  /* Footer */
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 40px',
    fontSize: 12,
    color: '#9ca3af',
    borderTop: '1px solid #e5e7eb',
  },
}
