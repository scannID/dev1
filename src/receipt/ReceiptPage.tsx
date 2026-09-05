import { useEffect, useState } from 'react'
import { KodteMark } from '../customer/KodteMark'
import {
  formatReceiptDate,
  loadReceipts,
  updateReceiptStatus,
  type CustomerReceipt,
} from '../customer/receipts'
import { ordersApi } from '../api/services'
import { formatRemovedIngredients } from '../lib/catalogCart'
import '../customer/CustomerApp.css'
import './ReceiptPage.css'

function currency(amount: number) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0,
  }).format(amount)
}

function resolveOrderId(): string | null {
  const match = window.location.pathname.match(/^\/receipt\/([^/]+)\/?$/)
  return match ? decodeURIComponent(match[1]) : null
}

export default function ReceiptPage() {
  const orderId = resolveOrderId()
  const [receipt, setReceipt] = useState<CustomerReceipt | undefined>(() =>
    orderId ? loadReceipts().find((r) => r.orderId === orderId || r.id === orderId) : undefined,
  )

  // On mount: if the receipt isn't already stamped and we have tracking info,
  // fetch the real order status from the backend. This handles the case where
  // the customer closed the tab / switched off the phone before the kitchen
  // marked the order Completed.
  useEffect(() => {
    if (!receipt) return
    if (receipt.orderStatus === 'Completed') return
    if (!receipt.orderPublicId || !receipt.orderPhone) return

    let cancelled = false
    ordersApi
      .trackPublic(receipt.orderPublicId, receipt.orderPhone)
      .then((tracked) => {
        if (cancelled) return
        if (tracked.status === 'Completed') {
          updateReceiptStatus(receipt.orderId, 'Completed')
          setReceipt((prev) =>
            prev ? { ...prev, orderStatus: 'Completed' } : prev,
          )
        }
      })
      .catch(() => {
        // silently ignore — receipt still renders, just without the stamp
      })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt?.orderId])

  if (!orderId) {
    return <NotFound message="No receipt ID in this link." />
  }

  if (!receipt) {
    return (
      <div className="rp-shell">
        <div className="rp-header">
          <KodteMark size={28} />
          <span className="rp-brand">Koddly</span>
        </div>
        <div className="rp-not-found">
          <div className="rp-nf-icon">🧾</div>
          <h2>Receipt not on this device</h2>
          <p>
            This QR links to order <strong>{orderId}</strong>. Receipts are saved on the
            device that made the payment. Open this link on that device to view it.
          </p>
          <p className="rp-nf-hint">
            If you're the payer, open your receipt history in the Koddly menu and find
            this order.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rp-shell">
      {/* Header */}
      <div className="rp-header">
        {receipt.businessLogoUrl ? (
          <img src={receipt.businessLogoUrl} alt="" className="rp-header-logo" />
        ) : (
          <KodteMark size={28} />
        )}
        <span className="rp-brand">{receipt.businessName}</span>
      </div>

      {/* Paper */}
      <div className="rp-paper">
        {receipt.orderStatus === 'Completed' && (
          <div className="rp-settled-stamp" aria-hidden="true">SETTLED</div>
        )}
        <div className="rp-paper-top">
          <p className="rp-paper-eyebrow">Payment receipt</p>
          <h1 className="rp-paper-biz">{receipt.businessName}</h1>
          <p className="rp-paper-date">{formatReceiptDate(receipt.paidAt)}</p>
        </div>

        <div className="rp-divider rp-divider--dashed" />

        <dl className="rp-meta">
          <div>
            <dt>Order</dt>
            <dd>{receipt.orderId}</dd>
          </div>
          <div>
            <dt>Customer</dt>
            <dd>{receipt.customerName}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{receipt.customerPhone}</dd>
          </div>
          <div>
            <dt>Payment</dt>
            <dd>{receipt.paymentMethod} · {receipt.paymentProvider}</dd>
          </div>
          {receipt.paymentReference ? (
            <div>
              <dt>Reference</dt>
              <dd>{receipt.paymentReference}</dd>
            </div>
          ) : null}
        </dl>

        <div className="rp-divider" />

        {/* Items */}
        <div className="rp-items">
          <div className="rp-items-head">
            <span>Item</span>
            <span>Qty</span>
            <span>Amount</span>
          </div>
          {receipt.items.map((item, i) => {
            const removed = formatRemovedIngredients(item.removedIngredients)
            return (
              <div className="rp-item-row" key={`${item.name}-${i}`}>
                <span>
                  {item.name}
                  {removed ? <em className="rp-removed"> · {removed}</em> : null}
                </span>
                <span>{item.quantity}</span>
                <strong>{currency(item.lineTotal)}</strong>
              </div>
            )
          })}
        </div>

        <div className="rp-divider" />

        {/* Totals */}
        <div className="rp-totals">
          <div>
            <span>Subtotal</span>
            <span>{currency(receipt.subtotal)}</span>
          </div>
          {(receipt.serviceFee ?? 0) > 0 && (
            <div>
              <span>Service fee</span>
              <span>{currency(receipt.serviceFee)}</span>
            </div>
          )}
          <div className="rp-grand">
            <span>Total paid</span>
            <strong>{currency(receipt.total)}</strong>
          </div>
        </div>

        <div className="rp-divider rp-divider--dashed" />

        <p className="rp-footnote">
         Koddly Powered by <strong>QbiLabs</strong> · This receipt is stored on the payer's device.
        </p>
      </div>
    </div>
  )
}

function NotFound({ message }: { message: string }) {
  return (
    <div className="rp-shell">
      <div className="rp-header">
        <KodteMark size={28} />
        <span className="rp-brand">Koddly</span>
      </div>
      <div className="rp-not-found">
        <div className="rp-nf-icon">❌</div>
        <h2>Invalid receipt link</h2>
        <p>{message}</p>
      </div>
    </div>
  )
}
