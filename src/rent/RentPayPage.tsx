import { type FormEvent, useEffect, useState } from 'react'
import { rentPublicApi } from './api'
import type { TenantPayContext, UnitPickOption, InitiateRentPaymentResponse } from './types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function money(amount: number, currency: string) {
  return `${amount.toLocaleString()} ${currency}`
}

function periodDisplay(label: string) {
  // "2026-11" → "November 2026"
  try {
    const [y, m] = label.split('-')
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString([], {
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return label
  }
}

// ── Status badge ──────────────────────────────────────────────────────────────

type Phase = 'loading' | 'error' | 'pick-unit' | 'form' | 'success' | 'confirmed'

// ── Component ─────────────────────────────────────────────────────────────────

export default function RentPayPage({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [ctx, setCtx] = useState<TenantPayContext | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Unit selection (when property-level token)
  const [selectedUnit, setSelectedUnit] = useState<UnitPickOption | null>(null)

  // Payment form
  const [phone, setPhone] = useState('0')
  const [name, setName] = useState('')
  const [payAmount, setPayAmount] = useState<string>('')  // partial payment amount
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [result, setResult] = useState<InitiateRentPaymentResponse | null>(null)

  // Payment status polling
  const [paymentStatus, setPaymentStatus] = useState<'Pending' | 'Completed' | 'Failed'>('Pending')

  useEffect(() => {
    let cancelled = false
    rentPublicApi.resolvePayContext(token).then((data) => {
      if (cancelled) return
      setCtx(data)
      setPhase(data.tokenType === 'property' ? 'pick-unit' : 'form')
    }).catch((err) => {
      if (cancelled) return
      setLoadError(err instanceof Error ? err.message : 'Payment link not found')
      setPhase('error')
    })
    return () => { cancelled = true }
  }, [token])

  // Poll payment status after initiation until Completed or Failed
  useEffect(() => {
    if (phase !== 'success' || !result?.transactionRef) return
    let cancelled = false
    let attempts = 0
    const MAX_ATTEMPTS = 24 // 2 minutes at 5s intervals

    const poll = () => {
      if (cancelled || attempts >= MAX_ATTEMPTS) return
      attempts++
      rentPublicApi.pollPaymentStatus(result.transactionRef).then((s) => {
        if (cancelled) return
        if (s.status === 'Completed') {
          setPaymentStatus('Completed')
          setPhase('confirmed')
        } else if (s.status === 'Failed') {
          setPaymentStatus('Failed')
          setPhase('confirmed')
        } else {
          setTimeout(poll, 5000)
        }
      }).catch(() => {
        if (!cancelled) setTimeout(poll, 5000)
      })
    }

    const timer = setTimeout(poll, 5000) // first check after 5s
    return () => { cancelled = true; clearTimeout(timer) }
  }, [phase, result])

  function handleSelectUnit(unit: UnitPickOption) {
    setSelectedUnit(unit)
    setPhase('form')
  }

  async function handlePay(e: FormEvent) {
    e.preventDefault()
    if (!ctx) return
    setFormError(null)
    setSubmitting(true)

    // Determine the amount to send (null = full balance, handled server-side)
    const fullAmount = ctx.balance ?? 0
    let requestedAmount: number | undefined
    if (ctx.partialPaymentAllowed && payAmount.trim()) {
      const parsed = parseInt(payAmount.replace(/,/g, ''), 10)
      if (isNaN(parsed) || parsed <= 0) {
        setFormError('Enter a valid payment amount')
        setSubmitting(false)
        return
      }
      if (parsed > fullAmount) {
        setFormError(`Cannot pay more than the outstanding balance (${money(fullAmount, ctx.currency)})`)
        setSubmitting(false)
        return
      }
      if (ctx.minPaymentAmount && parsed < ctx.minPaymentAmount) {
        setFormError(`Minimum payment is ${money(ctx.minPaymentAmount, ctx.currency)}`)
        setSubmitting(false)
        return
      }
      requestedAmount = parsed
    }

    try {
      const res = await rentPublicApi.initiatePayment(
        token,
        {
          customerPhone: phone.trim(),
          customerName: name.trim() || undefined,
          amount: requestedAmount,
        },
        selectedUnit?.unitId ?? ctx.unitId ?? undefined,
        null,
      )
      if (!res.success) { setFormError(res.message); return }
      setResult(res)
      setPaymentStatus('Pending')
      setPhase('success')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not start payment')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="scanny-page">
        <div className="scanny-page-narrow">
          <div className="scanny-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ color: '#6b7280', fontSize: 14 }}>Loading payment…</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (phase === 'error' || !ctx) {
    return (
      <div className="scanny-page">
        <div className="scanny-page-narrow">
          <div className="scanny-card">
            <h1 className="scanny-title">Payment unavailable</h1>
            <p className="scanny-error" style={{ marginTop: 16 }}>{loadError}</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Pick unit (property-level QR) ────────────────────────────────────────────
  if (phase === 'pick-unit') {
    return (
      <div className="scanny-page">
        <div className="scanny-page-narrow">
          <div className="scanny-card">
            <p className="scanny-eyebrow">Rent payment</p>
            <h1 className="scanny-title">{ctx.propertyName}</h1>
            <p className="scanny-sub" style={{ marginTop: 4 }}>Select your unit to pay rent</p>

            <div style={{ display: 'grid', gap: 8, marginTop: 20 }}>
              {ctx.units.map((u) => (
                <button
                  key={u.unitId}
                  type="button"
                  onClick={() => handleSelectUnit(u)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: 10,
                    border: '1.5px solid #e5e7eb',
                    background: '#fff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>
                      Unit {u.unitNumber}
                      {u.floor ? ` · ${u.floor}` : ''}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
                      {money(u.monthlyAmount, ctx.currency)} / month
                    </p>
                  </div>
                  <span style={{ fontSize: 11, color: u.hasActiveTenant ? '#059669' : '#9ca3af' }}>
                    {u.hasActiveTenant ? 'Occupied' : 'Vacant'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Payment form ─────────────────────────────────────────────────────────────
  if (phase === 'form') {
    const unitLabel = selectedUnit?.unitNumber ?? ctx.unitNumber
    const amount = ctx.balance ?? 0
    const period = ctx.periodLabel ? periodDisplay(ctx.periodLabel) : ''

    return (
      <div className="scanny-page">
        <div className="scanny-page-narrow">
          <div className="scanny-card">
            <p className="scanny-eyebrow">Rent payment</p>
            <h1 className="scanny-title">{ctx.propertyName}</h1>
            {unitLabel && (
              <p className="scanny-sub" style={{ marginTop: 4 }}>
                Unit {unitLabel}{period ? ` · ${period}` : ''}
              </p>
            )}

            {amount > 0 ? (
              <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary)', margin: '12px 0 0' }}>
                {money(amount, ctx.currency)}
              </p>
            ) : null}

            <p style={{ marginTop: 6, fontSize: 13, color: '#6b7280' }}>
              Pays to: <strong style={{ color: '#111827' }}>{ctx.ownerMomo}</strong>
              {' '}({ctx.ownerName})
            </p>

            <form onSubmit={handlePay} style={{ display: 'grid', gap: 14, marginTop: 20 }} noValidate>
              <label style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  Your name <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
                </span>
                <input
                  className="scanny-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Kamya"
                />
              </label>

              <label style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  Mobile money number <span style={{ color: '#ef4444' }}>*</span>
                </span>
                <input
                  className="scanny-input"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07XX XXX XXX"
                  required
                  disabled={submitting}
                />
              </label>

              {/* Partial payment amount — only shown when property allows partial payments */}
              {ctx.partialPaymentAllowed && amount > 0 && (
                <label style={{ display: 'grid', gap: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    Amount to pay{' '}
                    <span style={{ color: '#9ca3af', fontWeight: 400 }}>
                      (leave blank to pay full {money(amount, ctx.currency)})
                    </span>
                  </span>
                  <input
                    className="scanny-input"
                    type="number"
                    min={ctx.minPaymentAmount ?? 1}
                    max={amount}
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder={`Up to ${amount.toLocaleString()}`}
                    disabled={submitting}
                  />
                  {ctx.minPaymentAmount != null && ctx.minPaymentAmount > 0 && (
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>
                      Minimum: {money(ctx.minPaymentAmount, ctx.currency)}
                    </span>
                  )}
                </label>
              )}

              {formError && (
                <p className="scanny-error" role="alert">{formError}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="scanny-btn scanny-btn-primary"
                style={{ marginTop: 4 }}
              >
                {submitting
                  ? 'Starting…'
                  : `Pay ${payAmount.trim() && ctx.partialPaymentAllowed
                      ? money(parseInt(payAmount.replace(/,/g, ''), 10) || 0, ctx.currency)
                      : amount > 0 ? money(amount, ctx.currency) : 'Rent'
                    }`
                }
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // ── Success (waiting for MoMo confirmation) ──────────────────────────────────
  if (phase === 'success' && result) {
    return (
      <div className="scanny-page">
        <div className="scanny-page-narrow">
          <div className="scanny-card">
            <p className="scanny-eyebrow">Payment started</p>
            <h1 className="scanny-title">{money(result.amount, result.currency)}</h1>
            <p className="scanny-sub">
              {ctx.propertyName}
              {result.periodLabel ? ` · ${periodDisplay(result.periodLabel)}` : ''}
            </p>

            <div className="scanny-panel" style={{ marginTop: 20 }}>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: '#374151' }}>
                {result.message || `Check your phone for a MoMo prompt to send ${money(result.amount, result.currency)} to`}
              </p>
              <p style={{ margin: '10px 0 0', fontSize: 22, fontWeight: 700, fontFamily: 'monospace' }}>
                {result.paymentDestination}
              </p>
              <p style={{ margin: '10px 0 0', fontSize: 12, color: '#9ca3af', fontFamily: 'monospace' }}>
                Ref: {result.transactionRef}
              </p>
            </div>

            {/* Polling indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
              <span style={{
                display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                background: '#f59e0b', animation: 'scanny-pulse 1.4s ease-in-out infinite',
              }} />
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
                Waiting for confirmation…
              </p>
            </div>

            <p style={{ marginTop: 12, fontSize: 12, color: '#9ca3af' }}>
              Keep this page open. It will update automatically once your payment is confirmed.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Confirmed / Failed ────────────────────────────────────────────────────────
  if (phase === 'confirmed' && result) {
    const isOk = paymentStatus === 'Completed'
    return (
      <div className="scanny-page">
        <div className="scanny-page-narrow">
          <div className="scanny-card">
            <p className="scanny-eyebrow">{isOk ? 'Payment confirmed' : 'Payment failed'}</p>
            <h1 className="scanny-title" style={{ color: isOk ? '#059669' : '#dc2626' }}>
              {isOk ? `✓ ${money(result.amount, result.currency)}` : '✗ Payment not completed'}
            </h1>
            <p className="scanny-sub">
              {ctx.propertyName}
              {result.periodLabel ? ` · ${periodDisplay(result.periodLabel)}` : ''}
            </p>

            <div className="scanny-panel" style={{ marginTop: 20, borderColor: isOk ? '#bbf7d0' : '#fecaca', background: isOk ? '#f0fdf4' : '#fff1f2' }}>
              {isOk ? (
                <p style={{ margin: 0, fontSize: 14, color: '#166534' }}>
                  Your rent payment has been received. Your landlord has been notified.
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: 14, color: '#991b1b' }}>
                  The payment did not complete. Please try again or contact your landlord.
                </p>
              )}
              <p style={{ margin: '10px 0 0', fontSize: 12, color: '#9ca3af', fontFamily: 'monospace' }}>
                Ref: {result.transactionRef}
              </p>
            </div>

            {!isOk && (
              <button
                type="button"
                onClick={() => {
                  setPhase('form')
                  setResult(null)
                  setPaymentStatus('Pending')
                  setFormError(null)
                }}
                className="scanny-btn scanny-btn-primary"
                style={{ marginTop: 16 }}
              >
                Try again
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}
