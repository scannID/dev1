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

/** Branch ops permissions — Overview / Reports stay with the owner (general manager). */
export const BRANCH_MANAGER_PERMISSIONS: PermissionId[] = [
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
  'venue:busy',
  'venue:settings',
]

/** Owner-only capabilities shown on the Roles page (not a staff enum). */
export const GENERAL_MANAGER_PERMISSIONS: PermissionId[] = [
  ...BRANCH_MANAGER_PERMISSIONS,
  'staff:manage',
  'reports:read',
]

/** Display cards for the Roles page — only Branch Manager is inviteable. */
export const ACCESS_LEVELS: RoleDefinition[] = [
  {
    id: 'GENERAL_MANAGER',
    label: 'General Manager',
    description:
      'Business owner — Overview, Reports, Roles, and every branch. Not invited as staff; this is your merchant login.',
    staffRole: null,
    system: true,
    accentClass: 'roles-accent-gm',
    permissions: GENERAL_MANAGER_PERMISSIONS,
  },
  {
    id: 'MANAGER',
    label: 'Branch Manager',
    description:
      'Runs one branch — orders, kitchen, catalog, floor, and venue. Invite them while switched into that branch.',
    staffRole: 'MANAGER',
    system: true,
    accentClass: 'roles-accent-manager',
    permissions: BRANCH_MANAGER_PERMISSIONS,
  },
]

/** Only assignable system role for staff invites. */
export const SYSTEM_ROLES: RoleDefinition[] = ACCESS_LEVELS.filter(
  (role) => role.staffRole === 'MANAGER',
)

/** Labels for legacy DB roles that can no longer be assigned. */
const LEGACY_ROLE_LABELS: Partial<Record<StaffRole, string>> = {
  CASHIER: 'Cashier',
  WAITER: 'Waiter',
  KITCHEN: 'Kitchen',
}

/** Keep existing legacy staff accounts usable until reassigned. */
const LEGACY_ROLE_PERMISSIONS: Partial<Record<StaffRole, PermissionId[]>> = {
  CASHIER: [
    'orders:read',
    'orders:pay',
    'orders:split',
    'orders:receipt',
    'floor:tables',
    'kitchen:view',
  ],
  WAITER: ['floor:tables', 'floor:qr', 'floor:status', 'orders:read', 'kitchen:view'],
  KITCHEN: ['kitchen:view', 'kitchen:advance'],
}

export function permissionLabel(id: PermissionId): string {
  return AVAILABLE_PERMISSIONS.find((p) => p.id === id)?.label ?? id
}

export function permissionGroup(id: PermissionId): string {
  return AVAILABLE_PERMISSIONS.find((p) => p.id === id)?.group ?? id.split(':')[0]
}

export function formatStaffRoleLabel(role: StaffRole): string {
  return (
    SYSTEM_ROLES.find((r) => r.staffRole === role)?.label ??
    LEGACY_ROLE_LABELS[role] ??
    role
  )
}

const CUSTOM_ROLES_KEY = (businessId: string) => `kodte-custom-roles:${businessId}`

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

export function permissionsForRole(role: StaffRole): PermissionId[] {
  return (
    SYSTEM_ROLES.find((r) => r.staffRole === role)?.permissions ??
    LEGACY_ROLE_PERMISSIONS[role] ??
    []
  )
}

export function hasPermission(role: StaffRole, permission: PermissionId): boolean {
  return permissionsForRole(role).includes(permission)
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}
