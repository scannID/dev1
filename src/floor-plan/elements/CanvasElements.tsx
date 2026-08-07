/**
 * Konva shape components with:
 * - Real SVG furniture icons
 * - Animated pulse on OCCUPIED status
 * - Polygon shape type support for odd-shaped rooms/zones
 */
import { useEffect, useRef, useState } from 'react'
import { Circle, Group, Image as KonvaImage, Line, Rect, Text, Transformer } from 'react-konva'
import Konva from 'konva'
import type { EditorElement } from '../hooks/useFloorPlanEditor'
import type { ElementStatusSnapshot } from '../../api/floorPlan'
import { getStatusStyle } from '../lib/statusColors'
import { getIconImage } from '../lib/furnitureIcons'

// ─── Shared props ──────────────────────────────────────────────────────────────

export interface BaseProps {
  el: EditorElement
  isSelected: boolean
  editorMode: boolean
  status?: ElementStatusSnapshot
  onSelect: (id: string) => void
  onDragEnd: (id: string, x: number, y: number) => void
  onTransformEnd: (id: string, x: number, y: number, w: number, h: number, rot: number) => void
  onClick?: (id: string) => void
}

// ─── Selection transformer ─────────────────────────────────────────────────────

export function SelectionTransformer({ nodeRef }: { nodeRef: React.RefObject<Konva.Node | null> }) {
  const trRef = useRef<Konva.Transformer>(null)
  useEffect(() => {
    if (trRef.current && nodeRef.current) {
      trRef.current.nodes([nodeRef.current])
      trRef.current.getLayer()?.batchDraw()
    }
  }, [nodeRef])
  return (
    <Transformer
      ref={trRef}
      rotateEnabled
      enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
      boundBoxFunc={(oldBox, newBox) => {
        if (newBox.width < 20 || newBox.height < 20) return oldBox
        return newBox
      }}
    />
  )
}

// ─── Pulse animation hook ──────────────────────────────────────────────────────

function usePulse(nodeRef: React.RefObject<Konva.Node | null>, active: boolean) {
  const tweenRef = useRef<Konva.Tween | null>(null)

  useEffect(() => {
    const node = nodeRef.current
    if (!node) return

    if (active) {
      tweenRef.current?.destroy()
      tweenRef.current = new Konva.Tween({
        node,
        duration: 0.9,
        opacity: 0.2,
        easing: Konva.Easings.EaseInOut,
        yoyo: true,
        repeat: Infinity,
      })
      tweenRef.current.play()
    } else {
      tweenRef.current?.destroy()
      tweenRef.current = null
      node.opacity(1)
      node.getLayer()?.batchDraw()
    }

    return () => {
      tweenRef.current?.destroy()
      tweenRef.current = null
    }
  }, [active, nodeRef])
}

// ─── SVG Icon overlay ─────────────────────────────────────────────────────────

function FurnitureIcon({ el }: { el: EditorElement }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const kind = el.elementKind

  useEffect(() => {
    let cancelled = false
    getIconImage(kind).then((image) => {
      if (!cancelled) setImg(image)
    })
    return () => { cancelled = true }
  }, [kind])

  if (!img) return null

  const padding = el.elementKind === 'WALL' || el.elementKind === 'DOOR' || el.elementKind === 'WINDOW' ? 0 : 6
  return (
    <KonvaImage
      image={img}
      x={el.x + padding}
      y={el.y + padding}
      width={el.width - padding * 2}
      height={el.height - padding * 2}
      listening={false}
      opacity={0.88}
    />
  )
}

// ─── Status overlay with pulse ────────────────────────────────────────────────

function StatusOverlay({ el, status }: { el: EditorElement; status: ElementStatusSnapshot | undefined }) {
  const overlayRef = useRef<Konva.Rect | null>(null)
  const circleRef = useRef<Konva.Circle | null>(null)
  const isOccupied = status?.status === 'OCCUPIED'

  usePulse(overlayRef as React.RefObject<Konva.Node | null>, isOccupied)
  usePulse(circleRef as React.RefObject<Konva.Node | null>, isOccupied)

  if (!status) return null

  const style = getStatusStyle(status.status)

  if (el.shapeType === 'circle') {
    return (
      <Circle
        ref={circleRef}
        x={el.x + el.width / 2}
        y={el.y + el.height / 2}
        radius={Math.min(el.width, el.height) / 2}
        fill={style.fill}
        opacity={0.42}
        listening={false}
      />
    )
  }
  return (
    <Rect
      ref={overlayRef}
      x={el.x} y={el.y}
      width={el.width} height={el.height}
      cornerRadius={6}
      fill={style.fill}
      opacity={0.42}
      listening={false}
    />
  )
}

// ─── Status dot (corner badge) ────────────────────────────────────────────────

function StatusDot({ el, status }: { el: EditorElement; status: ElementStatusSnapshot | undefined }) {
  if (!status) return null
  const style = getStatusStyle(status.status)
  return (
    <Circle
      x={el.x + el.width - 9}
      y={el.y + 9}
      radius={7}
      fill={style.fill}
      stroke="#fff"
      strokeWidth={2}
      listening={false}
    />
  )
}

// ─── Generic draggable/resizable shape (rect or circle) ───────────────────────

interface ShapeBaseProps extends BaseProps {
  shapeOverride?: 'rect' | 'circle'
  fillOpacity?: number
  dashPattern?: number[]
  cornerRad?: number
}

function DraggableRect({
  el, isSelected, editorMode, onSelect, onDragEnd, onTransformEnd, onClick,
  fillOpacity = 1, dashPattern, cornerRad,
}: ShapeBaseProps) {
  const shapeRef = useRef<Konva.Rect>(null)

  function handleDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    onDragEnd(el.id, e.target.x(), e.target.y())
  }
  function handleTransformEnd(e: Konva.KonvaEventObject<Event>) {
    const node = e.target as Konva.Rect
    const sx = node.scaleX(); const sy = node.scaleY()
    node.scaleX(1); node.scaleY(1)
    onTransformEnd(el.id, node.x(), node.y(), node.width() * sx, node.height() * sy, node.rotation())
  }

  return (
    <>
      <Rect
        ref={shapeRef}
        x={el.x} y={el.y}
        width={el.width} height={el.height}
        rotation={el.rotation}
        fill={el.color}
        opacity={fillOpacity}
        stroke={isSelected ? '#6366f1' : '#00000033'}
        strokeWidth={isSelected ? 2.5 : 1.5}
        draggable={editorMode}
        shadowBlur={isSelected ? 8 : 2}
        shadowColor={isSelected ? '#6366f1' : '#00000018'}
        cornerRadius={cornerRad ?? 6}
        dash={dashPattern}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        onClick={() => { onSelect(el.id); onClick?.(el.id) }}
        onTap={() => { onSelect(el.id); onClick?.(el.id) }}
      />
      {isSelected && editorMode && <SelectionTransformer nodeRef={shapeRef as React.RefObject<Konva.Node>} />}
    </>
  )
}

// ─── Polygon shape (for odd-shaped zones/rooms) ───────────────────────────────

export function PolygonElement({ el, isSelected, editorMode, status, onSelect, onDragEnd, onTransformEnd, onClick }: BaseProps) {
  const groupRef = useRef<Konva.Group>(null)

  // Points stored in customStyle as JSON array of [x,y,...] relative to element origin
  let points: number[] = []
  try {
    if (el.customStyle) {
      const parsed = JSON.parse(el.customStyle) as { points?: number[] }
      if (Array.isArray(parsed.points)) points = parsed.points
    }
  } catch { /* ignore */ }

  // Fallback to a default diamond/hexagon shape if no points defined yet
  if (points.length < 6) {
    const w = el.width; const h = el.height
    points = [w * 0.5, 0, w, h * 0.3, w, h * 0.7, w * 0.5, h, 0, h * 0.7, 0, h * 0.3]
  }

  const absPoints = points.map((v, i) => i % 2 === 0 ? v + el.x : v + el.y)

  function handleDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    onDragEnd(el.id, e.target.x(), e.target.y())
  }

  const style = status ? getStatusStyle(status.status) : null

  return (
    <Group
      ref={groupRef}
      x={0} y={0}
      draggable={editorMode}
      onDragEnd={handleDragEnd}
      onClick={() => { onSelect(el.id); onClick?.(el.id) }}
      onTap={() => { onSelect(el.id); onClick?.(el.id) }}
    >
      <Line
        points={absPoints}
        closed
        fill={el.color}
        opacity={el.elementKind === 'ZONE' ? 0.35 : 0.9}
        stroke={isSelected ? '#6366f1' : style ? style.stroke : '#00000033'}
        strokeWidth={isSelected ? 2.5 : 1.5}
        dash={el.elementKind === 'ZONE' ? [8, 4] : undefined}
      />
      {status && style && (
        <Line
          points={absPoints}
          closed
          fill={style.fill}
          opacity={0.4}
          listening={false}
        />
      )}
      {el.label && (
        <Text
          x={el.x + 8} y={el.y + 8}
          text={el.label}
          fontSize={12} fontStyle="bold"
          fill="#1f2937"
          listening={false}
        />
      )}
    </Group>
  )
}

// ─── TABLE / HOTEL_ROOM ───────────────────────────────────────────────────────

export function TableElement({ el, isSelected, editorMode, status, onSelect, onDragEnd, onTransformEnd, onClick }: BaseProps) {
  const shapeRef = useRef<Konva.Rect>(null)

  function handleDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    onDragEnd(el.id, e.target.x(), e.target.y())
  }
  function handleTransformEnd(e: Konva.KonvaEventObject<Event>) {
    const node = e.target as Konva.Rect
    const sx = node.scaleX(); const sy = node.scaleY()
    node.scaleX(1); node.scaleY(1)
    onTransformEnd(el.id, node.x(), node.y(), node.width() * sx, node.height() * sy, node.rotation())
  }

  const isCircle = el.shapeType === 'circle'

  return (
    <>
      <Rect
        ref={shapeRef}
        x={el.x} y={el.y}
        width={el.width} height={el.height}
        rotation={el.rotation}
        fill={el.color}
        cornerRadius={isCircle ? Math.min(el.width, el.height) / 2 : 6}
        stroke={isSelected ? '#6366f1' : '#00000033'}
        strokeWidth={isSelected ? 2.5 : 1.5}
        draggable={editorMode}
        shadowBlur={isSelected ? 8 : 3}
        shadowColor={isSelected ? '#6366f1' : '#00000022'}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        onClick={() => { onSelect(el.id); onClick?.(el.id) }}
        onTap={() => { onSelect(el.id); onClick?.(el.id) }}
      />
      {/* SVG furniture icon */}
      <FurnitureIcon el={el} />
      {/* Status overlay (with pulse animation for OCCUPIED) */}
      <StatusOverlay el={el} status={status} />
      {/* Label */}
      {el.label && (
        <Text
          x={el.x} y={el.y + el.height - 18}
          width={el.width} align="center"
          text={el.label} fontSize={11} fontStyle="bold"
          fill="#1f2937" listening={false}
        />
      )}
      {/* Status dot */}
      <StatusDot el={el} status={status} />
      {isSelected && editorMode && <SelectionTransformer nodeRef={shapeRef as React.RefObject<Konva.Node>} />}
    </>
  )
}

// ─── CHAIR ────────────────────────────────────────────────────────────────────

export function ChairElement({ el, isSelected, editorMode, onSelect, onDragEnd, onTransformEnd }: BaseProps) {
  const shapeRef = useRef<Konva.Rect>(null)

  function handleDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    onDragEnd(el.id, e.target.x(), e.target.y())
  }
  function handleTransformEnd(e: Konva.KonvaEventObject<Event>) {
    const node = e.target as Konva.Rect
    const sx = node.scaleX(); const sy = node.scaleY()
    node.scaleX(1); node.scaleY(1)
    onTransformEnd(el.id, node.x(), node.y(), node.width() * sx, node.height() * sy, node.rotation())
  }

  return (
    <>
      <Rect
        ref={shapeRef}
        x={el.x} y={el.y}
        width={el.width} height={el.height}
        cornerRadius={Math.min(el.width, el.height) / 2}
        rotation={el.rotation}
        fill={el.color}
        stroke={isSelected ? '#6366f1' : '#00000033'}
        strokeWidth={isSelected ? 2 : 1}
        draggable={editorMode}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        onClick={() => onSelect(el.id)}
        onTap={() => onSelect(el.id)}
      />
      <FurnitureIcon el={el} />
      {isSelected && editorMode && <SelectionTransformer nodeRef={shapeRef as React.RefObject<Konva.Node>} />}
    </>
  )
}

// ─── WALL / DOOR / WINDOW ─────────────────────────────────────────────────────

export function WallElement({ el, isSelected, editorMode, onSelect, onDragEnd, onTransformEnd }: BaseProps) {
  const shapeRef = useRef<Konva.Rect>(null)

  function handleDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    onDragEnd(el.id, e.target.x(), e.target.y())
  }
  function handleTransformEnd(e: Konva.KonvaEventObject<Event>) {
    const node = e.target as Konva.Rect
    const sx = node.scaleX(); const sy = node.scaleY()
    node.scaleX(1); node.scaleY(1)
    onTransformEnd(el.id, node.x(), node.y(), node.width() * sx, node.height() * sy, node.rotation())
  }

  return (
    <>
      <Rect
        ref={shapeRef}
        x={el.x} y={el.y}
        width={el.width} height={el.height}
        rotation={el.rotation}
        fill={el.color}
        stroke={isSelected ? '#6366f1' : '#00000044'}
        strokeWidth={isSelected ? 2 : 1}
        draggable={editorMode}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        onClick={() => onSelect(el.id)}
        onTap={() => onSelect(el.id)}
      />
      <FurnitureIcon el={el} />
      {isSelected && editorMode && <SelectionTransformer nodeRef={shapeRef as React.RefObject<Konva.Node>} />}
    </>
  )
}

// ─── ZONE ─────────────────────────────────────────────────────────────────────

export function ZoneElement({ el, isSelected, editorMode, onSelect, onDragEnd, onTransformEnd }: BaseProps) {
  // Zones with polygon shape get the polygon renderer
  if (el.shapeType === 'polygon') {
    return <PolygonElement el={el} isSelected={isSelected} editorMode={editorMode}
      onSelect={onSelect} onDragEnd={onDragEnd} onTransformEnd={onTransformEnd} />
  }

  const shapeRef = useRef<Konva.Rect>(null)

  function handleDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    onDragEnd(el.id, e.target.x(), e.target.y())
  }
  function handleTransformEnd(e: Konva.KonvaEventObject<Event>) {
    const node = e.target as Konva.Rect
    const sx = node.scaleX(); const sy = node.scaleY()
    node.scaleX(1); node.scaleY(1)
    onTransformEnd(el.id, node.x(), node.y(), node.width() * sx, node.height() * sy, node.rotation())
  }

  return (
    <>
      <Rect
        ref={shapeRef}
        x={el.x} y={el.y}
        width={el.width} height={el.height}
        rotation={el.rotation}
        fill={el.color} opacity={0.35}
        stroke={isSelected ? '#6366f1' : '#93c5fd'}
        strokeWidth={isSelected ? 2 : 1.5}
        dash={[8, 4]}
        cornerRadius={8}
        draggable={editorMode}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        onClick={() => onSelect(el.id)}
        onTap={() => onSelect(el.id)}
      />
      {el.label && (
        <Text
          x={el.x + 8} y={el.y + 8}
          text={el.label} fontSize={11} fontStyle="bold"
          fill="#1e40af" listening={false}
        />
      )}
      {isSelected && editorMode && <SelectionTransformer nodeRef={shapeRef as React.RefObject<Konva.Node>} />}
    </>
  )
}

// ─── LABEL ────────────────────────────────────────────────────────────────────

export function LabelElement({ el, isSelected, editorMode, onSelect, onDragEnd, onTransformEnd }: BaseProps) {
  const shapeRef = useRef<Konva.Rect>(null)

  function handleDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    onDragEnd(el.id, e.target.x(), e.target.y())
  }
  function handleTransformEnd(e: Konva.KonvaEventObject<Event>) {
    const node = e.target as Konva.Rect
    const sx = node.scaleX(); const sy = node.scaleY()
    node.scaleX(1); node.scaleY(1)
    onTransformEnd(el.id, node.x(), node.y(), node.width() * sx, node.height() * sy, node.rotation())
  }

  return (
    <>
      <Rect
        ref={shapeRef}
        x={el.x} y={el.y}
        width={el.width} height={el.height}
        rotation={el.rotation}
        fill={el.color}
        stroke={isSelected ? '#6366f1' : 'transparent'}
        strokeWidth={isSelected ? 1.5 : 0}
        cornerRadius={4}
        draggable={editorMode}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        onClick={() => onSelect(el.id)}
        onTap={() => onSelect(el.id)}
      />
      <Text
        x={el.x + 4} y={el.y + el.height / 2 - 7}
        width={el.width - 8}
        text={el.label || 'Label'}
        fontSize={12} fill="#374151"
        listening={false}
      />
      {isSelected && editorMode && <SelectionTransformer nodeRef={shapeRef as React.RefObject<Konva.Node>} />}
    </>
  )
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export function CanvasElement(props: BaseProps) {
  if (props.el.shapeType === 'polygon') {
    return <PolygonElement {...props} />
  }
  switch (props.el.elementKind) {
    case 'CHAIR':
      return <ChairElement {...props} />
    case 'WALL':
    case 'DOOR':
    case 'WINDOW':
    case 'BAR':
    case 'STAGE':
    case 'PLANT':
    case 'DECOR':
      return <WallElement {...props} />
    case 'ZONE':
      return <ZoneElement {...props} />
    case 'LABEL':
      return <LabelElement {...props} />
    case 'TABLE':
    case 'HOTEL_ROOM':
    default:
      return <TableElement {...props} />
  }
}
