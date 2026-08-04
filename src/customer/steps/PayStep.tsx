import { useRef } from 'react'
import type { Business } from '../../api/types'
import { formatRemovedIngredients, isLodgingItem } from '../../lib/catalogCart'
import { effectivePrice } from '../../lib/catalogPricing'
import type { PaymentProvider } from '../payments'
import { currency, usdEquiv, DEFAULT_SERVICE_FEE_UGX, formatUgPhoneHint, withServiceFee } from '../utils'
import { distributeEqually, type SplitShareDraft } from '../splitValidation'
import type { CartLine } from './CartStep'

export type { SplitShareDraft }

function UsdHint({ amount }: { amount: number }) {
  const usd = usdEquiv(amount)
  return usd ? <span className="cm-usd">{usd}</span> : null
}

export function PayStep({
  business,
  cartItems,
  cartTotal,
  serviceFeeUgx = DEFAULT_SERVICE_FEE_UGX,
  provider,
  phone,
  saveNumber,
  deviceKnown,
  savedPhone,
  phoneError,
  submitting,
  splitEnabled,
  splitShares,
  feeConsent,
  onSplitEnabled,
  onSplitShares,
  onFeeConsent,
  onProvider,
  onPhone,
  onSaveNumber,
}: {
  business: Business
  cartItems: CartLine[]
  cartTotal: number
  serviceFeeUgx?: number
  provider: PaymentProvider
  phone: string
  saveNumber: boolean
  deviceKnown: boolean
  savedPhone?: string | null
  phoneError?: string | null
  submitting: boolean
  splitEnabled: boolean
  splitShares: SplitShareDraft[]
  feeConsent: boolean
  onSplitEnabled: (enabled: boolean) => void
  onSplitShares: (shares: SplitShareDraft[]) => void
  onFeeConsent: (value: boolean) => void
  onProvider: (provider: PaymentProvider) => void
  onPhone: (value: string) => void
  onSaveNumber: (value: boolean) => void
}) {
  const phoneInputRef = useRef<HTMLInputElement | null>(null)
  const payableTotal = withServiceFee(cartTotal, serviceFeeUgx)
  const allocated = splitShares.reduce((sum, share) => sum + (Math.round(Number(share.amount)) || 0), 0)
  const remaining = payableTotal - allocated

  function setPeopleCount(count: number) {
    onSplitShares(distributeEqually(payableTotal, count, splitShares))
  }

  function splitEqually() {
    setPeopleCount(splitShares.length || 2)
  }

  function updateShare(index: number, patch: Partial<SplitShareDraft>) {
    onSplitShares(splitShares.map((share, i) => (i === index ? { ...share, ...patch } : share)))
  }

  function toggleSplit(enabled: boolean) {
    onSplitEnabled(enabled)
    if (enabled && splitShares.length < 2) {
      setPeopleCount(2)
    }
  }

  function beginChangeSavedNumber() {
    onPhone('0')
    window.setTimeout(() => {
      phoneInputRef.current?.focus()
      phoneInputRef.current?.setSelectionRange(1, 1)
    }, 0)
  }

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
          const amount =
            isLodgingItem(item) && item.nights
              ? effectivePrice(item) * item.nights * item.quantity
              : effectivePrice(item) * item.quantity
          return (
            <div key={item.lineKey}>
              <span>
                {item.quantity}× {item.name}
                {item.checkInDate && item.checkOutDate
                  ? ` · ${item.checkInDate} → ${item.checkOutDate}`
                  : ''}
                {removed ? <em className="cm-line-removed"> · {removed}</em> : null}
              </span>
              <span>{currency(amount)}</span>
            </div>
          )
        })}
        <div>
          <span>Subtotal</span>
          <span>{currency(cartTotal)}</span>
        </div>
        <div>
          <span>Service fee</span>
          <span>{currency(serviceFeeUgx)}</span>
        </div>
        <div className="cm-order-strip-total">
          <span>Total</span>
          <strong>
            {currency(payableTotal)}
            <UsdHint amount={payableTotal} />
          </strong>
        </div>
      </div>
      <label className="cm-check">
        <input
          type="checkbox"
          checked={feeConsent}
          onChange={(e) => onFeeConsent(e.target.checked)}
          disabled={submitting}
        />
        <span>I confirm the total includes the service fee shown above.</span>
      </label>

      <section className="split-pay-panel">
        <label className="cm-check">
          <input
            type="checkbox"
            checked={splitEnabled}
            disabled={submitting}
            onChange={(e) => toggleSplit(e.target.checked)}
          />
          <span>Split this bill (multi-payer)</span>
        </label>

        {splitEnabled ? (
          <>
            <p className="cm-muted" style={{ margin: 0 }}>
              Enter each person’s <strong>name, MoMo number, and amount</strong>. Everyone gets their own
              prompt. All shares settle under the same Kode payment ref
              {business.paymentReference ? (
                <>
                  {' '}
                  (<strong>{business.paymentReference}</strong>)
                </>
              ) : null}
              .
            </p>
            <label className="cm-field">
              Number of people
              <select
                value={splitShares.length || 2}
                disabled={submitting}
                onChange={(e) => setPeopleCount(Number(e.target.value))}
              >
                {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n} people
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="customer-secondary-btn" disabled={submitting} onClick={splitEqually}>
              Split equally
            </button>
            <ul>
              {splitShares.map((share, index) => (
                <li key={index} className="split-draft-row split-draft-row-multi">
                  <input
                    type="text"
                    aria-label={`Person ${index + 1} name`}
                    placeholder={`Guest ${index + 1}`}
                    value={share.name}
                    disabled={submitting}
                    onChange={(e) => updateShare(index, { name: e.target.value })}
                  />
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    aria-label={`Person ${index + 1} phone`}
                    placeholder="07XX XXX XXX"
                    value={share.phone}
                    disabled={submitting}
                    onChange={(e) => updateShare(index, { phone: e.target.value })}
                  />
                  <input
                    type="number"
                    min="1"
                    aria-label={`Person ${index + 1} amount`}
                    placeholder="Amount"
                    value={share.amount}
                    disabled={submitting}
                    onChange={(e) => updateShare(index, { amount: e.target.value })}
                  />
                </li>
              ))}
            </ul>
            <div className={`split-remaining ${remaining === 0 ? 'ok' : remaining < 0 ? 'over' : ''}`}>
              <span>Allocated {currency(allocated)}</span>
              <strong>
                {remaining === 0
                  ? 'Total met — ready to prompt everyone'
                  : remaining > 0
                    ? `Remaining ${currency(remaining)}`
                    : `Over by ${currency(Math.abs(remaining))}`}
              </strong>
            </div>
          </>
        ) : null}
      </section>

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

      {!splitEnabled ? (
        <>
          {deviceKnown && savedPhone ? (
            <div className="cm-saved-box">
              <p className="cm-eyebrow">Saved on this phone</p>
              <strong>{formatUgPhoneHint(savedPhone ?? '')}</strong>
              <p className="cm-muted">We’ll send the {provider} prompt here. Change the number below if needed.</p>
              <button
                type="button"
                className="customer-secondary-btn"
                disabled={submitting}
                onClick={beginChangeSavedNumber}
              >
                Change number
              </button>
            </div>
          ) : null}

          <label className="cm-field">
            Mobile money number
            <input
              ref={phoneInputRef}
              value={phone}
              onChange={(e) => onPhone(e.target.value)}
              placeholder="07XX XXX XXX"
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
        </>
      ) : phoneError ? (
        <p className="cm-field-error">{phoneError}</p>
      ) : null}

      <p className="cm-hint">
        {splitEnabled
          ? `Each person gets a ${provider} prompt for their share. When every share is approved, the order is paid under one Kode ref.`
          : `You’ll get a ${provider} prompt on your phone. Approve it to complete payment — we won’t mark the order paid until confirmation arrives.`}
      </p>
    </div>
  )
}
