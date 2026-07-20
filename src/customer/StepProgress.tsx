import type { CheckoutStep } from './session'

const FLOW: Array<{ id: CheckoutStep; label: string }> = [
  { id: 'menu', label: 'Menu' },
  { id: 'cart', label: 'Cart' },
  { id: 'details', label: 'Details' },
  { id: 'pay', label: 'Pay' },
]

const ORDER: CheckoutStep[] = ['menu', 'cart', 'details', 'pay', 'waiting', 'done']

function indexOf(step: CheckoutStep) {
  if (step === 'waiting' || step === 'done') return FLOW.length - 1
  return FLOW.findIndex((s) => s.id === step)
}

export function StepProgress({ step }: { step: CheckoutStep }) {
  if (step === 'waiting' || step === 'done') return null

  const current = indexOf(step)

  return (
    <nav className="cm-progress" aria-label="Checkout progress">
      {FLOW.map((item, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo'
        return (
          <div key={item.id} className={`cm-progress-item ${state}`}>
            <span className="cm-progress-dot" aria-hidden="true" />
            <span className="cm-progress-label">{item.label}</span>
            {i < FLOW.length - 1 && <span className="cm-progress-line" aria-hidden="true" />}
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
