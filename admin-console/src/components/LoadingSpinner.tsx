import { Loader2 } from 'lucide-react'

type LoadingSpinnerProps = {
  label?: string
  size?: number
  fullPage?: boolean
  className?: string
}

/** Consistent loading indicator for the admin console. */
export function LoadingSpinner({
  label,
  size = 28,
  fullPage = false,
  className = '',
}: LoadingSpinnerProps) {
  const body = (
    <div className={`admin-loading ${className}`.trim()} role="status" aria-live="polite">
      <Loader2 size={size} className="admin-spin" aria-hidden="true" />
      {label ? <p className="admin-loading-label">{label}</p> : <span className="sr-only">Loading</span>}
    </div>
  )

  if (!fullPage) return body

  return <div className="admin-loading-page">{body}</div>
}

export function InlineSpinner({ size = 14, label }: { size?: number; label?: string }) {
  return (
    <span className="admin-loading admin-loading-inline" role="status" aria-live="polite">
      <Loader2 size={size} className="admin-spin" aria-hidden="true" />
      {label ? <span>{label}</span> : <span className="sr-only">Loading</span>}
    </span>
  )
}

export default LoadingSpinner
