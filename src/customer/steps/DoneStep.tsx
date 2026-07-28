import { Check } from 'lucide-react'
import type { OrderStatus } from '../../api/types'
import { formatWaitRange } from '../../lib/waitEstimate'
import { OrderStatusTracker } from '../OrderStatusTracker'
import { OrderFeedbackForm } from '../OrderFeedbackForm'
import { SplitPayPanel } from '../SplitPayPanel'
import { currency, usdEquiv } from '../utils'
import type { PaymentProvider } from '../payments'

export function DoneStep({
  businessName,
  orderId,
  publicId,
  businessId,
  total,
  orderStatus,
  estimatedWaitMinutes,
  trackingLoading,
  trackingError,
  onOrderMore,
  phone,
  customerName,
  provider,
}: {
  businessName: string
  orderId: string | null
  publicId?: string | null
  businessId?: string
  total: number
  orderStatus: OrderStatus
  estimatedWaitMinutes?: number | null
  trackingLoading?: boolean
  trackingError?: string | null
  onOrderMore: () => void
  phone?: string
  customerName?: string
  provider?: PaymentProvider
}) {
  const waitLabel =
    orderStatus === 'Pending' || orderStatus === 'Preparing'
      ? formatWaitRange(estimatedWaitMinutes)
      : null

  return (
    <div className="cm-step cm-step-enter cm-panel cm-done">
      <div className="cm-done-icon">
        <Check size={28} />
      </div>
      <h2>Payment confirmed</h2>
      <p className="cm-muted">
        {businessName} has your paid order
        {orderId ? ` (${orderId})` : ''}.
      </p>
      <p className="cm-done-total">{currency(total)}{usdEquiv(total) ? <span className="cm-usd">{usdEquiv(total)}</span> : null}</p>

      {waitLabel ? (
        <div className="cm-wait-estimate" role="status">
          <span>Est. ready in</span>
          <strong>{waitLabel}</strong>
        </div>
      ) : null}

      <OrderStatusTracker status={orderStatus} loading={trackingLoading} />
      {trackingError ? <div className="cm-error cm-order-track-error">{trackingError}</div> : null}

      <button type="button" className="cm-primary cm-full" onClick={onOrderMore}>
        Order more
      </button>
      {publicId && businessId && phone ? (
        <SplitPayPanel
          publicId={publicId}
          businessId={businessId}
          phone={phone}
          customerName={customerName}
          provider={provider}
        />
      ) : null}
      {publicId && phone ? (
        <OrderFeedbackForm publicId={publicId} phone={phone} />
      ) : null}
    </div>
  )
}
