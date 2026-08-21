import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { inventoryReportsApi, type VarianceRow } from '../api/inventory'
import { DatePicker } from '@/components/ui/date-picker'

function ugx(n: number) { return `UGX ${Math.round(n).toLocaleString()}` }
function fmtQty(n: number, unit: string) {
  const s = Number(n)
  return `${Number.isInteger(s) ? s : s.toFixed(3)} ${unit}`
}

export function VarianceReportPage({ businessId }: { businessId: string }) {
  const defaultFrom = (() => {
    const d = new Date(); d.setDate(d.getDate() - 7)
    return d.toISOString().slice(0, 10)
  })()
  const defaultTo = new Date().toISOString().slice(0, 10)

  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [rows, setRows] = useState<VarianceRow[] | null>(null)
  const [loading, setLoading] = useState(false)

  const run = useCallback(async () => {
    if (!from || !to) { toast.error('Select a date range'); return }
    if (from > to) { toast.error('From date must be before To date'); return }
    setLoading(true)
    try {
      const fromIso = new Date(from + 'T00:00:00Z').toISOString()
      const toIso   = new Date(to   + 'T23:59:59Z').toISOString()
      const result  = await inventoryReportsApi.variance(businessId, fromIso, toIso)
      setRows(result)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }, [businessId, from, to])

  const totalVarianceCost = rows ? rows.reduce((sum, r) => sum + Math.abs(r.varianceCost), 0) : 0
  const overUsed  = rows ? rows.filter(r => r.varianceQty > 0) : []
  const underUsed = rows ? rows.filter(r => r.varianceQty < 0) : []

  return (
    <section className="inventory-page space-y-4">
      <div>
        <h3 className="font-semibold text-sm mb-1">Variance report</h3>
        <p className="text-xs text-muted-foreground">
          Compares actual stock consumed to theoretical consumption based on recipes and paid orders.
          A positive variance means more was used than expected — check for waste, portioning, or recording gaps.
        </p>
      </div>

      {/* Date range picker */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="grid gap-1.5">
          <Label>From</Label>
          <DatePicker value={from} onChange={setFrom} max={to} placeholder="Start date" />
        </div>
        <div className="grid gap-1.5">
          <Label>To</Label>
          <DatePicker value={to} onChange={setTo} min={from} placeholder="End date" />
        </div>
        <Button className="h-8" onClick={() => void run()} disabled={loading}>
          {loading ? 'Running…' : 'Run report'}
        </Button>
      </div>

      {rows === null && !loading && (
        <p className="text-sm text-muted-foreground">Select a date range and run the report.</p>
      )}

      {rows !== null && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">No inventory movements in this period.</p>
      )}

      {rows !== null && rows.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Ingredients tracked', value: String(rows.length) },
              { label: 'Over-used items', value: String(overUsed.length), warn: overUsed.length > 0 },
              { label: 'Under-used items', value: String(underUsed.length) },
              { label: 'Total variance cost', value: ugx(totalVarianceCost), warn: totalVarianceCost > 0 },
            ].map(c => (
              <div key={c.label} className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className={`text-lg font-bold mt-0.5 ${c.warn ? 'text-amber-600' : ''}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Full table */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingredient</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Theoretical</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Waste</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead className="text-right">Variance cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => {
                  const isOver  = r.varianceQty > 0.001
                  const isUnder = r.varianceQty < -0.001
                  return (
                    <TableRow key={r.ingredientId}
                      className={isOver ? 'bg-amber-50/40' : isUnder ? 'bg-blue-50/30' : ''}>
                      <TableCell className="font-medium">{r.ingredientName}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {fmtQty(r.receivedQty, r.unit)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtQty(r.theoreticalConsumption, r.unit)}
                      </TableCell>
                      <TableCell className="text-right">
                        {fmtQty(r.actualConsumption, r.unit)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {fmtQty(r.recordedWaste, r.unit)}
                      </TableCell>
                      <TableCell className="text-right">
                        {isOver || isUnder ? (
                          <Badge variant="secondary"
                            className={isOver ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}>
                            {isOver ? '+' : ''}{fmtQty(r.varianceQty, r.unit)}
                          </Badge>
                        ) : (
                          <span className="text-emerald-600 text-xs">✓ On target</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {r.varianceCost !== 0
                          ? <span className={isOver ? 'text-amber-600' : 'text-blue-600'}>{ugx(r.varianceCost)}</span>
                          : '—'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <p className="text-xs text-muted-foreground">
            Positive variance (amber) = used more than recipes suggest. Negative (blue) = used less than expected.
            Both indicate recording or portioning issues worth investigating.
          </p>
        </>
      )}
    </section>
  )
}
