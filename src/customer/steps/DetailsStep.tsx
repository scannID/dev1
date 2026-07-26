import type { Business } from '../../api/types'

export function DetailsStep({
  business,
  mode = 'food',
  customerName,
  customerLocation,
  customerNote,
  nameError,
  locationError,
  onName,
  onLocation,
  onNote,
}: {
  business: Business
  mode?: 'food' | 'stay'
  customerName: string
  customerLocation: string
  customerNote: string
  nameError?: string | null
  locationError?: string | null
  onName: (value: string) => void
  onLocation: (value: string) => void
  onNote: (value: string) => void
}) {
  const isStay = mode === 'stay'
  const locationLabel = business.tableLabel || 'Table / location'

  return (
    <div className="cm-step cm-step-enter cm-panel">
      <h2>{isStay ? 'Guest details' : 'Your details'}</h2>
      <p className="cm-muted">
        {isStay
          ? `So ${business.name} knows who the stay is for`
          : `So ${business.name} can find your order`}
      </p>

      <label className="cm-field">
        {isStay ? 'Guest name' : 'Your name'}
        <input
          value={customerName}
          onChange={(e) => onName(e.target.value)}
          placeholder={isStay ? 'e.g. Jane Okello' : 'e.g. Jane'}
          autoComplete="name"
          required
          aria-required="true"
          aria-invalid={Boolean(nameError)}
        />
        {nameError ? <span className="cm-field-error">{nameError}</span> : null}
      </label>

      {!isStay ? (
        <label className="cm-field">
          {locationLabel}
          <input
            value={customerLocation}
            onChange={(e) => onLocation(e.target.value)}
            placeholder="Table 4, counter…"
            required
            aria-required="true"
            aria-invalid={Boolean(locationError)}
          />
          {locationError ? <span className="cm-field-error">{locationError}</span> : null}
        </label>
      ) : null}

      <label className="cm-field">
        Note <span className="cm-optional">(optional)</span>
        <input
          value={customerNote}
          onChange={(e) => onNote(e.target.value)}
          placeholder={isStay ? 'Early check-in, extra pillows…' : 'No onions, extra sauce…'}
        />
      </label>
    </div>
  )
}
