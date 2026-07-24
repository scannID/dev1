import type { Business } from '../../api/types'
import { formatRemovedIngredients } from '../../lib/catalogCart'
import { effectivePrice } from '../../lib/catalogPricing'
import type { PaymentProvider } from '../payments'
import { currency, SERVICE_FEE_UGX, withServiceFee } from '../utils'
import type { CartLine } from './CartStep'

export function PayStep({
  business,
  cartItems,
  cartTotal,
  provider,
  phone,
  saveNumber,
  deviceKnown,
  savedPhone,
  phoneError,
  submitting,
  onProvider,
  onPhone,
  onSaveNumber,
}: {
  business: Business
  cartItems: CartLine[]
  cartTotal: number
  provider: PaymentProvider
  phone: string
  saveNumber: boolean
  deviceKnown: boolean
  savedPhone?: string | null
  phoneError?: string | null
  submitting: boolean
  onProvider: (provider: PaymentProvider) => void
  onPhone: (value: string) => void
  onSaveNumber: (value: boolean) => void
}) {
  const payableTotal = withServiceFee(cartTotal)

  return (
    <div className="cm-step cm-step-enter cm-panel">
      <h2>Pay with mobile money</h2>
      <p className="cm-muted">
        Pay {currency(payableTotal)} to <strong>{business.name}</strong>
      </p>
      {business.paymentReference ? <p className="cm-ref">Ref: {business.paymentReference}</p> : null}

      <div className="cm-order-strip">
        {cartItems.map((item) => {
          const removed = formatRemovedIngredients(item.removedIngredients)
          return (
          <div key={item.lineKey}>
            <span>
              {item.quantity}× {item.name}
              {removed ? <em className="cm-line-removed"> · {removed}</em> : null}
            </span>
            <span>{currency(effectivePrice(item) * item.quantity)}</span>
          </div>
          )
        })}
        <div>
          <span>Subtotal</span>
          <span>{currency(cartTotal)}</span>
        </div>
        <div>
          <span>Service fee</span>
          <span>{currency(SERVICE_FEE_UGX)}</span>
        </div>
        <div className="cm-order-strip-total">
          <span>Total</span>
          <strong>{currency(payableTotal)}</strong>
        </div>
      </div>

      {deviceKnown && savedPhone ? (
        <div className="cm-saved-box">
          <p className="cm-eyebrow">Saved on this phone</p>
          <strong>{savedPhone}</strong>
          <p className="cm-muted">We’ll send the {provider} prompt here. Change the number below if needed.</p>
        </div>
      ) : null}

      <div className="cm-providers" role="group" aria-label="Payment provider">
        <button
          type="button"
          className={provider === 'MTN' ? 'active' : ''}
          onClick={() => onProvider('MTN')}
          disabled={submitting}
          aria-label="MTN MoMo"
        >
          <img src="/mtn.png" alt="MTN" className="cm-provider-logo" />
        </button>
        <button
          type="button"
          className={provider === 'Airtel' ? 'active' : ''}
          onClick={() => onProvider('Airtel')}
          disabled={submitting}
          aria-label="Airtel Money"
        >
          <img src="/airtel.png" alt="Airtel" className="cm-provider-logo cm-provider-logo-airtel" />
        </button>
      </div>

      <label className="cm-field">
        Mobile money number
        <input
          value={phone}
          onChange={(e) => onPhone(e.target.value)}
          placeholder="07XX XXX XXX or +256…"
          inputMode="tel"
          autoComplete="tel"
          required
          aria-required="true"
          aria-invalid={Boolean(phoneError)}
          disabled={submitting}
        />
        {phoneError ? <span className="cm-field-error">{phoneError}</span> : null}
      </label>

      {!deviceKnown ? (
        <label className="cm-check">
          <input
            type="checkbox"
            checked={saveNumber}
            onChange={(e) => onSaveNumber(e.target.checked)}
            disabled={submitting}
          />
          <span>Save this number on this phone for faster checkout next time</span>
        </label>
      ) : null}

      <p className="cm-hint">
        You’ll get a {provider} prompt on your phone. Approve it to complete payment — we won’t mark the order paid
        until confirmation arrives.
      </p>
    </div>
  )
}
