import type { MouseEvent } from 'react'
import { footerCols, navigateMarketing } from './routes'

type SiteFooterProps = {
  textColor?: string
  mutedColor?: string
}

function handleFooterClick(e: MouseEvent<HTMLAnchorElement>, href: string) {
  if (href.startsWith('http') || href.startsWith('mailto:')) return
  e.preventDefault()
  navigateMarketing(href)
}

export function SiteFooter({
  textColor = 'var(--foreground)',
  mutedColor = 'var(--muted-foreground)',
}: SiteFooterProps) {
  return (
    <footer
      className="scanny-footer"
      style={{
        position: 'relative',
        zIndex: 1,
        marginTop: 40,
        padding: '64px 24px 28px',
        background: '#ffffff',
        borderTop: '1px solid rgba(15, 23, 42, 0.08)',
      }}
    >
      <style>{`
        .scanny-footer a.footer-link {
          color: var(--muted-foreground);
          font-size: 14px;
          text-decoration: none;
          line-height: 1.4;
          transition: color 0.15s ease;
        }
        .scanny-footer a.footer-link:hover {
          color: var(--foreground);
          opacity: 1;
        }
        .scanny-footer-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 40px 32px;
        }
        @media (max-width: 900px) {
          .scanny-footer-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
        @media (max-width: 520px) {
          .scanny-footer-grid {
            grid-template-columns: 1fr;
            gap: 28px;
          }
        }
      `}</style>

      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        <div className="scanny-footer-grid">
          {footerCols.map(col => (
            <div key={col.title}>
              <p
                style={{
                  color: textColor,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  margin: '0 0 16px',
                }}
              >
                {col.title}
              </p>
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {col.links.map(link => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="footer-link"
                      onClick={e => handleFooterClick(e, link.href)}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 48,
            paddingTop: 22,
            borderTop: '1px solid rgba(15, 23, 42, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <p style={{ color: mutedColor, fontSize: 13, margin: 0 }}>
            © {new Date().getFullYear()} Koddly. All rights reserved.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <a href="/privacy" className="footer-link" onClick={e => handleFooterClick(e, '/privacy')}>
              Privacy
            </a>
            <a href="/terms" className="footer-link" onClick={e => handleFooterClick(e, '/terms')}>
              Terms
            </a>
            <a
              href="/status"
              className="footer-link"
              onClick={e => handleFooterClick(e, '/status')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#22c55e',
                  display: 'inline-block',
                }}
              />
              All systems operational
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
