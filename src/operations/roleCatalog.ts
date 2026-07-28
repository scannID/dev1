import type { StaffRole } from '../api/operations'

export type PermissionId =
  | 'catalog:read'
  | 'catalog:manage'
  | 'orders:read'
  | 'orders:pay'
  | 'orders:split'
  | 'orders:receipt'
  | 'kitchen:view'
  | 'kitchen:advance'
  | 'floor:tables'
  | 'floor:qr'
  | 'floor:status'
  | 'staff:manage'
  | 'venue:busy'
  | 'venue:settings'
  | 'reports:read'

export type RoleDefinition = {
  id: string
  label: string
  description: string
  permissions: PermissionId[]
  system: boolean
  /** Maps to backend StaffRole when assigning staff; null for custom-only docs. */
  staffRole: StaffRole | null
  accentClass: string
  memberCount?: number
}

export type PermissionMeta = {
  id: PermissionId
  label: string
  group: string
}

export const AVAILABLE_PERMISSIONS: PermissionMeta[] = [
  { id: 'catalog:read', label: 'View catalog', group: 'Catalog' },
  { id: 'catalog:manage', label: 'Add & edit menu items', group: 'Catalog' },
  { id: 'orders:read', label: 'View orders', group: 'Orders' },
  { id: 'orders:pay', label: 'Take payments', group: 'Orders' },
  { id: 'orders:split', label: 'Split bills', group: 'Orders' },
  { id: 'orders:receipt', label: 'Print receipts', group: 'Orders' },
  { id: 'kitchen:view', label: 'Open kitchen display', group: 'Kitchen' },
  { id: 'kitchen:advance', label: 'Advance kitchen status', group: 'Kitchen' },
  { id: 'floor:tables', label: 'Manage open tables', group: 'Floor' },
  { id: 'floor:qr', label: 'Share table QR links', group: 'Floor' },
  { id: 'floor:status', label: 'Update floor order status', group: 'Floor' },
  { id: 'staff:manage', label: 'Invite staff & change roles', group: 'Staff' },
  { id: 'venue:busy', label: 'Busy mode / pause orders', group: 'Venue' },
  { id: 'venue:settings', label: 'Edit venue settings', group: 'Venue' },
  { id: 'reports:read', label: 'View reports', group: 'Reports' },
]

export const SYSTEM_ROLES: RoleDefinition[] = [
  {
    id: 'MANAGER',
    label: 'Manager',
    description: 'Full merchant access — catalog, staff, venue controls, and kitchen.',
    staffRole: 'MANAGER',
    system: true,
    accentClass: 'roles-accent-manager',
    permissions: [
      'catalog:read',
      'catalog:manage',
      'orders:read',
      'orders:pay',
      'orders:split',
      'orders:receipt',
      'kitchen:view',
      'kitchen:advance',
      'floor:tables',
      'floor:qr',
      'floor:status',
      'staff:manage',
      'venue:busy',
      'venue:settings',
      'reports:read',
    ],
  },
  {
    id: 'CASHIER',
    label: 'Cashier',
    description: 'Orders, payments, receipts, and table sessions at the counter.',
    staffRole: 'CASHIER',
    system: true,
    accentClass: 'roles-accent-cashier',
    permissions: [
      'orders:read',
      'orders:pay',
      'orders:split',
      'orders:receipt',
      'floor:tables',
      'kitchen:view',
    ],
  },
  {
    id: 'WAITER',
    label: 'Waiter',
    description: 'Floor service — tables, QR links, and order status on the floor.',
    staffRole: 'WAITER',
    system: true,
    accentClass: 'roles-accent-waiter',
    permissions: [
      'floor:tables',
      'floor:qr',
      'floor:status',
      'orders:read',
      'kitchen:view',
    ],
  },
  {
    id: 'KITCHEN',
    label: 'Kitchen',
    description: 'Kitchen display only — advance Pending → Preparing → Ready.',
    staffRole: 'KITCHEN',
    system: true,
    accentClass: 'roles-accent-kitchen',
    permissions: ['kitchen:view', 'kitchen:advance'],
  },
]

export function permissionLabel(id: PermissionId): string {
  return AVAILABLE_PERMISSIONS.find((p) => p.id === id)?.label ?? id
}

export function permissionGroup(id: PermissionId): string {
  return AVAILABLE_PERMISSIONS.find((p) => p.id === id)?.group ?? id.split(':')[0]
}

export function formatStaffRoleLabel(role: StaffRole): string {
  return SYSTEM_ROLES.find((r) => r.staffRole === role)?.label ?? role
}

const CUSTOM_ROLES_KEY = (businessId: string) => `kode-custom-roles:${businessId}`

export function loadCustomRoles(businessId: string): RoleDefinition[] {
  try {
    const raw = localStorage.getItem(CUSTOM_ROLES_KEY(businessId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as RoleDefinition[]
    if (!Array.isArray(parsed)) return []
    return parsed.map((role) => ({
      ...role,
      system: false,
      staffRole: null,
      accentClass: role.accentClass || 'roles-accent-custom',
    }))
  } catch {
    return []
  }
}

export function saveCustomRoles(businessId: string, roles: RoleDefinition[]) {
  try {
    localStorage.setItem(CUSTOM_ROLES_KEY(businessId), JSON.stringify(roles))
  } catch {
    /* private mode */
  }
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}
