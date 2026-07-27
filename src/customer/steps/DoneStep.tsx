import { Check } from 'lucide-react'
import type { OrderStatus } from '../../api/types'
import { formatWaitRange } from '../../lib/waitEstimate'
import { OrderStatusTracker } from '../OrderStatusTracker'
import { currency, usdEquiv } from '../utils'

export function DoneStep({
  businessName,
  orderId,
  total,
  orderStatus,
  estimatedWaitMinutes,
  trackingLoading,
  trackingError,
  onOrderMore,
}: {
  businessName: string
  orderId: string | null
  total: number
  orderStatus: OrderStatus
  estimatedWaitMinutes?: number | null
  trackingLoading?: boolean
  trackingError?: string | null
  onOrderMore: () => void
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
    </div>
  )
}
