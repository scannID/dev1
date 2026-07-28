import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  operationsApi,
  type SplitBillSummary,
  type SplitPayment,
} from '../api/operations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function formatMoney(amount: number) {
  return `UGX ${amount.toLocaleString()}`
}

export function SplitBillPanel({
  businessId,
  orderId,
  orderTotal,
  onOrderMaybePaid,
}: {
  businessId: string
  orderId: string
  orderTotal: number
  onOrderMaybePaid?: () => void
}) {
  const [bill, setBill] = useState<SplitBillSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [parts, setParts] = useState(2)
  const [payerName, setPayerName] = useState('')
  const [payerPhone, setPayerPhone] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)

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

  async function createEqual() {
    setBusy(true)
    try {
      await operationsApi.createEqualSplits(businessId, orderId, {
        parts,
        basePayerName: payerName || 'Guest',
      })
      toast.success(`Split into ${parts} shares`)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create equal splits')
    } finally {
      setBusy(false)
    }
  }

  async function addCustom() {
    const value = Number(amount)
    if (!payerName.trim() || !Number.isFinite(value) || value < 1) {
      toast.error('Enter a payer name and amount')
      return
    }
    setBusy(true)
    try {
      await operationsApi.createSplit(businessId, orderId, {
        payerName: payerName.trim(),
        payerPhone: payerPhone.trim(),
        amount: Math.round(value),
      })
      toast.success('Share added')
      setAmount('')
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add share')
    } finally {
      setBusy(false)
    }
  }

  async function markPaid(split: SplitPayment) {
    setBusy(true)
    try {
      await operationsApi.markSplitPaid(businessId, orderId, split.id)
      toast.success(`Marked ${split.payerName} as paid`)
      await refresh()
      onOrderMaybePaid?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not mark paid')
    } finally {
      setBusy(false)
    }
  }

  const remaining = bill?.remainingTotal ?? orderTotal
  const splits = bill?.splits ?? []

  return (
    <div className="split-bill-panel">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
          Split bill / pay-at-table
        </p>
        <Button variant="ghost" size="sm" onClick={() => void refresh()} disabled={loading || busy}>
          Refresh
        </Button>
      </div>

      <div className="split-bill-summary">
        <span>Order {formatMoney(bill?.orderTotal ?? orderTotal)}</span>
        <span>Allocated {formatMoney(bill?.allocatedTotal ?? 0)}</span>
        <span>Remaining {formatMoney(remaining)}</span>
      </div>

      {splits.length === 0 ? (
        <div className="operations-grid-2">
          <div className="operations-field">
            <Label>Equal shares</Label>
            <Input
              type="number"
              min={2}
              max={20}
              value={parts}
              onChange={(e) => setParts(Math.max(2, Number(e.target.value) || 2))}
            />
          </div>
          <div className="operations-field">
            <Label>Label prefix</Label>
            <Input
              placeholder="Guest"
              value={payerName}
              onChange={(e) => setPayerName(e.target.value)}
            />
          </div>
          <Button onClick={() => void createEqual()} disabled={busy || remaining < 1}>
            Split equally
          </Button>
        </div>
      ) : null}

      {remaining > 0 ? (
        <div className="operations-grid-2">
          <Input placeholder="Payer name" value={payerName} onChange={(e) => setPayerName(e.target.value)} />
          <Input placeholder="Phone (optional)" value={payerPhone} onChange={(e) => setPayerPhone(e.target.value)} />
          <Input
            placeholder={`Amount (max ${remaining})`}
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Button variant="outline" onClick={() => void addCustom()} disabled={busy}>
            Add share
          </Button>
        </div>
      ) : null}

      <ul className="operations-list">
        {splits.map((split) => (
          <li key={split.id} className="split-bill-row">
            <div>
              <strong>{split.payerName}</strong>
              <span className="text-muted-foreground">
                {' '}
                · {formatMoney(split.amount)} · {split.paymentStatus}
              </span>
              {split.payerPhone ? <div className="text-xs text-muted-foreground">{split.payerPhone}</div> : null}
            </div>
            {split.paymentStatus !== 'Paid' ? (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void markPaid(split)}>
                Mark paid
              </Button>
            ) : (
              <span className="text-xs text-emerald-700">Paid</span>
            )}
          </li>
        ))}
        {!loading && splits.length === 0 ? <li>No shares yet — split equally or add custom amounts.</li> : null}
      </ul>

      {splits.some((s) => s.paymentStatus !== 'Paid') ? (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void operationsApi.clearUnpaidSplits(businessId, orderId).then(async (n) => {
            toast.success(`Cleared ${n} unpaid share(s)`)
            await refresh()
          }).catch((err) => toast.error(err instanceof Error ? err.message : 'Could not clear splits'))}
        >
          Clear unpaid shares
        </Button>
      ) : null}
    </div>
  )
}
