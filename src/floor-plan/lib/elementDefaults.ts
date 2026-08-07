import type { ElementKind } from '../../api/floorPlan'

export interface ElementDefaults {
  width: number
  height: number
  color: string
  shapeType: 'rect' | 'circle'
  seatCount: number
  /** Whether this element kind can be linked to a BusinessTable */
  bookable: boolean
  /** Whether this element kind has purely decorative role (no status) */
  decorative: boolean
  /** Default label prefix for auto-labeling */
  labelPrefix: string
}

export const ELEMENT_DEFAULTS: Record<ElementKind, ElementDefaults> = {
  TABLE: {
    width: 100,
    height: 70,
    color: '#d4a373',
    shapeType: 'rect',
    seatCount: 4,
    bookable: true,
    decorative: false,
    labelPrefix: 'Table',
  },
  CHAIR: {
    width: 28,
    height: 28,
    color: '#b5838d',
    shapeType: 'circle',
    seatCount: 1,
    bookable: false,
    decorative: true,
    labelPrefix: '',
  },
  WALL: {
    width: 160,
    height: 18,
    color: '#9ca3af',
    shapeType: 'rect',
    seatCount: 0,
    bookable: false,
    decorative: true,
    labelPrefix: '',
  },
  BAR: {
    width: 200,
    height: 50,
    color: '#6b4226',
    shapeType: 'rect',
    seatCount: 0,
    bookable: false,
    decorative: true,
    labelPrefix: 'Bar',
  },
  DOOR: {
    width: 50,
    height: 12,
    color: '#60a5fa',
    shapeType: 'rect',
    seatCount: 0,
    bookable: false,
    decorative: true,
    labelPrefix: '',
  },
  WINDOW: {
    width: 60,
    height: 10,
    color: '#93c5fd',
    shapeType: 'rect',
    seatCount: 0,
    bookable: false,
    decorative: true,
    labelPrefix: '',
  },
  STAGE: {
    width: 200,
    height: 100,
    color: '#fbbf24',
    shapeType: 'rect',
    seatCount: 0,
    bookable: false,
    decorative: true,
    labelPrefix: 'Stage',
  },
  PLANT: {
    width: 30,
    height: 30,
    color: '#4ade80',
    shapeType: 'circle',
    seatCount: 0,
    bookable: false,
    decorative: true,
    labelPrefix: '',
  },
  DECOR: {
    width: 40,
    height: 40,
    color: '#f3f4f6',
    shapeType: 'rect',
    seatCount: 0,
    bookable: false,
    decorative: true,
    labelPrefix: '',
  },
  HOTEL_ROOM: {
    width: 120,
    height: 90,
    color: '#a5b4fc',
    shapeType: 'rect',
    seatCount: 1,
    bookable: true,
    decorative: false,
    labelPrefix: 'Room',
  },
  ZONE: {
    width: 220,
    height: 160,
    color: '#e0f2fe',
    shapeType: 'rect',
    seatCount: 0,
    bookable: false,
    decorative: true,
    labelPrefix: 'Zone',
  },
  LABEL: {
    width: 80,
    height: 30,
    color: '#f3f4f6',
    shapeType: 'rect',
    seatCount: 0,
    bookable: false,
    decorative: true,
    labelPrefix: '',
  },
}

export function getDefaults(kind: ElementKind): ElementDefaults {
  return ELEMENT_DEFAULTS[kind] ?? ELEMENT_DEFAULTS.TABLE
}
