import { X } from 'lucide-react'
import type { CustomerOrderTracking } from '../api/types'
import { OrderStatusTracker } from './OrderStatusTracker'
import { currency } from './utils'

export function OrderTrackingPanel({
  open,
  order,
  loading,
  error,
  onClose,
}: {
  open: boolean
  order: CustomerOrderTracking | null
  loading?: boolean
  error?: string | null
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div className="cm-track-overlay" role="dialog" aria-modal="true" aria-label="Order tracking">
      <button type="button" className="cm-track-backdrop" aria-label="Close tracking" onClick={onClose} />
      <div className="cm-track-sheet">
        <div className="cm-track-sheet-header">
          <div>
            <h2>Your order</h2>
            <p className="cm-muted">{order?.businessName ?? 'Live status updates'}</p>
          </div>
          <button type="button" className="cm-track-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {order ? (
          <div className="cm-track-meta">
            <div>
              <span>Order</span>
              <strong>{order.id}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{currency(order.total)}</strong>
            </div>
            <div>
              <span>Payment</span>
              <strong>{order.paymentStatus}</strong>
            </div>
          </div>
        ) : null}

        <OrderStatusTracker status={order?.status ?? 'Pending'} loading={loading} />
        {error ? <div className="cm-error">{error}</div> : null}
        {!order && !loading ? (
          <p className="cm-muted cm-track-hint">We could not load your order yet. Try again in a moment.</p>
        ) : null}
      </div>
    </div>
  )
}
