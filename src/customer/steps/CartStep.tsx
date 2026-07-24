import { Plus, Minus, Trash2 } from 'lucide-react'
import type { CatalogItem } from '../../api/types'
import { formatRemovedIngredients } from '../../lib/catalogCart'
import { effectivePrice } from '../../lib/catalogPricing'
import { currency, DEFAULT_SERVICE_FEE_UGX, withServiceFee } from '../utils'

export interface CartLine extends CatalogItem {
  quantity: number
  removedIngredients: string[]
  lineKey: string
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
        <p className="cm-muted">Nothing here yet. Add something from the menu.</p>
        <button type="button" className="cm-primary cm-full" onClick={onBackToMenu}>
          Browse menu
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
          const unit = effectivePrice(item)
          return (
            <div key={item.lineKey} className="cm-summary-line">
              <div className="cm-summary-main">
                <strong>{item.name}</strong>
                {removed ? <span className="cm-line-removed">{removed}</span> : null}
                <span className="cm-line-meta">{currency(unit)} each</span>
                <div className="cm-qty compact">
                  <button type="button" onClick={() => onUpdateQty(item.lineKey, -1)} aria-label={`Decrease ${item.name}`}>
                    <Minus size={12} />
                  </button>
                  <span>{item.quantity}</span>
                  <button type="button" onClick={() => onUpdateQty(item.lineKey, 1)} aria-label={`Increase ${item.name}`}>
                    <Plus size={12} />
                  </button>
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
              <span className="cm-line-total">{currency(unit * item.quantity)}</span>
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
          <strong>{currency(withServiceFee(cartTotal, serviceFeeUgx))}</strong>
        </div>
      </div>
    </div>
  )
}
