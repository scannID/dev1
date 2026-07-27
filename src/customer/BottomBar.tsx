import { ChevronRight, Loader2 } from 'lucide-react'
import { currency, usdEquiv } from './utils'

export function BottomBar({
  count,
  total,
  label,
  onAction,
  disabled,
  loading,
}: {
  count: number
  total: number
  label: string
  onAction: () => void
  disabled?: boolean
  loading?: boolean
}) {
  return (
    <div className="cm-bottom-bar">
      <div>
        <span>
          {count} item{count === 1 ? '' : 's'}
        </span>
        <strong>{currency(total)}{usdEquiv(total) ? <span className="cm-usd">{usdEquiv(total)}</span> : null}</strong>
      </div>
      <button type="button" className="cm-primary" disabled={disabled || loading} onClick={onAction}>
        {loading ? (
          <>
            <Loader2 size={16} className="cm-spin" aria-hidden="true" />
            {label}
          </>
        ) : (
          <>
            {label} <ChevronRight size={16} />
          </>
        )}
      </button>
    </div>
  )
}
