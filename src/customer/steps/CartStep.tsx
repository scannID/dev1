import { Plus, Minus, Trash2 } from 'lucide-react'
import type { CatalogItem } from '../../api/types'
import { formatRemovedIngredients, isLodgingItem } from '../../lib/catalogCart'
import { effectivePrice } from '../../lib/catalogPricing'
import { currency, usdEquiv, DEFAULT_SERVICE_FEE_UGX, withServiceFee } from '../utils'

function UsdHint({ amount }: { amount: number }) {
  const usd = usdEquiv(amount)
  return usd ? <span className="cm-usd">{usd}</span> : null
}

export interface CartLine extends CatalogItem {
  quantity: number
  removedIngredients: string[]
  lineKey: string
  checkInDate?: string
  checkOutDate?: string
  nights?: number
}

function lineAmount(item: CartLine) {
  const unit = effectivePrice(item)
  if (isLodgingItem(item) && item.nights) {
    return unit * item.nights * item.quantity
  }
  return unit * item.quantity
}

export function CartStep({
  cartItems,
  cartTotal,
  serviceFeeUgx = DEFAULT_SERVICE_FEE_UGX,
  onUpdateQty,
  onRemove,
  onBackToMenu,
}: {
  cartItems: CartLine[]
  cartTotal: number
  serviceFeeUgx?: number
  onUpdateQty: (lineKey: string, delta: number) => void
  onRemove: (lineKey: string) => void
  onBackToMenu: () => void
}) {
  if (cartItems.length === 0) {
    return (
      <div className="cm-step cm-step-enter cm-panel">
        <h2>Your cart</h2>
        <p className="cm-muted">Nothing here yet. Add a stay or something from the menu.</p>
        <button type="button" className="cm-primary cm-full" onClick={onBackToMenu}>
          Continue browsing
        </button>
      </div>
    )
  }

  return (
    <div className="cm-step cm-step-enter cm-panel">
      <h2>Your cart</h2>
      <p className="cm-muted">Review quantities before checkout</p>

      <div className="cm-summary">
        {cartItems.map((item) => {
          const removed = formatRemovedIngredients(item.removedIngredients)
          const lodging = isLodgingItem(item)
          const unit = effectivePrice(item)
          return (
            <div key={item.lineKey} className="cm-summary-line">
              <div className="cm-summary-main">
                <strong>{item.name}</strong>
                {lodging && item.checkInDate && item.checkOutDate ? (
                  <span className="cm-line-removed">
                    {item.checkInDate} → {item.checkOutDate} · {item.nights ?? 1} night
                    {(item.nights ?? 1) === 1 ? '' : 's'}
                  </span>
                ) : null}
                {removed ? <span className="cm-line-removed">{removed}</span> : null}
                <span className="cm-line-meta">
                  {lodging ? `${currency(unit)} / night` : `${currency(unit)} each`}
                </span>
                <div className="cm-qty compact">
                  {!lodging && (
                    <button type="button" onClick={() => onUpdateQty(item.lineKey, -1)} aria-label={`Decrease ${item.name}`}>
                      <Minus size={12} />
                    </button>
                  )}
                  <span>{lodging ? `${item.nights ?? 1} night${(item.nights ?? 1) === 1 ? '' : 's'}` : item.quantity}</span>
                  {!lodging && (
                    <button type="button" onClick={() => onUpdateQty(item.lineKey, 1)} aria-label={`Increase ${item.name}`}>
                      <Plus size={12} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="cm-remove"
                    onClick={() => onRemove(item.lineKey)}
                    aria-label={`Remove ${item.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <span className="cm-line-total">{currency(lineAmount(item))}<UsdHint amount={lineAmount(item)} /></span>
            </div>
          )
        })}
        <div className="cm-summary-total cm-summary-row">
          <span>Subtotal</span>
          <strong>{currency(cartTotal)}</strong>
        </div>
        <div className="cm-summary-row">
          <span>Service fee</span>
          <strong>{currency(serviceFeeUgx)}</strong>
        </div>
        <div className="cm-summary-total">
          <span>Total</span>
          <strong>{currency(withServiceFee(cartTotal, serviceFeeUgx))}<UsdHint amount={withServiceFee(cartTotal, serviceFeeUgx)} /></strong>
        </div>
      </div>
    </div>
  )
}
