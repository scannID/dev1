import { Loader2 } from 'lucide-react'
import type { OrderStatus } from '../../api/types'
import type { PaymentProvider, PaymentStatus } from '../payments'
import { OrderStatusTracker } from '../OrderStatusTracker'
import { currency, usdEquiv } from '../utils'

export type SplitShareLive = {
  name: string
  phone: string
  amount: number
  splitId?: string
  paymentId?: string
  status: PaymentStatus
  failureReason?: string
}

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 6) return phone
  return `${digits.slice(0, 3)}•••${digits.slice(-3)}`
}

export function WaitingStep({
  businessName,
  paymentReference,
  orderId,
  total,
  provider,
  phone,
  status,
  orderStatus,
  trackingLoading,
  error,
  splitSummary,
  onRetry,
  onChangeNumber,
}: {
  businessName: string
  paymentReference?: string | null
  businessId: string
  orderId: string
  publicId?: string | null
  total: number
  provider: PaymentProvider
  phone: string
  customerName?: string
  status: PaymentStatus
  orderStatus?: OrderStatus
  trackingLoading?: boolean
  error?: string | null
  splitSummary?: SplitShareLive[] | null
  onRetry: () => void
  onChangeNumber: () => void
}) {
  const failed = status === 'FAILED'
  const multi = Boolean(splitSummary && splitSummary.length > 0)
  const paidCount = splitSummary?.filter((s) => s.status === 'PAID').length ?? 0
  const pendingCount = splitSummary?.filter((s) => s.status === 'PENDING').length ?? 0

  return (
    <div className="cm-step cm-step-enter cm-panel cm-waiting">
      <div className={`cm-waiting-icon ${failed ? 'failed' : ''}`}>
        {failed ? (
          <span aria-hidden="true">!</span>
        ) : (
          <Loader2 size={28} className="cm-spin" aria-hidden="true" />
        )}
      </div>

      <h2>
        {failed
          ? multi
            ? 'Some payments failed'
            : 'Payment failed'
          : multi
            ? 'Waiting for all payers'
            : 'Waiting for payment'}
      </h2>
      <p className="cm-muted">
        {failed
          ? multi
            ? 'Retry to re-prompt unpaid shares. Paid shares stay paid.'
            : 'The mobile money request did not complete. You can retry or change the number.'
          : multi
            ? `Each friend should approve their ${provider} prompt. ${paidCount}/${splitSummary!.length} paid`
              + (pendingCount ? ` · ${pendingCount} waiting` : '')
              + '.'
            : `Approve the ${provider} prompt on ${phone || 'your phone'} to pay ${currency(total)} to ${businessName}.`}
      </p>

      {paymentReference ? (
        <p className="cm-ref">
          Kodte payment ref: <strong>{paymentReference}</strong>
          {multi ? ' · all shares settle under this ref' : null}
        </p>
      ) : null}

      <div className="cm-waiting-meta">
        <div>
          <span>Order</span>
          <strong>{orderId}</strong>
        </div>
        <div>
          <span>Amount</span>
          <strong>
            {currency(total)}
            {usdEquiv(total) ? <span className="cm-usd">{usdEquiv(total)}</span> : null}
          </strong>
        </div>
        <div>
          <span>Status</span>
          <strong className={failed ? 'cm-status-failed' : 'cm-status-pending'}>
            {failed ? 'Failed' : multi ? `${paidCount}/${splitSummary!.length}` : 'Pending'}
          </strong>
        </div>
      </div>

      {error ? <div className="cm-error">{error}</div> : null}

      {multi ? (
        <section className="split-pay-panel">
          <h3>Payers</h3>
          <ul>
            {splitSummary!.map((share, index) => (
              <li key={share.splitId ?? `${share.phone}-${index}`} className="split-live-row">
                <div>
                  <strong>{share.name}</strong>
                  <span>
                    {' '}
                    · {maskPhone(share.phone)} · {currency(share.amount)}
                  </span>
                </div>
                <span
                  className={
                    share.status === 'PAID'
                      ? 'split-live-status paid'
                      : share.status === 'FAILED'
                        ? 'split-live-status failed'
                        : 'split-live-status pending'
                  }
                >
                  {share.status === 'PAID'
                    ? 'Paid'
                    : share.status === 'FAILED'
                      ? (share.failureReason ?? 'Failed')
                      : 'Prompt sent'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!failed ? (
        <p className="cm-hint">
          {multi
            ? 'Keep this screen open while friends approve. The order marks paid when every share clears.'
            : 'Order is placed and awaiting payment confirmation. Keep this screen open — we’ll update when the prompt is approved.'}
        </p>
      ) : null}

      {orderStatus ? (
        <OrderStatusTracker status={orderStatus} loading={trackingLoading} />
      ) : null}

      <div className="cm-waiting-actions">
        {failed ? (
          <button type="button" className="cm-primary cm-full" onClick={onRetry}>
            {multi ? 'Retry unpaid shares' : 'Try again'}
          </button>
        ) : null}
      </div>
    </div>
  )
}
