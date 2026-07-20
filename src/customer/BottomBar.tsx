import { ChevronRight } from 'lucide-react'
import { currency } from './utils'

export function BottomBar({
  count,
  total,
  label,
  onAction,
  disabled,
}: {
  count: number
  total: number
  label: string
  onAction: () => void
  disabled?: boolean
}) {
  return (
    <div className="cm-bottom-bar">
      <div>
        <span>
          {count} item{count === 1 ? '' : 's'}
        </span>
        <strong>{currency(total)}</strong>
      </div>
      <button type="button" className="cm-primary" disabled={disabled} onClick={onAction}>
        {label} <ChevronRight size={16} />
      </button>
    </div>
  )
}
