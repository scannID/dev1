import type { CSSProperties } from 'react'
import { marketingPages } from './MarketingPages'
import { SiteFooter } from './SiteFooter'
import { navigateMarketing, type MarketingSlug } from './routes'

type Props = {
  slug: MarketingSlug
  onGetStarted: () => void
}

const pageFont: CSSProperties = {
  fontFamily: "'Outfit Variable', Outfit, ui-sans-serif, system-ui, sans-serif",
}

export default function MarketingLayout({ slug, onGetStarted }: Props) {
  const page = marketingPages[slug]
  const maxWidth = page.narrow ? 720 : 880

  return (
    <div
      className="scanny-force-light"
      style={{ ...pageFont, minHeight: '100vh', background: '#ffffff', color: 'var(--foreground)' }}
    >
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(15, 23, 42, 0.06)',
        }}
      >
        <div
          style={{
            maxWidth: 1160,
            margin: '0 auto',
            height: 60,
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <a
            href="/"
            onClick={e => {
              e.preventDefault()
              navigateMarketing('/')
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'inherit' }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                background: '#0a0a0a',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="1" y="1" width="6" height="6" rx="1" fill="white" />
                <rect x="11" y="1" width="6" height="6" rx="1" fill="white" />
                <rect x="1" y="11" width="6" height="6" rx="1" fill="white" />
                <rect x="11" y="11" width="3" height="3" rx="0.5" fill="white" />
                <rect x="15" y="11" width="2" height="2" rx="0.5" fill="white" />
                <rect x="11" y="15" width="2" height="2" rx="0.5" fill="white" />
                <rect x="14" y="14" width="3" height="3" rx="0.5" fill="white" />
              </svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em' }}>Scanny</span>
          </a>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a
              href="/"
              onClick={e => {
                e.preventDefault()
                navigateMarketing('/')
              }}
              style={{
                color: 'var(--muted-foreground)',
                fontSize: 14,
                textDecoration: 'none',
                fontWeight: 550,
              }}
            >
              Home
            </a>
            <button
              type="button"
              onClick={onGetStarted}
              className="cta-primary"
              style={{
                background: '#ffffff',
                color: 'var(--primary)',
                padding: '8px 18px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                border: '1px solid color-mix(in srgb, var(--primary) 28%, transparent)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <svg className="cta-primary__arrow" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Get started
            </button>
            <style>{`
              .cta-primary__arrow {
                display: block;
                flex-shrink: 0;
                animation: ctaArrowNudge 1.1s ease-in-out infinite;
              }
              @keyframes ctaArrowNudge {
                0%, 100% { transform: translateX(0); opacity: 0.85; }
                50% { transform: translateX(4px); opacity: 1; }
              }
              @media (prefers-reduced-motion: reduce) {
                .cta-primary__arrow { animation: none !important; }
              }
            `}</style>
          </div>
        </div>
      </header>

      <main style={{ padding: '56px 24px 24px' }}>
        <article style={{ maxWidth, margin: '0 auto' }}>
          <p
            style={{
              margin: '0 0 12px',
              color: 'var(--primary)',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {page.eyebrow}
          </p>
          <h1
            style={{
              margin: '0 0 14px',
              fontSize: 'clamp(28px, 4vw, 40px)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
              color: 'var(--foreground)',
            }}
          >
            {page.title}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 17,
              lineHeight: 1.65,
              color: 'var(--muted-foreground)',
              maxWidth: 640,
            }}
          >
            {page.lead}
          </p>

          <div style={{ marginTop: 8 }}>{page.body}</div>

          {page.showCta ? (
            <div style={{ marginTop: 48 }}>
              <button
                type="button"
                onClick={onGetStarted}
                style={{
                  background: '#ffffff',
                  color: 'var(--primary)',
                  padding: '12px 22px',
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 700,
                  border: '1px solid color-mix(in srgb, var(--primary) 28%, transparent)',
                  cursor: 'pointer',
                }}
              >
                Get started
              </button>
            </div>
          ) : null}
        </article>
      </main>

      <SiteFooter />
    </div>
  )
}
