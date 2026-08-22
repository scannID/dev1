import { type FormEvent, useEffect, useState } from 'react'
import { publicTicketsApi } from '../api/services'
import type { TicketEventInfo, QueueStatusResponse, WaitlistJoinResponse, TicketPurchaseResponse } from '../api/types'
import { KodteMark } from '../customer/KodteMark'
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

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return null
  }
}

function getCountdown(targetIso: string | null | undefined) {
  if (!targetIso) return null
  const diff = new Date(targetIso).getTime() - Date.now()
  if (diff <= 0) return null
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
  const minutes = Math.floor((diff / (1000 * 60)) % 60)
  const seconds = Math.floor((diff / 1000) % 60)
  return {
    days: String(days).padStart(2, '0'),
    hours: String(hours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0'),
  }
}

function QueueWaitingStep({
  queueToken,
  initialPosition,
  initialWaitSeconds,
  eventName,
  onReset,
}: {
  queueToken: string
  initialPosition?: number | null
  initialWaitSeconds?: number | null
  eventName: string
  onReset: () => void
}) {
  const [position, setPosition] = useState<number | null>(initialPosition ?? 1)
  const [waitSeconds, setWaitSeconds] = useState<number | null>(initialWaitSeconds ?? 6)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const res = await publicTicketsApi.getQueueStatus(queueToken)
        if (cancelled) return
        if (res.position != null) setPosition(res.position)
        if (res.estimatedWaitSeconds != null) setWaitSeconds(res.estimatedWaitSeconds)

        if (res.status === 'Complete' && res.viewUrl) {
          window.location.href = res.viewUrl
        } else if (res.status === 'Failed') {
          setError(res.errorMessage || 'Ticket purchase failed. Please try again.')
        } else if (res.status === 'Expired') {
          setError('Your spot in line has expired. Please rejoin the queue.')
        }
      } catch (err: any) {
        // network retry
      }
    }

    const timer = window.setInterval(poll, 2500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [queueToken])

  return (
    <div className="tk-queue-panel tk-enter">
      <p className="tk-queue-kicker">Virtual Waiting Room</p>

      <div className="tk-queue-pos-ring">
        <span className="tk-queue-pos-number">{position ?? 1}</span>
        <span className="tk-queue-pos-label">In line</span>
      </div>

      <h2 className="tk-queue-headline">You're in line for {eventName}</h2>
      <p className="tk-queue-sub">
        High demand launch. Orders are being processed sequentially to guarantee fair access.
      </p>

      {waitSeconds != null && waitSeconds > 0 ? (
        <div className="tk-queue-eta-badge">
          <span>⏱ Estimated wait: ~{waitSeconds} seconds</span>
        </div>
      ) : null}

      <div className="tk-queue-progress-bar">
        <div
          className="tk-queue-progress-fill"
          style={{ width: `${Math.max(15, 100 - ((position ?? 1) - 1) * 20)}%` }}
        />
      </div>

      {error ? (
        <div className="tk-error" style={{ width: '100%', textAlign: 'center', marginTop: 12 }}>
          <p style={{ margin: '0 0 10px' }}>{error}</p>
          <button type="button" className="tk-btn-submit" onClick={onReset}>
            Try again
          </button>
        </div>
      ) : (
        <p className="tk-queue-warning">
          🔒 Do not close or refresh this tab. Your position is held.
        </p>
      )}
    </div>
  )
}

// ── Helper: extract accessToken from a view URL like /ticket/view/{token} ──
// ── Multi-ticket success screen: just show all the codes ──
function MultiTicketSuccessStep({
  result,
  eventName,
  purchaseUrl,
}: {
  result: TicketPurchaseResponse
  eventName: string
  purchaseUrl: string
}) {
  const codes = result.ticketCodes ?? [result.ticketCode]

  return (
    <div className="tk-panel tk-enter tk-mt-success">
      <div className="tk-mt-success-icon" aria-hidden>🎟️</div>
      <h2 className="tk-mt-success-title">{codes.length} tickets confirmed</h2>
      <p className="tk-hint" style={{ marginBottom: 8 }}>
        {eventName} — share each code with the person attending.
      </p>

      <div className="tk-mt-ticket-list">
        {codes.map((code, i) => (
          <div key={code} className="tk-mt-ticket-row tk-enter">
            <span className="tk-mt-ticket-num">Ticket {i + 1}</span>
            <strong className="tk-mt-code">{code}</strong>
          </div>
        ))}
      </div>

      <a href={purchaseUrl} className="tk-btn-cancel" style={{ display: 'flex', marginTop: 20 }}>
        ← Back to event
      </a>
    </div>
  )
}

export default function TicketPurchasePage({ masterQrToken }: Props) {
  const [event, setEvent] = useState<TicketEventInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [queueEntry, setQueueEntry] = useState<QueueStatusResponse | null>(null)
  const [waitlistEntry, setWaitlistEntry] = useState<WaitlistJoinResponse | null>(null)
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [buyTab, setBuyTab] = useState<'classes' | 'tables'>('classes')
  const [ticketClass, setTicketClass] = useState('')
  const [holderName, setHolderName] = useState('')
  const [holderPhone, setHolderPhone] = useState('')
  const [paymentPhone, setPaymentPhone] = useState('0')
  const [presaleCode, setPresaleCode] = useState('')
  const [feeConsent, setFeeConsent] = useState(false)
  const paymentProvider = detectProvider(paymentPhone || holderPhone)
  const [submitting, setSubmitting] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [purchaseResult, setPurchaseResult] = useState<TicketPurchaseResponse | null>(null)

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
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
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
    if (selectedClass?.presaleRequired && !presaleCode.trim()) {
      setError('Presale code is required for this ticket class')
      return
    }
    try {
      setSubmitting(true)
      setError(null)
      const payload = {
        masterQrToken,
        ticketClass,
        holderName: holderName.trim(),
        holderEmail: '',
        holderPhone: holderPhone.trim(),
        paymentPhone: paymentPhone.trim() || undefined,
        provider: paymentProvider ?? undefined,
        presaleCode: presaleCode.trim() || undefined,
        quantity: quantity > 1 ? quantity : undefined,
      }

      // purchase() returns 200 (direct) or 202 (auto-queued by backend under high load)
      const result = await publicTicketsApi.purchase(payload)
      if (result.status === 202) {
        // Backend detected high concurrency and placed us in the queue automatically
        setQueueEntry(result.data)
      } else {
        const data = result.data
        // Multi-ticket: show inline success screen so buyer can distribute each ticket
        if ((data.viewUrls?.length ?? 0) > 1) {
          setPurchaseResult(data)
        } else {
          window.location.href = data.viewUrl
        }
      }    } catch (err) {
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

  const isSaleUpcoming = Boolean(
    event?.saleStartsAt && new Date(event.saleStartsAt).getTime() > now
  )
  const isSaleClosed = Boolean(
    event?.saleEndsAt && new Date(event.saleEndsAt).getTime() <= now
  )
  const isSaleOpen = event?.saleOpen ?? (!isSaleUpcoming && !isSaleClosed)
  const countdown = isSaleUpcoming ? getCountdown(event?.saleStartsAt) : null

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
          <p className="tk-hero-kicker">Kodte</p>
          <h2>Event unavailable</h2>
          <p className="tk-error" role="alert" style={{ textAlign: 'left' }}>
            {error}
          </p>
        </div>
      </div>
    )
  }

  if (!event) return null

  if (queueEntry) {
    return (
      <div className="tk-shell">
        <header className="tk-topbar">
          <div className="tk-brand">
            <KodteMark size={28} />
            <div>
              <strong>Kodte</strong>
              <span>{event.host?.trim() || 'Hosted event'}</span>
            </div>
          </div>
          <span className="tk-topbar-badge">Waiting room</span>
        </header>

        <main className="tk-main">
          <QueueWaitingStep
            queueToken={queueEntry.queueToken}
            initialPosition={queueEntry.position}
            initialWaitSeconds={queueEntry.estimatedWaitSeconds}
            eventName={event.eventName}
            onReset={() => setQueueEntry(null)}
          />
        </main>
      </div>
    )
  }

  if (waitlistEntry) {
    return (
      <div className="tk-shell">
        <header className="tk-topbar">
          <div className="tk-brand">
            <KodteMark size={28} />
            <div>
              <strong>Kodte</strong>
              <span>{event.host?.trim() || 'Hosted event'}</span>
            </div>
          </div>
        </header>
        <main className="tk-main">
          <div className="tk-panel tk-enter tk-waitlist-success">
            <div className="tk-waitlist-icon" aria-hidden="true">🎟️</div>
            <h2>You're on the waitlist!</h2>
            <p className="tk-hint">{waitlistEntry.message}</p>
            <p className="tk-hint" style={{ marginTop: 8 }}>
              Position: <strong>#{waitlistEntry.position}</strong>
            </p>
            <button type="button" className="tk-cta" style={{ marginTop: 20 }}
              onClick={() => { window.location.href = '/' }}>
              Back to home
            </button>
          </div>
        </main>
      </div>
    )
  }

  if (purchaseResult && event && (purchaseResult.viewUrls?.length ?? 0) > 1) {
    return (
      <div className="tk-shell">
        <header className="tk-topbar">
          <div className="tk-brand">
            <KodteMark size={28} />
            <div>
              <strong>Kodte</strong>
              <span>{event.host?.trim() || event.eventName}</span>
            </div>
          </div>
        </header>
        <main className="tk-main">
          <MultiTicketSuccessStep
            result={purchaseResult}
            eventName={event.eventName}
            purchaseUrl={`/ticket/${masterQrToken}`}
          />
        </main>
      </div>
    )
  }

  return (
    <div className="tk-shell">
      <header className="tk-topbar">
        <div className="tk-brand">
          <KodteMark size={28} />
          <div>
            <strong>Kodte</strong>
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
          {isSaleUpcoming && countdown ? (
            <div className="tk-sale-window is-upcoming">
              <span className="tk-sale-window-badge">Sales Opening Soon</span>
              <p>Ticket sales open on <strong>{formatDateTime(event.saleStartsAt)}</strong></p>
              <div className="tk-countdown" aria-label="Countdown until sales open">
                <div className="tk-countdown-segment"><span>{countdown.days}</span><label>Days</label></div>
                <div className="tk-countdown-segment"><span>{countdown.hours}</span><label>Hours</label></div>
                <div className="tk-countdown-segment"><span>{countdown.minutes}</span><label>Mins</label></div>
                <div className="tk-countdown-segment"><span>{countdown.seconds}</span><label>Secs</label></div>
              </div>
            </div>
          ) : isSaleClosed ? (
            <div className="tk-sale-window is-closed">
              <span className="tk-sale-window-badge">Sales Closed</span>
              <p>Ticket sales for this event have closed.</p>
            </div>
          ) : null}

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
                disabled={submitting || !isSaleOpen}
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
                disabled={submitting || !isSaleOpen}
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
                  const isExpired = Boolean(t.saleEndsAt && new Date(t.saleEndsAt).getTime() <= now)
                  const isEarly = Boolean(t.saleEndsAt && new Date(t.saleEndsAt).getTime() > now)
                  const isUnavailable = Boolean(t.soldOut || isExpired || !isSaleOpen)

                  return (
                    <button
                      key={t.name}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`tk-class-card${active ? ' is-selected' : ''}${isUnavailable ? ' is-sold-out' : ''}`}
                      onClick={() => setTicketClass(t.name)}
                      disabled={submitting || isUnavailable}
                    >
                      <span className="tk-radio" aria-hidden="true" />
                      <span className="tk-class-card-body">
                        <span className="tk-class-card-main">
                          <strong>{t.name}</strong>
                          {t.seats > 0 ? <em className="tk-card-meta">{t.seats} seats</em> : null}
                          {isEarly ? (
                            <span className="tk-badge-pill is-early">Early package</span>
                          ) : null}
                          {isExpired ? (
                            <em className="tk-card-meta is-danger">Package ended</em>
                          ) : stock ? (
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
                  const isExpired = Boolean(c.saleEndsAt && new Date(c.saleEndsAt).getTime() <= now)
                  const isEarly = Boolean(c.saleEndsAt && new Date(c.saleEndsAt).getTime() > now)
                  const isUnavailable = Boolean(c.soldOut || isExpired || !isSaleOpen)

                  return (
                    <button
                      key={c.name}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`tk-class-card${active ? ' is-selected' : ''}${isUnavailable ? ' is-sold-out' : ''}`}
                      onClick={() => setTicketClass(c.name)}
                      disabled={submitting || isUnavailable}
                    >
                      <span className="tk-radio" aria-hidden="true" />
                      <span className="tk-class-card-body">
                        <span className="tk-class-card-main">
                          <strong>{c.name}</strong>
                          {c.presaleRequired ? (
                            <span className="tk-badge-pill is-presale">Presale code</span>
                          ) : isEarly ? (
                            <span className="tk-badge-pill is-early">Early Bird</span>
                          ) : null}
                          {isExpired ? (
                            <em className="tk-card-meta is-danger">Sales ended</em>
                          ) : stock ? (
                            <em className={`tk-card-meta${c.soldOut ? ' is-danger' : ''}`}>{stock}</em>
                          ) : null}
                        </span>
                        <span className="tk-class-card-price">{money(c.price, event.currency)}</span>
                      </span>
                    </button>
                  )
                })}
          </div>

          {selectedClass?.presaleRequired ? (
            <div className="tk-fields" style={{ marginTop: 12 }}>
              <label className="tk-field">
                Presale Access Code
                <input
                  value={presaleCode}
                  onChange={(e) => setPresaleCode(e.target.value.toUpperCase())}
                  placeholder="Enter code (e.g. VIPKODE25)"
                  autoCapitalize="characters"
                  required
                  disabled={submitting || !isSaleOpen}
                />
                <p className="tk-hint">
                  This tier requires an exclusive presale access code.
                </p>
              </label>
            </div>
          ) : null}

          <div className="tk-perf" role="presentation" />

          <p className="tk-section-label">Your details</p>
          <div className="tk-fields">
            <label className="tk-field">
              Your name
              <input
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
                autoComplete="name"
                required
                disabled={submitting || !isSaleOpen}
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
                autoComplete="tel"
                required
                disabled={submitting || !isSaleOpen}
              />
              <p className="tk-hint">
                Ticket will be sent here via WhatsApp.
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
                disabled={submitting || !isSaleOpen}
                aria-describedby="tk-payment-phone-hint"
              />
              <p className="tk-hint" id="tk-payment-phone-hint">
                {paymentProvider
                  ? `${paymentProvider} detected — this number will be charged.`
                  : 'Enter Valid Number.'}
              </p>
            </label>
          </div>

          <div className="tk-total-strip" aria-label="Price breakdown">
            <p>
              <span>Ticket subtotal</span>
              <strong>{money(selectedPrice * quantity, event.currency)}</strong>
            </p>
            <p>
              <span>Service fee × {quantity}</span>
              <strong>{money(SERVICE_FEE * quantity, event.currency)}</strong>
            </p>
            <p className="is-total">
              <span>Total to pay</span>
              <strong>{money(totalPrice * quantity, event.currency)}</strong>
            </p>
          </div>

          {/* Quantity stepper — only show when not sold out and class is available */}
          {!selectedSoldOut && isSaleOpen ? (
            <div className="tk-qty-row" aria-label="Ticket quantity">
              <span className="tk-qty-label">Quantity</span>
              <div className="tk-qty-stepper">
                <button type="button" className="tk-qty-btn"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  disabled={quantity <= 1 || submitting}
                  aria-label="Decrease quantity">−</button>
                <span className="tk-qty-value">{quantity}</span>
                <button type="button" className="tk-qty-btn"
                  onClick={() => setQuantity(q => Math.min(10, q + 1))}
                  disabled={quantity >= 10 || submitting}
                  aria-label="Increase quantity">+</button>
              </div>
              {quantity > 1 ? (
                <p className="tk-hint" style={{ marginTop: 6, gridColumn: '1 / -1' }}>
                  Each person gets their own ticket and QR code, all sent to your WhatsApp.
                </p>
              ) : null}
            </div>
          ) : null}

          <label className="tk-check">
            <input
              type="checkbox"
              checked={feeConsent}
              onChange={(e) => setFeeConsent(e.target.checked)}
              disabled={submitting || !isSaleOpen}
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
            disabled={
              submitting ||
              !isSaleOpen ||
              !ticketClass ||
              selectedSoldOut ||
              !feeConsent ||
              Boolean(selectedClass?.presaleRequired && !presaleCode.trim())
            }
          >
            {submitting
              ? 'Creating…'
              : !isSaleOpen
                ? isSaleUpcoming
                  ? 'Sales open soon'
                  : 'Sales closed'
                : selectedSoldOut
                  ? 'Sold out'
                  : selectedClass?.presaleRequired && !presaleCode.trim()
                    ? 'Enter presale code to continue'
                    : !feeConsent
                      ? 'Confirm total to continue'
                      : paymentProvider
                        ? `Pay via ${paymentProvider} · ${money(totalPrice * quantity, event.currency)}`
                        : `Create ticket${quantity > 1 ? ` × ${quantity}` : ''} · ${money(totalPrice * quantity, event.currency)}`}
          </button>

          {/* Waitlist button — shown when selected class is sold out */}
          {selectedSoldOut && isSaleOpen && holderName.trim() && holderPhone.length > 3 ? (
            <button
              type="button"
              className="tk-waitlist-btn"
              disabled={waitlistSubmitting}
              onClick={async () => {
                try {
                  setWaitlistSubmitting(true)
                  setError(null)
                  const res = await publicTicketsApi.joinWaitlist({
                    masterTicketId: event.masterTicketId,
                    ticketClass,
                    holderName: holderName.trim(),
                    holderPhone: holderPhone.trim(),
                  })
                  setWaitlistEntry(res)
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Could not join waitlist')
                } finally {
                  setWaitlistSubmitting(false)
                }
              }}
            >
              {waitlistSubmitting ? 'Joining…' : '🔔 Notify me when a ticket opens up'}
            </button>
          ) : selectedSoldOut && isSaleOpen ? (
            <p className="tk-hint" style={{ textAlign: 'center', marginTop: 6 }}>
              Fill in your name and WhatsApp number above to join the waitlist.
            </p>
          ) : null}

          <p className="tk-trust-note">
            Ticket delivered instantly on WhatsApp
          </p>
        </form>
      </main>
    </div>
  )
}

