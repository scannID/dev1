import { useEffect, useState } from 'react'
import { adminApi } from '../api/services'
import type { CookieConsentAnalytics, ScansOrdersRange } from '../api/types'
import { InlineSpinner } from './LoadingSpinner'

type Range = ScansOrdersRange

const RANGES: { key: Range; label: string }[] = [
  { key: 'hourly', label: 'Hourly' },
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
]

const VW = 600
const VH = 180
const PL = 36
const PR = 10
const PT = 14
const PB = 24
const CW = VW - PL - PR
const CH = VH - PT - PB

function tx(i: number, n: number) {
  return PL + (i / Math.max(n - 1, 1)) * CW
}

function ty(v: number, max: number) {
  return PT + CH - (v / Math.max(max, 1)) * CH
}

function smooth(pts: [number, number][]) {
  if (pts.length < 2) return ''
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 1; i < pts.length; i++) {
    const mx = (pts[i - 1][0] + pts[i][0]) / 2
    d += ` C${mx},${pts[i - 1][1]} ${mx},${pts[i][1]} ${pts[i][0]},${pts[i][1]}`
  }
  return d
}

function formatWhen(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function shortId(value: string | null) {
  if (!value) return '—'
  if (value.length <= 12) return value
  return `${value.slice(0, 8)}…`
}

export default function CookieConsentPanel() {
  const [range, setRange] = useState<Range>('daily')
  const [data, setData] = useState<CookieConsentAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await adminApi.analytics.getCookieConsents(range)
        if (!cancelled) setData(response)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load cookie consent analytics')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [range])

  const series = data?.series
  const n = series?.accepted.length ?? 0
  const acceptedPts: [number, number][] = series
    ? series.accepted.map((v, i) => [tx(i, n), ty(v, series.yMax)])
    : []
  const essentialPts: [number, number][] = series
    ? series.essential.map((v, i) => [tx(i, n), ty(v, series.yMax)])
    : []

  const summary = data?.summary

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <div>
          <h3>Cookie Consent</h3>
          <p>Visitor consent choices saved to the backend</p>
        </div>
        <div style={{ display: 'flex', gap: 2, background: 'var(--muted)', borderRadius: 8, padding: 3 }}>
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              style={{
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: range === r.key ? 600 : 400,
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                background: range === r.key ? 'var(--card)' : 'transparent',
                color: range === r.key ? 'var(--primary)' : 'var(--muted-foreground)',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ padding: '20px 20px 8px' }}>
          <InlineSpinner label="Loading consent analytics…" />
        </div>
      )}

      {error && (
        <div style={{ padding: '12px 20px', color: 'oklch(0.577 0.245 27.325)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {!loading && !error && summary && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 12,
              padding: '0 20px 16px',
            }}
          >
            {[
              { label: 'Total consents', value: summary.total },
              { label: 'Accepted', value: summary.accepted },
              { label: 'Essential only', value: summary.essential },
              { label: 'Unique visitors', value: summary.uniqueClients },
              { label: 'Last 24 hours', value: summary.last24Hours },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  background: 'var(--background)',
                }}
              >
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)' }}>
                  {item.label}
                </div>
                <div style={{ marginTop: 4, fontSize: 20, fontWeight: 700, color: 'var(--foreground)' }}>
                  {item.value.toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          {series && n > 0 && (
            <div style={{ padding: '0 20px 12px' }}>
              <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 11, color: 'var(--muted-foreground)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 18, height: 2, background: '#ea580c', borderRadius: 2 }} />
                  Accepted
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 18, height: 2, background: '#64748b', borderRadius: 2 }} />
                  Essential only
                </span>
              </div>
              <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" height={VH} role="img" aria-label="Cookie consent trend chart">
                {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                  const y = PT + CH * (1 - t)
                  return (
                    <line
                      key={t}
                      x1={PL}
                      x2={VW - PR}
                      y1={y}
                      y2={y}
                      stroke="var(--border)"
                      strokeWidth="1"
                    />
                  )
                })}
                <path d={smooth(acceptedPts)} fill="none" stroke="#ea580c" strokeWidth="2.2" />
                <path d={smooth(essentialPts)} fill="none" stroke="#64748b" strokeWidth="2.2" />
              </svg>
            </div>
          )}

          <div className="admin-table-wrap">
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['When', 'Choice', 'Source', 'Path', 'Visitor', 'User'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '8px 20px',
                        textAlign: 'left',
                        fontSize: 10,
                        fontWeight: 500,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: 'var(--muted-foreground)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.recent ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '16px 20px', color: 'var(--muted-foreground)' }}>
                      No consent events recorded yet.
                    </td>
                  </tr>
                ) : (
                  data!.recent.map((row, index) => (
                    <tr key={`${row.consentedAt}-${index}`} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 20px', color: 'var(--muted-foreground)' }}>
                        {formatWhen(row.consentedAt)}
                      </td>
                      <td style={{ padding: '10px 20px', textTransform: 'capitalize' }}>{row.choice}</td>
                      <td style={{ padding: '10px 20px', color: 'var(--muted-foreground)' }}>{row.source || '—'}</td>
                      <td style={{ padding: '10px 20px', color: 'var(--muted-foreground)' }}>{row.path || '—'}</td>
                      <td style={{ padding: '10px 20px', fontFamily: 'monospace' }}>{shortId(row.clientId)}</td>
                      <td style={{ padding: '10px 20px', color: 'var(--muted-foreground)' }}>{row.actorEmail || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
