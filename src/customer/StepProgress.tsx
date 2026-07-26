import type { CheckoutStep } from './session'

type FlowVariant = 'food' | 'stay'

const FOOD_FLOW: Array<{ id: CheckoutStep; label: string }> = [
  { id: 'menu', label: 'Menu' },
  { id: 'cart', label: 'Cart' },
  { id: 'details', label: 'Details' },
  { id: 'pay', label: 'Pay' },
]

const STAY_FLOW: Array<{ id: CheckoutStep; label: string }> = [
  { id: 'menu', label: 'Stay' },
  { id: 'cart', label: 'Cart' },
  { id: 'details', label: 'Guest' },
  { id: 'pay', label: 'Pay' },
]

const ORDER: CheckoutStep[] = ['menu', 'cart', 'details', 'pay', 'waiting', 'done']

function flowFor(variant: FlowVariant) {
  return variant === 'stay' ? STAY_FLOW : FOOD_FLOW
}

function indexOf(step: CheckoutStep, variant: FlowVariant) {
  const flow = flowFor(variant)
  if (step === 'waiting' || step === 'done') return flow.length - 1
  return flow.findIndex((s) => s.id === step)
}

export function StepProgress({
  step,
  variant = 'food',
}: {
  step: CheckoutStep
  variant?: FlowVariant
}) {
  if (step === 'waiting' || step === 'done') return null

  const flow = flowFor(variant)
  const current = indexOf(step, variant)

  return (
    <nav className="cm-progress" aria-label="Checkout progress">
      {flow.map((item, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo'
        return (
          <div key={item.id} className={`cm-progress-item ${state}`}>
            <span className="cm-progress-dot" aria-hidden="true" />
            <span className="cm-progress-label">{item.label}</span>
            {i < flow.length - 1 && <span className="cm-progress-line" aria-hidden="true" />}
          </div>
        )
      })}
    </nav>
  )
}

export function canGoBack(step: CheckoutStep) {
  return ORDER.indexOf(step) > 0 && step !== 'waiting' && step !== 'done'
}

export function previousStep(step: CheckoutStep): CheckoutStep {
  const i = ORDER.indexOf(step)
  if (i <= 0) return 'menu'
  if (step === 'waiting') return 'pay'
  return ORDER[i - 1]
}
