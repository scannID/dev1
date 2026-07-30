import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import QRCode from 'qrcode'
import { Check, Clock } from 'lucide-react'
import { publicTicketsApi } from '../api/services'
import type { AttendeeTicketView } from '../api/types'
import { TicketRenderer, type EventTicketVisual } from '../EventTicket'
import { KodeMark } from '../customer/KodeMark'
import { MusicInstrumentLoader } from './MusicInstrumentLoader'
import { buildTicketGateUrl } from '../lib/scanBase'
import './TicketCustomer.css'

type Props = { accessToken: string }

function money(amount: number, currency: string) {
  return `${amount.toLocaleString()} ${currency}`
}

function parseTemplate(raw: string | null | undefined): EventTicketVisual['template'] {
  if (raw === 'festival' || raw === 'minimal' || raw === 'classic' || raw === 'gold') return raw
  return 'classic'
}

function parseMeta(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/** Scales the fixed-width TicketRenderer to the frame width (no cqw — avoids scale(0)). */
function TicketPassFrame({ children }: { children: ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [innerH, setInnerH] = useState(360)

  useLayoutEffect(() => {
    const frame = frameRef.current
    const inner = innerRef.current
    if (!frame || !inner) return

    const measure = () => {
      const frameW = frame.clientWidth
      const naturalH = inner.scrollHeight || 360
      const nextScale = frameW > 0 ? Math.min(1, frameW / 520) : 1
      setScale(nextScale > 0 ? nextScale : 1)
      setInnerH(naturalH)
    }

    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(frame)
    ro?.observe(inner)
    window.addEventListener('resize', measure)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  return (
    <div
      ref={frameRef}
      className="tk-pass-frame"
      style={{ height: Math.max(1, innerH * scale) }}
    >
      <div
        ref={innerRef}
        className="tk-pass-scale"
        style={{ transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  )
}

export default function TicketViewPage({ accessToken }: Props) {
  const [ticket, setTicket] = useState<AttendeeTicketView | null>(null)
  const [qr, setQr] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        const data = await publicTicketsApi.view(accessToken)
        const remaining = Math.max(0, 700 - (Date.now() - started))
        if (remaining > 0) await new Promise((r) => setTimeout(r, remaining))
        if (cancelled) return
        setTicket(data)
        if (data.paymentStatus === 'Paid') {
          const gateLink = buildTicketGateUrl(
            data.qrPayload || data.gateUrl || data.viewUrl || data.qrToken || data.id,
          )
          const url = await QRCode.toDataURL(gateLink, {
            width: 260,
            margin: 1,
            color: { dark: '#0d1612', light: '#ffffff' },
          })
          if (!cancelled) setQr(url)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Receipt not found')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [accessToken])

  const visual = useMemo((): Partial<EventTicketVisual> | null => {
    if (!ticket) return null
    const meta = parseMeta(ticket.metadata)
    const payTo = typeof meta.payTo === 'string' ? meta.payTo : ''
    const location = typeof meta.location === 'string' ? meta.location : ''
    const time = typeof meta.time === 'string' ? meta.time : ''
    const host = typeof meta.host === 'string' ? meta.host : ''
    const eventImageUrl = typeof meta.eventImageUrl === 'string' ? meta.eventImageUrl : undefined
    const dateIso = ticket.eventDate
    const date = dateIso ? dateIso.slice(0, 10) : ''
    return {
      eventName: ticket.eventName,
      date,
      time,
      location,
      host,
      paymentDetails: payTo,
      template: parseTemplate(ticket.template),
      ticketClasses: [{ id: '1', name: ticket.ticketType, fee: String(ticket.price) }],
      tables: [],
      ticketId: ticket.id,
      selectedClass: ticket.ticketType,
      eventImageUrl,
    }
  }, [ticket])

  if (loading) {
    return (
      <div className="tk-shell tk-centered tk-boot">
        <MusicInstrumentLoader />
      </div>
    )
  }

  if (error || !ticket || !visual) {
    return (
      <div className="tk-shell tk-centered">
        <div className="tk-panel tk-empty tk-enter">
          <p className="tk-hero-kicker">Kode</p>
          <h2>Ticket unavailable</h2>
          <p className="tk-error" role="alert" style={{ textAlign: 'left' }}>
            {error ?? 'Not found'}
          </p>
        </div>
      </div>
    )
  }

  const paid = ticket.paymentStatus === 'Paid'

  return (
    <div className="tk-shell">
      <header className="tk-topbar">
        <div className="tk-brand">
          <KodeMark size={28} />
          <div>
            <strong>Kode</strong>
            <span>{visual.host?.trim() || ticket.holderName || 'Hosted event'}</span>
          </div>
        </div>
      </header>

      <main className="tk-main">
        <header className="tk-hero tk-enter">
          {visual.eventImageUrl ? (
            <div className="tk-hero-art">
              <img src={visual.eventImageUrl} alt="" />
            </div>
          ) : null}
          <p className="tk-hero-kicker">{paid ? 'Entry pass' : 'Almost there'}</p>
          <h1>{ticket.eventName}</h1>
          <p className="tk-hero-meta">
            {ticket.ticketType}
            {ticket.holderName ? ` · ${ticket.holderName}` : ''}
          </p>
        </header>

        <div className="tk-status-row tk-enter">
          {paid ? (
            <span className="tk-pill tk-pill-ok">
              <Check size={14} strokeWidth={2.5} aria-hidden />
              Paid
            </span>
          ) : (
            <span className="tk-pill tk-pill-pending">
              <Clock size={14} strokeWidth={2.5} aria-hidden />
              Pending
            </span>
          )}
          {paid ? (
            <p className="tk-status-note">
              Sent via WhatsApp to <strong>{ticket.holderPhone || '—'}</strong>
            </p>
          ) : (
            <p className="tk-status-note">
              Complete the Mobile Money approval on your phone to unlock this pass.
            </p>
          )}
        </div>

        {paid ? (
          <div className="tk-enter">
            <TicketPassFrame>
              <TicketRenderer d={visual} qr={qr} />
            </TicketPassFrame>

            <div className="tk-pass-meta">
              <div>
                <span>Guest</span>
                <strong>{ticket.holderName || '—'}</strong>
              </div>
              <div>
                <span>Amount</span>
                <strong>{money(ticket.price, ticket.currency)}</strong>
              </div>
            </div>

            <p className="tk-foot-note">Show this QR at entry. A copy is also in your email.</p>
          </div>
        ) : (
          <div className="tk-panel tk-wait tk-enter">
            <div className="tk-wait-ring" aria-hidden>
              <Clock size={28} color="var(--tk-gold-bright)" strokeWidth={1.75} />
            </div>
            <h2>Waiting for payment</h2>
            <p>
              Approve the prompt on your phone. This page updates automatically when payment
              clears.
            </p>
            <p className="tk-ref">Ticket {ticket.id}</p>
          </div>
        )}
      </main>
    </div>
  )
}
