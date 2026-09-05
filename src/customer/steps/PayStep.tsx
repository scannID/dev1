import { useRef } from 'react'
import type { Business } from '../../api/types'
import { formatRemovedIngredients, isLodgingItem } from '../../lib/catalogCart'
import { effectivePrice } from '../../lib/catalogPricing'
import type { PaymentProvider } from '../payments'
import { currency, usdEquiv, DEFAULT_SERVICE_FEE_UGX, formatUgPhoneHint, withServiceFee } from '../utils'
import { distributeEqually, redistributeRemaining, type SplitShareDraft } from '../splitValidation'
import type { CartLine } from './CartStep'
import { MoMoPhoneInput, detectProvider } from '../../components/MoMoPhoneInput'
import '../../components/MoMoPhoneInput.css'

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
  orderTotal,
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
  /** Actual order total from the backend — used for split allocation so amounts match exactly. */
  orderTotal?: number
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
  // Use actual order total for split allocation when available (avoids backend mismatch)
  const splitTotal = orderTotal ?? payableTotal
  const allocated = splitShares.reduce((sum, share) => sum + (Math.round(Number(share.amount)) || 0), 0)
  const remaining = splitTotal - allocated

  function setPeopleCount(count: number) {
    onSplitShares(distributeEqually(splitTotal, count, splitShares))
  }

  function splitEqually() {
    setPeopleCount(splitShares.length || 2)
  }

  function updateShare(index: number, patch: Partial<SplitShareDraft>) {
    // Keep the leading 0 on phone — if the user clears it, restore the prefix.
    if ('phone' in patch && patch.phone !== undefined && patch.phone === '') {
      patch = { ...patch, phone: '0' }
    }
    const updated = splitShares.map((share, i) => (i === index ? { ...share, ...patch } : share))
    // When the user edits an amount, auto-assign the leftover to another share.
    if ('amount' in patch) {
      onSplitShares(redistributeRemaining(splitTotal, updated, index))
    } else {
      onSplitShares(updated)
    }
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
              Enter each person's <strong>name, MoMo number, and amount</strong>. Everyone gets their own
              prompt. All shares settle under the same Koddly payment ref
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
              {splitShares.map((share, index) => {
                const shareAmount = Math.round(Number(share.amount)) || 0
                return (
                  <li key={index} className="split-draft-row split-draft-row-multi">
                    <input
                      type="text"
                      aria-label={`Person ${index + 1} name`}
                      placeholder={`Guest ${index + 1}`}
                      value={share.name}
                      disabled={submitting}
                      onChange={(e) => updateShare(index, { name: e.target.value })}
                    />
                    <MoMoPhoneInput
                      value={share.phone}
                      onChange={(v) => updateShare(index, { phone: v })}
                      placeholder="07XX XXX XXX"
                      disabled={submitting}
                      aria-label={`Person ${index + 1} phone`}
                    />
                    <div className="split-amount-cell">
                      <input
                        type="number"
                        min="1"
                        aria-label={`Person ${index + 1} amount`}
                        placeholder="Amount"
                        value={share.amount}
                        disabled={submitting}
                        onChange={(e) => updateShare(index, { amount: e.target.value })}
                      />
                      {shareAmount > 0 && (
                        <span className="split-amount-hint">{currency(shareAmount)}</span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
            <div className={`split-remaining ${remaining === 0 ? 'ok' : remaining < 0 ? 'over' : ''}`}>
              <span>Allocated {currency(allocated)} of {currency(splitTotal)}</span>
              <strong>
                {remaining === 0
                  ? 'All allocated — ready to pay'
                  : remaining > 0
                    ? `${currency(remaining)} unallocated`
                    : `Over by ${currency(Math.abs(remaining))}`}
              </strong>
              {remaining !== 0 && splitShares.length > 0 && (
                <button
                  type="button"
                  className="customer-secondary-btn"
                  style={{ marginTop: 4, fontSize: 12, padding: '4px 10px' }}
                  disabled={submitting}
                  onClick={() => {
                    // Assign the full remainder to the last share
                    const lastIdx = splitShares.length - 1
                    const othersSum = splitShares
                      .slice(0, lastIdx)
                      .reduce((s, sh) => s + (Math.round(Number(sh.amount)) || 0), 0)
                    const lastAmount = Math.max(1, splitTotal - othersSum)
                    onSplitShares(
                      splitShares.map((sh, i) =>
                        i === lastIdx ? { ...sh, amount: String(lastAmount) } : sh,
                      ),
                    )
                  }}
                >
                  {remaining > 0
                    ? `Assign ${currency(remaining)} to ${splitShares[splitShares.length - 1]?.name || `Guest ${splitShares.length}`}`
                    : 'Fix allocation'}
                </button>
              )}
            </div>
          </>
        ) : null}
      </section>

      {!splitEnabled ? (
        <>
          {deviceKnown && savedPhone ? (
            <div className="cm-saved-box">
              <p className="cm-eyebrow">Saved on this phone</p>
              <strong>{formatUgPhoneHint(savedPhone ?? '')}</strong>
              <p className="cm-muted">
                {provider
                  ? `We'll send the ${provider} prompt here. Change the number below if needed.`
                  : "We'll send the MoMo prompt here. Change the number below if needed."}
              </p>
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
            <MoMoPhoneInput
              value={phone}
              onChange={(v) => {
                onPhone(v)
                const p = detectProvider(v)
                if (p === 'MTN' || p === 'Airtel') onProvider(p)
              }}
              placeholder="07XX XXX XXX"
              required
              disabled={submitting}
              inputClassName=""
              aria-invalid={Boolean(phoneError)}
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
          ? provider
            ? `Each person gets a ${provider} prompt for their share. When every share is approved, the order is paid under one Koddly ref.`
            : 'Each person gets a MoMo prompt for their share. When every share is approved, the order is paid under one Koddly ref.'
          : provider
            ? `You'll get a ${provider} prompt on your phone. Approve it to complete payment — we won't mark the order paid until confirmation arrives.`
            : "You'll get a MoMo prompt on your phone. Approve it to complete payment — we won't mark the order paid until confirmation arrives."}
      </p>
    </div>
  )
}
