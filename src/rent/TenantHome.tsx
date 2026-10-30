import { useMemo, useState, type ReactNode } from 'react'
import { CreditCard, ChevronLeft, ChevronRight } from 'lucide-react'
import type { TenantPayContext } from './types'
import './TenantHome.css'

// Optional fields: if your backend sends them, they are used automatically.
type Ctx = TenantPayContext & {
  periodStart?: string | null
  tenancyStart?: string | null
}

const DAY = 86_400_000
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const diffDays = (a: Date, b: Date) => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY)
const sameDay = (a: Date, b: Date) => diffDays(a, b) === 0
const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString([], o)
const money = (n: number, c: string) => `${n.toLocaleString()} ${c}`

function monthsBetween(a: Date, b: Date) {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
}

export default function TenantHome({
  ctx: rawCtx, statusLabel, statusKey, onPay, receiptsSlot,
}: {
  ctx: TenantPayContext
  statusLabel: string
  statusKey: 'paid' | 'overdue' | 'partial' | 'unpaid'
  onPay: () => void
  receiptsSlot?: ReactNode
}) {
  const ctx = rawCtx as Ctx
  const today = startOfDay(new Date())

  // ── Cycle dates ──────────────────────────────────────────────────────────
  const { start, end } = useMemo(() => {
    if (ctx.dueDate) {
      const e = startOfDay(new Date(ctx.dueDate))
      const s = ctx.periodStart
        ? startOfDay(new Date(ctx.periodStart))
        : new Date(e.getFullYear(), e.getMonth() - 1, e.getDate())
      return { start: s, end: e }
    }
    const [y, m] = (ctx.periodLabel ?? '').split('-').map(Number)
    const base = y && m ? new Date(y, m - 1, 1) : new Date(today.getFullYear(), today.getMonth(), 1)
    return { start: base, end: new Date(base.getFullYear(), base.getMonth() + 1, 0) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.dueDate, ctx.periodStart, ctx.periodLabel])

  const totalDays = Math.max(1, diffDays(start, end))
  const elapsed = Math.min(totalDays, Math.max(0, diffDays(start, today)))
  const remaining = ctx.daysRemaining ?? diffDays(today, end)
  const overdue = remaining < 0
  const isPaid = statusKey === 'paid'

  // ── Month title: "Month X of Y" when lease info is available ──────────────
  const monthNo = ctx.tenancyStart ? monthsBetween(new Date(ctx.tenancyStart), start) + 1 : null
  const leaseMonth = ctx.monthNumber ?? monthNo
  const monthTitle = leaseMonth && leaseMonth > 0
    ? (ctx.leaseTermMonths
        ? `Month ${leaseMonth} of ${ctx.leaseTermMonths}`
        : `Month ${leaseMonth}`)
    : fmt(start, { month: 'long' })

  // ── Money ────────────────────────────────────────────────────────────────
  const balance = ctx.balance ?? 0
  const totalRent = ctx.totalRent ?? 0
  const paidAmount = ctx.paidAmount ?? 0
  const pct = totalRent > 0 ? Math.min(100, Math.round((paidAmount / totalRent) * 100)) : 0

  // ── Ring ─────────────────────────────────────────────────────────────────
  const R = 54, C = 2 * Math.PI * R
  const ringPct = isPaid ? 1 : overdue ? 1 : elapsed / totalDays
  const tone = isPaid ? 'ok' : overdue ? 'bad' : remaining <= 3 ? 'warn' : 'calm'

  // ── Calendar ─────────────────────────────────────────────────────────────
  const [offset, setOffset] = useState(0)
  const view = new Date(today.getFullYear(), today.getMonth() + offset, 1)
  const lead = (view.getDay() + 6) % 7 // Monday-first
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate()
  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1)),
  ]

  return (
    <div className="th">

      {/* ── Hero ── */}
      <section className={`th-hero th-${tone}`}>
        <div className="th-hero-top">
          <span className="th-month">{monthTitle}</span>
          <span className={`th-chip ${statusKey}`}>{statusLabel}</span>
        </div>

        <div className="th-hero-body">
          <div
            className="th-ring"
            role="img"
            aria-label={overdue ? `${Math.abs(remaining)} days overdue` : `${remaining} days remaining`}
          >
            <svg viewBox="0 0 128 128">
              <circle className="th-ring-bg" cx="64" cy="64" r={R} />
              <circle
                className="th-ring-fg" cx="64" cy="64" r={R}
                strokeDasharray={C} strokeDashoffset={C * (1 - ringPct)}
                transform="rotate(-90 64 64)"
              />
            </svg>
            <div className="th-ring-label">
              {isPaid
                ? <strong>✓</strong>
                : <strong>{Math.abs(remaining)}</strong>}
              <span>{isPaid ? 'all paid' : overdue ? 'days overdue' : remaining === 1 ? 'day left' : 'days left'}</span>
            </div>
          </div>

          <div className="th-hero-info">
            <span className="th-k">{isPaid ? 'Rent paid' : 'Balance due'}</span>
            <span className="th-amount">{money(isPaid ? totalRent : balance, ctx.currency)}</span>
            <span className="th-sub">
              {fmt(start, { day: 'numeric', month: 'short' })} → {fmt(end, { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>

        {(statusKey === 'partial' || isPaid) && totalRent > 0 && (
          <div className="th-progress">
            <div className="th-progress-row">
              <span>{money(paidAmount, ctx.currency)} paid</span>
              <strong>{pct}%</strong>
            </div>
            <div className="th-progress-track">
              <div style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        {!isPaid && balance > 0 && (
          <button type="button" className="th-pay" onClick={onPay}>
            <CreditCard size={18} />
            {statusKey === 'partial'
              ? `Pay remaining ${money(balance, ctx.currency)}`
              : `Pay ${money(balance, ctx.currency)}`}
          </button>
        )}

        {/* Expired / not-yet-active lease states */}
        {ctx.leaseEnd && ctx.leaseDaysRemaining !== null && ctx.leaseDaysRemaining <= 0 && !isPaid && (
          <div className="th-lease-state ended">
            Lease ended on {fmt(new Date(ctx.leaseEnd), { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        )}
        {ctx.tenancyStart && new Date(ctx.tenancyStart) > today && (
          <div className="th-lease-state pending">
            Lease starts on {fmt(new Date(ctx.tenancyStart), { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        )}
      </section>

      {/* ── Calendar ── */}
      <section className="th-cal">
        <div className="th-cal-head">
          <button type="button" aria-label="Previous month" onClick={() => setOffset((o) => o - 1)}>
            <ChevronLeft size={18} />
          </button>
          <h3>{fmt(view, { month: 'long', year: 'numeric' })}</h3>
          <button type="button" aria-label="Next month" onClick={() => setOffset((o) => o + 1)}>
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="th-cal-grid th-cal-dow">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}
        </div>

        <div className="th-cal-grid">
          {cells.map((d, i) => {
            if (!d) return <span key={i} />
            const inCycle = diffDays(start, d) >= 0 && diffDays(d, end) >= 0
            const past = inCycle && diffDays(d, today) > 0
            const cls = [
              'th-day',
              inCycle && 'in',
              past && 'past',
              sameDay(d, today) && 'today',
              sameDay(d, start) && 'start',
              sameDay(d, end) && 'due',
            ].filter(Boolean).join(' ')
            return <span key={i} className={cls}>{d.getDate()}</span>
          })}
        </div>

        <div className="th-legend">
          <span><i className="lg start" />Cycle starts</span>
          <span><i className="lg today" />Today</span>
          <span><i className="lg due" />Rent due</span>
        </div>
      </section>

      {/* ── Lease strip ── */}
      {ctx.tenancyStart && ctx.leaseEnd && (
        <section className="th-lease">
          <div className="th-lease-dates">
            <span>{fmt(new Date(ctx.tenancyStart), { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <span>→</span>
            <span>{fmt(new Date(ctx.leaseEnd), { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
          {ctx.leaseDaysRemaining !== null && ctx.leaseDaysRemaining > 0 && (
            <>
              <div className="th-lease-bar">
                <div
                  className="th-lease-fill"
                  style={{ width: `${Math.min(100, 100 - (ctx.leaseDaysRemaining / (ctx.leaseTermMonths ?? 12) / 30) * 100)}%` }}
                />
              </div>
              <p className="th-lease-days">
                {Math.round(ctx.leaseDaysRemaining)} days left on lease
              </p>
            </>
          )}
          {ctx.leaseDaysRemaining !== null && ctx.leaseDaysRemaining <= 60 && ctx.leaseDaysRemaining > 0 && (
            <p className="th-lease-notice">
              Lease ends on {fmt(new Date(ctx.leaseEnd), { day: 'numeric', month: 'short', year: 'numeric' })}, contact your property manager about renewal.
            </p>
          )}
        </section>
      )}

      {receiptsSlot}
    </div>
  )
}
