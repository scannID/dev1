import { useEffect, useState } from 'react'
import { adminApi } from '../api/services'
import type { CookieConsentAnalytics, ScansOrdersRange } from '../api/types'
import ConsentTrendChart from '../components/ConsentTrendChart'
import { InlineSpinner } from '../components/LoadingSpinner'

type Range = ScansOrdersRange

const RANGES: { key: Range; label: string }[] = [
  { key: 'hourly', label: 'Hourly' },
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
]

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

export default function CookieConsentPage() {
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

  return (
    <>
      {error && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: 16,
            background: 'oklch(0.96 0.02 30 / 0.15)',
            border: '1px solid oklch(0.577 0.245 27.325 / 0.4)',
            borderRadius: 10,
            color: 'oklch(0.577 0.245 27.325)',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          Could not load cookie consent: {error}
        </div>
      )}
      {loading && (
        <div className="admin-loading-banner">
          <InlineSpinner label="Loading consent analytics…" />
        </div>
      )}

      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <h3>Consent Trend</h3>
            <p>Accepted vs essential-only over time</p>
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

        <div style={{ padding: '8px 20px 20px' }}>
          {!loading && series ? (
            <ConsentTrendChart series={series} />
          ) : (
            !loading && (
              <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>
                No consent events in this range yet.
              </p>
            )
          )}
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <h3>Recent Consents</h3>
            <p>Latest visitor choices saved to the backend</p>
          </div>
        </div>
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
                    {loading ? <InlineSpinner label="Loading…" /> : 'No consent events recorded yet.'}
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
      </div>
    </>
  )
}
