import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import {
  CalendarRange,
  Check,
  ImagePlus,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { announcementsApi, imagesApi } from '@/api/services'
import type { BusinessAnnouncement, ImageSearchResult } from '@/api/types'
import { resizeImageFile } from '@/lib/resizeImage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

// ── helpers ───────────────────────────────────────────────────────────────────

function toLocalDateString(iso: string | null | undefined): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

function formatDateRange(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
  if (startsAt && endsAt) return `${fmt(startsAt)} – ${fmt(endsAt)}`
  if (startsAt) return `From ${fmt(startsAt)}`
  if (endsAt) return `Until ${fmt(endsAt)}`
  return 'No date set'
}

function isActive(a: BusinessAnnouncement): boolean {
  const now = Date.now()
  const start = a.startsAt ? new Date(a.startsAt).getTime() : -Infinity
  const end = a.endsAt ? new Date(a.endsAt).getTime() : Infinity
  return a.active && now >= start && now <= end
}

// ── form state ────────────────────────────────────────────────────────────────

interface FormState {
  title: string
  body: string
  imageUrl: string
  startsAt: string
  endsAt: string
}

const BLANK: FormState = { title: '', body: '', imageUrl: '', startsAt: '', endsAt: '' }

// ── image picker (device upload + Pexels search) ──────────────────────────────

function AnnouncementImagePicker({
  imageUrl,
  disabled,
  onChange,
}: {
  imageUrl: string
  disabled?: boolean
  onChange: (url: string) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<ImageSearchResult[]>([])
  const [importingId, setImportingId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file'); return }
    setUploadingImage(true)
    try {
      const dataUrl = await resizeImageFile(file, 960, 0.84)
      onChange(dataUrl)
      setSelectedId(null)
      setSearchOpen(false)
      toast.success('Image uploaded')
    } catch {
      toast.error('Could not process image')
    } finally {
      setUploadingImage(false)
    }
  }

  async function runSearch() {
    const q = query.trim()
    if (!q) return
    setSearching(true)
    setSelectedId(null)
    try {
      const response = await imagesApi.search(q, 20)
      setResults(response.results)
      if (response.results.length === 0) toast.message('No photos found. Try another word.')
    } catch (err) {
      setResults([])
      toast.error(err instanceof Error ? err.message : 'Photo search failed')
    } finally {
      setSearching(false)
    }
  }

  async function useResult(result: ImageSearchResult) {
    if (importingId) return
    setImportingId(result.id)
    setSelectedId(result.id)
    try {
      const dataUrl = await imagesApi.importFromUrl(result.imageUrl)
      onChange(dataUrl)
      setSearchOpen(false)
      toast.success('Photo ready')
    } catch {
      try {
        onChange(result.imageUrl)
        setSearchOpen(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not use this photo')
        setSelectedId(null)
      }
    } finally {
      setImportingId(null)
    }
  }

  return (
    <div className="grid gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled || uploadingImage}
        onChange={handleFile}
      />

      {/* Preview */}
      {imageUrl ? (
        <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', aspectRatio: '16/7' }}>
          <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          <button
            type="button"
            aria-label="Remove image"
            onClick={() => { onChange(''); setSelectedId(null); setResults([]) }}
            style={{
              position: 'absolute', top: 6, right: 6,
              background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%',
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#fff',
            }}
          >
            <X size={14} />
          </button>
        </div>
      ) : null}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploadingImage}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploadingImage ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
          {uploadingImage ? 'Processing…' : 'Upload from device'}
        </Button>
        <Button
          type="button"
          variant={searchOpen ? 'default' : 'outline'}
          size="sm"
          disabled={disabled}
          onClick={() => setSearchOpen((v) => !v)}
        >
          <Search size={14} />
          Search free photos
        </Button>
        {imageUrl ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => { onChange(''); setSelectedId(null) }}
          >
            <Trash2 size={14} />
            Remove
          </Button>
        ) : null}
      </div>

      {/* Pexels search panel */}
      {searchOpen ? (
        <div className="rounded-xl border border-border bg-muted/20 p-3 grid gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="search"
              className="flex-1"
              value={query}
              disabled={searching}
              placeholder="e.g. live music, food festival…"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void runSearch() } }}
            />
            <Button
              type="button"
              disabled={searching || !query.trim()}
              onClick={() => void runSearch()}
            >
              {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Find
            </Button>
          </div>

          {results.length > 0 ? (
            <>
              <p className="text-xs text-muted-foreground">Tap a photo to use it.</p>
              <div className="grid grid-cols-3 gap-2 max-h-[240px] overflow-y-auto">
                {results.map((result) => {
                  const busy = importingId === result.id
                  const selected = selectedId === result.id
                  return (
                    <button
                      key={result.id}
                      type="button"
                      disabled={Boolean(importingId)}
                      className={`relative overflow-hidden rounded-lg border aspect-square disabled:opacity-60 ${selected ? 'border-primary ring-2 ring-primary/40' : 'border-border'}`}
                      onClick={() => void useResult(result)}
                      title={result.alt || result.photographer}
                    >
                      <img src={result.thumbUrl} alt={result.alt || ''} className="size-full object-cover" />
                      {busy ? (
                        <span className="absolute inset-0 grid place-items-center bg-black/45 text-white">
                          <Loader2 className="size-4 animate-spin" />
                        </span>
                      ) : selected ? (
                        <span className="absolute top-1.5 right-1.5 rounded-full bg-primary p-1 text-primary-foreground">
                          <Check className="size-3" />
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Search for event or food keywords, then tap a photo.
            </p>
          )}

        </div>
      ) : null}
    </div>
  )
}

// ── announcement form ─────────────────────────────────────────────────────────

function AnnouncementForm({
  initial,
  saving,
  onSave,
  onCancel,
}: {
  initial: FormState
  saving: boolean
  onSave: (data: FormState) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<FormState>(initial)

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function validate(): string | null {
    if (!form.title.trim()) return 'Title is required'
    if (form.startsAt && form.endsAt && form.endsAt < form.startsAt)
      return 'End date must be after start date'
    return null
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validate()
    if (err) { toast.error(err); return }
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
      {/* Title */}
      <div className="grid gap-1.5">
        <Label htmlFor="ann-title">
          Title <span aria-hidden="true" style={{ color: 'var(--destructive)' }}>*</span>
        </Label>
        <Input
          id="ann-title"
          placeholder="e.g. Live music this Friday!"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          maxLength={120}
          required
          disabled={saving}
        />
      </div>

      {/* Body */}
      <div className="grid gap-1.5">
        <Label htmlFor="ann-body">
          Details{' '}
          <span style={{ fontWeight: 400, color: 'var(--muted-foreground)', fontSize: 12 }}>
            (optional)
          </span>
        </Label>
        <Textarea
          id="ann-body"
          placeholder="Share extra info — time, dress code, special offers…"
          value={form.body}
          onChange={(e) => set('body', e.target.value)}
          rows={3}
          maxLength={600}
          disabled={saving}
        />
      </div>

      {/* Image picker */}
      <div className="grid gap-1.5">
        <Label>
          Image{' '}
          <span style={{ fontWeight: 400, color: 'var(--muted-foreground)', fontSize: 12 }}>
            (optional)
          </span>
        </Label>
        <AnnouncementImagePicker
          imageUrl={form.imageUrl}
          disabled={saving}
          onChange={(url) => set('imageUrl', url)}
        />
      </div>

      {/* Date range */}
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="ann-starts">Show from</Label>
          <DatePicker
            id="ann-starts"
            value={form.startsAt}
            onChange={(v) => set('startsAt', v)}
            placeholder="Any date"
            disabled={saving}
            aria-label="Show from date"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ann-ends">Show until</Label>
          <DatePicker
            id="ann-ends"
            value={form.endsAt}
            min={form.startsAt || undefined}
            onChange={(v) => set('endsAt', v)}
            placeholder="Any date"
            disabled={saving}
            aria-label="Show until date"
          />
        </div>
      </div>
      <p style={{ margin: '-8px 0 0', fontSize: 11, color: 'var(--muted-foreground)' }}>
        Leave both dates empty to show the announcement indefinitely.
      </p>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" disabled={saving}>
          {saving && <Loader2 size={14} className="animate-spin" />}
          Save announcement
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

// ── main panel ────────────────────────────────────────────────────────────────

export function AnnouncementsPanel({
  open,
  businessId,
  onOpenChange,
}: {
  open: boolean
  businessId: string
  onOpenChange: (open: boolean) => void
}) {
  const [announcements, setAnnouncements] = useState<BusinessAnnouncement[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formInitial, setFormInitial] = useState<FormState>(BLANK)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoadError(null)
    setLoading(true)
    announcementsApi
      .list(businessId)
      .then((list) => { setAnnouncements(list); setLoadError(null) })
      .catch((err) => {
        // Don't crash the panel — just show an inline message
        setLoadError(err instanceof Error ? err.message : 'Could not load announcements')
      })
      .finally(() => setLoading(false))
  }, [open, businessId])

  function openCreate() {
    setFormInitial(BLANK)
    setEditingId(null)
    setFormMode('create')
  }

  function openEdit(a: BusinessAnnouncement) {
    setFormInitial({
      title: a.title,
      body: a.body ?? '',
      imageUrl: a.imageUrl ?? '',
      startsAt: toLocalDateString(a.startsAt),
      endsAt: toLocalDateString(a.endsAt),
    })
    setEditingId(a.id)
    setFormMode('edit')
  }

  function closeForm() {
    setFormMode(null)
    setEditingId(null)
    setFormInitial(BLANK)
  }

  async function handleSave(data: FormState) {
    setSaving(true)
    try {
      const payload = {
        title: data.title.trim(),
        body: data.body.trim() || null,
        imageUrl: data.imageUrl || null,
        startsAt: data.startsAt ? new Date(data.startsAt).toISOString() : null,
        endsAt: data.endsAt ? new Date(data.endsAt + 'T23:59:59').toISOString() : null,
      }

      if (formMode === 'edit' && editingId) {
        const updated = await announcementsApi.update(businessId, editingId, payload)
        setAnnouncements((prev) => prev.map((a) => (a.id === editingId ? updated : a)))
        toast.success('Announcement updated')
      } else {
        const created = await announcementsApi.create(businessId, payload)
        setAnnouncements((prev) => [created, ...prev])
        toast.success('Announcement created')
      }
      closeForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save announcement')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return
    setDeletingId(id)
    try {
      await announcementsApi.delete(businessId, id)
      setAnnouncements((prev) => prev.filter((a) => a.id !== id))
      toast.success('Announcement deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete announcement')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleToggleActive(a: BusinessAnnouncement) {
    try {
      const updated = await announcementsApi.update(businessId, a.id, { active: !a.active })
      setAnnouncements((prev) => prev.map((x) => (x.id === a.id ? updated : x)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update announcement')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
        <SheetHeader className="border-b border-border px-6 py-4 flex-shrink-0">
          <SheetTitle>Announcements</SheetTitle>
          <SheetDescription>
            Create event notices or promotions — customers see them when they scan your QR code.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">

          {/* New / edit form */}
          {formMode ? (
            <div style={{ background: 'var(--muted)', borderRadius: 12, padding: '16px' }}>
              <p style={{ margin: '0 0 12px', fontWeight: 600, fontSize: 14 }}>
                {formMode === 'edit' ? 'Edit announcement' : 'New announcement'}
              </p>
              <AnnouncementForm
                initial={formInitial}
                saving={saving}
                onSave={handleSave}
                onCancel={closeForm}
              />
            </div>
          ) : (
            <Button size="sm" className="w-fit" onClick={openCreate}>
              <Plus size={14} />
              New announcement
            </Button>
          )}

          {/* Loading / error / list */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted-foreground)', fontSize: 13 }}>
              <Loader2 size={18} className="animate-spin inline-block mb-2" />
              <p style={{ margin: 0 }}>Loading…</p>
            </div>
          ) : loadError ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>
                {loadError}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setLoadError(null)
                  setLoading(true)
                  announcementsApi
                    .list(businessId)
                    .then((list) => setAnnouncements(list))
                    .catch((err) => setLoadError(err instanceof Error ? err.message : 'Error'))
                    .finally(() => setLoading(false))
                }}
              >
                Retry
              </Button>
            </div>
          ) : announcements.length === 0 && !formMode ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Megaphone size={28} style={{ margin: '0 auto 10px', color: 'var(--muted-foreground)', display: 'block' }} />
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>No announcements yet</p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted-foreground)' }}>
                Add one to let customers know about events or promotions.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {announcements.map((a) => {
                const live = isActive(a)
                const isDeleting = deletingId === a.id
                return (
                  <div
                    key={a.id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      overflow: 'hidden',
                      opacity: isDeleting ? 0.5 : 1,
                      transition: 'opacity 0.2s',
                    }}
                  >
                    {a.imageUrl ? (
                      <div style={{ height: 110, overflow: 'hidden' }}>
                        <img src={a.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </div>
                    ) : null}

                    <div style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <p style={{ margin: 0, fontWeight: 650, fontSize: 14, flex: 1, lineHeight: 1.3 }}>
                          {a.title}
                        </p>
                        <button
                          type="button"
                          onClick={() => void handleToggleActive(a)}
                          style={{
                            flexShrink: 0,
                            border: '1px solid var(--border)',
                            borderRadius: 999,
                            padding: '2px 8px',
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: '0.05em',
                            cursor: 'pointer',
                            background: live ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'var(--muted)',
                            color: live ? 'var(--primary)' : 'var(--muted-foreground)',
                          }}
                          title={a.active ? 'Click to deactivate' : 'Click to activate'}
                        >
                          {live ? 'LIVE' : a.active ? 'ACTIVE' : 'OFF'}
                        </button>
                      </div>

                      {a.body ? (
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted-foreground)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {a.body}
                        </p>
                      ) : null}

                      <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CalendarRange size={11} style={{ flexShrink: 0 }} />
                        {formatDateRange(a.startsAt, a.endsAt)}
                      </p>

                      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          style={{ fontSize: 11, height: 28, padding: '0 10px' }}
                          onClick={() => openEdit(a)}
                          disabled={isDeleting || formMode === 'edit'}
                        >
                          <Pencil size={11} />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          style={{ fontSize: 11, height: 28, padding: '0 10px', color: 'var(--destructive)' }}
                          onClick={() => void handleDelete(a.id, a.title)}
                          disabled={isDeleting}
                        >
                          {isDeleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
