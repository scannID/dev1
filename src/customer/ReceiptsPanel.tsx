import { ArrowLeft, Receipt, RotateCcw, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ScannyMark } from './ScannyMark'
import {
  formatReceiptDate,
  formatReceiptDay,
  type CustomerReceipt,
} from './receipts'
import { currency } from './utils'
import { formatRemovedIngredients } from '../lib/catalogCart'

function ReceiptCard({
  receipt,
  onOpen,
}: {
  receipt: CustomerReceipt
  onOpen: () => void
}) {
  return (
    <button type="button" className="cm-receipt-card" onClick={onOpen}>
      <div className="cm-receipt-card-top">
        <div className="cm-receipt-card-brand">
          {receipt.businessLogoUrl ? (
            <img src={receipt.businessLogoUrl} alt="" className="cm-receipt-card-logo" />
          ) : (
            <span className="cm-receipt-card-mark">
              <ScannyMark size={22} />
            </span>
          )}
          <div>
            <strong>{receipt.businessName}</strong>
            <span>{formatReceiptDay(receipt.paidAt)}</span>
          </div>
        </div>
        <strong className="cm-receipt-card-total">{currency(receipt.total)}</strong>
      </div>
      <div className="cm-receipt-card-meta">
        <span>{receipt.orderId}</span>
        <span>
          {receipt.items.length} item{receipt.items.length === 1 ? '' : 's'} · {receipt.paymentProvider}
        </span>
      </div>
    </button>
  )
}

function ReceiptDetail({
  receipt,
  canReorder,
  onBack,
  onReorder,
}: {
  receipt: CustomerReceipt
  canReorder: boolean
  onBack: () => void
  onReorder?: (receipt: CustomerReceipt) => void
}) {
  return (
    <div className="cm-receipt-detail">
      <button type="button" className="cm-receipt-back" onClick={onBack}>
        <ArrowLeft size={16} /> All receipts
      </button>

      <div className="cm-receipt-paper">
        <div className="cm-receipt-paper-head">
          {receipt.businessLogoUrl ? (
            <img src={receipt.businessLogoUrl} alt="" className="cm-receipt-paper-logo" />
          ) : (
            <ScannyMark size={28} />
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

        <p className="cm-receipt-footnote">
          Saved on this device only. Other phones won&apos;t see these receipts.
        </p>
      </div>
    </div>
  )
}

export function ReceiptsPanel({
  open,
  receipts,
  currentBusinessId,
  onReorder,
  onClose,
}: {
  open: boolean
  receipts: CustomerReceipt[]
  currentBusinessId?: string
  onReorder?: (receipt: CustomerReceipt) => void
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
