import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { operationsApi, type SplitBillSummary, type SplitPayment } from '../api/operations'
import { payments, type PaymentProvider } from './payments'
import { currency } from './utils'

export function SplitPayPanel({
  publicId,
  businessId,
  phone,
  customerName,
  provider = 'MTN',
}: {
  publicId: string
  businessId: string
  phone: string
  customerName?: string
  provider?: PaymentProvider
}) {
  const [bill, setBill] = useState<SplitBillSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [parts, setParts] = useState(2)
  const [splitting, setSplitting] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const next = await operationsApi.getPublicSplitBill(publicId)
      setBill(next)
    } catch {
      setBill(null)
    } finally {
      setLoading(false)
    }
  }, [publicId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function createSplit() {
    setSplitting(true)
    try {
      await operationsApi.createPublicEqualSplits(publicId, {
        parts,
        basePayerName: customerName?.trim() || 'Guest',
      })
      toast.success(`Split into ${parts} shares`)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not split the bill')
    } finally {
      setSplitting(false)
    }
  }

  async function payShare(split: SplitPayment) {
    if (!phone.trim()) {
      toast.error('Add your phone number to pay your share')
      return
    }
    setPayingId(split.id)
    try {
      const result = await payments.initiateSplit({
        splitId: split.id,
        provider,
        phone: phone.trim(),
        amount: split.amount,
        businessId,
        customerName,
      })
      if (result.status === 'PAID') {
        toast.success('Share paid')
      } else {
        toast.message('Payment started — approve on your phone')
        for (let i = 0; i < 12; i++) {
          await new Promise((r) => setTimeout(r, 2000))
          const status = await payments.status(result.paymentId)
          if (status.status === 'PAID') {
            toast.success('Share paid')
            break
          }
          if (status.status === 'FAILED') {
            toast.error('Payment failed')
            break
          }
        }
      }
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start split payment')
    } finally {
      setPayingId(null)
    }
  }

  if (loading) return null
  if (!bill) return null

  const splits = bill.splits ?? []
  const unpaid = splits.filter((s) => s.paymentStatus !== 'Paid')
  const orderTotal = bill.orderTotal
  const shareFor = (n: number) => (n > 0 ? Math.ceil(orderTotal / n) : 0)

  if (splits.length === 0) {
    return (
      <section className="split-pay-panel">
        <h3>Split the bill</h3>
        <p>Share this order with friends — each person pays their own share on their phone.</p>
        <label className="cm-field">
          Number of people
          <select
            value={parts}
            onChange={(e) => setParts(Number(e.target.value))}
            disabled={splitting}
          >
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n} people · ~{currency(shareFor(n))} each
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="customer-secondary-btn"
          disabled={splitting || orderTotal < 1}
          onClick={() => void createSplit()}
        >
          {splitting ? 'Splitting…' : `Split into ${parts}`}
        </button>
      </section>
    )
  }

  return (
    <section className="split-pay-panel">
      <h3>Split bill</h3>
      <p>
        Order {currency(bill.orderTotal)} · {unpaid.length} unpaid share
        {unpaid.length === 1 ? '' : 's'}
      </p>
      <ul>
        {splits.map((split) => (
          <li key={split.id}>
            <div>
              <strong>{split.payerName}</strong>
              <span>
                {' '}
                · {currency(split.amount)} · {split.paymentStatus}
              </span>
            </div>
            {split.paymentStatus !== 'Paid' ? (
              <button
                type="button"
                className="customer-secondary-btn"
                disabled={payingId === split.id}
                onClick={() => void payShare(split)}
              >
                {payingId === split.id ? 'Paying…' : 'Pay this share'}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
