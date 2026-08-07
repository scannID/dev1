import { api } from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ShapeType = 'rect' | 'circle' | 'polygon' | 'custom-path'

export type ElementKind =
  | 'TABLE'
  | 'CHAIR'
  | 'WALL'
  | 'BAR'
  | 'DOOR'
  | 'WINDOW'
  | 'STAGE'
  | 'PLANT'
  | 'DECOR'
  | 'HOTEL_ROOM'
  | 'ZONE'
  | 'LABEL'

export type ElementStatus = 'FREE' | 'OCCUPIED' | 'RESERVED' | 'OUT_OF_SERVICE'

export interface FloorPlanElement {
  id: string
  floorPlanId: string
  shapeType: ShapeType
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  color: string
  elementKind: ElementKind
  label: string | null
  seatCount: number
  parentElementId: string | null
  businessTableId: string | null
  businessTableLabel: string | null
  createdAt: string
}

export interface FloorPlan {
  id: string
  businessId: string
  name: string
  canvasWidth: number
  canvasHeight: number
  gridSize: number
  backgroundImage: string | null
  elements: FloorPlanElement[]
  createdAt: string
  updatedAt: string | null
}

export interface FloorPlanSummary {
  id: string
  businessId: string
  name: string
  canvasWidth: number
  canvasHeight: number
  gridSize: number
  backgroundImage: string | null
  createdAt: string
  updatedAt: string | null
}

export interface ElementStatusSnapshot {
  elementId: string
  status: ElementStatus
  sessionId: string | null
  reservationId: string | null
  tableLabel: string | null
  sessionOpenedAt: string | null
  guestName: string | null
  partySize: number | null
  unpaidTotal: number | null
  updatedAt: string
}

export interface LiveSnapshot {
  plan: FloorPlan
  statuses: Record<string, ElementStatusSnapshot>
}

export interface FloorPlanTemplate {
  id: string
  businessId: string | null
  name: string
  shapeType: ShapeType
  elementKind: ElementKind
  defaultWidth: number
  defaultHeight: number
  defaultColor: string
  defaultSeatCount: number
  thumbnailSvg: string | null
  sortOrder: number
}

// ─── Request types ────────────────────────────────────────────────────────────

export interface CreateFloorPlanRequest {
  name: string
  canvasWidth?: number
  canvasHeight?: number
  gridSize?: number
  backgroundImage?: string | null
}

export interface ElementSaveRequest {
  id?: string | null
  shapeType: ShapeType
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  zIndex?: number
  color?: string
  elementKind: ElementKind
  label?: string | null
  seatCount?: number
  parentElementId?: string | null
  businessTableId?: string | null
}

export interface SaveCanvasRequest {
  name?: string
  canvasWidth?: number
  canvasHeight?: number
  gridSize?: number
  backgroundImage?: string | null
  elements: ElementSaveRequest[]
}

export interface SetElementStatusRequest {
  status: ElementStatus
  sessionId?: string | null
  reservationId?: string | null
}

// ─── API client ───────────────────────────────────────────────────────────────

export const floorPlanApi = {
  listPlans: (businessId: string) =>
    api.get<{ plans: FloorPlanSummary[] }>(
      `/businesses/${businessId}/floor-plans`
    ).then((r) => r.plans),

  createPlan: (businessId: string, data: CreateFloorPlanRequest) =>
    api.post<{ plan: FloorPlan }>(
      `/businesses/${businessId}/floor-plans`,
      { canvasWidth: 1200, canvasHeight: 800, gridSize: 20, ...data }
    ).then((r) => r.plan),

  getPlan: (businessId: string, planId: string) =>
    api.get<{ plan: FloorPlan }>(
      `/businesses/${businessId}/floor-plans/${planId}`
    ).then((r) => r.plan),

  saveCanvas: (businessId: string, planId: string, data: SaveCanvasRequest) =>
    api.put<{ plan: FloorPlan }>(
      `/businesses/${businessId}/floor-plans/${planId}`,
      data
    ).then((r) => r.plan),

  updateMeta: (businessId: string, planId: string, data: Partial<CreateFloorPlanRequest>) =>
    api.patch<{ plan: FloorPlan }>(
      `/businesses/${businessId}/floor-plans/${planId}`,
      data
    ).then((r) => r.plan),

  deletePlan: (businessId: string, planId: string) =>
    api.delete<{ status: string }>(
      `/businesses/${businessId}/floor-plans/${planId}`
    ),

  getLiveSnapshot: (businessId: string, planId: string) =>
    api.get<{ plan: FloorPlan; statuses: Record<string, ElementStatusSnapshot> }>(
      `/businesses/${businessId}/floor-plans/${planId}/live`
    ).then((r) => ({ plan: r.plan, statuses: r.statuses }) as LiveSnapshot),

  setElementStatus: (
    businessId: string,
    planId: string,
    elementId: string,
    data: SetElementStatusRequest
  ) =>
    api.patch<{ status: ElementStatusSnapshot }>(
      `/businesses/${businessId}/floor-plans/${planId}/elements/${elementId}/status`,
      data
    ).then((r) => r.status),

  listTemplates: (businessId: string) =>
    api.get<{ templates: FloorPlanTemplate[] }>(
      `/businesses/${businessId}/floor-plans/templates`
    ).then((r) => r.templates),
}
