import { useState, useEffect } from 'react'
import { api } from '../api/client'
import type { TopMerchant } from '../api/types'
import { InlineSpinner } from './LoadingSpinner'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FunnelAnalytics {
  totalDrops: number
  byStep: Array<{ step: string; count: number }>
  byFeedbackReason: Array<{ reason: string; count: number }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STEP_META: Record<string, { label: string; emoji: string; color: string }> = {
  menu:    { label: 'Menu',    emoji: '📋', color: '#3b82f6' },
  cart:    { label: 'Cart',    emoji: '🛒', color: '#f59e0b' },
  details: { label: 'Details', emoji: '✏️',  color: '#8b5cf6' },
  pay:     { label: 'Payment', emoji: '💳', color: '#ef4444' },
}

const REASON_META: Record<string, { label: string; emoji: string }> = {
  too_expensive:  { label: 'Too expensive',   emoji: '💸' },
  long_wait:      { label: 'Seemed too slow',  emoji: '⏳' },
  just_browsing:  { label: 'Just browsing',    emoji: '👀' },
  changed_mind:   { label: 'Changed mind',     emoji: '🔄' },
  payment_issue:  { label: 'Payment trouble',  emoji: '📱' },
  menu_limited:   { label: 'Nothing wanted',   emoji: '🍽️' },
  other:          { label: 'Other',            emoji: '💬' },
}

const DAYS_OPTIONS = [
  { value: 7,  label: '7d' },
  { value: 14, label: '14d' },
  { value: 30, label: '30d' },
]

async function fetchFunnelAnalytics(businessId: string, days: number): Promise<FunnelAnalytics> {
  return api.get<FunnelAnalytics>(
    `/businesses/${encodeURIComponent(businessId)}/analytics/funnel-drops?days=${days}`,
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepBar({ step, count, total }: { step: string; count: number; total: number }) {
  const meta = STEP_META[step] ?? { label: step, emoji: '📍', color: '#6b7280' }
  const pct = total > 0 ? (count / total) * 100 : 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <span style={{ width: 20, textAlign: 'center', fontSize: 14 }} aria-hidden="true">
        {meta.emoji}
      </span>
      <span style={{ width: 62, fontSize: 12, fontWeight: 500, color: 'var(--foreground)' }}>
        {meta.label}
      </span>
      <div style={{
        flex: 1,
        height: 7,
        background: 'var(--muted)',
        borderRadius: 4,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: meta.color,
          borderRadius: 4,
          transition: 'width 0.4s ease',
        }} />
      </div>
      <span style={{ width: 36, fontSize: 12, fontWeight: 700, color: 'var(--foreground)', textAlign: 'right' }}>
        {count.toLocaleString()}
      </span>
      <span style={{ width: 38, fontSize: 11, color: 'var(--muted-foreground)', textAlign: 'right' }}>
        {pct.toFixed(0)}%
      </span>
    </div>
  )
}

function ReasonChip({ reason, count }: { reason: string; count: number }) {
  const meta = REASON_META[reason] ?? { label: reason, emoji: '❓' }
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '5px 10px',
      background: 'var(--muted)',
      borderRadius: 20,
      border: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: 13 }} aria-hidden="true">{meta.emoji}</span>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--foreground)' }}>{meta.label}</span>
      <span style={{
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--primary)',
        background: 'color-mix(in oklch, var(--primary) 12%, transparent)',
        borderRadius: 10,
        padding: '1px 6px',
        marginLeft: 2,
      }}>{count}</span>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface FunnelDropsCardProps {
  /** Top merchants from the overview dashboard — used to populate the picker. */
  merchants: TopMerchant[]
}

export default function FunnelDropsCard({ merchants }: FunnelDropsCardProps) {
  const [selectedId, setSelectedId] = useState<string>(merchants[0]?.id ?? '')
  const [days, setDays] = useState(7)
  const [data, setData] = useState<FunnelAnalytics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Keep selected merchant in sync if merchants list changes on re-render
  useEffect(() => {
    if (!selectedId && merchants.length > 0) {
      setSelectedId(merchants[0].id)
    }
  }, [merchants, selectedId])

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchFunnelAnalytics(selectedId, days)
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [selectedId, days])

  const selectedName = merchants.find((m) => m.id === selectedId)?.name ?? 'Merchant'
  const totalDrops = data?.totalDrops ?? 0
  const hasData = data && (data.byStep.length > 0 || data.byFeedbackReason.length > 0)

  return (
    <div className="admin-card">
      {/* Header */}
      <div className="admin-card-header">
        <div>
          <h3>Funnel Drop-offs</h3>
          <p>Where customers stopped before placing an order</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Merchant picker */}
          {merchants.length > 0 && (
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              aria-label="Select merchant"
              style={{
                fontSize: 12,
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--card)',
                color: 'var(--foreground)',
                cursor: 'pointer',
                maxWidth: 160,
              }}
            >
              {merchants.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          )}

          {/* Days range toggle */}
          <div style={{ display: 'flex', gap: 4 }}>
            {DAYS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDays(opt.value)}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '3px 9px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: days === opt.value ? 'var(--primary)' : 'var(--card)',
                  color: days === opt.value ? '#ffffff' : 'var(--muted-foreground)',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading && (
        <div style={{ padding: '24px 20px' }}>
          <InlineSpinner label={`Loading ${selectedName} funnel data…`} />
        </div>
      )}

      {!loading && error && (
        <p style={{ padding: '16px 20px', color: 'var(--destructive)', fontSize: 13 }}>
          {error}
        </p>
      )}

      {!loading && !error && !hasData && (
        <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--muted-foreground)' }}>
          <span style={{ fontSize: 28, display: 'block', marginBottom: 8 }} aria-hidden="true">🎉</span>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>
            No drop-offs recorded for {selectedName} in the last {days} days.
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 12 }}>
            Either everyone is ordering or data hasn't started flowing yet.
          </p>
        </div>
      )}

      {!loading && !error && hasData && (
        <div style={{ padding: '4px 20px 16px' }}>
          {/* Total stat */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 18,
            padding: '10px 14px',
            background: 'color-mix(in oklch, var(--primary) 8%, transparent)',
            borderRadius: 10,
            border: '1px solid color-mix(in oklch, var(--primary) 20%, transparent)',
          }}>
            <span style={{ fontSize: 22 }} aria-hidden="true">📉</span>
            <div>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--foreground)' }}>
                {totalDrops.toLocaleString()}
              </p>
              <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--muted-foreground)' }}>
                total drop-offs · last {days} days · {selectedName}
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Step breakdown */}
            <div>
              <p style={{
                margin: '0 0 12px',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--muted-foreground)',
              }}>
                Drop-off by step
              </p>
              {data?.byStep.length ? (
                data.byStep.map((row) => (
                  <StepBar key={row.step} step={row.step} count={row.count} total={totalDrops} />
                ))
              ) : (
                <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>No step data yet.</p>
              )}
            </div>

            {/* Feedback reasons */}
            <div>
              <p style={{
                margin: '0 0 12px',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--muted-foreground)',
              }}>
                Feedback reasons
              </p>
              {data?.byFeedbackReason.length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {data.byFeedbackReason.map((row) => (
                    <ReasonChip key={row.reason} reason={row.reason} count={row.count} />
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                  No feedback collected yet. Customers will see the nudge on their next scan.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
