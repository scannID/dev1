import { type FormEvent, useEffect, useState } from 'react'
import { publicTicketsApi } from '../api/services'
import type { TicketEventInfo } from '../api/types'
import { KodeMark } from '../customer/KodeMark'
import { MusicInstrumentLoader } from './MusicInstrumentLoader'
import './TicketCustomer.css'
import { usePageMeta } from '../hooks/usePageMeta'
import { MoMoPhoneInput, detectProvider } from '../components/MoMoPhoneInput'
import '../components/MoMoPhoneInput.css'

type Props = { masterQrToken: string }
const SERVICE_FEE = 700

function money(amount: number, currency: string) {
  return `${amount.toLocaleString()} ${currency}`
}

function stockLabel(option: { capacity?: number | null; remaining?: number | null; soldOut?: boolean }) {
  if (option.soldOut) return 'Sold out'
  if (option.capacity == null || option.remaining == null) return null
  if (option.remaining <= 0) return 'Sold out'
  if (option.remaining === 1) return '1 left'
  return `${option.remaining} left`
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

function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

export default function TicketPurchasePage({ masterQrToken }: Props) {
  const [event, setEvent] = useState<TicketEventInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [buyTab, setBuyTab] = useState<'classes' | 'tables'>('classes')
  const [ticketClass, setTicketClass] = useState('')
  const [holderName, setHolderName] = useState('')
  const [holderPhone, setHolderPhone] = useState('')
  const [paymentPhone, setPaymentPhone] = useState('0')
  const [feeConsent, setFeeConsent] = useState(false)
  const paymentProvider = detectProvider(paymentPhone || holderPhone)
  const [submitting, setSubmitting] = useState(false)

  usePageMeta({
    title: event ? `Buy tickets — ${event.eventName}` : 'Buy event tickets',
    description: event
      ? `Get your tickets for ${event.eventName}. Select your tier and pay via mobile money — ticket delivered instantly.`
      : 'Scan to buy tickets for this event. Pay via mobile money — no app required.',
    robots: 'noindex, nofollow',
  })

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
          const firstOpen =
            data.ticketClasses.find((c) => !c.soldOut)?.name ??
            data.ticketClasses[0]?.name ??
            ''
          setTicketClass(firstOpen)
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!event) return
    if (!feeConsent) {
      setError('Confirm the total and service fee before continuing')
      return
    }
    try {
      setSubmitting(true)
      setError(null)
      const result = await publicTicketsApi.purchase({
        masterQrToken,
        ticketClass,
        holderName: holderName.trim(),
        holderEmail: '',
        holderPhone: holderPhone.trim(),
        paymentPhone: paymentPhone.trim() || undefined,
        provider: paymentProvider ?? undefined,
      })
      window.location.href = result.viewUrl
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
  const totalPrice = selectedPrice + SERVICE_FEE
  const selectedSoldOut = Boolean(selectedClass?.soldOut || selectedTable?.soldOut)
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
        <span className="tk-topbar-badge">Verified event</span>
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
            {[dateLabel, 'Instant entry pass'].filter(Boolean).join(' · ')}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="tk-panel tk-enter" noValidate>
          {hasTables ? (
            <div className="tk-tabs" role="tablist" aria-label="Buy general tickets or tables">
              <button
                type="button"
                role="tab"
                aria-selected={buyTab === 'classes'}
                className={`tk-tab${buyTab === 'classes' ? ' is-active' : ''}`}
                onClick={() => {
                  setBuyTab('classes')
                  setTicketClass(
                    event.ticketClasses.find((c) => !c.soldOut)?.name ??
                      event.ticketClasses[0]?.name ??
                      '',
                  )
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
                  setTicketClass(tables.find((t) => !t.soldOut)?.name ?? tables[0]?.name ?? '')
                }}
                disabled={submitting}
              >
                Tables
              </button>
            </div>
          ) : null}

          <p className="tk-section-label">{buyTab === 'tables' && hasTables ? 'Choose a table' : 'Choose a ticket'}</p>
          <div
            className="tk-class-grid"
            role="radiogroup"
            aria-label={buyTab === 'tables' && hasTables ? 'Table' : 'Ticket'}
          >
            {buyTab === 'tables' && hasTables
              ? tables.map((t) => {
                  const active = t.name === ticketClass
                  const stock = stockLabel(t)
                  return (
                    <button
                      key={t.name}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`tk-class-card${active ? ' is-selected' : ''}${t.soldOut ? ' is-sold-out' : ''}`}
                      onClick={() => setTicketClass(t.name)}
                      disabled={submitting || Boolean(t.soldOut)}
                    >
                      <span className="tk-radio" aria-hidden="true" />
                      <span className="tk-class-card-body">
                        <span className="tk-class-card-main">
                          <strong>{t.name}</strong>
                          {t.seats > 0 ? <em className="tk-card-meta">{t.seats} seats</em> : null}
                          {stock ? (
                            <em className={`tk-card-meta${t.soldOut ? ' is-danger' : ''}`}>{stock}</em>
                          ) : null}
                        </span>
                        <span className="tk-class-card-price">{money(t.price, event.currency)}</span>
                      </span>
                    </button>
                  )
                })
              : event.ticketClasses.map((c) => {
                  const active = c.name === ticketClass
                  const stock = stockLabel(c)
                  return (
                    <button
                      key={c.name}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`tk-class-card${active ? ' is-selected' : ''}${c.soldOut ? ' is-sold-out' : ''}`}
                      onClick={() => setTicketClass(c.name)}
                      disabled={submitting || Boolean(c.soldOut)}
                    >
                      <span className="tk-radio" aria-hidden="true" />
                      <span className="tk-class-card-body">
                        <span className="tk-class-card-main">
                          <strong>{c.name}</strong>
                          {stock ? (
                            <em className={`tk-card-meta${c.soldOut ? ' is-danger' : ''}`}>{stock}</em>
                          ) : null}
                        </span>
                        <span className="tk-class-card-price">{money(c.price, event.currency)}</span>
                      </span>
                    </button>
                  )
                })}
          </div>

          <div className="tk-perf" role="presentation" />

          <p className="tk-section-label">Your details</p>
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
              WhatsApp number
              <input
                type="tel"
                value={holderPhone}
                onChange={(e) => {
                  const v = e.target.value
                  setHolderPhone(!v ? '0' : !v.startsWith('0') ? '0' + v.replace(/^0*/, '') : v)
                }}
                placeholder="07XX XXX XXX"
                autoComplete="tel"
                required
                disabled={submitting}
              />
              <p className="tk-hint">
                Ticket + QR will be sent here via WhatsApp.
              </p>
            </label>

            <label className="tk-field" htmlFor="tk-payment-phone">
              Mobile money number to pay from
              <MoMoPhoneInput
                id="tk-payment-phone"
                value={paymentPhone}
                onChange={setPaymentPhone}
                placeholder="07XX XXX XXX"
                required
                disabled={submitting}
                aria-describedby="tk-payment-phone-hint"
              />
              <p className="tk-hint" id="tk-payment-phone-hint">
                {paymentProvider
                  ? `${paymentProvider} detected — this number will be charged.`
                  : 'Start with 0 — e.g. 0771 234 567. We detect MTN or Airtel automatically.'}
              </p>
            </label>
          </div>

          <div className="tk-total-strip" aria-label="Price breakdown">
            <p>
              <span>Ticket subtotal</span>
              <strong>{money(selectedPrice, event.currency)}</strong>
            </p>
            <p>
              <span>Service fee</span>
              <strong>{money(SERVICE_FEE, event.currency)}</strong>
            </p>
            <p className="is-total">
              <span>Total to pay</span>
              <strong>{money(totalPrice, event.currency)}</strong>
            </p>
          </div>

          <label className="tk-check">
            <input
              type="checkbox"
              checked={feeConsent}
              onChange={(e) => setFeeConsent(e.target.checked)}
              disabled={submitting}
            />
            <span>I confirm the total includes the service fee shown above.</span>
          </label>

          {error ? (
            <div className="tk-error" role="alert">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            className="tk-cta"
            disabled={submitting || !ticketClass || selectedSoldOut || !feeConsent}
          >
            {submitting
              ? 'Creating…'
              : selectedSoldOut
                ? 'Sold out'
                : !feeConsent
                  ? 'Confirm total to continue'
                  : paymentProvider
                    ? `Pay via ${paymentProvider} · ${money(totalPrice, event.currency)}`
                    : `Create ticket · ${money(totalPrice, event.currency)}`}
          </button>

          <p className="tk-trust-note">
            <LockIcon />
            Secure checkout · Ticket and QR delivered instantly on WhatsApp
          </p>
        </form>
      </main>
    </div>
  )
}
