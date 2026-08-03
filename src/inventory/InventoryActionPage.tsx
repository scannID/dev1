import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PaginationBar } from '../components/PaginationBar'
import { usePagination } from '../hooks/usePagination'
import {
  inventoryApi,
  type Ingredient,
  type StockMovement,
  type StockMovementType,
} from '../api/inventory'
import { operationsApi, type Branch } from '../api/operations'

export type InventoryActionMode = 'transfer' | 'adjust' | 'waste'

const MODE_META: Record<
  InventoryActionMode,
  { title: string; blurb: string; movementTypes: StockMovementType[]; submitLabel: string }
> = {
  transfer: {
    title: 'Transfer stock',
    blurb:
      'Move stock from this branch to another. Both branches get matching transfer movements.',
    movementTypes: ['TRANSFER_OUT', 'TRANSFER_IN'],
    submitLabel: 'Transfer stock',
  },
  adjust: {
    title: 'Adjust stock',
    blurb:
      'Correct on-hand quantity for this branch only. Use positive or negative quantities. Use Transfer to move stock between branches.',
    movementTypes: ['ADJUST'],
    submitLabel: 'Save adjustment',
  },
  waste: {
    title: 'Record waste',
    blurb: 'Write off spoiled, damaged, or discarded stock from this branch.',
    movementTypes: ['WASTE'],
    submitLabel: 'Record waste',
  },
}

function ugx(amount: number) {
  return `UGX ${Math.round(amount).toLocaleString()}`
}

function fmtQty(qty: number, unit: string) {
  const n = Number(qty)
  const text = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
  return `${text} ${unit}`
}

export function InventoryActionPage({
  businessId,
  mode,
}: {
  businessId: string
  mode: InventoryActionMode
}) {
  const meta = MODE_META[mode]
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [ingredientId, setIngredientId] = useState('')
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [toBusinessId, setToBusinessId] = useState('')
  const [saving, setSaving] = useState(false)

  const siblingBranches = useMemo(
    () => branches.filter((b) => b.id !== businessId),
    [branches, businessId],
  )

  const selected = useMemo(
    () => ingredients.find((i) => i.id === ingredientId) ?? null,
    [ingredients, ingredientId],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return ingredients
    return ingredients.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        i.sku.toLowerCase().includes(q),
    )
  }, [ingredients, search])

  const recent = useMemo(
    () => movements.filter((m) => meta.movementTypes.includes(m.movementType)),
    [movements, meta.movementTypes],
  )

  const pagination = usePagination(recent, {
    initialPageSize: 20,
    resetKey: `${businessId}|${mode}|${recent.length}`,
  })
  const { pageItems } = pagination

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [items, moves, branchList] = await Promise.all([
        inventoryApi.listIngredients(businessId),
        inventoryApi.listMovements(businessId, 200),
        operationsApi.listBranches(businessId).catch(() => [] as Branch[]),
      ])
      setIngredients(items)
      setMovements(moves)
      setBranches(branchList)
      setToBusinessId((prev) => {
        const siblings = branchList.filter((b) => b.id !== businessId)
        if (prev && siblings.some((b) => b.id === prev)) return prev
        return siblings[0]?.id ?? ''
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    setIngredientId('')
    setQty('')
    setNote('')
  }, [mode, businessId])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) {
      toast.error('Select an ingredient')
      return
    }
    const amount = Number(qty)
    if (!Number.isFinite(amount) || amount === 0) {
      toast.error('Enter a non-zero quantity')
      return
    }
    setSaving(true)
    try {
      if (mode === 'transfer') {
        if (!toBusinessId) {
          toast.error('Pick a destination branch')
          return
        }
        const result = await inventoryApi.transfer(businessId, selected.id, {
          toBusinessId,
          qty: Math.abs(amount),
          note: note.trim() || undefined,
        })
        toast.success(
          `Transferred ${result.qty} ${selected.unit} → ${result.toBranchLabel} (${result.transferGroupId})`,
        )
      } else if (mode === 'adjust') {
        await inventoryApi.adjust(businessId, selected.id, {
          qtyDelta: amount,
          note: note.trim() || undefined,
        })
        toast.success('Stock adjusted')
      } else {
        await inventoryApi.waste(businessId, selected.id, {
          qty: Math.abs(amount),
          note: note.trim() || undefined,
        })
        toast.success('Waste recorded')
      }
      setQty('')
      setNote('')
      await reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Stock update failed')
    } finally {
      setSaving(false)
    }
  }

  const branchName = (id?: string | null) => {
    if (!id) return null
    const b = branches.find((x) => x.id === id)
    return b ? b.branchLabel || b.name : id
  }

  return (
    <section className="inventory-page">
      <div className="inventory-metrics-row inventory-metrics-row--actions">
        <div className="inventory-action-hero">
          <h3>{meta.title}</h3>
          <p>{meta.blurb}</p>
        </div>
        <div className="inventory-page-toolbar">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search ingredients…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-sm"
              aria-label="Search ingredients"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <p className="report-empty">Loading inventory…</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <form className="inventory-form p-4" onSubmit={submit} noValidate>
              <div className="inventory-form-grid">
                <div className="grid gap-1.5">
                  <Label>Ingredient</Label>
                  <Select value={ingredientId} onValueChange={setIngredientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select ingredient" />
                    </SelectTrigger>
                    <SelectContent>
                      {filtered.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} · {fmtQty(item.qtyOnHand, item.unit)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {mode === 'transfer' ? (
                  <div className="grid gap-1.5">
                    <Label>To branch</Label>
                    <Select
                      value={toBusinessId}
                      onValueChange={setToBusinessId}
                      disabled={siblingBranches.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            siblingBranches.length === 0 ? 'No other branches' : 'Select branch'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {siblingBranches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.branchLabel || b.name}
                            {b.primary ? ' (Main)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div className="grid gap-1.5">
                  <Label>{mode === 'adjust' ? 'Qty change (+/−)' : 'Quantity'}</Label>
                  <Input
                    type="number"
                    step="any"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    required
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label>Note</Label>
                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>

              {selected ? (
                <p className="text-sm text-muted-foreground" style={{ margin: 0 }}>
                  On hand: {fmtQty(selected.qtyOnHand, selected.unit)} · Unit cost{' '}
                  {ugx(selected.avgUnitCost)} · Value {ugx(selected.stockValue)}
                </p>
              ) : null}

              <Button
                type="submit"
                disabled={
                  saving ||
                  !ingredientId ||
                  (mode === 'transfer' && siblingBranches.length === 0)
                }
              >
                {saving ? 'Saving…' : meta.submitLabel}
              </Button>
            </form>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
              <h4 className="m-0 text-sm font-semibold text-foreground">Recent {mode} activity</h4>
              <span className="ml-auto text-xs text-muted-foreground">{recent.length} records</span>
            </div>
            <div className="p-4">
              {recent.length === 0 ? (
                <p className="report-empty">No {mode} movements yet.</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>Ingredient</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Note</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageItems.map((m) => {
                        const other = branchName(m.relatedBusinessId)
                        const noteText =
                          m.transferGroupId && other
                            ? `${m.transferGroupId} · ${m.movementType === 'TRANSFER_OUT' ? '→' : '←'} ${other}`
                            : m.note || m.transferGroupId || '—'
                        return (
                          <TableRow key={m.id}>
                            <TableCell className="whitespace-nowrap">
                              {new Date(m.createdAt).toLocaleString()}
                            </TableCell>
                            <TableCell>{m.ingredientName}</TableCell>
                            <TableCell>{m.movementType}</TableCell>
                            <TableCell>{m.qtyDelta}</TableCell>
                            <TableCell>{noteText}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                  <PaginationBar pagination={pagination} hideWhenEmpty={false} className="report-list-pagination" />
                </>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  )
}

export function InventoryTransferPage({ businessId }: { businessId: string }) {
  return <InventoryActionPage businessId={businessId} mode="transfer" />
}

export function InventoryAdjustPage({ businessId }: { businessId: string }) {
  return <InventoryActionPage businessId={businessId} mode="adjust" />
}

export function InventoryWastePage({ businessId }: { businessId: string }) {
  return <InventoryActionPage businessId={businessId} mode="waste" />
}
