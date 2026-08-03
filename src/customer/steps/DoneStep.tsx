import { Check } from 'lucide-react'
import type { OrderStatus } from '../../api/types'
import { OrderStatusTracker } from '../OrderStatusTracker'
import { currency, usdEquiv } from '../utils'

export function DoneStep({
  businessName,
  orderId,
  publicId,
  total,
  orderStatus,
  trackingLoading,
  trackingError,
  onOrderMore,
}: {
  businessName: string
  orderId: string | null
  publicId?: string | null
  total: number
  orderStatus: OrderStatus
  trackingLoading?: boolean
  trackingError?: string | null
  onOrderMore: () => void
}) {
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

      <OrderStatusTracker status={orderStatus} loading={trackingLoading} />
      {trackingError ? <div className="cm-error cm-order-track-error">{trackingError}</div> : null}

      <button type="button" className="cm-primary cm-full" onClick={onOrderMore}>
        Order more
      </button>
    </div>
  )
}
