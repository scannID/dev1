import type { FloorPlanElement, ElementSaveRequest } from '../../api/floorPlan'
import type { EditorElement } from '../hooks/useFloorPlanEditor'

/** Convert API element to editor element */
export function apiToEditor(el: FloorPlanElement): EditorElement {
  return {
    id: el.id,
    shapeType: el.shapeType,
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    rotation: el.rotation,
    zIndex: el.zIndex,
    color: el.color,
    elementKind: el.elementKind,
    label: el.label ?? '',
    seatCount: el.seatCount,
    parentElementId: el.parentElementId ?? null,
    businessTableId: el.businessTableId ?? null,
    businessTableLabel: el.businessTableLabel ?? null,
  }
}

/** Convert editor elements to API save payload */
export function editorToApi(elements: EditorElement[]): ElementSaveRequest[] {
  return elements.map((el) => ({
    id: el.id,
    shapeType: el.shapeType,
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    rotation: el.rotation,
    zIndex: el.zIndex,
    color: el.color,
    elementKind: el.elementKind,
    label: el.label || null,
    seatCount: el.seatCount,
    parentElementId: el.parentElementId ?? null,
    businessTableId: el.businessTableId ?? null,
  }))
}
