import { Loader2 } from 'lucide-react'
import type { PaymentProvider, PaymentStatus } from '../payments'
import { currency } from '../utils'

export function WaitingStep({
  businessName,
  orderId,
  total,
  provider,
  phone,
  status,
  error,
  onRetry,
  onChangeNumber,
}: {
  businessName: string
  orderId: string
  total: number
  provider: PaymentProvider
  phone: string
  status: PaymentStatus
  error?: string | null
  onRetry: () => void
  onChangeNumber: () => void
}) {
  const failed = status === 'FAILED'

  return (
    <div className="cm-step cm-step-enter cm-panel cm-waiting">
      <div className={`cm-waiting-icon ${failed ? 'failed' : ''}`}>
        {failed ? (
          <span aria-hidden="true">!</span>
        ) : (
          <Loader2 size={28} className="cm-spin" aria-hidden="true" />
        )}
      </div>

      <h2>{failed ? 'Payment failed' : 'Waiting for payment'}</h2>
      <p className="cm-muted">
        {failed
          ? 'The mobile money request did not complete. You can retry or change the number.'
          : `Approve the ${provider} prompt on ${phone || 'your phone'} to pay ${currency(total)} to ${businessName}.`}
      </p>

      <div className="cm-waiting-meta">
        <div>
          <span>Order</span>
          <strong>{orderId}</strong>
        </div>
        <div>
          <span>Amount</span>
          <strong>{currency(total)}</strong>
        </div>
        <div>
          <span>Status</span>
          <strong className={failed ? 'cm-status-failed' : 'cm-status-pending'}>
            {failed ? 'Failed' : 'Pending'}
          </strong>
        </div>
      </div>

      {error ? <div className="cm-error">{error}</div> : null}

      {!failed ? (
        <p className="cm-hint">
          Order is placed and awaiting payment confirmation. Keep this screen open — we’ll update when the prompt is
          approved.
        </p>
      ) : null}

      <div className="cm-waiting-actions">
        {failed ? (
          <button type="button" className="cm-primary cm-full" onClick={onRetry}>
            Try again
          </button>
        ) : null}
        <button type="button" className="cm-ghost-btn cm-full-btn" onClick={onChangeNumber}>
          Change number
        </button>
      </div>
    </div>
  )
}
