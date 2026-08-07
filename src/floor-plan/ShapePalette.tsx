import type { ElementKind } from '../api/floorPlan'
import type { FloorPlanTemplate } from '../api/floorPlan'
import { getDefaults } from './lib/elementDefaults'

interface ShapePaletteProps {
  templates: FloorPlanTemplate[]
  onAddElement: (kind: ElementKind) => void
}

interface PaletteGroup {
  label: string
  items: { kind: ElementKind; label: string; emoji: string }[]
}

const PALETTE_GROUPS: PaletteGroup[] = [
  {
    label: 'Tables',
    items: [
      { kind: 'TABLE', label: 'Table', emoji: '⬛' },
      { kind: 'CHAIR', label: 'Chair', emoji: '🪑' },
      { kind: 'BAR', label: 'Bar Counter', emoji: '🍸' },
    ],
  },
  {
    label: 'Structure',
    items: [
      { kind: 'WALL', label: 'Wall', emoji: '🧱' },
      { kind: 'DOOR', label: 'Door', emoji: '🚪' },
      { kind: 'WINDOW', label: 'Window', emoji: '🪟' },
      { kind: 'ZONE', label: 'Zone / Area', emoji: '📐' },
    ],
  },
  {
    label: 'Features',
    items: [
      { kind: 'STAGE', label: 'Stage', emoji: '🎭' },
      { kind: 'PLANT', label: 'Plant', emoji: '🌿' },
      { kind: 'DECOR', label: 'Decor', emoji: '🎨' },
      { kind: 'LABEL', label: 'Label', emoji: '🏷️' },
    ],
  },
  {
    label: 'Hotel',
    items: [
      { kind: 'HOTEL_ROOM', label: 'Room', emoji: '🛏️' },
    ],
  },
]

export function ShapePalette({ onAddElement }: ShapePaletteProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ margin: 0, fontSize: 11, color: 'var(--muted-foreground, #6b7280)', fontWeight: 500 }}>
        Click to add to canvas
      </p>
      {PALETTE_GROUPS.map((group) => (
        <div key={group.label}>
          <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted-foreground, #9ca3af)' }}>
            {group.label}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {group.items.map(({ kind, label, emoji }) => {
              const def = getDefaults(kind)
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => onAddElement(kind)}
                  title={`Add ${label}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 8px',
                    border: '1px solid var(--border, #e5e7eb)',
                    borderRadius: 6,
                    background: 'var(--card, #fff)',
                    cursor: 'pointer',
                    fontSize: 11,
                    color: 'var(--foreground, #111)',
                    textAlign: 'left',
                    transition: 'background 0.15s',
                    userSelect: 'none',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--accent, #f3f4f6)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--card, #fff)' }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: def.shapeType === 'circle' ? '50%' : 3,
                      background: def.color,
                      flexShrink: 0,
                      border: '1px solid #00000022',
                    }}
                  />
                  <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{label}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
