import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
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
} from '../api/inventory'
import { operationsApi, type Branch } from '../api/operations'
import type { CatalogItem } from '../api/types'

const UNITS = ['kg', 'g', 'L', 'ml', 'pcs', 'portion'] as const

function ugx(amount: number) {
  return `UGX ${Math.round(amount).toLocaleString()}`
}

function fmtQty(qty: number, unit: string) {
  const n = Number(qty)
  const text = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
  return `${text} ${unit}`
}

type Tab = 'stock' | 'recipes' | 'movements'

export function InventoryPage({
  businessId,
  catalogItems,
}: {
  businessId: string
  catalogItems: CatalogItem[]
}) {
  const [tab, setTab] = useState<Tab>('stock')
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [summary, setSummary] = useState<{ ingredientCount: number; lowStockCount: number; stockValueTotal: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [movementSearch, setMovementSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const foodItems = useMemo(
    () => catalogItems.filter((item) => !item.itemKind || item.itemKind === 'FOOD'),
    [catalogItems],
  )

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [items, sum, moves, branchList] = await Promise.all([
        inventoryApi.listIngredients(businessId),
        inventoryApi.summary(businessId),
        inventoryApi.listMovements(businessId, 200),
        operationsApi.listBranches(businessId).catch(() => [] as Branch[]),
      ])
      setIngredients(items)
      setSummary(sum)
      setMovements(moves)
      setBranches(branchList)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    void reload()
  }, [reload])

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

  return (
    <section className="inventory-page">
      <div className="inventory-metrics-row">
        <div className="metric-grid overview-metric-grid" aria-label="Inventory summary">
          <div>
            <span>INGREDIENTS</span>
            <strong>{summary?.ingredientCount ?? '—'}</strong>
          </div>
          <div>
            <span>STOCK VALUE</span>
            <strong>{summary ? ugx(summary.stockValueTotal) : '—'}</strong>
          </div>
          <div>
            <span>LOW STOCK</span>
            <strong style={{ color: (summary?.lowStockCount ?? 0) > 0 ? '#b45309' : undefined }}>
              {summary?.lowStockCount ?? '—'}
            </strong>
          </div>
        </div>

        <div className="inventory-page-toolbar">
          {tab === 'recipes' ? null : (
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder={tab === 'stock' ? 'Search ingredients…' : 'Search movements…'}
                value={tab === 'stock' ? search : movementSearch}
                onChange={(e) =>
                  tab === 'stock' ? setSearch(e.target.value) : setMovementSearch(e.target.value)
                }
                className="h-8 pl-8 text-sm"
                aria-label={tab === 'stock' ? 'Search ingredients' : 'Search movements'}
              />
            </div>
          )}
          {tab === 'stock' ? (
            <Button type="button" size="sm" className="h-8" onClick={() => setShowAdd((v) => !v)}>
              {showAdd ? (
                'Cancel'
              ) : (
                <>
                  <Plus className="size-3.5" />
                  Add ingredient
                </>
              )}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="range-tabs" aria-label="Inventory sections">
        {(
          [
            ['stock', 'Stock'],
            ['recipes', 'Recipes'],
            ['movements', 'Movements'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="report-empty">Loading inventory…</p>
      ) : tab === 'stock' ? (
        <StockTab
          businessId={businessId}
          ingredients={filtered}
          search={search}
          showAdd={showAdd}
          onCloseAdd={() => setShowAdd(false)}
          onChanged={reload}
        />
      ) : tab === 'recipes' ? (
        <RecipesTab businessId={businessId} foodItems={foodItems} ingredients={ingredients} />
      ) : (
        <MovementsTab movements={movements} branches={branches} search={movementSearch} />
      )}
    </section>
  )
}

function StockTab({
  businessId,
  ingredients,
  search,
  showAdd,
  onCloseAdd,
  onChanged,
}: {
  businessId: string
  ingredients: Ingredient[]
  search: string
  showAdd: boolean
  onCloseAdd: () => void
  onChanged: () => void
}) {
  const [actionFor, setActionFor] = useState<{
    id: string
    mode: 'receive'
  } | null>(null)
  const pagination = usePagination(ingredients, {
    initialPageSize: 20,
    resetKey: `${businessId}|${search}`,
  })
  const { pageItems } = pagination

  return (
    <div className="inventory-panel">
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {showAdd ? (
          <div className="border-b border-border px-4 py-4">
            <AddIngredientForm
              businessId={businessId}
              onDone={() => {
                onCloseAdd()
                onChanged()
              }}
            />
          </div>
        ) : null}

        {actionFor ? (
          <div className="border-b border-border px-4 py-4">
            <StockActionForm
              businessId={businessId}
              ingredient={ingredients.find((i) => i.id === actionFor.id)}
              mode="receive"
              siblingBranches={[]}
              onCancel={() => setActionFor(null)}
              onDone={() => {
                setActionFor(null)
                onChanged()
              }}
            />
          </div>
        ) : null}

        <div className="p-4">
          {ingredients.length === 0 ? (
            <p className="report-empty">No ingredients yet. Add stock to track cost and profit.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingredient</TableHead>
                    <TableHead>On hand</TableHead>
                    <TableHead>Unit cost</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <strong>{item.name}</strong>
                        <div className="text-xs text-muted-foreground">
                          {item.category || 'Uncategorized'}
                          {item.lowStock ? (
                            <Badge variant="outline" className="ml-2">
                              Low
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>{fmtQty(item.qtyOnHand, item.unit)}</TableCell>
                      <TableCell>{ugx(item.avgUnitCost)}</TableCell>
                      <TableCell>{ugx(item.stockValue)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setActionFor({ id: item.id, mode: 'receive' })}>
                          Receive
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationBar pagination={pagination} hideWhenEmpty={false} className="report-list-pagination" />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function AddIngredientForm({
  businessId,
  onDone,
}: {
  businessId: string
  onDone: () => void
}) {
  const [name, setName] = useState('')
  const [unit, setUnit] = useState<string>('kg')
  const [category, setCategory] = useState('')
  const [qty, setQty] = useState('0')
  const [unitCost, setUnitCost] = useState('0')
  const [threshold, setThreshold] = useState('0')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await inventoryApi.createIngredient(businessId, {
        name: name.trim(),
        unit,
        category: category.trim() || undefined,
        qtyOnHand: Number(qty) || 0,
        avgUnitCost: Math.max(0, Math.round(Number(unitCost) || 0)),
        lowStockThreshold: Number(threshold) || 0,
      })
      toast.success('Ingredient added')
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add ingredient')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="inventory-form" onSubmit={submit}>
      <h3 style={{ margin: 0 }}>New ingredient</h3>
      <div className="inventory-form-grid">
        <div className="grid gap-1.5">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Chicken breast" required />
        </div>
        <div className="grid gap-1.5">
          <Label>Unit</Label>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNITS.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Category</Label>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Protein" />
        </div>
        <div className="grid gap-1.5">
          <Label>Opening qty</Label>
          <Input type="number" min={0} step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>Unit cost (UGX)</Label>
          <Input type="number" min={0} value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>Low-stock at</Label>
          <Input type="number" min={0} step="any" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
        </div>
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Save ingredient'}
      </Button>
    </form>
  )
}

function StockActionForm({
  businessId,
  ingredient,
  mode,
  siblingBranches,
  onCancel,
  onDone,
}: {
  businessId: string
  ingredient?: Ingredient
  mode: 'receive' | 'adjust' | 'waste' | 'transfer'
  siblingBranches: Branch[]
  onCancel: () => void
  onDone: () => void
}) {
  const [qty, setQty] = useState('')
  const [unitCost, setUnitCost] = useState(String(ingredient?.avgUnitCost ?? 0))
  const [note, setNote] = useState('')
  const [toBusinessId, setToBusinessId] = useState(siblingBranches[0]?.id ?? '')
  const [saving, setSaving] = useState(false)

  if (!ingredient) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const amount = Number(qty)
    if (!Number.isFinite(amount) || amount === 0) return
    setSaving(true)
    try {
      if (mode === 'receive') {
        await inventoryApi.receive(businessId, ingredient!.id, {
          qty: Math.abs(amount),
          unitCost: Math.max(0, Math.round(Number(unitCost) || 0)),
          note: note.trim() || undefined,
        })
      } else if (mode === 'adjust') {
        await inventoryApi.adjust(businessId, ingredient!.id, {
          qtyDelta: amount,
          note: note.trim() || undefined,
        })
      } else if (mode === 'transfer') {
        if (!toBusinessId) {
          toast.error('Pick a destination branch')
          setSaving(false)
          return
        }
        const result = await inventoryApi.transfer(businessId, ingredient!.id, {
          toBusinessId,
          qty: Math.abs(amount),
          note: note.trim() || undefined,
        })
        toast.success(
          `Transferred ${result.qty} ${ingredient!.unit} → ${result.toBranchLabel} (${result.transferGroupId})`,
        )
        onDone()
        return
      } else {
        await inventoryApi.waste(businessId, ingredient!.id, {
          qty: Math.abs(amount),
          note: note.trim() || undefined,
        })
      }
      toast.success('Stock updated')
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Stock update failed')
    } finally {
      setSaving(false)
    }
  }

  const title =
    mode === 'receive'
      ? `Receive · ${ingredient.name}`
      : mode === 'adjust'
        ? `Adjust (this branch) · ${ingredient.name}`
        : mode === 'transfer'
          ? `Transfer · ${ingredient.name}`
          : `Waste · ${ingredient.name}`

  return (
    <form className="inventory-form" onSubmit={submit}>
      <h3 style={{ margin: 0 }}>{title}</h3>
      <p className="text-sm text-muted-foreground" style={{ margin: 0 }}>
        On hand: {fmtQty(ingredient.qtyOnHand, ingredient.unit)}
        {mode === 'adjust' ? ' · Use Transfer to move stock to another branch.' : null}
      </p>
      <div className="inventory-form-grid">
        {mode === 'transfer' ? (
          <div className="grid gap-1.5">
            <Label>To branch</Label>
            <Select value={toBusinessId} onValueChange={setToBusinessId}>
              <SelectTrigger>
                <SelectValue placeholder="Select branch" />
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
          <Input type="number" step="any" value={qty} onChange={(e) => setQty(e.target.value)} required />
        </div>
        {mode === 'receive' ? (
          <div className="grid gap-1.5">
            <Label>Unit cost (UGX)</Label>
            <Input type="number" min={0} value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
          </div>
        ) : null}
        <div className="grid gap-1.5">
          <Label>Note</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : mode === 'transfer' ? 'Transfer stock' : 'Save'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function RecipesTab({
  businessId,
  foodItems,
  ingredients,
}: {
  businessId: string
  foodItems: CatalogItem[]
  ingredients: Ingredient[]
}) {
  const [selectedId, setSelectedId] = useState(foodItems[0]?.id ?? '')
  const [lines, setLines] = useState<Array<{ ingredientId: string; qtyPerSale: string }>>([])
  const [meta, setMeta] = useState<{ sellPrice: number; estimatedCost: number; marginPercent: number | null; name: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    setLoading(true)
    inventoryApi
      .getRecipe(businessId, selectedId)
      .then((recipe) => {
        if (cancelled) return
        setLines(
          recipe.lines.map((l) => ({
            ingredientId: l.ingredientId,
            qtyPerSale: String(l.qtyPerSale),
          })),
        )
        setMeta({
          sellPrice: recipe.sellPrice,
          estimatedCost: recipe.estimatedCost,
          marginPercent: recipe.marginPercent,
          name: recipe.catalogItemName,
        })
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load recipe'))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [businessId, selectedId])

  const liveCost = useMemo(() => {
    return lines.reduce((sum, line) => {
      const ing = ingredients.find((i) => i.id === line.ingredientId)
      const qty = Number(line.qtyPerSale) || 0
      if (!ing || qty <= 0) return sum
      return sum + Math.round(qty * ing.avgUnitCost)
    }, 0)
  }, [lines, ingredients])

  async function save() {
    if (!selectedId) return
    const payload = lines
      .filter((l) => l.ingredientId && Number(l.qtyPerSale) > 0)
      .map((l) => ({ ingredientId: l.ingredientId, qtyPerSale: Number(l.qtyPerSale) }))
    setSaving(true)
    try {
      const recipe = await inventoryApi.setRecipe(businessId, selectedId, payload)
      setMeta({
        sellPrice: recipe.sellPrice,
        estimatedCost: recipe.estimatedCost,
        marginPercent: recipe.marginPercent,
        name: recipe.catalogItemName,
      })
      toast.success('Recipe saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save recipe')
    } finally {
      setSaving(false)
    }
  }

  if (foodItems.length === 0) {
    return <p className="report-empty">Add food items in Catalog first, then link recipes here.</p>
  }

  if (ingredients.length === 0) {
    return <p className="report-empty">Add ingredients in Stock before building recipes.</p>
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="h-8 max-w-sm text-sm">
            <SelectValue placeholder="Select menu item" />
          </SelectTrigger>
          <SelectContent>
            {foodItems.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          className="h-8 ml-auto"
          onClick={() => void save()}
          disabled={saving || loading}
        >
          {saving ? 'Saving…' : 'Save recipe'}
        </Button>
      </div>

      <div className="inventory-panel p-4">
        {meta ? (
          <div className="inventory-recipe-meta">
            <span>
              Sell <strong>{ugx(meta.sellPrice)}</strong>
            </span>
            <span>
              Est. cost <strong>{ugx(liveCost || meta.estimatedCost)}</strong>
            </span>
            <span>
              Margin{' '}
              <strong>
                {meta.sellPrice > 0
                  ? `${Math.round(((meta.sellPrice - (liveCost || meta.estimatedCost)) * 100) / meta.sellPrice)}%`
                  : '—'}
              </strong>
            </span>
          </div>
        ) : null}

        {loading ? (
          <p className="report-empty">Loading recipe…</p>
        ) : (
          <div className="inventory-form">
            {lines.map((line, index) => (
              <div key={`${line.ingredientId}-${index}`} className="inventory-form-grid">
                <div className="grid gap-1.5">
                  <Label>Ingredient</Label>
                  <Select
                    value={line.ingredientId}
                    onValueChange={(value) => {
                      const next = [...lines]
                      next[index] = { ...next[index], ingredientId: value }
                      setLines(next)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pick ingredient" />
                    </SelectTrigger>
                    <SelectContent>
                      {ingredients.map((ing) => (
                        <SelectItem key={ing.id} value={ing.id}>
                          {ing.name} ({ing.unit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Qty per portion</Label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={line.qtyPerSale}
                    onChange={(e) => {
                      const next = [...lines]
                      next[index] = { ...next[index], qtyPerSale: e.target.value }
                      setLines(next)
                    }}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setLines(lines.filter((_, i) => i !== index))}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setLines([...lines, { ingredientId: ingredients[0]?.id ?? '', qtyPerSale: '1' }])
              }
            >
              Add line
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function MovementsTab({
  movements,
  branches,
  search,
}: {
  movements: StockMovement[]
  branches: Branch[]
  search: string
}) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return movements
    return movements.filter(
      (m) =>
        m.ingredientName.toLowerCase().includes(q) ||
        m.movementType.toLowerCase().includes(q) ||
        (m.note || '').toLowerCase().includes(q) ||
        (m.transferGroupId || '').toLowerCase().includes(q),
    )
  }, [movements, search])

  const pagination = usePagination(filtered, {
    initialPageSize: 20,
    resetKey: `${search}|${filtered.length}`,
  })
  const { pageItems } = pagination

  const branchName = (id?: string | null) => {
    if (!id) return null
    const b = branches.find((x) => x.id === id)
    return b ? b.branchLabel || b.name : id
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="p-4">
        {movements.length === 0 ? (
          <p className="report-empty">No stock movements yet.</p>
        ) : filtered.length === 0 ? (
          <p className="report-empty">No movements match your search.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Ingredient</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Match / note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((m) => {
                  const other = branchName(m.relatedBusinessId)
                  const matchLabel =
                    m.transferGroupId && other
                      ? `${m.transferGroupId} · ${m.movementType === 'TRANSFER_OUT' ? '→' : '←'} ${other}`
                      : m.transferGroupId || m.note || m.orderId || '—'
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(m.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{m.movementType}</Badge>
                      </TableCell>
                      <TableCell>{m.ingredientName}</TableCell>
                      <TableCell>
                        {m.qtyDelta > 0 ? '+' : ''}
                        {m.qtyDelta}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {matchLabel}
                        {m.note && m.transferGroupId ? (
                          <div>{m.note}</div>
                        ) : null}
                      </TableCell>
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
  )
}
