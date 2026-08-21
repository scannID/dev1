import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, RefreshCw, AlertTriangle, PackageCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  purchaseOrdersApi, suppliersApi,
  type PurchaseOrder, type PurchaseOrderStatus,
  type Supplier, type Ingredient, type ReorderSuggestion, type IngredientBatch,
} from '../api/inventory'

const STATUS_BADGE: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  SENT: 'bg-blue-50 text-blue-700',
  PARTIALLY_RECEIVED: 'bg-amber-50 text-amber-700',
  RECEIVED: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-red-50 text-red-600',
}

function ugx(n: number) { return `UGX ${Math.round(n).toLocaleString()}` }
function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
}

type SubTab = 'orders' | 'reorder' | 'batches'

export function PurchaseOrdersPage({
  businessId,
  ingredients,
  suppliers: initialSuppliers,
}: {
  businessId: string
  ingredients: Ingredient[]
  suppliers: Supplier[]
}) {
  const [subTab, setSubTab] = useState<SubTab>('orders')
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [suggestions, setSuggestions] = useState<ReorderSuggestion[]>([])
  const [batches, setBatches] = useState<IngredientBatch[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PurchaseOrder | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Create form
  const [newSupplierId, setNewSupplierId] = useState('')
  const [newSupplierName, setNewSupplierName] = useState('')
  const [newReference, setNewReference] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [newLines, setNewLines] = useState<Array<{ ingredientId: string; qtyOrdered: string; unitCost: string }>>([
    { ingredientId: '', qtyOrdered: '', unitCost: '' },
  ])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ords, sups, sugg, batchList] = await Promise.all([
        purchaseOrdersApi.list(businessId),
        suppliersApi.list(businessId),
        purchaseOrdersApi.reorderSuggestions(businessId),
        purchaseOrdersApi.batches(businessId),
      ])
      setOrders(ords)
      setSuppliers(sups)
      setSuggestions(sugg)
      setBatches(batchList)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load purchase orders')
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => { void load() }, [load])

  async function handleCreate() {
    const validLines = newLines.filter(l => l.ingredientId && Number(l.qtyOrdered) > 0)
    if (validLines.length === 0) { toast.error('Add at least one ingredient line'); return }
    setActionLoading('create')
    try {
      const created = await purchaseOrdersApi.create(businessId, {
        supplierId: newSupplierId || undefined,
        supplierName: newSupplierName || undefined,
        reference: newReference,
        notes: newNotes,
        lines: validLines.map(l => ({
          ingredientId: l.ingredientId,
          qtyOrdered: Number(l.qtyOrdered),
          unitCost: Number(l.unitCost) || 0,
        })),
      })
      setOrders(prev => [created, ...prev])
      setShowCreate(false)
      setSelected(created)
      toast.success(`PO ${created.id} created`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create PO')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleSend(po: PurchaseOrder) {
    setActionLoading(po.id + ':send')
    try {
      const updated = await purchaseOrdersApi.send(businessId, po.id)
      setOrders(prev => prev.map(p => p.id === updated.id ? updated : p))
      if (selected?.id === po.id) setSelected(updated)
      toast.success('PO marked as sent')
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed') }
    finally { setActionLoading(null) }
  }

  async function handleCancel(po: PurchaseOrder) {
    if (!confirm(`Cancel PO ${po.id}?`)) return
    setActionLoading(po.id + ':cancel')
    try {
      const updated = await purchaseOrdersApi.cancel(businessId, po.id)
      setOrders(prev => prev.map(p => p.id === updated.id ? updated : p))
      if (selected?.id === po.id) setSelected(updated)
      toast.success('PO cancelled')
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed') }
    finally { setActionLoading(null) }
  }

  async function handleCreateFromSuggestions() {
    if (suggestions.length === 0) return
    setActionLoading('from-suggestions')
    try {
      const created = await purchaseOrdersApi.create(businessId, {
        notes: 'Auto-generated from reorder suggestions',
        lines: suggestions.map(s => ({
          ingredientId: s.ingredientId,
          qtyOrdered: Number(s.reorderQty),
          unitCost: s.avgUnitCost,
        })),
      })
      setOrders(prev => [created, ...prev])
      setSubTab('orders')
      setSelected(created)
      toast.success(`Draft PO created with ${suggestions.length} items`)
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed') }
    finally { setActionLoading(null) }
  }

  const SUB_TABS: Array<{ id: SubTab; label: string; count?: number }> = [
    { id: 'orders', label: 'Purchase Orders', count: orders.length },
    { id: 'reorder', label: 'Reorder Alerts', count: suggestions.length },
    { id: 'batches', label: 'Batches & Expiry', count: batches.filter(b => b.expiringSoon || b.expired).length || undefined },
  ]

  return (
    <section className="inventory-page">
      {/* Sub-tab bar */}
      <div className="flex gap-0 border-b mb-4 overflow-x-auto">
        {SUB_TABS.map(t => (
          <button key={t.id} type="button" onClick={() => setSubTab(t.id)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
              ${subTab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                {t.count}
              </span>
            )}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 pb-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void load()}>
            <RefreshCw className="size-3.5" />
          </Button>
          {subTab === 'orders' && (
            <Button size="sm" className="h-7" onClick={() => setShowCreate(true)}>
              <Plus className="size-3.5 mr-1" /> New PO
            </Button>
          )}
        </div>
      </div>

      {/* ── Orders ── */}
      {subTab === 'orders' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                      No purchase orders yet. Create one to track supplier deliveries.
                    </TableCell>
                  </TableRow>
                ) : orders.map(po => (
                  <TableRow key={po.id} className={`cursor-pointer ${selected?.id === po.id ? 'bg-muted/50' : ''}`}
                    onClick={() => setSelected(po)}>
                    <TableCell className="font-mono text-xs">{po.id}</TableCell>
                    <TableCell>{po.supplierName || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={STATUS_BADGE[po.status] ?? ''}>
                        {po.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{ugx(po.totalCost)}</TableCell>
                    <TableCell className="text-sm">{fmtDate(po.createdAt)}</TableCell>
                    <TableCell>
                      {po.status === 'DRAFT' && (
                        <Button variant="outline" size="sm" className="h-6 text-xs"
                          disabled={actionLoading === po.id + ':send'}
                          onClick={e => { e.stopPropagation(); void handleSend(po) }}>
                          Send
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* PO detail panel */}
          {selected && (
            <div className="rounded-md border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-mono text-sm font-medium">{selected.id}</p>
                <Badge variant="secondary" className={STATUS_BADGE[selected.status] ?? ''}>
                  {selected.status.replace('_', ' ')}
                </Badge>
              </div>
              {selected.supplierName && <p className="text-sm text-muted-foreground">Supplier: {selected.supplierName}</p>}
              {selected.reference && <p className="text-sm text-muted-foreground">Ref: {selected.reference}</p>}

              <div className="border-t pt-2 space-y-1">
                {selected.lines.map(l => (
                  <div key={l.id} className="flex justify-between text-sm">
                    <span>{l.ingredientName} <span className="text-muted-foreground">×{l.qtyOrdered} {l.unit}</span></span>
                    <span className="text-muted-foreground">{ugx(l.lineTotal)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between border-t pt-2 font-medium text-sm">
                <span>Total</span><span>{ugx(selected.totalCost)}</span>
              </div>

              <div className="flex gap-2 pt-1 flex-wrap">
                {(selected.status === 'SENT' || selected.status === 'PARTIALLY_RECEIVED') && (
                  <Button size="sm" className="h-7" onClick={() => { /* open receive sheet */ }}>
                    <PackageCheck className="size-3.5 mr-1" /> Receive stock
                  </Button>
                )}
                {selected.status !== 'CANCELLED' && selected.status !== 'RECEIVED' && (
                  <Button variant="outline" size="sm" className="h-7 text-destructive"
                    disabled={actionLoading === selected.id + ':cancel'}
                    onClick={() => void handleCancel(selected)}>
                    Cancel PO
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Reorder alerts ── */}
      {subTab === 'reorder' && (
        <div className="space-y-4">
          {suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No reorder alerts. Set a par level and reorder quantity on each ingredient to get suggestions when stock runs low.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {suggestions.length} ingredient{suggestions.length !== 1 ? 's' : ''} need restocking.
                </p>
                <Button size="sm" className="h-7" disabled={actionLoading === 'from-suggestions'}
                  onClick={() => void handleCreateFromSuggestions()}>
                  <Plus className="size-3.5 mr-1" /> Create draft PO from all
                </Button>
              </div>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ingredient</TableHead>
                      <TableHead className="text-right">On hand</TableHead>
                      <TableHead className="text-right">Par level</TableHead>
                      <TableHead className="text-right">Reorder qty</TableHead>
                      <TableHead className="text-right">Est. cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suggestions.map(s => (
                      <TableRow key={s.ingredientId}>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle className="size-3.5 text-amber-500 shrink-0" />
                            <span className="font-medium">{s.ingredientName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          {Number(s.qtyOnHand).toFixed(2)} {s.unit}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {Number(s.parLevel).toFixed(2)} {s.unit}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {Number(s.reorderQty).toFixed(2)} {s.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          {ugx(Number(s.reorderQty) * s.avgUnitCost)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Batches / expiry ── */}
      {subTab === 'batches' && (
        <div className="space-y-3">
          {batches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No batch records yet. Batch tracking is created automatically when you receive a purchase order with batch/expiry details.
            </p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingredient</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Received</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map(b => (
                    <TableRow key={b.id}
                      className={b.expired ? 'bg-red-50' : b.expiringSoon ? 'bg-amber-50' : ''}>
                      <TableCell className="font-medium">{b.ingredientName}</TableCell>
                      <TableCell className="font-mono text-xs">{b.batchNumber || '—'}</TableCell>
                      <TableCell className="text-right">
                        {Number(b.qtyRemaining).toFixed(2)} {b.unit}
                      </TableCell>
                      <TableCell>
                        {b.expiryDate ? (
                          <span className={b.expired ? 'text-red-600 font-medium' : b.expiringSoon ? 'text-amber-600 font-medium' : ''}>
                            {fmtDate(b.expiryDate)}
                            {b.expired && ' · EXPIRED'}
                            {!b.expired && b.expiringSoon && ' · Soon'}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(b.receivedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Create PO sheet */}
      <Sheet open={showCreate} onOpenChange={setShowCreate}>
        <SheetContent side="right" className="w-full max-w-lg flex flex-col gap-0 p-0">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle>New purchase order</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Supplier</Label>
                <Select value={newSupplierId} onValueChange={v => {
                  setNewSupplierId(v)
                  setNewSupplierName(suppliers.find(s => s.id === v)?.name ?? '')
                }}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Reference / invoice no.</Label>
                <Input value={newReference} onChange={e => setNewReference(e.target.value)}
                  placeholder="INV-001" className="h-8" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Notes</Label>
              <Textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} rows={2}
                placeholder="Delivery instructions, payment terms…" />
            </div>

            <div>
              <Label className="mb-2 block">Order lines</Label>
              <div className="space-y-2">
                {newLines.map((line, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <Select value={line.ingredientId} onValueChange={v =>
                      setNewLines(prev => prev.map((l, j) => j === i ? { ...l, ingredientId: v } : l))}>
                      <SelectTrigger className="h-8 flex-1"><SelectValue placeholder="Ingredient" /></SelectTrigger>
                      <SelectContent>
                        {ingredients.map(ing => <SelectItem key={ing.id} value={ing.id}>{ing.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input className="h-8 w-24" placeholder="Qty" type="number" min="0.001"
                      value={line.qtyOrdered}
                      onChange={e => setNewLines(prev => prev.map((l, j) => j === i ? { ...l, qtyOrdered: e.target.value } : l))} />
                    <Input className="h-8 w-28" placeholder="Unit cost" type="number" min="0"
                      value={line.unitCost}
                      onChange={e => setNewLines(prev => prev.map((l, j) => j === i ? { ...l, unitCost: e.target.value } : l))} />
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground"
                      onClick={() => setNewLines(prev => prev.filter((_, j) => j !== i))}>×</Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="h-7"
                  onClick={() => setNewLines(prev => [...prev, { ingredientId: '', qtyOrdered: '', unitCost: '' }])}>
                  <Plus className="size-3.5 mr-1" /> Add line
                </Button>
              </div>
            </div>
          </div>
          <div className="border-t px-6 py-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}
              disabled={actionLoading === 'create'}>Cancel</Button>
            <Button onClick={() => void handleCreate()} disabled={actionLoading === 'create'}>
              {actionLoading === 'create' ? 'Creating…' : 'Create PO'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  )
}
