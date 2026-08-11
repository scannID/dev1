import { BedDouble, CalendarCheck, ArrowRight, Loader2 } from 'lucide-react'
import type { PaymentProvider, PaymentStatus } from '../payments'
import { currency, usdEquiv } from '../utils'

export function StayBookedStep({
  businessName,
  orderId,
  total,
  provider,
  phone,
  status,
  checkInDate,
  checkOutDate,
  nights,
  roomName,
  error,
  onRetry,
  onChangeNumber,
  onDone,
}: {
  businessName: string
  orderId: string
  total: number
  provider: PaymentProvider
  phone: string
  status: PaymentStatus
  checkInDate?: string | null
  checkOutDate?: string | null
  nights?: number | null
  roomName?: string | null
  error?: string | null
  onRetry: () => void
  onChangeNumber: () => void
  onDone: () => void
}) {
  const failed = status === 'FAILED'
  const confirmed = status === 'PAID'

  function fmt(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div className="cm-step cm-step-enter cm-panel cm-done">
      {/* Icon */}
      <div className={`cm-done-icon${failed ? ' failed' : ''}`}>
        {failed ? (
          <span aria-hidden="true">!</span>
        ) : confirmed ? (
          <BedDouble size={28} />
        ) : (
          <Loader2 size={28} className="cm-spin" aria-hidden="true" />
        )}
      </div>

      <h2>
        {failed
          ? 'Payment failed'
          : confirmed
            ? 'Booking confirmed'
            : 'Waiting for payment'}
      </h2>

      <p className="cm-muted">
        {failed
          ? 'The mobile money request did not complete. You can retry or change the number.'
          : confirmed
            ? `Your stay at ${businessName} is confirmed. See you soon!`
            : `Approve the ${provider} prompt on ${phone || 'your phone'} to confirm your booking.`}
      </p>

      {/* Booking summary card */}
      {(checkInDate || checkOutDate || roomName) && (
        <div
          style={{
            margin: '16px 0',
            padding: '14px 16px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--muted)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {roomName && (
            <div style={{ fontWeight: 600, fontSize: 15 }}>{roomName}</div>
          )}
          {checkInDate && checkOutDate && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                color: 'var(--muted-foreground)',
              }}
            >
              <CalendarCheck size={14} />
              <span>{fmt(checkInDate)}</span>
              <ArrowRight size={12} />
              <span>{fmt(checkOutDate)}</span>
              {nights ? (
                <span style={{ marginLeft: 4, fontWeight: 500, color: 'var(--foreground)' }}>
                  {nights} night{nights === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
          )}
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--muted-foreground)' }}>
            {orderId} ·{' '}
            <strong style={{ color: 'var(--foreground)' }}>
              {currency(total)}
              {usdEquiv(total) ? <span className="cm-usd">{usdEquiv(total)}</span> : null}
            </strong>
          </div>
        </div>
      )}

      {error && <div className="cm-error">{error}</div>}

      {!confirmed && !failed && (
        <p className="cm-hint">
          Keep this screen open — we'll update as soon as the prompt is approved.
        </p>
      )}

      <div className="cm-waiting-actions" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {failed && (
          <>
            <button type="button" className="cm-primary cm-full" onClick={onRetry}>
              Try again
            </button>
            <button
              type="button"
              className="cm-ghost-btn cm-full"
              style={{ justifyContent: 'center' }}
              onClick={onChangeNumber}
            >
              Change number
            </button>
          </>
        )}
        {confirmed && (
          <button type="button" className="cm-primary cm-full" onClick={onDone}>
            Done
          </button>
        )}
      </div>
    </div>
  )
}
