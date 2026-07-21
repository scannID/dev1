import { useState } from 'react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import AddCategoryPopover from './AddCategoryPopover'

const NEW_CATEGORY = '__new__'

export default function CategoryField({
  id = 'item-category',
  categories,
  value,
  onChange,
  onAddCategory,
  error,
  disabled,
}: {
  id?: string
  categories: string[]
  value: string
  onChange: (value: string) => void
  onAddCategory?: (name: string) => Promise<string[] | void>
  error?: boolean
  disabled?: boolean
}) {
  const [showAddPopover, setShowAddPopover] = useState(false)

  async function saveCategory(name: string) {
    if (onAddCategory) {
      await onAddCategory(name)
    }
    onChange(name)
  }

  const fieldRow = (
    <div className="flex gap-2">
      <Select
        value={value || undefined}
        onValueChange={(next) => {
          if (next === NEW_CATEGORY) {
            setShowAddPopover(true)
            return
          }
          onChange(next)
        }}
        disabled={disabled}
      >
        <SelectTrigger id={id} className={`flex-1 ${error ? 'border-destructive' : ''}`} aria-invalid={error}>
          <SelectValue placeholder="Choose a category" />
        </SelectTrigger>
        <SelectContent>
          {categories.map((category) => (
            <SelectItem key={category} value={category}>
              {category}
            </SelectItem>
          ))}
          <SelectItem value={NEW_CATEGORY}>+ Add custom category…</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="shrink-0"
        title="Add custom category"
        disabled={disabled}
        onClick={() => setShowAddPopover(true)}
      >
        +
      </Button>
    </div>
  )

  return (
    <AddCategoryPopover
      open={showAddPopover}
      onOpenChange={setShowAddPopover}
      onSave={saveCategory}
      anchor={
        <div className="grid gap-2">
          <Label htmlFor={id}>Category</Label>
          {fieldRow}
        </div>
      }
    />
  )
}
