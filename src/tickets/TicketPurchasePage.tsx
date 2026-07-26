import { type FormEvent, useEffect, useState } from 'react'
import { Smartphone } from 'lucide-react'
import { publicTicketsApi, paymentsApi } from '../api/services'
import type { TicketEventInfo, TicketPurchaseResponse } from '../api/types'
import { KodeMark } from '../customer/KodeMark'
import { MusicInstrumentLoader } from './MusicInstrumentLoader'
import './TicketCustomer.css'

type Props = { masterQrToken: string }

const PAYMENT_WAIT_LIMIT_SEC = 30

function money(amount: number, currency: string) {
  return `${amount.toLocaleString()} ${currency}`
}

function formatEventDate(iso: string | null) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return null
  }
}

export default function TicketPurchasePage({ masterQrToken }: Props) {
  const [event, setEvent] = useState<TicketEventInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [buyTab, setBuyTab] = useState<'classes' | 'tables'>('classes')
  const [ticketClass, setTicketClass] = useState('')
  const [holderName, setHolderName] = useState('')
  const [holderEmail, setHolderEmail] = useState('')
  const [holderPhone, setHolderPhone] = useState('')
  const [provider, setProvider] = useState<'MTN' | 'Airtel'>('MTN')
  const [submitting, setSubmitting] = useState(false)
  const [purchase, setPurchase] = useState<TicketPurchaseResponse | null>(null)
  const [waiting, setWaiting] = useState(false)
  const [waitSecondsLeft, setWaitSecondsLeft] = useState(PAYMENT_WAIT_LIMIT_SEC)

  useEffect(() => {
    document.documentElement.classList.add('tk-app')
    document.body.classList.add('tk-app')
    return () => {
      document.documentElement.classList.remove('tk-app')
      document.body.classList.remove('tk-app')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const started = Date.now()
        const data = await publicTicketsApi.getEvent(masterQrToken)
        const remaining = Math.max(0, 700 - (Date.now() - started))
        if (remaining > 0) await new Promise((r) => setTimeout(r, remaining))
        if (!cancelled) {
          setEvent(data)
          setTicketClass(data.ticketClasses[0]?.name ?? '')
          setBuyTab('classes')
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
    setWaitSecondsLeft(PAYMENT_WAIT_LIMIT_SEC)

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

    const countdown = window.setInterval(() => {
      setWaitSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(countdown)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    const timeout = window.setTimeout(() => {
      if (cancelled) return
      window.location.href = '/'
    }, PAYMENT_WAIT_LIMIT_SEC * 1000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.clearInterval(countdown)
      window.clearTimeout(timeout)
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

  const tables = event?.tables ?? []
  const hasTables = tables.length > 0
  const selectedClass = event?.ticketClasses.find((c) => c.name === ticketClass)
  const selectedTable = tables.find((t) => t.name === ticketClass)
  const selectedPrice = selectedClass?.price ?? selectedTable?.price ?? 0
  const dateLabel = formatEventDate(event?.eventDate ?? null)

  if (loading) {
    return (
      <div className="tk-shell tk-centered tk-boot">
        <MusicInstrumentLoader />
      </div>
    )
  }

  if (error && !event) {
    return (
      <div className="tk-shell tk-centered">
        <div className="tk-panel tk-empty tk-enter">
          <p className="tk-hero-kicker">Kode</p>
          <h2>Event unavailable</h2>
          <p className="tk-error" role="alert" style={{ textAlign: 'left' }}>
            {error}
          </p>
        </div>
      </div>
    )
  }

  if (!event) return null

  if (waiting && purchase) {
    return (
      <div className="tk-shell">
        <header className="tk-topbar">
          <div className="tk-brand">
            <KodeMark size={28} />
            <div>
              <strong>Kode</strong>
              <span>Event ticket</span>
            </div>
          </div>
        </header>
        <main className="tk-main">
          <div className="tk-panel tk-wait tk-enter">
            <div className="tk-wait-ring" aria-hidden>
              <Smartphone size={28} color="var(--tk-gold-bright)" strokeWidth={1.75} />
            </div>
            <h2>Approve on your phone</h2>
            <p>
              Check your phone for the <strong>{provider}</strong> prompt for{' '}
              <strong>{event.eventName}</strong>.
            </p>
            <p>
              Once paid, your ticket opens here and we email <strong>{holderEmail}</strong>.
            </p>
            <p className="tk-ref">Payment ref: {purchase.paymentId}</p>
            <p className="tk-ref" role="status">
              Waiting {waitSecondsLeft}s — then back to home if still pending
            </p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="tk-shell">
      <header className="tk-topbar">
        <div className="tk-brand">
          <KodeMark size={28} />
          <div>
            <strong>Kode</strong>
            <span>{event.host?.trim() || 'Hosted event'}</span>
          </div>
        </div>
      </header>

      <main className="tk-main">
        <header className="tk-hero tk-enter">
          {event.eventImageUrl ? (
            <div className="tk-hero-art">
              <img src={event.eventImageUrl} alt="" />
            </div>
          ) : null}
          <p className="tk-hero-kicker">Get your ticket</p>
          <h1>{event.eventName}</h1>
          <p className="tk-hero-meta">
            {[dateLabel, 'Pay with mobile money'].filter(Boolean).join(' · ')}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="tk-panel tk-enter">
          {hasTables ? (
            <div className="tk-tabs" role="tablist" aria-label="Buy general tickets or tables">
              <button
                type="button"
                role="tab"
                aria-selected={buyTab === 'classes'}
                className={`tk-tab${buyTab === 'classes' ? ' is-active' : ''}`}
                onClick={() => {
                  setBuyTab('classes')
                  setTicketClass(event.ticketClasses[0]?.name ?? '')
                }}
                disabled={submitting}
              >
                General
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={buyTab === 'tables'}
                className={`tk-tab${buyTab === 'tables' ? ' is-active' : ''}`}
                onClick={() => {
                  setBuyTab('tables')
                  setTicketClass(tables[0]?.name ?? '')
                }}
                disabled={submitting}
              >
                Tables
              </button>
            </div>
          ) : null}

          <p className="tk-section-label">{buyTab === 'tables' && hasTables ? 'Table' : 'Ticket'}</p>
          <div
            className="tk-class-grid"
            role="radiogroup"
            aria-label={buyTab === 'tables' && hasTables ? 'Table' : 'Ticket'}
          >
            {buyTab === 'tables' && hasTables
              ? tables.map((t) => {
                  const active = t.name === ticketClass
                  return (
                    <button
                      key={t.name}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`tk-class-card${active ? ' is-selected' : ''}`}
                      onClick={() => setTicketClass(t.name)}
                      disabled={submitting}
                    >
                      <span>
                        <strong>{t.name}</strong>
                        {t.seats > 0 ? <em className="tk-card-meta">{t.seats} seats</em> : null}
                      </span>
                      <span>{money(t.price, event.currency)}</span>
                    </button>
                  )
                })
              : event.ticketClasses.map((c) => {
                  const active = c.name === ticketClass
                  return (
                    <button
                      key={c.name}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`tk-class-card${active ? ' is-selected' : ''}`}
                      onClick={() => setTicketClass(c.name)}
                      disabled={submitting}
                    >
                      <strong>{c.name}</strong>
                      <span>{money(c.price, event.currency)}</span>
                    </button>
                  )
                })}
          </div>

          <div className="tk-fields">
            <label className="tk-field">
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

            <label className="tk-field">
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
              <p className="tk-hint">
                Ticket is emailed here after payment — one purchase per email for this event.
              </p>
            </label>
          </div>

          <p className="tk-section-label" style={{ marginTop: 16 }}>
            Pay with
          </p>
          <div className="tk-providers" role="group" aria-label="Payment provider">
            <button
              type="button"
              className={`tk-provider${provider === 'MTN' ? ' is-active' : ''}`}
              onClick={() => setProvider('MTN')}
              disabled={submitting}
              aria-label="MTN MoMo"
              aria-pressed={provider === 'MTN'}
            >
              <img src="/mtn.png" alt="" />
            </button>
            <button
              type="button"
              className={`tk-provider${provider === 'Airtel' ? ' is-active' : ''}`}
              onClick={() => setProvider('Airtel')}
              disabled={submitting}
              aria-label="Airtel Money"
              aria-pressed={provider === 'Airtel'}
            >
              <img src="/airtel.png" alt="" className="tk-provider-airtel" />
            </button>
          </div>

          <div className="tk-fields" style={{ marginTop: 14 }}>
            <label className="tk-field">
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
          </div>

          {error ? (
            <div className="tk-error" role="alert">
              {error}
            </div>
          ) : null}

          <button type="submit" className="tk-cta" disabled={submitting || !ticketClass}>
            {submitting ? 'Starting…' : `Pay ${money(selectedPrice, event.currency)}`}
          </button>
        </form>
      </main>
    </div>
  )
}
