import { type FormEvent, useEffect, useState } from 'react'
import { quickPaymentsApi } from '../api/services'
import type { QuickPaymentCode } from '../api/types'
import { LoadingSpinner, InlineSpinner } from '../components/LoadingSpinner'
import { KodeMark } from '../customer/KodeMark'
import { usePageMeta } from '../hooks/usePageMeta'

function money(amount: number, currency: string) {
  return `${amount.toLocaleString()} ${currency}`
}

type Props = {
  qrToken: string
}

export default function QuickPayCustomer({ qrToken }: Props) {
  const [code, setCode] = useState<QuickPaymentCode | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [txnRef, setTxnRef] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // Page title updates once the code loads — show description + amount
  usePageMeta({
    title: code ? `Pay ${code.amount.toLocaleString()} ${code.currency} — ${code.description}` : 'Quick payment',
    description: code
      ? `Scan to pay ${code.amount.toLocaleString()} ${code.currency} for ${code.description} via mobile money.`
      : 'Scan this QR to make a mobile money payment — no app required.',
    robots: 'noindex, nofollow',
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await quickPaymentsApi.getByQr(qrToken)
        if (!cancelled) setCode(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Payment QR not found')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [qrToken])

  async function handlePay(e: FormEvent) {
    e.preventDefault()
    if (!code) return
    try {
      setSubmitting(true)
      setError(null)
      const result = await quickPaymentsApi.pay(qrToken, {
        customerPhone: customerPhone.trim(),
        customerName: customerName.trim() || undefined,
        paymentMethod: 'MobileMoney',
      })
      if (!result.valid) {
        setError(result.message)
        return
      }
      setTxnRef(result.transactionRef)
      setMessage(result.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start payment')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="scanny-page">
        <div className="scanny-loading-page" style={{ display: 'grid', gap: 22, placeItems: 'center' }}>
          <KodeMark size={52} />
          <LoadingSpinner label="Loading payment…" />
        </div>
      </div>
    )
  }

  if (error && !code) {
    return (
      <div className="scanny-page">
        <div className="scanny-page-narrow">
          <div className="scanny-card">
            <h1 className="scanny-title">Payment unavailable</h1>
            <p className="scanny-error" role="alert" style={{ marginTop: 16 }}>{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!code) return null

  if (txnRef) {
    return (
      <div className="scanny-page">
        <div className="scanny-page-narrow">
          <div className="scanny-card">
            <p className="scanny-eyebrow">Payment started</p>
            <h1 className="scanny-title">{money(code.amount, code.currency)}</h1>
            <p className="scanny-sub">{code.description}</p>
            <div className="scanny-panel">
              <p className="scanny-hint" style={{ fontSize: 14, lineHeight: 1.6 }}>
                {message || `Send ${money(code.amount, code.currency)} via mobile money to`}
              </p>
              <p className="scanny-stat-value scanny-mono" style={{ marginTop: 10, fontSize: 22 }}>
                {code.paymentDestination}
              </p>
              <p className="scanny-hint scanny-mono" style={{ marginTop: 12, fontSize: 12 }}>
                Ref: {txnRef}
              </p>
            </div>
            <p className="scanny-hint" style={{ marginTop: 16 }}>
              Keep this reference. The owner will see your payment on their tracking page once confirmed.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="scanny-page">
      <div className="scanny-page-narrow">
        <div className="scanny-card">
          <p className="scanny-eyebrow">Quick pay</p>
          <h1 className="scanny-title">{code.description}</h1>
          <p className="scanny-title" style={{ marginTop: 8, fontSize: 28, color: 'var(--primary)' }}>
            {money(code.amount, code.currency)}
          </p>
          {!code.canBeUsed ? (
            <p className="scanny-error" role="alert" style={{ marginTop: 16 }}>This payment QR is no longer active.</p>
          ) : (
            <form onSubmit={handlePay} className="scanny-form" noValidate>
              <label className="scanny-field">
                <span className="scanny-label">Your name</span>
                <input
                  className="scanny-input"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Optional"
                />
              </label>
              <label className="scanny-field">
                <span className="scanny-label">Mobile money number <span className="req">*</span></span>
                <input
                  required
                  className="scanny-input"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+256700123456"
                />
              </label>
              {error ? <p className="scanny-error" role="alert">{error}</p> : null}
              <button type="submit" disabled={submitting} className="scanny-btn scanny-btn-primary">
                {submitting
                  ? <InlineSpinner label="Starting…" />
                  : `Pay ${money(code.amount, code.currency)}`}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
