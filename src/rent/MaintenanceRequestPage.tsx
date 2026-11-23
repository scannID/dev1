import { type FormEvent, useEffect, useState } from 'react'
import { Wrench, ArrowLeft, CheckCircle2, AlertCircle, LinkIcon, Clock } from 'lucide-react'
import { rentPublicApi } from './api'
import type { TenantPayContext, MaintenanceRequest } from './types'
import './RentPayPage.css'

// ── Maintenance loader — bouncing wrench ───────────────────────────────────

function MaintenanceLoader() {
  return (
    <div className="ml-wrap" role="status" aria-label="Loading your account…">
      <style>{`
        .ml-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          color: var(--rp-blue, #2147c9);
        }
        .ml-icons {
          display: flex;
          align-items: flex-end;
          gap: 18px;
        }
        .ml-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          border-radius: 14px;
          background: color-mix(in srgb, var(--rp-blue, #2147c9) 10%, transparent);
          color: var(--rp-blue, #2147c9);
          animation: ml-bounce 0.85s ease-in-out infinite;
          will-change: transform;
        }
        .ml-icon:nth-child(1) { animation-delay: 0s; }
        .ml-icon:nth-child(2) { animation-delay: 0.2125s; }
        .ml-icon:nth-child(3) { animation-delay: 0.425s; }
        @keyframes ml-bounce {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(-4deg); }
          25% { transform: translate3d(-2px, -10px, 0) rotate(3deg); }
          50% { transform: translate3d(0, 0, 0) rotate(4deg); }
          75% { transform: translate3d(2px, -10px, 0) rotate(-3deg); }
        }
        .ml-label {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--rp-muted, #627084);
          animation: ml-fade 1.6s ease-in-out infinite;
        }
        @keyframes ml-fade {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ml-icon { animation: none; }
          .ml-label { animation: none; }
        }
      `}</style>

      <div className="ml-icons" aria-hidden="true">
        {/* Wrench 1 */}
        <div className="ml-icon">
          <Wrench size={26} />
        </div>
        {/* Wrench 2 */}
        <div className="ml-icon">
          <Wrench size={26} />
        </div>
        {/* Wrench 3 */}
        <div className="ml-icon">
          <Wrench size={26} />
        </div>
      </div>

      <p className="ml-label">Loading your account…</p>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return iso }
}

function statusLabel(status: string | null): string {
  switch (status) {
    case 'OPEN': return 'Open'
    case 'IN_PROGRESS': return 'In Progress'
    case 'RESOLVED': return 'Resolved'
    case 'CLOSED': return 'Closed'
    default: return status ?? 'Unknown'
  }
}

function statusColor(status: string | null): 'open' | 'submitted' | 'resolved' {
  switch (status) {
    case 'RESOLVED':
    case 'CLOSED':
      return 'resolved'
    case 'IN_PROGRESS':
      return 'open'
    default:
      return 'submitted'
  }
}

const centerIcon = { display: 'grid', placeItems: 'center' } as const

// ── Main component ─────────────────────────────────────────────────────────

export default function MaintenanceRequestPage({ token }: { token: string }) {
  // ── Boot ────────────────────────────────────────────────────────────────
  const [ctx, setCtx] = useState<TenantPayContext | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [booting, setBooting] = useState(true)

  // ── Maintenance ──────────────────────────────────────────────────────────
  const [maintRequests, setMaintRequests] = useState<MaintenanceRequest[]>([])
  const [maintTitle, setMaintTitle] = useState('')
  const [maintDesc, setMaintDesc] = useState('')
  const [maintSubmitting, setMaintSubmitting] = useState(false)
  const [maintSuccess, setMaintSuccess] = useState(false)
  const [maintError, setMaintError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  // Load context + maintenance requests
  useEffect(() => {
    let cancelled = false
    rentPublicApi.resolvePayContext(token)
      .then((data) => {
        if (cancelled) return
        setCtx(data)
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : 'QR link not found')
      })
      .finally(() => { if (!cancelled) setBooting(false) })
    // Load existing maintenance requests from backend
    rentPublicApi.listMyMaintenance(token)
      .then((items) => { if (!cancelled) setMaintRequests(items) })
      .catch(() => {}) // non-fatal
    return () => { cancelled = true }
  }, [token])

  // ── Maintenance submit ────────────────────────────────────────────────────
  async function handleMaintSubmit(e: FormEvent) {
    e.preventDefault()
    if (!maintTitle.trim()) return
    setMaintSubmitting(true)
    setMaintError(null)
    try {
      const req = await rentPublicApi.submitMaintenance(token, {
        title: maintTitle.trim(),
        description: maintDesc.trim() || undefined,
        tenantName: ctx?.tenantFirstName ?? undefined,
      })
      setMaintRequests((prev) => [req, ...prev])
      setMaintTitle('')
      setMaintDesc('')
      setMaintSuccess(true)
      setTimeout(() => setMaintSuccess(false), 4000)
    } catch (err) {
      setMaintError(err instanceof Error ? err.message : 'Could not submit request')
    } finally {
      setMaintSubmitting(false)
    }
  }

  // ── Screens ───────────────────────────────────────────────────────────────

  if (booting) {
    return (
      <div className="rp-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', minHeight: '100dvh' }}>
        <MaintenanceLoader />
      </div>
    )
  }

  if (loadError || !ctx) {
    return (
      <div className="rp-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, minHeight: '100dvh' }}>
        <div style={{ maxWidth: 380, textAlign: 'center' }}>
          <div
            style={{
              ...centerIcon,
              width: 56, height: 56, margin: '0 auto 16px', borderRadius: 16,
              background: 'color-mix(in srgb, var(--rp-red) 10%, #fff)',
              color: 'var(--rp-red)',
            }}
          >
            <LinkIcon size={26} />
          </div>
          <h1 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800 }}>Link unavailable</h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--rp-muted)', lineHeight: 1.6 }}>
            {loadError ?? 'This QR code could not be found. Please scan again or contact your landlord.'}
          </p>
        </div>
      </div>
    )
  }

  const unitLabel = ctx.unitNumber

  return (
    <div className="rp-page">
      {/* ── Header ── */}
      <header className="rp-topbar">
        <div className="rp-brand">
          <span className="rp-brand-name">
            {ctx.tenantFirstName ? `Hi, ${ctx.tenantFirstName}` : ctx.propertyName}
          </span>
          <span className="rp-brand-sub">
            {ctx.propertyName}{unitLabel ? ` · Unit ${unitLabel}` : ''} · Maintenance
          </span>
        </div>
        <div className="rp-topbar-actions">
          {maintRequests.length > 0 && (
            <button
              type="button"
              className={`rp-icon-btn${showHistory ? ' active' : ''}`}
              onClick={() => setShowHistory(!showHistory)}
              title={showHistory ? 'Hide history' : 'View history'}
              aria-label={showHistory ? 'Hide history' : 'View history'}
            >
              <Clock size={16} />
              <span className="rp-badge">{maintRequests.length > 9 ? '9+' : maintRequests.length}</span>
            </button>
          )}
        </div>
      </header>

      {/* ── Content ── */}
      <div className="rp-section">
        {!showHistory ? (
          <>
            {/* ── New Request Form ── */}
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>
                Submit a request
              </h1>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--rp-muted)', lineHeight: 1.6 }}>
                Let your landlord know about any repairs or issues that need attention.
              </p>
            </div>

            {/* ── Property info banner ── */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 12,
              marginBottom: 14,
              background: 'color-mix(in srgb, var(--rp-blue) 6%, #fff)',
              border: '1px solid color-mix(in srgb, var(--rp-blue) 22%, transparent)',
            }}>
              <div style={{
                ...centerIcon,
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'color-mix(in srgb, var(--rp-blue) 15%, #fff)',
                color: 'var(--rp-blue)',
                flexShrink: 0,
              }}>
                <Wrench size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--rp-text)' }}>
                  {ctx.propertyName}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--rp-muted)' }}>
                  {unitLabel ? `Unit ${unitLabel}` : 'Property-wide request'}
                </p>
              </div>
            </div>

            {/* ── Success message ── */}
            {maintSuccess && (
              <div style={{
                padding: '12px 14px',
                borderRadius: 12,
                background: 'color-mix(in srgb, var(--rp-green) 8%, #fff)',
                border: '1px solid color-mix(in srgb, var(--rp-green) 30%, transparent)',
                marginBottom: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}>
                <CheckCircle2 size={18} style={{ color: 'var(--rp-green)', flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--rp-green)' }}>
                  Request submitted. Your landlord has been notified.
                </p>
              </div>
            )}

            {/* ── Error message ── */}
            {maintError && (
              <div style={{
                padding: '12px 14px',
                borderRadius: 12,
                background: 'color-mix(in srgb, var(--rp-red) 8%, #fff)',
                border: '1px solid color-mix(in srgb, var(--rp-red) 30%, transparent)',
                marginBottom: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}>
                <AlertCircle size={18} style={{ color: 'var(--rp-red)', flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--rp-red)' }}>
                  {maintError}
                </p>
              </div>
            )}

            {/* ── Form ── */}
            <div className="rp-card">
              <form onSubmit={handleMaintSubmit}>
                <div className="rp-field">
                  <label className="rp-label" htmlFor="maint-title">
                    Issue <span style={{ color: 'var(--rp-red)' }}>*</span>
                  </label>
                  <input
                    id="maint-title"
                    className="rp-input"
                    type="text"
                    placeholder="e.g. Leaking tap, broken window, faulty lock"
                    value={maintTitle}
                    onChange={(e) => setMaintTitle(e.target.value)}
                    disabled={maintSubmitting}
                    required
                    autoComplete="off"
                  />
                  <span className="rp-hint">Brief summary of the problem</span>
                </div>

                <div className="rp-field">
                  <label className="rp-label" htmlFor="maint-desc">
                    Details
                  </label>
                  <textarea
                    id="maint-desc"
                    className="rp-textarea"
                    placeholder="Describe the problem in more detail…"
                    value={maintDesc}
                    onChange={(e) => setMaintDesc(e.target.value)}
                    disabled={maintSubmitting}
                  />
                  <span className="rp-hint">
                    Optional — help your landlord understand the issue better
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={maintSubmitting || !maintTitle.trim()}
                  className="rp-pay-btn"
                  style={{ marginTop: 0 }}
                >
                  <Wrench size={16} />
                  {maintSubmitting ? 'Submitting…' : 'Submit request'}
                </button>
              </form>
            </div>

            {/* ── Past requests preview ── */}
            {maintRequests.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}>
                  <p className="rp-section-heading" style={{ margin: 0 }}>
                    Recent requests
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowHistory(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--rp-blue)',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                      fontFamily: 'inherit',
                    }}
                  >
                    View all
                  </button>
                </div>

                <div className="rp-card">
                  {maintRequests.slice(0, 3).map((r) => (
                    <RequestRow key={r.id} request={r} />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* ── Request History ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <button
                type="button"
                aria-label="Back to form"
                onClick={() => setShowHistory(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--rp-muted)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <p style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em' }}>
                  Your requests
                </p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--rp-muted)' }}>
                  {maintRequests.length} request{maintRequests.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {maintRequests.length === 0 ? (
              <div className="rp-empty">
                <Wrench size={36} style={{ opacity: 0.25, display: 'block', margin: '0 auto 12px' }} />
                <p>No maintenance requests yet.</p>
              </div>
            ) : (
              <div className="rp-card">
                {maintRequests.map((r) => (
                  <RequestRow key={r.id} request={r} full />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Footer branding ── */}
      <div style={{
        padding: '20px',
        textAlign: 'center',
        borderTop: '1px solid var(--rp-border)',
        background: 'var(--rp-card)',
      }}>
        <p style={{
          margin: 0,
          fontSize: 12,
          color: 'var(--rp-muted)',
          fontWeight: 600,
        }}>
          Powered by Koddly
        </p>
      </div>
    </div>
  )
}

// ── Request row ───────────────────────────────────────────────────────────────

function RequestRow({ request, full }: { request: MaintenanceRequest; full?: boolean }) {
  const dotCls = statusColor(request.status)
  const label = statusLabel(request.status)

  return (
    <div className="rp-maint-row">
      <span className={`rp-maint-dot ${dotCls}`} />
      <div className="rp-maint-body">
        <p className="rp-maint-title">{request.title}</p>
        {request.description && full && (
          <p
            className="rp-maint-desc"
            style={{
              whiteSpace: 'normal',
              overflow: 'visible',
              textOverflow: 'clip',
              marginTop: 4,
            }}
          >
            {request.description}
          </p>
        )}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 6,
        }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 999,
              background:
                request.status === 'RESOLVED' || request.status === 'CLOSED'
                  ? 'color-mix(in srgb, var(--rp-green) 15%, transparent)'
                  : request.status === 'IN_PROGRESS'
                  ? 'color-mix(in srgb, var(--rp-amber) 15%, transparent)'
                  : 'color-mix(in srgb, var(--rp-blue) 15%, transparent)',
              color:
                request.status === 'RESOLVED' || request.status === 'CLOSED'
                  ? 'var(--rp-green)'
                  : request.status === 'IN_PROGRESS'
                  ? 'var(--rp-amber)'
                  : 'var(--rp-blue)',
            }}
          >
            {label}
          </span>
          <span style={{ fontSize: 11, color: 'var(--rp-muted)' }}>
            {fmtDate(request.submittedAt)}
          </span>
        </div>
      </div>
    </div>
  )
}
