import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CatalogIngredient } from '@/api/types'
import { newIngredientId } from '@/lib/catalogCart'

export function IngredientsEditor({
  value,
  onChange,
  disabled,
  id = 'ingredients',
}: {
  value: CatalogIngredient[]
  onChange: (next: CatalogIngredient[]) => void
  disabled?: boolean
  id?: string
}) {
  const [draft, setDraft] = useState('')

  function addIngredient() {
    const name = draft.trim()
    if (!name || disabled) return
    if (value.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      setDraft('')
      return
    }
    onChange([...value, { id: newIngredientId(), name }])
    setDraft('')
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    addIngredient()
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      addIngredient()
    }
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>What's included</Label>
      <p className="text-xs text-muted-foreground">
        Add combo pieces customers can remove (onions, soda, fries…).
      </p>
      <div className="flex gap-2">
        <Input
          id={id}
          type="text"
          className=""
          value={draft}
          disabled={disabled}
          placeholder="e.g. Onions"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <Button type="button" variant="outline" disabled={disabled || !draft.trim()} onClick={addIngredient}>
          <Plus className="size-4" />
          Add
        </Button>
      </div>
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {value.map((ingredient) => (
            <span
              key={ingredient.id}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium"
            >
              {ingredient.name}
              <button
                type="button"
                className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-50"
                disabled={disabled}
                aria-label={`Remove ${ingredient.name}`}
                onClick={() => onChange(value.filter((item) => item.id !== ingredient.id))}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No ingredients yet — optional for simple items.</p>
      )}
      {/* keep form semantics for Enter without nesting forms */}
      <form className="hidden" onSubmit={onSubmit} />
    </div>
  )
}
