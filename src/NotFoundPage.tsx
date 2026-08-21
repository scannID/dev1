import { usePageMeta } from './hooks/usePageMeta'

/**
 * On-brand 404 page. Rendered by the Root component in main.tsx when the
 * current pathname doesn't match any known route. Stays in the same paper /
 * ticket aesthetic as the landing page.
 *
 * SSR note: because this is a client-side SPA, the server still returns
 * HTTP 200 for all paths. To emit a real 404 status code, either configure
 * your static host (Vercel / Netlify) to serve this as a 404.html fallback,
 * or migrate to SSR (Next.js / Remix). See vite.config.ts build notes.
 */

const C = {
  paper: '#efe6d2',
  paperLt: '#f7f1e3',
  ink: '#26201a',
  inkSoft: '#6b5e4e',
  stamp: '#b23425',
}

type Props = {
  onGoHome: () => void
}

export default function NotFoundPage({ onGoHome }: Props) {
  usePageMeta({
    title: '404 — Page not found',
    description: "The page you're looking for doesn't exist. Go back to Kodte to manage your QR ordering and event ticketing.",
    robots: 'noindex, nofollow',
  })

  return (
    <div
      style={{
        background: C.paper,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Outfit', sans-serif",
        padding: '32px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle paper grain */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          opacity: 0.45,
          backgroundImage: `repeating-linear-gradient(0deg, ${C.ink}05 0 1px, transparent 1px 3px)`,
        }}
      />

      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 480,
        }}
      >
        {/* Ticket card */}
        <div
          style={{
            background: C.paperLt,
            borderRadius: 3,
            boxShadow: '0 28px 60px rgba(38,32,26,0.22)',
            overflow: 'hidden',
            transform: 'rotate(-0.8deg)',
          }}
        >
          {/* Zigzag top edge */}
          <TicketEdge />

          <div style={{ padding: '32px 36px 40px' }}>
            {/* Stamp */}
            <div
              style={{
                display: 'inline-block',
                border: `3px solid ${C.stamp}`,
                borderRadius: 6,
                color: C.stamp,
                fontWeight: 800,
                fontSize: 11,
                letterSpacing: '0.14em',
                padding: '3px 10px',
                opacity: 0.9,
                marginBottom: 28,
                transform: 'rotate(-3deg)',
              }}
            >
              NOT FOUND
            </div>

            <h1
              style={{
                fontWeight: 800,
                fontSize: 'clamp(52px, 12vw, 96px)',
                lineHeight: 1,
                letterSpacing: '-0.06em',
                color: `${C.ink}22`,
                margin: '0 0 4px',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              404
            </h1>

            <p
              style={{
                fontWeight: 700,
                fontSize: 18,
                color: C.ink,
                margin: '0 0 12px',
                letterSpacing: '-0.01em',
              }}
            >
              This ticket doesn't exist
            </p>

            <p
              style={{
                fontSize: 13,
                fontWeight: 400,
                lineHeight: 1.7,
                color: C.inkSoft,
                margin: '0 0 32px',
                maxWidth: 340,
              }}
            >
              The page you're looking for was torn off the spike or never printed.
              Head back to the counter and try again.
            </p>

            {/* Dashed divider */}
            <div
              style={{
                borderTop: `1px dashed ${C.ink}44`,
                marginBottom: 28,
              }}
            />

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={onGoHome}
                style={{
                  background: C.ink,
                  color: C.paperLt,
                  border: 'none',
                  padding: '11px 24px',
                  fontFamily: "'Outfit', sans-serif",
                  fontWeight: 800,
                  fontSize: 13,
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                  borderRadius: 3,
                }}
              >
                BACK TO HOME
              </button>

              <a
                href="/help"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: 'transparent',
                  color: C.inkSoft,
                  border: `1.5px dashed ${C.ink}44`,
                  padding: '11px 20px',
                  fontFamily: "'Outfit', sans-serif",
                  fontWeight: 600,
                  fontSize: 13,
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  borderRadius: 3,
                  textDecoration: 'none',
                }}
              >
                HELP CENTER
              </a>
            </div>
          </div>

          {/* Punch holes row */}
          <div
            aria-hidden="true"
            style={{
              background: C.stamp,
              padding: '9px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                color: C.paperLt,
                fontWeight: 700,
                fontSize: 9,
                letterSpacing: '0.14em',
              }}
            >
              KODTE · kodte.ug
            </span>

            <div style={{ display: 'flex', gap: 5 }}>
              {Array.from({ length: 16 }, (_, i) => (
                <div
                  key={i}
                  style={{
                    width: 4,
                    height: (i * 3) % 2 === 0 ? 14 : 8,
                    background: C.paperLt,
                    opacity: 0.5,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Minimal SVG zigzag that matches the landing page ticket aesthetic */
function TicketEdge() {
  const teeth = 26
  const pts = Array.from({ length: teeth }, (_, i) => {
    const x = (i / teeth) * 100
    const y = i % 2 === 0 ? 0 : 100
    return `${x},${y}`
  }).join(' ')

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ width: '100%', height: 10, display: 'block' }}
    >
      <polygon points={`0,100 ${pts} 100,100`} fill={C.paperLt} />
    </svg>
  )
}
