import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import AddCategoryPopover from './AddCategoryPopover'

export default function CategoryManager({
  categories,
  onAddCategory,
  disabled,
}: {
  categories: string[]
  onAddCategory: (name: string) => Promise<void>
  disabled?: boolean
}) {
  const [showAddPopover, setShowAddPopover] = useState(false)

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Categories</p>
          <p className="mt-1 text-sm text-muted-foreground">Custom menu groups for your business.</p>
        </div>
        <AddCategoryPopover
          open={showAddPopover}
          onOpenChange={setShowAddPopover}
          onSave={onAddCategory}
          trigger={
            <Button type="button" size="sm" className="h-8" disabled={disabled}>
              <Plus className="size-3.5" />
              Add category
            </Button>
          }
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.length === 0 ? (
          <span className="text-sm text-muted-foreground">No categories yet.</span>
        ) : (
          categories.map((category) => (
            <Badge key={category} variant="secondary" className="font-normal">
              {category}
            </Badge>
          ))
        )}
      </div>
    </section>
  )
}
