import { Check, Circle, Clock, ChefHat, BellRing, PackageCheck, XCircle } from 'lucide-react'
import type { OrderStatus } from '../api/types'

const FLOW: Array<{ status: OrderStatus; label: string; hint: string }> = [
  { status: 'Pending', label: 'Order received', hint: 'Your order has been sent to the kitchen.' },
  { status: 'Preparing', label: 'Preparing', hint: 'The team is working on your order.' },
  { status: 'Ready', label: 'Ready', hint: 'Your order is ready for pickup or delivery.' },
  { status: 'Completed', label: 'Completed', hint: 'Enjoy — thanks for ordering!' },
]

function stepIndex(status: OrderStatus) {
  if (status === 'Cancelled') return -1
  const idx = FLOW.findIndex((step) => step.status === status)
  return idx >= 0 ? idx : 0
}

function StepIcon({ status, state }: { status: OrderStatus; state: 'done' | 'current' | 'todo' }) {
  const size = 16
  if (state === 'done') return <Check size={size} aria-hidden="true" />
  if (state === 'current') {
    switch (status) {
      case 'Pending':
        return <Clock size={size} aria-hidden="true" />
      case 'Preparing':
        return <ChefHat size={size} aria-hidden="true" />
      case 'Ready':
        return <BellRing size={size} aria-hidden="true" />
      case 'Completed':
        return <PackageCheck size={size} aria-hidden="true" />
      default:
        return <Circle size={size} aria-hidden="true" />
    }
  }
  return <Circle size={size} aria-hidden="true" />
}

export function OrderStatusTracker({
  status,
  loading,
}: {
  status: OrderStatus
  loading?: boolean
}) {
  if (status === 'Cancelled') {
    return (
      <div className="cm-order-track cm-order-track-cancelled" role="status">
        <div className="cm-order-track-cancelled-icon">
          <XCircle size={22} aria-hidden="true" />
        </div>
        <strong>Order cancelled</strong>
        <p className="cm-muted">This order is no longer active.</p>
      </div>
    )
  }

  const current = stepIndex(status)

  return (
    <div className="cm-order-track" aria-live="polite" aria-busy={loading || undefined}>
      <p className="cm-order-track-title">Order status</p>
      <ol className="cm-order-track-steps">
        {FLOW.map((step, i) => {
          const state = i < current ? 'done' : i === current ? 'current' : 'todo'
          return (
            <li key={step.status} className={`cm-order-track-step ${state}`}>
              <span className="cm-order-track-dot" aria-hidden="true">
                <StepIcon status={step.status} state={state} />
              </span>
              <div className="cm-order-track-copy">
                <strong>{step.label}</strong>
                {state === 'current' ? <span>{step.hint}</span> : null}
              </div>
            </li>
          )
        })}
      </ol>
      {loading ? <p className="cm-order-track-live cm-muted">Updating…</p> : null}
    </div>
  )
}
