import type { Business } from '../../api/types'

export function DetailsStep({
  business,
  customerName,
  customerLocation,
  customerNote,
  nameError,
  onName,
  onLocation,
  onNote,
}: {
  business: Business
  customerName: string
  customerLocation: string
  customerNote: string
  nameError?: string | null
  onName: (value: string) => void
  onLocation: (value: string) => void
  onNote: (value: string) => void
}) {
  return (
    <div className="cm-step cm-step-enter cm-panel">
      <h2>Your details</h2>
      <p className="cm-muted">So {business.name} can find your order</p>

      <label className="cm-field">
        Your name
        <input
          value={customerName}
          onChange={(e) => onName(e.target.value)}
          placeholder="e.g. Jane"
          autoComplete="name"
          aria-invalid={Boolean(nameError)}
        />
        {nameError ? <span className="cm-field-error">{nameError}</span> : null}
      </label>

      <label className="cm-field">
        {business.tableLabel || 'Table / location'}
        <input
          value={customerLocation}
          onChange={(e) => onLocation(e.target.value)}
          placeholder="Table 4, counter…"
        />
      </label>

      <label className="cm-field">
        Note <span className="cm-optional">(optional)</span>
        <input
          value={customerNote}
          onChange={(e) => onNote(e.target.value)}
          placeholder="No onions, extra sauce…"
        />
      </label>
    </div>
  )
}
