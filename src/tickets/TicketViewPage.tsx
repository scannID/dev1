import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { Check, Mail } from 'lucide-react'
import { publicTicketsApi } from '../api/services'
import type { AttendeeTicketView } from '../api/types'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { TicketRenderer, type EventTicketVisual } from '../EventTicket'
import { ScannyMark } from '../customer/ScannyMark'
import '../customer/CustomerApp.css'

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

export default function TicketViewPage({ accessToken }: Props) {
  const [ticket, setTicket] = useState<AttendeeTicketView | null>(null)
  const [qr, setQr] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.documentElement.classList.add('cm-app')
    return () => document.documentElement.classList.remove('cm-app')
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const data = await publicTicketsApi.view(accessToken)
        if (cancelled) return
        setTicket(data)
        if (data.paymentStatus === 'Paid') {
          const payload = data.viewUrl || data.id
          const url = await QRCode.toDataURL(payload, {
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
    const dateIso = ticket.eventDate
    const date = dateIso ? dateIso.slice(0, 10) : ''
    return {
      eventName: ticket.eventName,
      date,
      time,
      location,
      paymentDetails: payTo,
      template: parseTemplate(ticket.template),
      ticketClasses: [{ id: '1', name: ticket.ticketType, fee: String(ticket.price) }],
      tables: [],
      ticketId: ticket.id,
      selectedClass: ticket.ticketType,
    }
  }, [ticket])

  if (loading) {
    return (
      <div className="cm-page cm-centered cm-boot">
        <LoadingSpinner fullPage label="Loading ticket…" />
      </div>
    )
  }

  if (error || !ticket || !visual) {
    return (
      <div className="cm-page">
        <div className="cm-step cm-panel" style={{ margin: 16 }}>
          <h2>Ticket unavailable</h2>
          <p className="cm-error" role="alert">{error ?? 'Not found'}</p>
        </div>
      </div>
    )
  }

  const paid = ticket.paymentStatus === 'Paid'

  return (
    <div className="cm-page">
      <header className="cm-topbar">
        <div className="cm-brand">
          <ScannyMark size={28} />
          <div>
            <strong>Scanny</strong>
            <span className="cm-muted" style={{ display: 'block', fontSize: 12 }}>
              {paid ? 'Your ticket' : 'Payment pending'}
            </span>
          </div>
        </div>
      </header>

      <div className="cm-step cm-step-enter cm-panel cm-done" style={{ margin: 16, marginBottom: 12 }}>
        <div className="cm-done-icon">
          <Check size={28} />
        </div>
        <h2>{paid ? 'Payment confirmed' : 'Awaiting payment'}</h2>
        <p className="cm-muted">
          {ticket.eventName}
          {ticket.holderName ? ` · ${ticket.holderName}` : ''}
        </p>
        <p className="cm-done-total">{money(ticket.price, ticket.currency)}</p>

        {paid ? (
          <div className="cm-wait-estimate" role="status" style={{ marginTop: 8, alignItems: 'center', justifyContent: 'flex-start' }}>
            <Mail size={16} aria-hidden style={{ flexShrink: 0, color: 'var(--cm-orange)' }} />
            <span>
              Ticket emailed to <strong style={{ fontSize: 14 }}>{ticket.holderEmail}</strong>
            </span>
          </div>
        ) : (
          <div className="cm-error" role="alert" style={{ marginTop: 12 }}>
            Payment is still pending. Complete Mobile Money approval to finish this purchase.
          </div>
        )}
      </div>

      {paid ? (
        <div className="cm-receipt-detail" style={{ padding: '0 16px 24px' }}>
          <div className="cm-receipt-paper">
            <div className="cm-receipt-paper-head">
              <ScannyMark size={28} />
              <div>
                <p className="cm-receipt-paper-label">Event ticket</p>
                <h3>{ticket.eventName}</h3>
                <p className="cm-muted">{ticket.ticketType}</p>
              </div>
            </div>

            <div className="cm-receipt-paper-meta">
              <div>
                <span>Guest</span>
                <strong>{ticket.holderName || '—'}</strong>
              </div>
              <div>
                <span>Email</span>
                <strong>{ticket.holderEmail}</strong>
              </div>
              <div>
                <span>Ticket ID</span>
                <strong>{ticket.id}</strong>
              </div>
              <div>
                <span>Amount</span>
                <strong>{money(ticket.price, ticket.currency)}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', overflowX: 'auto', padding: '8px 0 4px' }}>
              <div style={{ transform: 'scale(0.72)', transformOrigin: 'top center', marginBottom: -80 }}>
                <TicketRenderer d={visual} qr={qr} />
              </div>
            </div>

            <p className="cm-muted" style={{ textAlign: 'center', fontSize: 12, marginTop: 12 }}>
              Show this QR at entry. A copy is also in your email.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
