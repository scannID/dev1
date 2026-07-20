import { Loader2 } from 'lucide-react'

type LoadingSpinnerProps = {
  label?: string
  size?: number
  fullPage?: boolean
  className?: string
}

/** Consistent loading indicator for merchant + customer surfaces. */
export function LoadingSpinner({
  label,
  size = 28,
  fullPage = false,
  className = '',
}: LoadingSpinnerProps) {
  const body = (
    <div className={`scanny-loading ${className}`.trim()} role="status" aria-live="polite">
      <Loader2 size={size} className="scanny-spin" aria-hidden="true" />
      {label ? <p className="scanny-loading-label">{label}</p> : <span className="sr-only">Loading</span>}
    </div>
  )

  if (!fullPage) return body

  return (
    <div className="scanny-loading-page">
      {body}
    </div>
  )
}

export function InlineSpinner({ size = 14, label }: { size?: number; label?: string }) {
  return (
    <span className="scanny-loading scanny-loading-inline" role="status" aria-live="polite">
      <Loader2 size={size} className="scanny-spin" aria-hidden="true" />
      {label ? <span>{label}</span> : <span className="sr-only">Loading</span>}
    </span>
  )
}

export default LoadingSpinner
