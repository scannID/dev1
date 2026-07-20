import { type FormEvent, useEffect, useState } from 'react'
import { publicTicketsApi, paymentsApi } from '../api/services'
import type { TicketEventInfo, TicketPurchaseResponse } from '../api/types'

type Props = { masterQrToken: string }

function money(amount: number, currency: string) {
  return `${amount.toLocaleString()} ${currency}`
}

export default function TicketPurchasePage({ masterQrToken }: Props) {
  const [event, setEvent] = useState<TicketEventInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ticketClass, setTicketClass] = useState('')
  const [holderName, setHolderName] = useState('')
  const [holderEmail, setHolderEmail] = useState('')
  const [holderPhone, setHolderPhone] = useState('')
  const [provider, setProvider] = useState<'MTN' | 'Airtel'>('MTN')
  const [submitting, setSubmitting] = useState(false)
  const [purchase, setPurchase] = useState<TicketPurchaseResponse | null>(null)
  const [waiting, setWaiting] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const data = await publicTicketsApi.getEvent(masterQrToken)
        if (!cancelled) {
          setEvent(data)
          setTicketClass(data.ticketClasses[0]?.name ?? '')
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Event not found')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [masterQrToken])

  useEffect(() => {
    if (!purchase?.paymentId || purchase.paymentStatus === 'Paid') return
    if (!waiting) return

    let cancelled = false
    const interval = window.setInterval(async () => {
      try {
        const status = await paymentsApi.status(purchase.paymentId)
        if (cancelled) return
        if (status.status === 'Paid') {
          window.location.href = purchase.viewUrl
        } else if (status.status === 'Failed' || status.status === 'Cancelled') {
          setError('Payment failed. Try again or use a different number.')
          setWaiting(false)
        }
      } catch {
        // keep polling
      }
    }, 3000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [purchase, waiting])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!event) return
    try {
      setSubmitting(true)
      setError(null)
      const result = await publicTicketsApi.purchase({
        masterQrToken,
        ticketClass,
        holderName: holderName.trim(),
        holderEmail: holderEmail.trim(),
        holderPhone: holderPhone.trim(),
        provider,
      })
      setPurchase(result)
      if (result.paymentStatus === 'Paid') {
        window.location.href = result.viewUrl
        return
      }
      setWaiting(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start purchase')
    } finally {
      setSubmitting(false)
    }
  }

  const selected = event?.ticketClasses.find((c) => c.name === ticketClass)

  if (loading) {
    return (
      <div className="scanny-page">
        <div className="scanny-page-narrow">
          <p className="scanny-hint" style={{ textAlign: 'center' }}>Loading event…</p>
        </div>
      </div>
    )
  }

  if (error && !event) {
    return (
      <div className="scanny-page">
        <div className="scanny-page-narrow">
          <div className="scanny-card">
            <h1 className="scanny-title">Event unavailable</h1>
            <p className="scanny-error" role="alert">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!event) return null

  if (waiting && purchase) {
    return (
      <div className="scanny-page">
        <div className="scanny-page-narrow">
          <div className="scanny-card">
            <p className="scanny-eyebrow">Approve payment</p>
            <h1 className="scanny-title">{event.eventName}</h1>
            <p className="scanny-sub">
              Check your phone for the {provider} prompt. Once paid, your ticket will open automatically and we&apos;ll email{' '}
              <strong>{holderEmail}</strong>.
            </p>
            <p className="scanny-hint scanny-mono" style={{ fontSize: 12 }}>
              Payment ref: {purchase.paymentId}
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
          <p className="scanny-eyebrow">Get your ticket</p>
          <h1 className="scanny-title">{event.eventName}</h1>
          {event.eventDate ? <p className="scanny-sub">{new Date(event.eventDate).toLocaleDateString()}</p> : null}

          <form onSubmit={handleSubmit} className="scanny-form">
            <label className="scanny-field">
              <span className="scanny-label">Ticket class</span>
              <select className="scanny-input" value={ticketClass} onChange={(e) => setTicketClass(e.target.value)} required>
                {event.ticketClasses.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} — {money(c.price, event.currency)}
                  </option>
                ))}
              </select>
            </label>

            <label className="scanny-field">
              <span className="scanny-label">Your name <span className="req">*</span></span>
              <input className="scanny-input" value={holderName} onChange={(e) => setHolderName(e.target.value)} required />
            </label>

            <label className="scanny-field">
              <span className="scanny-label">Email <span className="req">*</span></span>
              <input className="scanny-input" type="email" value={holderEmail} onChange={(e) => setHolderEmail(e.target.value)} required />
              <span className="scanny-hint">Your ticket is sent here after payment — one ticket per email for this event.</span>
            </label>

            <label className="scanny-field">
              <span className="scanny-label">Mobile money number <span className="req">*</span></span>
              <input className="scanny-input" value={holderPhone} onChange={(e) => setHolderPhone(e.target.value)} required placeholder="+256…" />
            </label>

            <div className="scanny-field">
              <span className="scanny-label">Pay with</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {([
                  { id: 'MTN' as const, logo: '/mtn.png', label: 'MTN MoMo' },
                  { id: 'Airtel' as const, logo: '/airtel.png', label: 'Airtel Money' },
                ]).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-label={p.label}
                    onClick={() => setProvider(p.id)}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '12px',
                      borderRadius: 12,
                      border: provider === p.id ? '1.5px solid #111' : '1px solid var(--border, #e5e7eb)',
                      background: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    <img
                      src={p.logo}
                      alt={p.label}
                      style={{
                        height: 28,
                        width: 'auto',
                        objectFit: 'contain',
                        background: p.id === 'Airtel' ? '#000' : 'transparent',
                        borderRadius: 4,
                        padding: p.id === 'Airtel' ? '4px 8px' : 0,
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>

            {error ? <p className="scanny-error" role="alert">{error}</p> : null}

            <button type="submit" disabled={submitting} className="scanny-btn scanny-btn-primary">
              {submitting ? 'Starting…' : `Pay ${money(selected?.price ?? 0, event.currency)}`}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
