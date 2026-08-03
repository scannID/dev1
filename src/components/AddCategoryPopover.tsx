import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function AddCategoryPopover({
  open,
  onOpenChange,
  onSave,
  trigger,
  anchor,
  title = 'New category',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (name: string) => Promise<void>
  trigger?: ReactNode
  anchor?: ReactNode
  title?: string
}) {
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setDraft('')
      setError(null)
      setSaving(false)
    }
  }, [open])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const name = draft.trim()
    if (!name) {
      setError('Enter a category name')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(name)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add category')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {anchor ? <PopoverAnchor asChild>{anchor}</PopoverAnchor> : null}
      {trigger ? <PopoverTrigger asChild>{trigger}</PopoverTrigger> : null}
      <PopoverContent
        side="left"
        align="start"
        sideOffset={8}
        className="z-[70] w-64 p-4 shadow-lg"
      >
        <form className="grid gap-3" onSubmit={(e) => void submit(e)} noValidate>
          <div>
            <p className="text-sm font-medium text-foreground">{title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Menu group for your items</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="new-category-name" className="text-xs">
              Name
            </Label>
            <Input
              id="new-category-name"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Bites, Cocktails, Merch"
              disabled={saving}
              autoFocus
              className="h-8 text-sm"
            />
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}
