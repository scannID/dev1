import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { publicTicketsApi } from '../api/services'
import type { AttendeeTicketView } from '../api/types'
import { LoadingSpinner } from '../components/LoadingSpinner'

type Props = { accessToken: string }

function money(amount: number, currency: string) {
  return `${amount.toLocaleString()} ${currency}`
}

export default function TicketViewPage({ accessToken }: Props) {
  const [ticket, setTicket] = useState<AttendeeTicketView | null>(null)
  const [qr, setQr] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const data = await publicTicketsApi.view(accessToken)
        if (cancelled) return
        setTicket(data)
        if (data.paymentStatus === 'Paid' && data.canBeUsed) {
          const url = await QRCode.toDataURL(data.qrToken, {
            width: 260,
            margin: 1,
            color: { dark: '#0d1612', light: '#ffffff' },
          })
          if (!cancelled) setQr(url)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Ticket not found')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [accessToken])

  if (loading) {
    return (
      <div className="scanny-page">
        <LoadingSpinner fullPage label="Loading ticket…" />
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="scanny-page">
        <div className="scanny-page-narrow">
          <div className="scanny-card">
            <h1 className="scanny-title">Ticket unavailable</h1>
            <p className="scanny-error" role="alert">{error ?? 'Not found'}</p>
          </div>
        </div>
      </div>
    )
  }

  const paid = ticket.paymentStatus === 'Paid'
  const used = ticket.status === 'Redeemed'

  return (
    <div className="scanny-page">
      <div className="scanny-page-narrow">
        <div className="scanny-card">
          <p className="scanny-eyebrow">{ticket.ticketType}</p>
          <h1 className="scanny-title">{ticket.eventName}</h1>
          <p className="scanny-sub">
            Admits: <strong>{ticket.holderName}</strong>
          </p>
          <p className="scanny-hint">{money(ticket.price, ticket.currency)} · {ticket.holderEmail}</p>

          {!paid ? (
            <p className="scanny-error" role="alert" style={{ marginTop: 16 }}>
              Payment pending. Complete payment to reveal your entry QR.
            </p>
          ) : used || !ticket.canBeUsed ? (
            <p className="scanny-hint" style={{ marginTop: 16 }}>
              This ticket has already been used or is no longer valid.
            </p>
          ) : qr ? (
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <img src={qr} alt="Entry QR code" style={{ width: 260, height: 260, borderRadius: 12 }} />
              <p className="scanny-hint" style={{ marginTop: 12 }}>
                Show this at the gate. Single entry — works once only.
              </p>
              <p className="scanny-hint scanny-mono" style={{ fontSize: 11 }}>
                {ticket.id}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
