import type { ElementStatus } from '../../api/floorPlan'

export interface StatusStyle {
  fill: string
  stroke: string
  strokeWidth: number
  /** Whether to animate (pulse) this status */
  animate: boolean
  label: string
}

export const STATUS_STYLES: Record<ElementStatus, StatusStyle> = {
  FREE: {
    fill: '#22c55e',
    stroke: '#16a34a',
    strokeWidth: 2,
    animate: false,
    label: 'Free',
  },
  OCCUPIED: {
    fill: '#ef4444',
    stroke: '#dc2626',
    strokeWidth: 2,
    animate: true,
    label: 'Occupied',
  },
  RESERVED: {
    fill: '#f59e0b',
    stroke: '#d97706',
    strokeWidth: 2,
    animate: false,
    label: 'Reserved',
  },
  OUT_OF_SERVICE: {
    fill: '#6b7280',
    stroke: '#4b5563',
    strokeWidth: 2,
    animate: false,
    label: 'Out of Service',
  },
}

export const STATUS_DOT_COLOR: Record<ElementStatus, string> = {
  FREE: '#22c55e',
  OCCUPIED: '#ef4444',
  RESERVED: '#f59e0b',
  OUT_OF_SERVICE: '#6b7280',
}

export function getStatusStyle(status: ElementStatus | undefined): StatusStyle {
  return STATUS_STYLES[status ?? 'FREE']
}
