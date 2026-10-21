import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { merchantsApi } from '../api/services'
import type { Merchant } from '../api/types'
import { InlineSpinner } from '../components/LoadingSpinner'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FunnelAnalytics {
  totalDrops: number
  byStep: Array<{ step: string; count: number }>
  byFeedbackReason: Array<{ reason: string; count: number }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STEP_META: Record<string, { label: string; emoji: string; color: string }> = {
  menu:    { label: 'Browsing menu',     emoji: '📋', color: '#3b82f6' },
  cart:    { label: 'Reviewing cart',    emoji: '🛒', color: '#f59e0b' },
  details: { label: 'Filling details',   emoji: '✏️',  color: '#8b5cf6' },
  pay:     { label: 'At payment step',   emoji: '💳', color: '#ef4444' },
}

const REASON_META: Record<string, { label: string; emoji: string }> = {
  too_expensive:  { label: 'Too expensive',    emoji: '💸' },
  long_wait:      { label: 'Seemed too slow',  emoji: '⏳' },
  just_browsing:  { label: 'Just browsing',    emoji: '👀' },
  changed_mind:   { label: 'Changed mind',     emoji: '🔄' },
  payment_issue:  { label: 'Payment trouble',  emoji: '📱' },
  menu_limited:   { label: 'Nothing wanted',   emoji: '🍽️' },
  other:          { label: 'Other',            emoji: '💬' },
}

const DAYS_OPTIONS = [
  { value: 7,  label: 'Last 7 days' },
  { value: 14, label: 'Last 14 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
]

async function fetchAnalytics(businessId: string, days: number): Promise<FunnelAnalytics> {
  return api.get<FunnelAnalytics>(
    `/businesses/${encodeURIComponent(businessId)}/analytics/funnel-drops?days=${days}`,
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepBar({ step, count, total }: { step: string; count: number; total: number }) {
  const meta = STEP_META[step] ?? { label: step, emoji: '📍', color: '#6b7280' }
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
      <span style={{ fontSize: 18, width: 24, textAlign: 'center', flexShrink: 0 }}>{meta.emoji}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{meta.label}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>
            {count.toLocaleString()} <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>({pct}%)</span>
          </span>
        </div>
        <div style={{ height: 8, background: 'var(--muted)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${pct}%`,
            background: meta.color, borderRadius: 4,
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>
    </div>
  )
}

function ReasonChip({ reason, count, maxCount }: { reason: string; count: number; maxCount: number }) {
  const meta = REASON_META[reason] ?? { label: reason, emoji: '❓' }
  const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', background: 'var(--muted)',
      borderRadius: 10, border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>{meta.emoji}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{meta.label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 60, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--primary)', borderRadius: 2 }} />
        </div>
        <span style={{
          fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
          background: 'color-mix(in oklch, var(--primary) 15%, transparent)',
          color: 'var(--primary)',
        }}>
          {count}
        </span>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FunnelDropsPage() {
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [merchantsLoading, setMerchantsLoading] = useState(true)

  const [selectedId, setSelectedId] = useState<string>('')
  const [days, setDays] = useState(7)
  const [data, setData] = useState<FunnelAnalytics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load merchant list on mount
  useEffect(() => {
    merchantsApi.list({ limit: 200 })
      .then((res) => {
        const active = res.merchants.filter((m) => m.status === 'active')
        setMerchants(active)
        if (active.length > 0) setSelectedId(active[0].id)
      })
      .catch(() => { /* non-fatal */ })
      .finally(() => setMerchantsLoading(false))
  }, [])

  // Load funnel analytics when merchant or days changes
  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchAnalytics(selectedId, days)
      .then((res) => { if (!cancelled) setData(res) })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [selectedId, days])

  const selectedMerchant = merchants.find((m) => m.id === selectedId)
  const totalDrops = data?.totalDrops ?? 0
  const hasDropData = data && data.byStep.length > 0
  const hasFeedback = data && data.byFeedbackReason.length > 0
  const maxFeedbackCount = hasFeedback
    ? Math.max(...data.byFeedbackReason.map((r) => r.count))
    : 1

  return (
    <div>
      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center',
        gap: 10, marginBottom: 24,
      }}>
        {/* Merchant picker */}
        {merchantsLoading ? (
          <InlineSpinner label="Loading merchants…" />
        ) : (
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            aria-label="Select merchant"
            style={{
              fontSize: 13, padding: '6px 10px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--card)',
              color: 'var(--foreground)', cursor: 'pointer', minWidth: 200,
            }}
          >
            {merchants.length === 0 && <option value="">No active merchants</option>}
            {merchants.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        )}

        {/* Days range */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {DAYS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setDays(opt.value)}
              style={{
                fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 6,
                border: '1px solid var(--border)', cursor: 'pointer',
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

      {/* ── Loading / error ────────────────────────────────────────────────── */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <InlineSpinner label={`Loading funnel data for ${selectedMerchant?.name ?? '…'}…`} />
        </div>
      )}
      {!loading && error && (
        <div style={{
          padding: '16px 20px', borderRadius: 10,
          background: 'oklch(0.96 0.02 30 / 0.15)',
          border: '1px solid oklch(0.577 0.245 27.325 / 0.4)',
          color: 'oklch(0.577 0.245 27.325)', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {!loading && !error && data && !hasDropData && (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)',
        }}>
          <p style={{ fontSize: 36, margin: 0 }}>🎉</p>
          <p style={{ marginTop: 12, fontSize: 15, fontWeight: 600, color: 'var(--foreground)' }}>
            No drop-offs recorded
          </p>
          <p style={{ marginTop: 6, fontSize: 13, color: 'var(--muted-foreground)' }}>
            {selectedMerchant?.name} has no funnel drop-offs in the last {days} days.<br />
            Either everyone ordered or tracking hasn't started yet.
          </p>
        </div>
      )}

      {/* ── Data ───────────────────────────────────────────────────────────── */}
      {!loading && !error && hasDropData && (
        <>
          {/* KPI bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '16px 20px', marginBottom: 24,
            background: 'color-mix(in oklch, var(--primary) 8%, transparent)',
            borderRadius: 12, border: '1px solid color-mix(in oklch, var(--primary) 20%, transparent)',
          }}>
            <span style={{ fontSize: 28 }}>📉</span>
            <div>
              <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: 'var(--foreground)' }}>
                {totalDrops.toLocaleString()}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>
                total drop-offs · last {days} days · {selectedMerchant?.name}
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Drop-off by step */}
            <div className="admin-card" style={{ height: 'fit-content' }}>
              <div className="admin-card-header">
                <div>
                  <h3>Drop-off by step</h3>
                  <p>Where customers stopped before ordering</p>
                </div>
              </div>
              <div style={{ padding: '4px 20px 16px' }}>
                {data.byStep.map((row) => (
                  <StepBar key={row.step} step={row.step} count={row.count} total={totalDrops} />
                ))}
              </div>
            </div>

            {/* Feedback reasons */}
            <div className="admin-card" style={{ height: 'fit-content' }}>
              <div className="admin-card-header">
                <div>
                  <h3>Customer feedback</h3>
                  <p>Reasons given via the nudge banner</p>
                </div>
              </div>
              <div style={{ padding: '4px 20px 16px', display: 'grid', gap: 8 }}>
                {hasFeedback ? (
                  data.byFeedbackReason.map((row) => (
                    <ReasonChip
                      key={row.reason}
                      reason={row.reason}
                      count={row.count}
                      maxCount={maxFeedbackCount}
                    />
                  ))
                ) : (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted-foreground)' }}>
                    <p style={{ fontSize: 24, margin: 0 }}>💬</p>
                    <p style={{ marginTop: 8, fontSize: 13 }}>
                      No feedback yet. Customers see the nudge on their next scan.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Insight callout */}
          {data.byStep.length > 0 && (
            <div style={{
              marginTop: 20, padding: '14px 18px',
              background: 'var(--muted)', borderRadius: 10,
              border: '1px solid var(--border)',
              display: 'flex', alignItems: 'flex-start', gap: 12,
            }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>💡</span>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--foreground)' }}>Biggest drop-off: </strong>
                {(() => {
                  const top = data.byStep[0]
                  const meta = STEP_META[top.step] ?? { label: top.step, emoji: '' }
                  const pct = totalDrops > 0 ? Math.round((top.count / totalDrops) * 100) : 0
                  return `${top.count.toLocaleString()} customers (${pct}%) left at the "${meta.label}" step. `
                })()}
                {data.byFeedbackReason.length > 0 && (() => {
                  const topReason = data.byFeedbackReason[0]
                  const meta = REASON_META[topReason.reason] ?? { label: topReason.reason, emoji: '' }
                  return `Top reason given: "${meta.label}" (${topReason.count} responses).`
                })()}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
