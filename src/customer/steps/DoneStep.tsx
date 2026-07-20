import { Check } from 'lucide-react'
import { currency } from '../utils'

export function DoneStep({
  businessName,
  orderId,
  total,
  onOrderMore,
}: {
  businessName: string
  orderId: string | null
  total: number
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
      <p className="cm-done-total">{currency(total)}</p>
      <button type="button" className="cm-primary cm-full" onClick={onOrderMore}>
        Order more
      </button>
    </div>
  )
}
