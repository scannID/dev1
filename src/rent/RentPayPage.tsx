import { type FormEvent, useEffect, useState } from 'react'
import {
  Home, CreditCard, Receipt, Wrench, ChevronRight, ArrowLeft,
} from 'lucide-react'
import { rentPublicApi } from './api'
import type {
  TenantPayContext,
  UnitPickOption,
  InitiateRentPaymentResponse,
  PaymentSummary,
  MaintenanceRequest,
} from './types'
import TenantHome from './TenantHome'
import './RentPayPage.css'

// ── Rent loader — three bouncing icons: person → money → apartment ─────────

function RentLoader() {
  return (
    <div className="rl-wrap" role="status" aria-label="Loading your account…">
      <style>{`
        .rl-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          color: #2563eb;
        }
        .rl-icons {
          display: flex;
          align-items: flex-end;
          gap: 18px;
        }
        .rl-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          border-radius: 16px;
          background: color-mix(in srgb, #2563eb 10%, transparent);
          color: #2563eb;
          animation: rl-bounce 1.2s ease-in-out infinite;
          will-change: transform;
        }
        .rl-icon:nth-child(1) { animation-delay: 0s; }
        .rl-icon:nth-child(2) { animation-delay: 0.2s; }
        .rl-icon:nth-child(3) { animation-delay: 0.4s; }
        @keyframes rl-bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-14px); }
        }
        .rl-label {
          margin: 0;
          font-size: 14px;
          font-weight: 500;
          color: #6b7280;
          animation: rl-fade 1.6s ease-in-out infinite;
        }
        @keyframes rl-fade {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .rl-icon { animation: none; }
          .rl-label { animation: none; }
        }
      `}</style>

      <div className="rl-icons" aria-hidden="true">
        {/* Person */}
        <div className="rl-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="7" r="4" />
            <path d="M5.5 21a8.38 8.38 0 0 1 13 0" />
          </svg>
        </div>
        {/* Money / Banknote */}
        <div className="rl-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <circle cx="12" cy="12" r="2" />
            <path d="M6 12h.01M18 12h.01" />
          </svg>
        </div>
        {/* Apartment / Building */}
        <div className="rl-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="2" width="16" height="20" rx="1" />
            <path d="M9 22V12h6v10" />
            <rect x="8" y="6" width="2" height="2" />
            <rect x="14" y="6" width="2" height="2" />
            <rect x="8" y="11" width="2" height="2" />
            <rect x="14" y="11" width="2" height="2" />
          </svg>
        </div>
      </div>

      <p className="rl-label">Loading your account…</p>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────

function money(n: number, currency: string) {
  return `${n.toLocaleString()} ${currency}`
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return iso }
}

function periodLabel(label: string | null) {
  if (!label) return ''
  try {
    const [y, m] = label.split('-')
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString([], { month: 'long', year: 'numeric' })
  } catch { return label }
}

function statusText(s: string | null) {
  switch (s) {
    case 'PAID': return '✓ Paid'
    case 'OVERDUE': return '! Overdue'
    case 'PARTIAL': return '~ Partial'
    case 'WAIVED': return 'Waived'
    case 'UNPAID': return 'Unpaid'
    default: return 'No charge'
  }
}

// ── Tab type ──────────────────────────────────────────────────────────────

type Tab = 'home' | 'pay' | 'receipts' | 'maintenance'
type PayPhase = 'form' | 'pending' | 'confirmed'

// ── Main component ─────────────────────────────────────────────────────────

export default function RentPayPage({ token }: { token: string }) {
  // ── Boot ────────────────────────────────────────────────────────────────
  const [ctx, setCtx] = useState<TenantPayContext | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [booting, setBooting] = useState(true)

  // ── Navigation ──────────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>('home')
  const [selectedUnit, setSelectedUnit] = useState<UnitPickOption | null>(null)
  const [pickingUnit, setPickingUnit] = useState(false)

  // ── Pay ─────────────────────────────────────────────────────────────────
  const [payPhase, setPayPhase] = useState<PayPhase>('form')
  const [phone, setPhone] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [payResult, setPayResult] = useState<InitiateRentPaymentResponse | null>(null)
  const [pollStatus, setPollStatus] = useState<'Pending' | 'Completed' | 'Failed'>('Pending')

  // ── Maintenance ──────────────────────────────────────────────────────────
  const [maintRequests, setMaintRequests] = useState<MaintenanceRequest[]>([])
  const [maintTitle, setMaintTitle] = useState('')
  const [maintDesc, setMaintDesc] = useState('')
  const [maintSubmitting, setMaintSubmitting] = useState(false)
  const [maintSuccess, setMaintSuccess] = useState(false)
  const [maintError, setMaintError] = useState<string | null>(null)

  // Load context + maintenance requests
  useEffect(() => {
    let cancelled = false
    rentPublicApi.resolvePayContext(token)
      .then((data) => {
        if (cancelled) return
        setCtx(data)
        if (data.tokenType === 'property') setPickingUnit(true)
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

  // ── Poll payment ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (payPhase !== 'pending' || !payResult?.transactionRef) return
    let cancelled = false
    let attempts = 0
    function poll() {
      if (cancelled || attempts >= 24) return
      attempts++
      rentPublicApi.pollPaymentStatus(payResult!.transactionRef)
        .then((s) => {
          if (cancelled) return
          if (s.status === 'Completed') { setPollStatus('Completed'); setPayPhase('confirmed') }
          else if (s.status === 'Failed') { setPollStatus('Failed'); setPayPhase('confirmed') }
          else setTimeout(poll, 5000)
        })
        .catch(() => { if (!cancelled) setTimeout(poll, 5000) })
    }
    setTimeout(poll, 5000)
    return () => { cancelled = true }
  }, [payPhase, payResult])

  // ── Pay submit ────────────────────────────────────────────────────────────
  async function handlePay(e: FormEvent) {
    e.preventDefault()
    if (!ctx) return
    setFormError(null)
    setSubmitting(true)
    const balance = ctx.balance ?? 0
    let amount: number | undefined
    if (ctx.partialPaymentAllowed && payAmount.trim()) {
      const parsed = parseInt(payAmount.replace(/,/g, ''), 10)
      if (isNaN(parsed) || parsed <= 0) { setFormError('Enter a valid amount'); setSubmitting(false); return }
      if (parsed > balance) { setFormError(`Cannot exceed ${money(balance, ctx.currency)}`); setSubmitting(false); return }
      if (ctx.minPaymentAmount && parsed < ctx.minPaymentAmount) {
        setFormError(`Minimum is ${money(ctx.minPaymentAmount, ctx.currency)}`); setSubmitting(false); return
      }
      amount = parsed
    }
    try {
      const res = await rentPublicApi.initiatePayment(
        token,
        { customerPhone: phone.trim(), amount },
        selectedUnit?.unitId ?? ctx.unitId ?? undefined,
        null,
      )
      if (!res.success) { setFormError(res.message); return }
      setPayResult(res)
      setPollStatus('Pending')
      setPayPhase('pending')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not start payment')
    } finally {
      setSubmitting(false)
    }
  }

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
      setTimeout(() => setMaintSuccess(false), 3000)
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
        <RentLoader />
      </div>
    )
  }

  if (loadError || !ctx) {
    return (
      <div className="rp-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 380, textAlign: 'center' }}>
          <div style={{ fontSize: 42, marginBottom: 16 }}>🏚️</div>
          <h1 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800 }}>Link unavailable</h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--rp-muted)', lineHeight: 1.6 }}>
            {loadError ?? 'This QR code could not be found. Please scan again or contact your landlord.'}
          </p>
        </div>
      </div>
    )
  }

  // ── Unit picker (property QR) ─────────────────────────────────────────────
  if (pickingUnit) {
    return (
      <div className="rp-page">
        <header className="rp-topbar">
          <div className="rp-brand">
            <span className="rp-brand-name">{ctx.propertyName}</span>
            <span className="rp-brand-sub">Select your unit</span>
          </div>
        </header>
        <div className="rp-section">
          <p className="rp-section-heading">{ctx.units.length} unit{ctx.units.length !== 1 ? 's' : ''}</p>
          {ctx.units.map((u) => (
            <button
              key={u.unitId}
              type="button"
              className="rp-unit-row"
              onClick={() => { setSelectedUnit(u); setPickingUnit(false) }}
            >
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>
                  Unit {u.unitNumber}
                  {u.floor ? <span style={{ fontWeight: 400, color: 'var(--rp-muted)', fontSize: 13 }}> · {u.floor}</span> : null}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--rp-muted)' }}>
                  {money(u.monthlyAmount, ctx.currency)} / month
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: u.hasActiveTenant ? 'var(--rp-green)' : 'var(--rp-muted)',
                  background: u.hasActiveTenant ? 'color-mix(in srgb, var(--rp-green) 12%, transparent)' : 'var(--rp-bg)',
                  border: `1px solid ${u.hasActiveTenant ? 'color-mix(in srgb, var(--rp-green) 30%, transparent)' : 'var(--rp-border)'}`,
                  borderRadius: 6, padding: '2px 8px',
                }}>
                  {u.hasActiveTenant ? 'Occupied' : 'Vacant'}
                </span>
                <ChevronRight size={16} color="var(--rp-muted)" />
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Main app ──────────────────────────────────────────────────────────────

  const balance = ctx.balance ?? 0
  const sc = ctx.chargeStatus
  const isPaid = sc === 'PAID' || sc === 'WAIVED'
  const isOverdue = sc === 'OVERDUE'
  const unitLabel = selectedUnit?.unitNumber ?? ctx.unitNumber
  const receipts = ctx.recentPayments ?? []

  // Derive status props for TenantHome
  const statusKey: 'paid' | 'overdue' | 'partial' | 'unpaid' =
    isPaid ? 'paid' : isOverdue ? 'overdue' : sc === 'PARTIAL' ? 'partial' : 'unpaid'
  const statusLabel = isPaid ? '✓ Paid' : isOverdue ? '! Overdue' : sc === 'PARTIAL' ? '~ Partial' : statusText(sc)

  return (
    <div className="rp-page">

      {/* ── Topbar ── */}
      <header className="rp-topbar">
        <div className="rp-brand">
          <span className="rp-brand-name">
            {ctx.tenantFirstName ? `Hi, ${ctx.tenantFirstName}` : ctx.propertyName}
          </span>
          <span className="rp-brand-sub">
            {ctx.propertyName}{unitLabel ? ` · Unit ${unitLabel}` : ''}
          </span>
        </div>
        <div className="rp-topbar-actions">
          {ctx.tokenType === 'property' && (
            <button
              type="button"
              className="rp-icon-btn"
              title="Change unit"
              onClick={() => setPickingUnit(true)}
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <button type="button" className={`rp-icon-btn${tab === 'home' ? ' active' : ''}`} onClick={() => setTab('home')} title="Home">
            <Home size={16} />
          </button>
          <button type="button" className={`rp-icon-btn${tab === 'pay' ? ' active' : ''}`} onClick={() => setTab('pay')} title="Pay">
            <CreditCard size={16} />
          </button>
          <button type="button" className={`rp-icon-btn${tab === 'receipts' ? ' active' : ''}`} onClick={() => setTab('receipts')} title={`${receipts.length} receipt${receipts.length !== 1 ? 's' : ''}`}>
            <Receipt size={16} />
            {receipts.length > 0 && <span className="rp-badge">{receipts.length > 9 ? '9+' : receipts.length}</span>}
          </button>
          <button type="button" className={`rp-icon-btn${tab === 'maintenance' ? ' active' : ''}`} onClick={() => setTab('maintenance')} title="Maintenance">
            <Wrench size={16} />
            {maintRequests.length > 0 && <span className="rp-badge">{maintRequests.length > 9 ? '9+' : maintRequests.length}</span>}
          </button>
        </div>
      </header>

      {/* ── Content ── */}
      {tab === 'home' && (
        <div className="rp-section">
          <TenantHome
            ctx={ctx}
            statusKey={statusKey}
            statusLabel={statusLabel}
            onPay={() => setTab('pay')}
            receiptsSlot={receipts.length > 0 ? (
              <div className="rp-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <p className="rp-section-heading" style={{ margin: 0 }}>Recent payments</p>
                  <button type="button" onClick={() => setTab('receipts')} style={{ background: 'none', border: 'none', color: 'var(--rp-blue)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                    See all →
                  </button>
                </div>
                {receipts.slice(0, 3).map((p) => <ReceiptRow key={p.transactionRef} p={p} currency={ctx.currency} />)}
              </div>
            ) : undefined}
          />
        </div>
      )}

      {tab === 'pay' && (
        <div className="rp-section">
          {payPhase === 'form' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <button type="button" onClick={() => setTab('home')} style={{ background: 'none', border: 'none', color: 'var(--rp-muted)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{money(balance, ctx.currency)}</p>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--rp-muted)' }}>
                    {ctx.propertyName}{unitLabel ? ` · Unit ${unitLabel}` : ''}{ctx.periodLabel ? ` · ${periodLabel(ctx.periodLabel)}` : ''}
                  </p>
                </div>
              </div>

              <div className="rp-card">
                <form onSubmit={handlePay} noValidate>
                  <div className="rp-field">
                    <label className="rp-label" htmlFor="rp-phone">
                      Mobile money number <span style={{ color: 'var(--rp-red)' }}>*</span>
                    </label>
                    <input
                      id="rp-phone"
                      className="rp-input"
                      type="tel"
                      inputMode="tel"
                      placeholder="07XX XXX XXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      disabled={submitting}
                      autoComplete="tel"
                    />
                    <span className="rp-hint">You'll receive a MoMo prompt on this number</span>
                  </div>

                  {ctx.partialPaymentAllowed && balance > 0 && (
                    <div className="rp-field">
                      <label className="rp-label" htmlFor="rp-amount">
                        Amount{' '}
                        <span style={{ fontWeight: 400, color: 'var(--rp-muted)' }}>
                          (blank = full {money(balance, ctx.currency)})
                        </span>
                      </label>
                      <input
                        id="rp-amount"
                        className="rp-input"
                        type="number"
                        inputMode="numeric"
                        min={ctx.minPaymentAmount ?? 1}
                        max={balance}
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        placeholder={balance.toLocaleString()}
                        disabled={submitting}
                      />
                      {ctx.minPaymentAmount > 0 && (
                        <span className="rp-hint">Minimum: {money(ctx.minPaymentAmount, ctx.currency)}</span>
                      )}
                    </div>
                  )}

                  <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--rp-bg)', marginBottom: 14, fontSize: 12, color: 'var(--rp-muted)' }}>
                    Paying to <strong style={{ color: 'var(--rp-text)' }}>{ctx.ownerName}</strong>
                  </div>

                  {formError && <p className="rp-error">{formError}</p>}

                  <button
                    type="submit"
                    disabled={submitting || !phone.trim()}
                    className={`rp-pay-btn${isOverdue ? ' danger' : ''}`}
                    style={{ marginTop: 0 }}
                  >
                    <CreditCard size={17} />
                    {submitting ? 'Starting…' : `Pay ${
                      payAmount.trim() && ctx.partialPaymentAllowed
                        ? money(parseInt(payAmount.replace(/,/g, ''), 10) || 0, ctx.currency)
                        : money(balance, ctx.currency)
                    }`}
                  </button>
                </form>
              </div>
            </>
          )}

          {payPhase === 'pending' && payResult && (
            <div className="rp-card" style={{ textAlign: 'center', padding: '28px 20px' }}>
              <div style={{ fontSize: 38, marginBottom: 14 }}>📱</div>
              <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800 }}>Check your phone</h2>
              <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--rp-muted)', lineHeight: 1.6 }}>
                Approve the MoMo prompt to send{' '}
                <strong style={{ color: 'var(--rp-text)' }}>{money(payResult.amount, payResult.currency)}</strong>{' '}
                to <strong style={{ color: 'var(--rp-text)' }}>{payResult.paymentDestination}</strong>
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14 }}>
                <span className="rp-pulse-dot" />
                <span style={{ fontSize: 13, color: 'var(--rp-muted)' }}>Waiting for confirmation…</span>
              </div>
              <p style={{ margin: 0, fontSize: 10, color: '#d1d5db', fontFamily: 'monospace' }}>Ref: {payResult.transactionRef}</p>
              <p style={{ margin: '12px 0 0', fontSize: 11, color: 'var(--rp-muted)' }}>Keep this page open. It updates automatically.</p>
            </div>
          )}

          {payPhase === 'confirmed' && payResult && (
            <div className="rp-card" style={{ textAlign: 'center', padding: '28px 20px' }}>
              <div className={`rp-confirm-icon ${pollStatus === 'Completed' ? 'ok' : 'fail'}`}>
                {pollStatus === 'Completed' ? '✓' : '✗'}
              </div>
              <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: pollStatus === 'Completed' ? 'var(--rp-green)' : 'var(--rp-red)' }}>
                {pollStatus === 'Completed' ? 'Rent paid!' : 'Payment failed'}
              </h2>
              {pollStatus === 'Completed' ? (
                <>
                  <p style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800 }}>{money(payResult.amount, payResult.currency)}</p>
                  <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--rp-muted)' }}>Your landlord has been notified.</p>
                  <p style={{ margin: 0, fontSize: 10, color: '#d1d5db', fontFamily: 'monospace' }}>Ref: {payResult.transactionRef}</p>
                  <button type="button" className="rp-pay-btn" style={{ marginTop: 18 }} onClick={() => { setTab('home'); setPayPhase('form'); setPayResult(null) }}>
                    Back to home
                  </button>
                </>
              ) : (
                <>
                  <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--rp-muted)', lineHeight: 1.6 }}>
                    The payment did not go through. Please try again.
                  </p>
                  <button type="button" className="rp-pay-btn danger" onClick={() => { setPayPhase('form'); setPayResult(null); setFormError(null) }}>
                    Try again
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'receipts' && (
        <div className="rp-section">
          <h2 style={{ margin: '0 0 14px', fontSize: 20, fontWeight: 800 }}>Receipts</h2>
          {receipts.length === 0 ? (
            <div className="rp-empty">
              <Receipt size={36} style={{ opacity: 0.2, display: 'block', margin: '0 auto 12px' }} />
              <p>No payment history yet.</p>
            </div>
          ) : (
            <div className="rp-card">
              {receipts.map((p) => <ReceiptRow key={p.transactionRef} p={p} currency={ctx.currency} full />)}
            </div>
          )}
        </div>
      )}

      {tab === 'maintenance' && (
        <div className="rp-section">
          <h2 style={{ margin: '0 0 14px', fontSize: 20, fontWeight: 800 }}>Maintenance</h2>

          {/* Request form */}
          <div className="rp-card">
            <p className="rp-section-heading">New request</p>
            {maintSuccess && (
              <div style={{ padding: '10px 12px', borderRadius: 10, background: 'color-mix(in srgb, var(--rp-green) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--rp-green) 30%, transparent)', color: 'var(--rp-green)', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
                Request submitted — your landlord has been notified.
              </div>
            )}
            {maintError && <p className="rp-error">{maintError}</p>}
            <form onSubmit={handleMaintSubmit}>
              <div className="rp-field">
                <label className="rp-label" htmlFor="maint-title">
                  Issue <span style={{ color: 'var(--rp-red)' }}>*</span>
                </label>
                <input
                  id="maint-title"
                  className="rp-input"
                  type="text"
                  placeholder="e.g. Leaking tap, Broken window…"
                  value={maintTitle}
                  onChange={(e) => setMaintTitle(e.target.value)}
                  disabled={maintSubmitting}
                  required
                />
              </div>
              <div className="rp-field">
                <label className="rp-label" htmlFor="maint-desc">Details</label>
                <textarea
                  id="maint-desc"
                  className="rp-textarea"
                  placeholder="Describe the problem…"
                  value={maintDesc}
                  onChange={(e) => setMaintDesc(e.target.value)}
                  disabled={maintSubmitting}
                />
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

          {/* Past requests */}
          {maintRequests.length > 0 && (
            <div className="rp-card">
              <p className="rp-section-heading">Your requests</p>
              {maintRequests.map((r) => {
                const dotCls = r.status === 'RESOLVED' ? 'resolved' : r.status === 'IN_PROGRESS' ? 'open' : 'submitted'
                return (
                  <div key={r.id} className="rp-maint-row">
                    <span className={`rp-maint-dot ${dotCls}`} />
                    <div className="rp-maint-body">
                      <p className="rp-maint-title">{r.title}</p>
                      {r.description && <p className="rp-maint-desc">{r.description}</p>}
                      <p className="rp-maint-desc" style={{ fontSize: 10, marginTop: 2 }}>
                        {r.status === 'OPEN' ? 'Open' : r.status === 'IN_PROGRESS' ? 'In progress' : r.status === 'RESOLVED' ? 'Resolved' : r.status}
                      </p>
                    </div>
                    <span className="rp-maint-date">{fmtDate(r.submittedAt)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

    </div>
  )
}

// ── Receipt row ───────────────────────────────────────────────────────────────

function ReceiptRow({ p, currency, full }: { p: PaymentSummary; currency: string; full?: boolean }) {
  const ok = p.status === 'Completed'
  const fail = p.status === 'Failed'
  const cls = ok ? 'ok' : fail ? 'fail' : 'pending'
  const icon = ok ? '✓' : fail ? '✗' : '…'
  const date = p.paidAt ?? p.createdAt
  return (
    <div className="rp-receipt-row">
      <div className={`rp-receipt-icon ${cls}`} style={{ color: ok ? 'var(--rp-green)' : fail ? 'var(--rp-red)' : 'var(--rp-amber)' }}>
        {icon}
      </div>
      <div className="rp-receipt-body">
        <p className={`rp-receipt-amount ${cls}`}>{money(p.amount, currency)}</p>
        <p className="rp-receipt-meta">
          {fmtDate(date)}
          {p.paymentMethod ? ` · ${p.paymentMethod}` : ''}
          {fail && p.failureReason ? ` · ${p.failureReason}` : ''}
        </p>
      </div>
      {full && <span className="rp-receipt-ref">···{p.transactionRef.slice(-6)}</span>}
    </div>
  )
}
