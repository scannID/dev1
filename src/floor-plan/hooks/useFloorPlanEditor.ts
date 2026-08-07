import { useCallback, useState } from 'react'
import { nanoid } from '../lib/nanoid'
import type { ElementKind, ShapeType } from '../../api/floorPlan'
import { getDefaults } from '../lib/elementDefaults'
import { snapPosition, snapSize } from '../lib/snapToGrid'

// ─── Core type ─────────────────────────────────────────────────────────────────

export interface EditorElement {
  id: string
  shapeType: ShapeType
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  color: string
  elementKind: ElementKind
  label: string
  seatCount: number
  parentElementId: string | null
  businessTableId: string | null
  businessTableLabel: string | null
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useFloorPlanEditor(gridSize: number) {
  const [elements, setElements] = useState<EditorElement[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  /** Load elements from the API (on plan load) */
  const loadElements = useCallback((incoming: EditorElement[]) => {
    setElements(incoming)
    setSelectedId(null)
    setDirty(false)
  }, [])

  /** Drop a new element at (x, y) from the shape palette */
  const addElement = useCallback(
    (kind: ElementKind, x: number, y: number): EditorElement => {
      const def = getDefaults(kind)
      const snapped = snapPosition(x - def.width / 2, y - def.height / 2, gridSize)
      const el: EditorElement = {
        id: nanoid(),
        shapeType: def.shapeType,
        x: snapped.x,
        y: snapped.y,
        width: def.width,
        height: def.height,
        rotation: 0,
        zIndex: 1,
        color: def.color,
        elementKind: kind,
        label: '',
        seatCount: def.seatCount,
        parentElementId: null,
        businessTableId: null,
        businessTableLabel: null,
      }
      setElements((prev) => [...prev, el])
      setSelectedId(el.id)
      setDirty(true)
      return el
    },
    [gridSize]
  )

  /** Update geometry (drag/resize) with grid snapping */
  const updateGeometry = useCallback(
    (
      id: string,
      changes: { x?: number; y?: number; width?: number; height?: number; rotation?: number }
    ) => {
      setElements((prev) =>
        prev.map((el) => {
          if (el.id !== id) return el
          let next = { ...el, ...changes }
          if (changes.x !== undefined || changes.y !== undefined) {
            const snapped = snapPosition(next.x, next.y, gridSize)
            next = { ...next, ...snapped }
          }
          if (changes.width !== undefined || changes.height !== undefined) {
            const snapped = snapSize(next.width, next.height, gridSize)
            next = { ...next, ...snapped }
          }
          return next
        })
      )
      setDirty(true)
    },
    [gridSize]
  )

  /** Update non-geometry props (label, color, seatCount, businessTableId …) */
  const updateProps = useCallback(
    (id: string, changes: Partial<Omit<EditorElement, 'id'>>) => {
      setElements((prev) =>
        prev.map((el) => (el.id === id ? { ...el, ...changes } : el))
      )
      setDirty(true)
    },
    []
  )

  const deleteElement = useCallback((id: string) => {
    setElements((prev) => prev.filter((el) => el.id !== id && el.parentElementId !== id))
    setSelectedId(null)
    setDirty(true)
  }, [])

  const selectElement = useCallback((id: string | null) => {
    setSelectedId(id)
  }, [])

  const selectedElement = elements.find((el) => el.id === selectedId) ?? null

  const markClean = useCallback(() => setDirty(false), [])

  return {
    elements,
    setElements,
    selectedId,
    selectedElement,
    dirty,
    loadElements,
    addElement,
    updateGeometry,
    updateProps,
    deleteElement,
    selectElement,
    markClean,
  }
}
