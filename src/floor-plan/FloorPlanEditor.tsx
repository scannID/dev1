import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Grid3X3, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { FloorPlan, FloorPlanTemplate, SaveCanvasRequest } from '../api/floorPlan'
import type { BusinessTable } from '../api/operations'
import { useFloorPlanEditor } from './hooks/useFloorPlanEditor'
import { apiToEditor, editorToApi } from './lib/layoutSerializer'
import { FloorPlanCanvas } from './FloorPlanCanvas'
import { ShapePalette } from './ShapePalette'
import { ElementControls } from './ElementControls'
import type { ElementKind } from '../api/floorPlan'

interface FloorPlanEditorProps {
  plan: FloorPlan
  templates: FloorPlanTemplate[]
  tables: BusinessTable[]
  onSave: (payload: SaveCanvasRequest) => Promise<FloorPlan | null>
  saving: boolean
}

export function FloorPlanEditor({ plan, templates, tables, onSave, saving }: FloorPlanEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(plan.canvasWidth)
  const [showGrid, setShowGrid] = useState(true)
  const [planName, setPlanName] = useState(plan.name)

  const editor = useFloorPlanEditor(plan.gridSize)

  // Load elements from plan on mount / plan change
  useEffect(() => {
    editor.loadElements(plan.elements.map(apiToEditor))
    setPlanName(plan.name)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id])

  // Responsive canvas width
  useEffect(() => {
    function measure() {
      if (containerRef.current) {
        const w = containerRef.current.getBoundingClientRect().width
        setContainerWidth(Math.floor(w))
      }
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const handleAddElement = useCallback(
    (kind: ElementKind) => {
      // Place new element near the center of the canvas
      const cx = plan.canvasWidth / 2
      const cy = plan.canvasHeight / 2
      editor.addElement(kind, cx, cy)
    },
    [editor, plan.canvasWidth, plan.canvasHeight]
  )

  const handleSave = useCallback(async () => {
    const payload: SaveCanvasRequest = {
      name: planName.trim() || plan.name,
      canvasWidth: plan.canvasWidth,
      canvasHeight: plan.canvasHeight,
      gridSize: plan.gridSize,
      backgroundImage: plan.backgroundImage,
      elements: editorToApi(editor.elements),
    }
    const result = await onSave(payload)
    if (result) {
      editor.markClean()
      toast.success('Layout saved')
    } else {
      toast.error('Save failed — check your connection and try again')
    }
  }, [onSave, plan, planName, editor])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && editor.selectedId) {
        editor.deleteElement(editor.selectedId)
      }
      if ((e.key === 's' || e.key === 'S') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        void handleSave()
      }
      if (e.key === 'g' || e.key === 'G') {
        setShowGrid((v) => !v)
      }
      if (e.key === 'Escape') {
        editor.selectElement(null)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [editor, handleSave])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
        borderBottom: '1px solid var(--border, #e5e7eb)',
        background: 'var(--card, #fff)', flexShrink: 0,
      }}>
        <Input
          value={planName}
          onChange={(e) => setPlanName(e.target.value)}
          placeholder="Floor plan name"
          style={{ maxWidth: 200, height: 32, fontSize: 13 }}
        />
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--muted-foreground, #6b7280)' }}>
          {editor.elements.length} element{editor.elements.length !== 1 ? 's' : ''}
          {editor.dirty && ' · unsaved'}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowGrid((v) => !v)}
          title="Toggle grid (G)"
          style={{ fontSize: 12, height: 32 }}
        >
          <Grid3X3 size={13} style={{ marginRight: 4 }} />
          Grid
        </Button>
        {editor.selectedId && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => editor.deleteElement(editor.selectedId!)}
            style={{ fontSize: 12, height: 32, color: '#dc2626' }}
            title="Delete selected (Del)"
          >
            <Trash2 size={13} />
          </Button>
        )}
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || !editor.dirty}
          style={{ fontSize: 12, height: 32 }}
        >
          <Save size={13} style={{ marginRight: 5 }} />
          {saving ? 'Saving…' : 'Save Layout'}
        </Button>
      </div>

      {/* Three-column body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left: Shape palette */}
        <div style={{
          width: 160, flexShrink: 0,
          borderRight: '1px solid var(--border, #e5e7eb)',
          overflowY: 'auto', padding: '12px 10px',
          background: 'var(--card, #fff)',
        }}>
          <ShapePalette templates={templates} onAddElement={handleAddElement} />
        </div>

        {/* Center: Canvas */}
        <div
          ref={containerRef}
          style={{
            flex: 1,
            minWidth: 0,          /* prevents flex child from overflowing */
            overflow: 'auto',
            padding: 16,
            background: 'var(--muted, #f9fafb)',
            position: 'relative',
          }}
        >
          <FloorPlanCanvas
            width={plan.canvasWidth}
            height={plan.canvasHeight}
            gridSize={plan.gridSize}
            showGrid={showGrid}
            elements={editor.elements}
            selectedId={editor.selectedId}
            editorMode
            onSelectElement={editor.selectElement}
            onDragEnd={(id, x, y) => editor.updateGeometry(id, { x, y })}
            onTransformEnd={(id, x, y, w, h, rot) =>
              editor.updateGeometry(id, { x, y, width: w, height: h, rotation: rot })
            }
            containerWidth={Math.max(200, containerWidth - 32)}
          />
          <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--muted-foreground, #9ca3af)' }}>
            Tip: Click a shape in the palette to add it · Drag to move · Handles to resize/rotate · Del to remove · Ctrl+S to save · G to toggle grid
          </p>
        </div>

        {/* Right: Element controls */}
        <div style={{
          width: 200, flexShrink: 0,
          borderLeft: '1px solid var(--border, #e5e7eb)',
          overflowY: 'auto', padding: '12px 10px',
          background: 'var(--card, #fff)',
        }}>
          <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted-foreground, #9ca3af)' }}>
            Properties
          </p>
          <ElementControls
            element={editor.selectedElement}
            tables={tables}
            onUpdate={editor.updateProps}
            onDelete={editor.deleteElement}
          />
        </div>
      </div>
    </div>
  )
}
