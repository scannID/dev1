import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  suppliersApi,
  type Supplier,
  type CreateSupplierRequest,
} from '../api/inventory'

export function SuppliersPage({ businessId }: { businessId: string }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<CreateSupplierRequest & { active?: boolean }>({
    name: '', contactName: '', phone: '', email: '', address: '', notes: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setSuppliers(await suppliersApi.list(businessId, true))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load suppliers')
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return suppliers
    return suppliers.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.contactName.toLowerCase().includes(q) ||
      s.phone.toLowerCase().includes(q)
    )
  }, [suppliers, search])

  function openAdd() {
    setEditing(null)
    setForm({ name: '', contactName: '', phone: '', email: '', address: '', notes: '' })
    setSheetOpen(true)
  }

  function openEdit(s: Supplier) {
    setEditing(s)
    setForm({ name: s.name, contactName: s.contactName, phone: s.phone,
      email: s.email, address: s.address, notes: s.notes, active: s.active })
    setSheetOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Supplier name is required'); return }
    setSaving(true)
    try {
      if (editing) {
        const updated = await suppliersApi.update(businessId, editing.id, form)
        setSuppliers(prev => prev.map(s => s.id === updated.id ? updated : s))
        toast.success('Supplier updated')
      } else {
        const created = await suppliersApi.create(businessId, form)
        setSuppliers(prev => [created, ...prev])
        toast.success('Supplier added')
      }
      setSheetOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save supplier')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="inventory-page">
      <div className="inventory-page-toolbar" style={{ marginBottom: 16 }}>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search suppliers…" value={search}
            onChange={e => setSearch(e.target.value)} className="h-8 pl-8 text-sm" />
        </div>
        <Button size="sm" className="h-8" onClick={openAdd}>
          <Plus className="size-3.5" /> Add supplier
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No suppliers yet. Add your first supplier to link them to ingredients and purchase orders.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.contactName || '—'}</TableCell>
                  <TableCell>{s.phone || '—'}</TableCell>
                  <TableCell>{s.email || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={s.active ? 'secondary' : 'outline'}
                      className={s.active ? 'bg-emerald-50 text-emerald-700' : 'text-muted-foreground'}>
                      {s.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => openEdit(s)}>
                      <Pencil className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle>{editing ? 'Edit supplier' : 'Add supplier'}</SheetTitle>
            <SheetDescription>Supplier details and contact info.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 grid gap-4">
            <div className="grid gap-1.5">
              <Label>Supplier name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Kampala Fresh Produce" />
            </div>
            <div className="grid gap-1.5">
              <Label>Contact name</Label>
              <Input value={form.contactName || ''} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                placeholder="e.g. John Mukasa" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Phone</Label>
                <Input value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+256 700…" />
              </div>
              <div className="grid gap-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="supplier@email.com" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Address</Label>
              <Textarea value={form.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Nakasero Market, Kampala" rows={2} />
            </div>
            <div className="grid gap-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Payment terms, delivery schedule…" rows={2} />
            </div>
            {editing && (
              <div className="flex items-center gap-2">
                <input type="checkbox" id="sup-active" checked={form.active !== false}
                  onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
                <Label htmlFor="sup-active">Active</Label>
              </div>
            )}
          </div>
          <div className="border-t px-6 py-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSheetOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save supplier'}</Button>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  )
}
