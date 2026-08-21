import { ArrowLeft, Receipt, RotateCcw, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { KodteMark } from './KodteMark'
import {
  formatReceiptDate,
  formatReceiptDay,
  updateReceiptStatus,
  type CustomerReceipt,
} from './receipts'
import { ordersApi } from '../api/services'
import { currency } from './utils'
import { formatRemovedIngredients } from '../lib/catalogCart'
import { ReceiptBarcode } from './ReceiptBarcode'

function ReceiptCard({
  receipt,
  onOpen,
  onDelete,
}: {
  receipt: CustomerReceipt
  onOpen: () => void
  onDelete?: () => void
}) {
  return (
    <div className="cm-receipt-card">
      <button type="button" className="cm-receipt-card-open" onClick={onOpen}>
        <div className="cm-receipt-card-top">
          <div className="cm-receipt-card-brand">
            {receipt.businessLogoUrl ? (
              <img src={receipt.businessLogoUrl} alt="" className="cm-receipt-card-logo" />
            ) : (
              <span className="cm-receipt-card-mark">
                <KodteMark size={22} />
              </span>
            )}
            <div>
              <strong>{receipt.businessName}</strong>
              <span>{formatReceiptDay(receipt.paidAt)}</span>
            </div>
          </div>
          <strong className={`cm-receipt-card-total${onDelete ? ' has-delete' : ''}`}>
            {currency(receipt.total)}
          </strong>
        </div>
        <div className="cm-receipt-card-meta">
          <span>{receipt.orderId}</span>
          <span>
            {receipt.items.length} item{receipt.items.length === 1 ? '' : 's'} · {receipt.paymentProvider}
          </span>
        </div>
      </button>
      {onDelete ? (
        <button
          type="button"
          className="cm-receipt-card-delete"
          aria-label="Delete receipt"
          onClick={(event) => {
            event.stopPropagation()
            onDelete()
          }}
        >
          <Trash2 size={14} />
        </button>
      ) : null}
    </div>
  )
}

function ReceiptDetail({
  receipt,
  canReorder,
  onBack,
  onReorder,
  onSettle,
}: {
  receipt: CustomerReceipt
  canReorder: boolean
  onBack: () => void
  onReorder?: (receipt: CustomerReceipt) => void
  onSettle?: (orderId: string) => void
}) {
  // Lazy-fetch the real order status on open — covers cases where the customer
  // navigated away or closed the tab before the kitchen marked it Completed.
  useEffect(() => {
    if (receipt.orderStatus === 'Completed') return
    if (!receipt.orderPublicId || !receipt.orderPhone) return
    let cancelled = false
    ordersApi
      .trackPublic(receipt.orderPublicId, receipt.orderPhone)
      .then((tracked) => {
        if (cancelled) return
        if (tracked.status === 'Completed') {
          updateReceiptStatus(receipt.orderId, 'Completed')
          setLocalSettled(true)
          onSettle?.(receipt.orderId)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.orderId])

  // Local settled flag so the stamp appears immediately on this device
  // even before the parent refreshes its receipts list.
  const [localSettled, setLocalSettled] = useState(
    receipt.orderStatus === 'Completed',
  )
  const isSettled = localSettled || receipt.orderStatus === 'Completed'

  return (
    <div className="cm-receipt-detail">
      <button type="button" className="cm-receipt-back" onClick={onBack}>
        <ArrowLeft size={16} /> All receipts
      </button>

      <div className="cm-receipt-paper">
        {isSettled && (
          <div className="cm-receipt-settled-stamp" aria-hidden="true">SETTLED</div>
        )}
        <div className="cm-receipt-paper-head">
          {receipt.businessLogoUrl ? (
            <img src={receipt.businessLogoUrl} alt="" className="cm-receipt-paper-logo" />
          ) : (
            <KodteMark size={28} />
          )}
          <div>
            <p className="cm-receipt-paper-label">Receipt</p>
            <h3>{receipt.businessName}</h3>
            <p className="cm-muted">{formatReceiptDate(receipt.paidAt)}</p>
          </div>
        </div>

        <div className="cm-receipt-paper-meta">
          <div>
            <span>Order</span>
            <strong>{receipt.orderId}</strong>
          </div>
          <div>
            <span>Customer</span>
            <strong>{receipt.customerName}</strong>
          </div>
          <div>
            <span>Phone</span>
            <strong>{receipt.customerPhone}</strong>
          </div>
          <div>
            <span>Payment</span>
            <strong>
              {receipt.paymentMethod} · {receipt.paymentProvider}
            </strong>
          </div>
          {receipt.paymentReference ? (
            <div>
              <span>Reference</span>
              <strong>{receipt.paymentReference}</strong>
            </div>
          ) : null}
        </div>

        <div className="cm-receipt-items">
          <div className="cm-receipt-items-head">
            <span>Item</span>
            <span>Qty</span>
            <span>Amount</span>
          </div>
          {receipt.items.map((item, index) => {
            const removed = formatRemovedIngredients(item.removedIngredients)
            return (
              <div className="cm-receipt-item-row" key={`${item.name}-${index}`}>
                <span>
                  {item.name}
                  {removed ? <em className="cm-line-removed"> · {removed}</em> : null}
                </span>
                <span>{item.quantity}</span>
                <strong>{currency(item.lineTotal)}</strong>
              </div>
            )
          })}
        </div>

        <div className="cm-receipt-totals">
          <div>
            <span>Subtotal</span>
            <strong>{currency(receipt.subtotal)}</strong>
          </div>
          {(receipt.serviceFee ?? 0) > 0 ? (
            <div>
              <span>Service fee</span>
              <strong>{currency(receipt.serviceFee)}</strong>
            </div>
          ) : null}
          <div className="cm-receipt-grand">
            <span>Total paid</span>
            <strong>{currency(receipt.total)}</strong>
          </div>
        </div>

        {canReorder && onReorder ? (
          <button
            type="button"
            className="cm-primary cm-full cm-receipt-reorder"
            onClick={() => onReorder(receipt)}
          >
            <RotateCcw size={16} /> Order again
          </button>
        ) : null}

        <div className="cm-receipt-qr-section">
          <ReceiptBarcode orderId={receipt.orderId} />
        </div>
      </div>
    </div>
  )
}

export function ReceiptsPanel({
  open,
  receipts,
  currentBusinessId,
  onReorder,
  onDelete,
  onSettle,
  onClose,
}: {
  open: boolean
  receipts: CustomerReceipt[]
  currentBusinessId?: string
  onReorder?: (receipt: CustomerReceipt) => void
  onDelete?: (receiptId: string) => void
  onSettle?: (orderId: string) => void
  onClose: () => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) setSelectedId(null)
  }, [open])

  const selected = useMemo(
    () => receipts.find((receipt) => receipt.id === selectedId) ?? null,
    [receipts, selectedId],
  )

  const handleDelete = (receiptId: string) => {
    onDelete?.(receiptId)
    setSelectedId((current) => (current === receiptId ? null : current))
  }

  if (!open) return null

  return (
    <div className="cm-track-overlay" role="dialog" aria-modal="true" aria-label="Your receipts">
      <button type="button" className="cm-track-backdrop" aria-label="Close receipts" onClick={onClose} />
      <div className="cm-track-sheet cm-receipts-sheet">
        <div className="cm-track-sheet-header">
          <div>
            <h2>{selected ? 'Receipt details' : 'Your receipts'}</h2>
            <p className="cm-muted">
              {selected
                ? selected.businessName
                : `${receipts.length} saved on this device`}
            </p>
          </div>
          <button type="button" className="cm-track-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {selected ? (
          <ReceiptDetail
            receipt={selected}
            canReorder={Boolean(currentBusinessId && selected.businessId === currentBusinessId && onReorder)}
            onBack={() => setSelectedId(null)}
            onReorder={onReorder}
            onSettle={onSettle}
          />
        ) : receipts.length === 0 ? (
          <div className="cm-receipts-empty">
            <div className="cm-receipts-empty-icon">
              <Receipt size={28} />
            </div>
            <h3>No receipts yet</h3>
            <p className="cm-muted">
              After you pay, your receipt is saved on this device so you can open it anytime.
            </p>
          </div>
        ) : (
          <div className="cm-receipts-list">
            {receipts.map((receipt) => (
              <ReceiptCard
                key={receipt.id}
                receipt={receipt}
                onOpen={() => setSelectedId(receipt.id)}
                onDelete={
                  onDelete
                    ? () => {
                        if (
                          window.confirm(
                            `Delete receipt from ${receipt.businessName}? It will be removed from this device only.`,
                          )
                        ) {
                          handleDelete(receipt.id)
                        }
                      }
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
