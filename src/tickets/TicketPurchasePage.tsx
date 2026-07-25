import { type FormEvent, useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { publicTicketsApi, paymentsApi } from '../api/services'
import type { TicketEventInfo, TicketPurchaseResponse } from '../api/types'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { ScannyMark } from '../customer/ScannyMark'
import '../customer/CustomerApp.css'

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
    document.documentElement.classList.add('cm-app')
    return () => document.documentElement.classList.remove('cm-app')
  }, [])

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
      <div className="cm-page cm-centered cm-boot">
        <LoadingSpinner fullPage label="Loading event…" />
      </div>
    )
  }

  if (error && !event) {
    return (
      <div className="cm-page">
        <div className="cm-step cm-panel" style={{ margin: 16 }}>
          <h2>Event unavailable</h2>
          <p className="cm-error" role="alert">{error}</p>
        </div>
      </div>
    )
  }

  if (!event) return null

  if (waiting && purchase) {
    return (
      <div className="cm-page">
        <header className="cm-topbar">
          <div className="cm-brand">
            <ScannyMark size={28} />
            <div>
              <strong>Scanny</strong>
              <span className="cm-muted" style={{ display: 'block', fontSize: 12 }}>Event ticket</span>
            </div>
          </div>
        </header>
        <div className="cm-step cm-step-enter cm-panel cm-done" style={{ margin: 16 }}>
          <div className="cm-done-icon" style={{ animation: 'none', background: 'var(--cm-teal-soft)', color: 'var(--cm-orange)' }}>
            <Check size={28} />
          </div>
          <h2>Approve payment</h2>
          <p className="cm-muted">
            Check your phone for the {provider} prompt for <strong>{event.eventName}</strong>.
          </p>
          <p className="cm-muted" style={{ marginTop: 8 }}>
            Once paid, your ticket opens here and we email <strong>{holderEmail}</strong>.
          </p>
          <p className="cm-ref" style={{ marginTop: 16 }}>Payment ref: {purchase.paymentId}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="cm-page">
      <header className="cm-topbar">
        <div className="cm-brand">
          <ScannyMark size={28} />
          <div>
            <strong>Scanny</strong>
            <span className="cm-muted" style={{ display: 'block', fontSize: 12 }}>Buy ticket</span>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="cm-step cm-step-enter cm-panel" style={{ margin: 16 }}>
        <h2>{event.eventName}</h2>
        <p className="cm-muted">
          {event.eventDate ? new Date(event.eventDate).toLocaleDateString() : 'Event ticket'} · pay with mobile money
        </p>

        <div className="cm-order-strip">
          <div>
            <span>Ticket</span>
            <span>{ticketClass || '—'}</span>
          </div>
          <div className="cm-order-strip-total">
            <span>Total</span>
            <strong>{money(selected?.price ?? 0, event.currency)}</strong>
          </div>
        </div>

        <label className="cm-field">
          Ticket class
          <select
            value={ticketClass}
            onChange={(e) => setTicketClass(e.target.value)}
            required
            disabled={submitting}
          >
            {event.ticketClasses.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} — {money(c.price, event.currency)}
              </option>
            ))}
          </select>
        </label>

        <label className="cm-field">
          Your name
          <input
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
            placeholder="e.g. Jane"
            autoComplete="name"
            required
            disabled={submitting}
          />
        </label>

        <label className="cm-field">
          Email
          <input
            type="email"
            value={holderEmail}
            onChange={(e) => setHolderEmail(e.target.value)}
            placeholder="you@email.com"
            autoComplete="email"
            required
            disabled={submitting}
          />
          <span className="cm-optional" style={{ fontWeight: 500 }}>
            Your ticket is emailed here after payment — one purchase per email for this event.
          </span>
        </label>

        <label className="cm-field">
          Mobile money number
          <input
            value={holderPhone}
            onChange={(e) => setHolderPhone(e.target.value)}
            placeholder="+256…"
            autoComplete="tel"
            required
            disabled={submitting}
          />
        </label>

        <div className="cm-providers" role="group" aria-label="Payment provider">
          <button
            type="button"
            className={provider === 'MTN' ? 'active' : ''}
            onClick={() => setProvider('MTN')}
            disabled={submitting}
            aria-label="MTN MoMo"
          >
            <img src="/mtn.png" alt="MTN" className="cm-provider-logo" />
          </button>
          <button
            type="button"
            className={provider === 'Airtel' ? 'active' : ''}
            onClick={() => setProvider('Airtel')}
            disabled={submitting}
            aria-label="Airtel Money"
          >
            <img src="/airtel.png" alt="Airtel" className="cm-provider-logo cm-provider-logo-airtel" />
          </button>
        </div>

        {error ? <div className="cm-error" role="alert">{error}</div> : null}

        <button type="submit" className="cm-primary cm-full" disabled={submitting}>
          {submitting ? 'Starting…' : `Pay ${money(selected?.price ?? 0, event.currency)}`}
        </button>
      </form>
    </div>
  )
}
