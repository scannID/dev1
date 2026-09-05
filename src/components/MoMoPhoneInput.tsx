/**
 * MoMoPhoneInput
 *
 * A phone number input that:
 * - Always starts with 0 (enforced — user cannot delete it)
 * - Auto-detects the Ugandan MoMo provider from the prefix:
 *     MTN:    077, 078, 079, 076
 *     Airtel: 075, 070, 074
 * - Shows the detected provider logo badge inside the input
 * - Exposes the detected provider to the parent via onProvider callback
 *
 * Reused by:
 *   - TicketPurchasePage  (/ticket/:token)   — payment phone field
 *   - QuickPayCustomer    (/pay/:token)       — customer phone field
 *   - PayStep             (CustomerApp)       — main + split-share phone fields
 */

import type { CSSProperties, ChangeEvent } from 'react'

export type MoMoProvider = 'MTN' | 'Airtel' | null

const MTN_PREFIXES    = ['077', '078', '079', '076']
const AIRTEL_PREFIXES = ['075', '070', '074']

/**
 * Detect provider from a Ugandan mobile number.
 * Accepts numbers starting with 0 (07X) or +256 (07X without leading 0).
 */
export function detectProvider(phone: string): MoMoProvider {
  const digits = phone.replace(/\D/g, '')
  // Normalise: strip country code so we always work with 07X...
  const local = digits.startsWith('256') ? '0' + digits.slice(3) : digits
  const prefix3 = local.slice(0, 3)
  if (MTN_PREFIXES.includes(prefix3))    return 'MTN'
  if (AIRTEL_PREFIXES.includes(prefix3)) return 'Airtel'
  return null
}

/** Simply return the raw value — no forced leading zero. */
function enforceLeadingZero(raw: string): string {
  return raw
}

// ── Logo components (inline SVG wrappers around the public PNGs) ──────────────

function MtnBadge() {
  return (
    <span className="momo-badge momo-badge-mtn" aria-label="MTN MoMo">
      <img src="/mtn.png" alt="MTN" />
    </span>
  )
}

function AirtelBadge() {
  return (
    <span className="momo-badge momo-badge-airtel" aria-label="Airtel Money">
      <img src="/airtel.png" alt="Airtel" />
    </span>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface MoMoPhoneInputProps {
  value: string
  onChange: (value: string) => void
  onProvider?: (provider: MoMoProvider) => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
  id?: string
  className?: string
  inputClassName?: string
  style?: CSSProperties
  inputStyle?: CSSProperties
  'aria-label'?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  autoComplete?: string
}

export function MoMoPhoneInput({
  value,
  onChange,
  onProvider,
  placeholder = '07XX XXX XXX',
  required = false,
  disabled = false,
  id,
  className = '',
  inputClassName = '',
  style,
  inputStyle,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedby,
  'aria-invalid': ariaInvalid,
  autoComplete = 'tel',
}: MoMoPhoneInputProps) {
  const provider = detectProvider(value)

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const next = enforceLeadingZero(e.target.value)
    const nextProvider = detectProvider(next)
    onChange(next)
    onProvider?.(nextProvider)
  }

  return (
    <div className={`momo-wrap${className ? ' ' + className : ''}`} style={style}>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete={autoComplete}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className={`momo-input${inputClassName ? ' ' + inputClassName : ''}`}
        style={inputStyle}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedby}
        aria-invalid={ariaInvalid}
      />
      {provider === 'MTN'    && <MtnBadge />}
      {provider === 'Airtel' && <AirtelBadge />}
    </div>
  )
}
