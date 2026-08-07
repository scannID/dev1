import type { EditorElement } from './hooks/useFloorPlanEditor'
import type { BusinessTable } from '../api/operations'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ElementControlsProps {
  element: EditorElement | null
  tables: BusinessTable[]
  onUpdate: (id: string, changes: Partial<Omit<EditorElement, 'id'>>) => void
  onDelete: (id: string) => void
}

const ELEMENT_KIND_OPTIONS = [
  { value: 'TABLE', label: 'Table' },
  { value: 'CHAIR', label: 'Chair' },
  { value: 'WALL', label: 'Wall' },
  { value: 'BAR', label: 'Bar Counter' },
  { value: 'DOOR', label: 'Door' },
  { value: 'WINDOW', label: 'Window' },
  { value: 'STAGE', label: 'Stage' },
  { value: 'PLANT', label: 'Plant / Decor' },
  { value: 'DECOR', label: 'Decor' },
  { value: 'HOTEL_ROOM', label: 'Hotel Room' },
  { value: 'ZONE', label: 'Zone / Area' },
  { value: 'LABEL', label: 'Label' },
]

export function ElementControls({ element, tables, onUpdate, onDelete }: ElementControlsProps) {
  if (!element) {
    return (
      <div style={{ padding: '16px 12px', color: 'var(--muted-foreground, #6b7280)', fontSize: 13, textAlign: 'center' }}>
        <p style={{ margin: 0 }}>Select an element to edit its properties.</p>
      </div>
    )
  }

  const bookable = element.elementKind === 'TABLE' || element.elementKind === 'HOTEL_ROOM'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
      {/* Kind */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Label style={{ fontSize: 11 }}>Kind</Label>
        <Select
          value={element.elementKind}
          onValueChange={(v) => onUpdate(element.id, { elementKind: v as EditorElement['elementKind'] })}
        >
          <SelectTrigger style={{ fontSize: 12, height: 32 }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ELEMENT_KIND_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} style={{ fontSize: 12 }}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Label */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Label style={{ fontSize: 11 }}>Label</Label>
        <Input
          value={element.label}
          onChange={(e) => onUpdate(element.id, { label: e.target.value })}
          placeholder="e.g. Table 1"
          style={{ fontSize: 12, height: 32 }}
        />
      </div>

      {/* Seat count */}
      {(element.elementKind === 'TABLE' || element.elementKind === 'HOTEL_ROOM') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label style={{ fontSize: 11 }}>
            {element.elementKind === 'HOTEL_ROOM' ? 'Max Occupancy' : 'Seat Count'}
          </Label>
          <Input
            type="number"
            min={0}
            max={99}
            value={element.seatCount}
            onChange={(e) => onUpdate(element.id, { seatCount: parseInt(e.target.value) || 0 })}
            style={{ fontSize: 12, height: 32 }}
          />
        </div>
      )}

      {/* Color */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Label style={{ fontSize: 11 }}>Color</Label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="color"
            value={element.color}
            onChange={(e) => onUpdate(element.id, { color: e.target.value })}
            style={{ width: 32, height: 32, border: 'none', borderRadius: 4, cursor: 'pointer', padding: 2 }}
          />
          <Input
            value={element.color}
            onChange={(e) => onUpdate(element.id, { color: e.target.value })}
            style={{ fontSize: 12, height: 32, fontFamily: 'monospace' }}
          />
        </div>
      </div>

      {/* Link to BusinessTable */}
      {bookable && tables.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Label style={{ fontSize: 11 }}>Linked Table</Label>
          <Select
            value={element.businessTableId ?? '__none__'}
            onValueChange={(v) =>
              onUpdate(element.id, {
                businessTableId: v === '__none__' ? null : v,
                businessTableLabel: v === '__none__' ? null : (tables.find((t) => t.id === v)?.label ?? null),
              })
            }
          >
            <SelectTrigger style={{ fontSize: 12, height: 32 }}>
              <SelectValue placeholder="Not linked" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__" style={{ fontSize: 12 }}>Not linked (decorative)</SelectItem>
              {tables.map((t) => (
                <SelectItem key={t.id} value={t.id} style={{ fontSize: 12 }}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p style={{ margin: 0, fontSize: 10, color: 'var(--muted-foreground, #6b7280)' }}>
            Link this element to a table to track occupancy.
          </p>
        </div>
      )}

      {/* Geometry (read-only display) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {[
          { label: 'X', value: Math.round(element.x) },
          { label: 'Y', value: Math.round(element.y) },
          { label: 'W', value: Math.round(element.width) },
          { label: 'H', value: Math.round(element.height) },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Label style={{ fontSize: 10 }}>{label}</Label>
            <div style={{ fontSize: 11, background: 'var(--muted, #f3f4f6)', borderRadius: 4, padding: '4px 8px', color: 'var(--muted-foreground, #6b7280)' }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Delete */}
      <Button
        variant="destructive"
        size="sm"
        onClick={() => onDelete(element.id)}
        style={{ marginTop: 4, fontSize: 12 }}
      >
        <Trash2 size={13} style={{ marginRight: 5 }} />
        Delete element
      </Button>
    </div>
  )
}
