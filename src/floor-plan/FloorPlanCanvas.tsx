import { useRef } from 'react'
import { Layer, Line, Rect, Stage } from 'react-konva'
import type Konva from 'konva'
import type { EditorElement } from './hooks/useFloorPlanEditor'
import type { ElementStatusSnapshot } from '../api/floorPlan'
import { CanvasElement } from './elements/CanvasElements'

interface FloorPlanCanvasProps {
  width: number
  height: number
  gridSize: number
  showGrid: boolean
  elements: EditorElement[]
  selectedId: string | null
  editorMode: boolean
  statuses?: Record<string, ElementStatusSnapshot>
  onSelectElement: (id: string | null) => void
  onDragEnd: (id: string, x: number, y: number) => void
  onTransformEnd: (id: string, x: number, y: number, w: number, h: number, rot: number) => void
  onElementClick?: (id: string) => void
  onDropElement?: (x: number, y: number) => void
  /** Canvas container CSS width (for responsive sizing) */
  containerWidth?: number
}

export function FloorPlanCanvas({
  width,
  height,
  gridSize,
  showGrid,
  elements,
  selectedId,
  editorMode,
  statuses = {},
  onSelectElement,
  onDragEnd,
  onTransformEnd,
  onElementClick,
  containerWidth,
}: FloorPlanCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null)

  // Scale the stage to fit the container if smaller than canvas
  const displayWidth = containerWidth ?? width
  const scale = displayWidth < width ? displayWidth / width : 1

  // Build grid lines
  const gridLines: React.ReactNode[] = []
  if (showGrid) {
    for (let x = 0; x <= width; x += gridSize) {
      gridLines.push(
        <Line key={`v${x}`} points={[x, 0, x, height]} stroke="#e5e7eb" strokeWidth={0.5} listening={false} />
      )
    }
    for (let y = 0; y <= height; y += gridSize) {
      gridLines.push(
        <Line key={`h${y}`} points={[0, y, width, y]} stroke="#e5e7eb" strokeWidth={0.5} listening={false} />
      )
    }
  }

  // Sort: zones first (bottom), then everything else by zIndex
  const sorted = [...elements].sort((a, b) => {
    if (a.elementKind === 'ZONE' && b.elementKind !== 'ZONE') return -1
    if (b.elementKind === 'ZONE' && a.elementKind !== 'ZONE') return 1
    return a.zIndex - b.zIndex
  })

  return (
    <div
      style={{
        border: '1px solid var(--border, #e5e7eb)',
        borderRadius: 8,
        overflow: 'hidden',
        background: '#fafafa',
        width: displayWidth,
        height: height * scale,
        cursor: editorMode ? 'default' : 'pointer',
      }}
    >
      <Stage
        ref={stageRef}
        width={displayWidth}
        height={height * scale}
        scaleX={scale}
        scaleY={scale}
        onMouseDown={(e) => {
          // Click on empty canvas → deselect
          if (e.target === e.target.getStage()) {
            onSelectElement(null)
          }
        }}
        onTouchStart={(e) => {
          if (e.target === e.target.getStage()) {
            onSelectElement(null)
          }
        }}
      >
        {/* Background */}
        <Layer listening={false}>
          <Rect x={0} y={0} width={width} height={height} fill="#ffffff" />
          {gridLines}
        </Layer>

        {/* Elements */}
        <Layer>
          {sorted.map((el) => (
            <CanvasElement
              key={el.id}
              el={el}
              isSelected={selectedId === el.id}
              editorMode={editorMode}
              status={statuses[el.id]}
              onSelect={onSelectElement}
              onDragEnd={onDragEnd}
              onTransformEnd={onTransformEnd}
              onClick={onElementClick}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  )
}
