import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  operationsApi,
  type SplitBillSummary,
} from '../api/operations'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

function formatMoney(amount: number) {
  return `UGX ${amount.toLocaleString()}`
}

/** Merchant view: read-only status of consumer-side split / pay-at-table. */
export function SplitBillPanel({
  businessId,
  orderId,
  orderTotal,
}: {
  businessId: string
  orderId: string
  orderTotal: number
  onOrderMaybePaid?: () => void
}) {
  const [bill, setBill] = useState<SplitBillSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const next = await operationsApi.getSplitBill(businessId, orderId)
      setBill(next)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load splits')
    } finally {
      setLoading(false)
    }
  }, [businessId, orderId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const splits = bill?.splits ?? []

  // Consumers create splits — hide when nothing was split.
  if (loading || splits.length === 0) return null

  const remaining = bill?.remainingTotal ?? orderTotal
  const paidCount = splits.filter((s) => s.paymentStatus === 'Paid').length

  return (
    <>
      <Separator className="" />
      <div className="split-bill-panel">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
            Split bill
          </p>
          <Button variant="ghost" size="sm" onClick={() => void refresh()} disabled={loading}>
            Refresh
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Guests split this on their phones. {paidCount} of {splits.length} share
          {splits.length === 1 ? '' : 's'} paid.
        </p>

        <div className="split-bill-summary">
          <span>Order {formatMoney(bill?.orderTotal ?? orderTotal)}</span>
          <span>Paid {formatMoney(bill?.allocatedTotal ?? 0)}</span>
          <span>Still owed {formatMoney(remaining)}</span>
        </div>

        <ul className="operations-list">
          {splits.map((split) => (
            <li key={split.id} className="split-bill-row">
              <div>
                <strong>{split.payerName}</strong>
                <span className="text-muted-foreground">
                  {' '}
                  · {formatMoney(split.amount)} · {split.paymentStatus}
                </span>
                {split.payerPhone ? (
                  <div className="text-xs text-muted-foreground">{split.payerPhone}</div>
                ) : null}
              </div>
              {split.paymentStatus === 'Paid' ? (
                <span className="text-xs text-emerald-700">Paid</span>
              ) : (
                <span className="text-xs text-muted-foreground">Awaiting guest</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
