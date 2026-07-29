import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Check,
  ChevronLeft,
  Copy,
  Eye,
  Grid3X3,
  List,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  operationsApi,
  type StaffMember,
  type StaffRole,
} from '../api/operations'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  AVAILABLE_PERMISSIONS,
  SYSTEM_ROLES,
  formatStaffRoleLabel,
  getInitials,
  loadCustomRoles,
  permissionGroup,
  permissionLabel,
  saveCustomRoles,
  type PermissionId,
  type RoleDefinition,
} from './roleCatalog'

type HubView = 'roles' | 'staff' | 'create-role'

type RoleFormState = {
  id?: string
  name: string
  description: string
  permissions: PermissionId[]
}

type StaffFormState = {
  email: string
  displayName: string
  role: StaffRole
  pin: string
}

const emptyRoleForm: RoleFormState = {
  name: '',
  description: '',
  permissions: [],
}

const emptyStaffForm: StaffFormState = {
  email: '',
  displayName: '',
  role: 'KITCHEN',
  pin: '',
}

export function RolesPermissionsHub({ businessId }: { businessId: string }) {
  const [view, setView] = useState<HubView>('roles')
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [customRoles, setCustomRoles] = useState<RoleDefinition[]>(() =>
    loadCustomRoles(businessId),
  )
  const [loadingStaff, setLoadingStaff] = useState(true)

  const [roleSearchQuery, setRoleSearchQuery] = useState('')
  const [roleTypeFilter, setRoleTypeFilter] = useState<'all' | 'system' | 'custom'>('all')
  const [roleSortOrder, setRoleSortOrder] = useState<
    'name-asc' | 'name-desc' | 'permissions-desc'
  >('name-asc')
  const [roleViewMode, setRoleViewMode] = useState<'grid' | 'list'>('grid')
  const [viewRole, setViewRole] = useState<RoleDefinition | null>(null)
  const [roleForm, setRoleForm] = useState<RoleFormState>(emptyRoleForm)

  const [staffSearchQuery, setStaffSearchQuery] = useState('')
  const [staffSheetOpen, setStaffSheetOpen] = useState(false)
  const [staffForm, setStaffForm] = useState<StaffFormState>(emptyStaffForm)
  const [savingStaff, setSavingStaff] = useState(false)

  useEffect(() => {
    setCustomRoles(loadCustomRoles(businessId))
  }, [businessId])

  useEffect(() => {
    let cancelled = false
    setLoadingStaff(true)
    operationsApi
      .listStaff(businessId)
      .then((list) => {
        if (!cancelled) setStaff(list)
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : 'Failed to load staff')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingStaff(false)
      })
    return () => {
      cancelled = true
    }
  }, [businessId])

  const memberCounts = useMemo(() => {
    const counts: Record<string, number> = {
      MANAGER: 0,
      CASHIER: 0,
      WAITER: 0,
      KITCHEN: 0,
    }
    for (const member of staff) {
      counts[member.role] = (counts[member.role] ?? 0) + 1
    }
    return counts
  }, [staff])

  const allRoles = useMemo((): RoleDefinition[] => {
    const system = SYSTEM_ROLES.map((role) => ({
      ...role,
      memberCount: memberCounts[role.id] ?? 0,
    }))
    return [...system, ...customRoles]
  }, [customRoles, memberCounts])

  const activeStaffCount = useMemo(
    () => staff.filter((m) => m.active).length,
    [staff],
  )
  const inactiveStaffCount = staff.length - activeStaffCount
  const totalPermissionAssignments = useMemo(
    () => allRoles.reduce((total, role) => total + role.permissions.length, 0),
    [allRoles],
  )

  const filteredRoles = useMemo(() => {
    const query = roleSearchQuery.trim().toLowerCase()
    return allRoles
      .filter((role) => {
        if (roleTypeFilter === 'system' && !role.system) return false
        if (roleTypeFilter === 'custom' && role.system) return false
        if (!query) return true
        return [role.label, role.description, role.id].some((value) =>
          value.toLowerCase().includes(query),
        )
      })
      .sort((a, b) => {
        if (roleSortOrder === 'name-desc') {
          return b.label.localeCompare(a.label)
        }
        if (roleSortOrder === 'permissions-desc') {
          return b.permissions.length - a.permissions.length
        }
        return a.label.localeCompare(b.label)
      })
  }, [allRoles, roleSearchQuery, roleSortOrder, roleTypeFilter])

  const filteredStaff = useMemo(() => {
    const query = staffSearchQuery.trim().toLowerCase()
    if (!query) return staff
    return staff.filter((member) =>
      [
        member.displayName,
        member.email,
        member.role,
        formatStaffRoleLabel(member.role),
      ].some((value) => value.toLowerCase().includes(query)),
    )
  }, [staff, staffSearchQuery])

  function persistCustom(next: RoleDefinition[]) {
    setCustomRoles(next)
    saveCustomRoles(businessId, next)
  }

  function openCreateRole(prefill?: RoleFormState) {
    setRoleForm(prefill ?? emptyRoleForm)
    setView('create-role')
  }

  function handleDuplicateRole(role: RoleDefinition) {
    openCreateRole({
      name: `${role.label} Copy`,
      description: role.description,
      permissions: [...role.permissions],
    })
  }

  function handleEditRole(role: RoleDefinition) {
    if (role.system) return
    openCreateRole({
      id: role.id,
      name: role.label,
      description: role.description,
      permissions: [...role.permissions],
    })
  }

  function handleDeleteRole(role: RoleDefinition) {
    if (role.system) return
    persistCustom(customRoles.filter((r) => r.id !== role.id))
    toast.success(`Removed ${role.label}`)
  }

  function toggleRoleFormPermission(permission: PermissionId) {
    setRoleForm((current) => {
      const has = current.permissions.includes(permission)
      return {
        ...current,
        permissions: has
          ? current.permissions.filter((item) => item !== permission)
          : [...current.permissions, permission],
      }
    })
  }

  function handleCreateRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = roleForm.name.trim()
    if (!name || roleForm.permissions.length === 0) return

    if (roleForm.id) {
      persistCustom(
        customRoles.map((role) =>
          role.id === roleForm.id
            ? {
                ...role,
                label: name,
                description: roleForm.description.trim(),
                permissions: [...roleForm.permissions],
              }
            : role,
        ),
      )
      toast.success('Role updated')
    } else {
      const next: RoleDefinition = {
        id: `custom-${Date.now()}`,
        label: name,
        description: roleForm.description.trim() || 'Custom merchant role',
        permissions: [...roleForm.permissions],
        system: false,
        staffRole: null,
        accentClass: 'roles-accent-custom',
        memberCount: 0,
      }
      persistCustom([next, ...customRoles])
      toast.success('Custom role saved locally')
    }

    setRoleForm(emptyRoleForm)
    setView('roles')
  }

  async function handleAddStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!staffForm.email.trim() || !staffForm.displayName.trim() || !staffForm.pin.trim()) {
      toast.error('Fill email, display name, and PIN')
      return
    }
    setSavingStaff(true)
    try {
      const created = await operationsApi.createStaff(businessId, {
        email: staffForm.email.trim(),
        displayName: staffForm.displayName.trim(),
        role: staffForm.role,
        pin: staffForm.pin,
      })
      setStaff((current) => [created, ...current])
      setStaffForm(emptyStaffForm)
      setStaffSheetOpen(false)
      toast.success('Staff added')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add staff')
    } finally {
      setSavingStaff(false)
    }
  }

  function generatePin(): string {
    // 6-digit PIN keeps it simple; backend validates 4–8 digits.
    return String(Math.floor(100000 + Math.random() * 900000))
  }

  async function handleInviteManager() {
    const email = staffForm.email.trim().toLowerCase()
    const displayName = staffForm.displayName.trim()
    if (!email || !displayName) {
      toast.error('Fill email and display name')
      return
    }

    const pin = generatePin()
    setSavingStaff(true)
    try {
      const created = await operationsApi.createStaff(businessId, {
        email,
        displayName,
        role: 'MANAGER',
        pin,
      })
      setStaff((current) => [created, ...current])
      setStaffForm(emptyStaffForm)
      setStaffSheetOpen(false)

      const link = `${window.location.origin}/?staff=1&business=${encodeURIComponent(businessId)}`
      const message = `Branch manager invite\nLink: ${link}\nEmail: ${email}\nPIN: ${pin}`
      await navigator.clipboard.writeText(message)
      toast.success('Invite copied (link + PIN)')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to invite manager')
    } finally {
      setSavingStaff(false)
    }
  }

  return (
    <div className="roles-hub">
      <div className="roles-hub-header">
        <div className="roles-hub-header-row">
          {view === 'create-role' ? (
            <>
              <div>
                <h2 className="roles-hub-title">
                  {roleForm.id ? 'Edit Role' : 'Create New Role'}
                </h2>
                <p className="roles-hub-subtitle">
                  Design a custom role with specific permissions for your venue staff.
                  Custom roles are saved on this device until backend support lands —
                  staff assignment still uses Manager, Cashier, Waiter, or Kitchen.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setView('roles')}
                className="roles-hub-btn"
              >
                Back to Roles
              </Button>
            </>
          ) : view === 'roles' ? (
            <>
              <div>
                <h2 className="roles-hub-title">Roles &amp; permissions</h2>
                <p className="roles-hub-subtitle">
                  Define who sees what on the floor, kitchen, and counter. Assign a
                  system role when you add staff — their PIN unlocks only what that
                  role allows.
                </p>
              </div>
              <div className="roles-hub-actions">
                <Button
                  variant="outline"
                  onClick={() => setView('staff')}
                  className="roles-hub-btn gap-2"
                >
                  <Users className="size-4" />
                  Manage Staff
                </Button>
                <Button
                  onClick={() => openCreateRole()}
                  className="roles-hub-btn roles-hub-btn-primary gap-2"
                >
                  <UserPlus className="size-4" />
                  Create New Role
                </Button>
              </div>
            </>
          ) : (
            <>
              <div>
                <h2 className="roles-hub-title">Manage Staff</h2>
                <p className="roles-hub-subtitle">
                  Invite team members, set their PIN, and assign a system role that
                  controls what they can open.
                </p>
              </div>
              <div className="roles-hub-actions">
                <Button
                  variant="outline"
                  onClick={() => setView('roles')}
                  className="roles-hub-btn gap-2"
                >
                  <Shield className="size-4" />
                  Roles
                </Button>
                <Button
                  onClick={() => setStaffSheetOpen(true)}
                  className="roles-hub-btn roles-hub-btn-primary gap-2"
                >
                  <UserPlus className="size-4" />
                  Add Staff
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {view !== 'create-role' && (
        <div
          className={`roles-stats ${view === 'roles' ? 'roles-stats-3' : 'roles-stats-4'}`}
        >
          {(view === 'roles'
            ? [
                {
                  label: 'Total Roles',
                  value: allRoles.length,
                  icon: Shield,
                  tone: 'roles-stat-tone-blue',
                },
                {
                  label: 'Custom Roles',
                  value: customRoles.length,
                  icon: UserPlus,
                  tone: 'roles-stat-tone-primary',
                },
                {
                  label: 'Permissions',
                  value: totalPermissionAssignments,
                  icon: ShieldCheck,
                  tone: 'roles-stat-tone-blue',
                },
              ]
            : [
                {
                  label: 'Total Staff',
                  value: staff.length,
                  icon: Users,
                  tone: 'roles-stat-tone-primary',
                },
                {
                  label: 'Active Staff',
                  value: activeStaffCount,
                  icon: UserCheck,
                  tone: 'roles-stat-tone-green',
                },
                {
                  label: 'Inactive',
                  value: inactiveStaffCount,
                  icon: UserX,
                  tone: 'roles-stat-tone-amber',
                },
                {
                  label: 'System Roles',
                  value: SYSTEM_ROLES.length,
                  icon: Shield,
                  tone: 'roles-stat-tone-blue',
                },
              ]
          ).map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="roles-stat-card">
                <div>
                  <div className="roles-stat-value">{stat.value}</div>
                  <div className="roles-stat-label">{stat.label}</div>
                </div>
                <div className={`roles-stat-icon ${stat.tone}`}>
                  <Icon className="size-5" />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {view === 'create-role' ? (
        <form id="create-role-form" onSubmit={handleCreateRole} className="roles-create">
          <div className="roles-create-header">
            <div>
              <h3>Role Details</h3>
              <p>
                Name the role, describe its responsibility, and select the
                permissions it should grant.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setView('roles')}
              className="roles-hub-btn gap-2"
            >
              <ChevronLeft className="size-4" />
              Back
            </Button>
          </div>

          <div className="roles-create-body">
            <div className="roles-create-main">
              <div className="roles-create-fields">
                <div className="roles-field">
                  <Label htmlFor="role-name">Role Name</Label>
                  <Input
                    id="role-name"
                    required
                    value={roleForm.name}
                    onChange={(e) =>
                      setRoleForm((c) => ({ ...c, name: e.target.value }))
                    }
                    placeholder="Bar supervisor"
                  />
                </div>
                <div className="roles-field">
                  <Label htmlFor="role-description">Description</Label>
                  <Input
                    id="role-description"
                    value={roleForm.description}
                    onChange={(e) =>
                      setRoleForm((c) => ({ ...c, description: e.target.value }))
                    }
                    placeholder="Runs the bar counter and splits"
                  />
                </div>
              </div>

              <div className="roles-field">
                <Label>Permissions</Label>
                <p className="roles-hint">Select at least one permission for this role.</p>
                <div className="roles-permission-grid">
                  {AVAILABLE_PERMISSIONS.map((permission) => {
                    const active = roleForm.permissions.includes(permission.id)
                    return (
                      <button
                        key={permission.id}
                        type="button"
                        onClick={() => toggleRoleFormPermission(permission.id)}
                        className={`roles-permission-chip${active ? ' active' : ''}`}
                      >
                        <div className="roles-permission-chip-text">
                          <div className="roles-permission-label">{permission.label}</div>
                          <div className="roles-permission-group">{permission.group}</div>
                        </div>
                        <span className={`roles-permission-check${active ? ' active' : ''}`}>
                          <Check className="size-3.5" />
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <aside className="roles-preview">
              <div className="roles-preview-top">
                <div>
                  <h4>Role Preview</h4>
                  <p>How this role appears in the catalog.</p>
                </div>
                <span className="roles-stat-icon roles-stat-tone-blue">
                  <ShieldCheck className="size-5" />
                </span>
              </div>
              <div className="roles-card roles-accent-custom roles-preview-card">
                <h4>{roleForm.name.trim() || 'New custom role'}</h4>
                <Badge variant="secondary" className="roles-badge-custom">
                  Custom Role
                </Badge>
                <p>
                  {roleForm.description.trim() ||
                    'Role description will appear here.'}
                </p>
                <div className="roles-card-meta">
                  <span>
                    <Shield className="size-4" />
                    {roleForm.permissions.length} permissions selected
                  </span>
                </div>
              </div>
            </aside>
          </div>

          <div className="roles-create-footer">
            <Button
              type="button"
              variant="outline"
              onClick={() => setView('roles')}
              className="roles-hub-btn"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!roleForm.name.trim() || roleForm.permissions.length === 0}
              className="roles-hub-btn roles-hub-btn-primary gap-2"
            >
              <UserPlus className="size-4" />
              {roleForm.id ? 'Save Role' : 'Create Role'}
            </Button>
          </div>
        </form>
      ) : view === 'staff' ? (
        <section className="roles-panel">
          <div className="roles-panel-header">
            <div>
              <h3>Team members</h3>
              <p>Search staff and review departments, status, and assigned roles.</p>
            </div>
          </div>
          <div className="roles-panel-body">
            <div className="roles-search-wrap">
              <Search className="roles-search-icon" />
              <Input
                value={staffSearchQuery}
                onChange={(e) => setStaffSearchQuery(e.target.value)}
                placeholder="Search staff by name, email, or role"
                className="roles-search-input"
              />
            </div>

            <div className="roles-staff-table">
              <div className="roles-staff-head">
                <span>Staff</span>
                <span>Role</span>
                <span>Status</span>
                <span className="roles-staff-action-head">Action</span>
              </div>
              <div className="roles-staff-body">
                {loadingStaff ? (
                  <div className="roles-empty">Loading staff…</div>
                ) : filteredStaff.length === 0 ? (
                  <div className="roles-empty">
                    {staff.length === 0
                      ? 'No staff yet — add someone to get started.'
                      : 'No staff match your search.'}
                  </div>
                ) : (
                  filteredStaff.map((member) => (
                    <div key={member.id} className="roles-staff-row">
                      <div className="roles-staff-identity">
                        <div className="roles-avatar">{getInitials(member.displayName)}</div>
                        <div className="roles-staff-text">
                          <div className="roles-staff-name">{member.displayName}</div>
                          <div className="roles-staff-email">{member.email}</div>
                        </div>
                      </div>
                      <div>
                        <Badge variant="outline" className="roles-role-badge">
                          {formatStaffRoleLabel(member.role)}
                        </Badge>
                      </div>
                      <div>
                        <Badge
                          variant="outline"
                          className={
                            member.active
                              ? 'roles-status-active'
                              : 'roles-status-inactive'
                          }
                        >
                          {member.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="roles-staff-action">
                        <Button
                          variant="outline"
                          size="sm"
                          className="roles-hub-btn gap-1"
                          onClick={() => setView('roles')}
                        >
                          <Shield className="size-3.5" />
                          Roles
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <div className="roles-catalog">
          <section className="roles-toolbar">
            <div className="roles-search-wrap roles-search-grow">
              <Search className="roles-search-icon" />
              <Input
                value={roleSearchQuery}
                onChange={(e) => setRoleSearchQuery(e.target.value)}
                placeholder="Search roles by name or description…"
                className="roles-search-input"
              />
            </div>
            <div className="roles-toolbar-controls">
              <Select
                value={roleTypeFilter}
                onValueChange={(v) =>
                  setRoleTypeFilter(v as typeof roleTypeFilter)
                }
              >
                <SelectTrigger className="roles-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="system">System Roles</SelectItem>
                  <SelectItem value="custom">Custom Roles</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={roleSortOrder}
                onValueChange={(v) =>
                  setRoleSortOrder(v as typeof roleSortOrder)
                }
              >
                <SelectTrigger className="roles-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">Name (A–Z)</SelectItem>
                  <SelectItem value="name-desc">Name (Z–A)</SelectItem>
                  <SelectItem value="permissions-desc">Most permissions</SelectItem>
                </SelectContent>
              </Select>
              <div className="roles-view-toggle">
                <Button
                  type="button"
                  size="icon"
                  variant={roleViewMode === 'grid' ? 'secondary' : 'ghost'}
                  className={roleViewMode === 'grid' ? 'roles-view-active' : ''}
                  onClick={() => setRoleViewMode('grid')}
                  aria-label="Grid view"
                >
                  <Grid3X3 className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant={roleViewMode === 'list' ? 'secondary' : 'ghost'}
                  className={roleViewMode === 'list' ? 'roles-view-active' : ''}
                  onClick={() => setRoleViewMode('list')}
                  aria-label="List view"
                >
                  <List className="size-4" />
                </Button>
              </div>
            </div>
          </section>

          <section
            className={
              roleViewMode === 'grid' ? 'roles-grid' : 'roles-list'
            }
          >
            {filteredRoles.map((role) => (
              <article
                key={role.id}
                className={`roles-card ${role.accentClass}`}
              >
                <div className="roles-card-top">
                  <div>
                    <h3>{role.label}</h3>
                    <Badge
                      variant="secondary"
                      className={
                        role.system ? 'roles-badge-system' : 'roles-badge-custom'
                      }
                    >
                      {role.system ? 'System Role' : 'Custom Role'}
                    </Badge>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="roles-card-menu">
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem
                        className=""
                        inset={false}
                        onSelect={() => setViewRole(role)}
                      >
                        <Eye className="size-4" />
                        View details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className=""
                        inset={false}
                        onSelect={() => handleDuplicateRole(role)}
                      >
                        <Copy className="size-4" />
                        Duplicate role
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="" />
                      <DropdownMenuItem
                        className=""
                        inset={false}
                        disabled={role.system}
                        onSelect={() => handleEditRole(role)}
                      >
                        <Pencil className="size-4" />
                        Edit permissions
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className=""
                        inset={false}
                        disabled={role.system}
                        variant="destructive"
                        onSelect={() => handleDeleteRole(role)}
                      >
                        <Trash2 className="size-4" />
                        Delete role
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <p className="roles-card-desc">{role.description}</p>

                <div className="roles-card-meta">
                  <span>
                    <Shield className="size-4" />
                    {role.permissions.length} permissions
                  </span>
                  <span>
                    <Users className="size-4" />
                    {role.memberCount ?? 0} members
                  </span>
                </div>

                <Button
                  variant="outline"
                  onClick={() => setViewRole(role)}
                  className="roles-card-view gap-2"
                >
                  <Eye className="size-4" />
                  View
                </Button>
              </article>
            ))}

            <button
              type="button"
              onClick={() => openCreateRole()}
              className="roles-create-tile"
            >
              <span className="roles-create-tile-icon">
                <Plus className="size-8" />
              </span>
              <span className="roles-create-tile-title">Create New Role</span>
              <span className="roles-create-tile-sub">
                Design a custom role with specific permissions
              </span>
            </button>
          </section>
        </div>
      )}

      <Sheet open={staffSheetOpen} onOpenChange={setStaffSheetOpen}>
        <SheetContent className="roles-sheet overflow-y-auto sm:max-w-lg">
          <SheetHeader className="roles-sheet-header">
            <SheetTitle>Add Staff Member</SheetTitle>
            <SheetDescription>
              Create a staff profile with a PIN and assign a system role.
            </SheetDescription>
          </SheetHeader>

          <form
            id="add-staff-form"
            onSubmit={handleAddStaff}
            className="roles-sheet-form"
          >
            <div className="roles-create-fields">
              <div className="roles-field">
                <Label htmlFor="staff-display-name">Display name</Label>
                <Input
                  id="staff-display-name"
                  required
                  value={staffForm.displayName}
                  onChange={(e) =>
                    setStaffForm((c) => ({ ...c, displayName: e.target.value }))
                  }
                  placeholder="Amina Okello"
                />
              </div>
              <div className="roles-field">
                <Label htmlFor="staff-email">Email</Label>
                <Input
                  id="staff-email"
                  required
                  type="email"
                  value={staffForm.email}
                  onChange={(e) =>
                    setStaffForm((c) => ({ ...c, email: e.target.value }))
                  }
                  placeholder="amina@venue.com"
                />
              </div>
            </div>

            <div className="roles-field">
              <Label htmlFor="staff-pin">PIN</Label>
              <Input
                id="staff-pin"
                required
                type="password"
                value={staffForm.pin}
                onChange={(e) =>
                  setStaffForm((c) => ({ ...c, pin: e.target.value }))
                }
                placeholder="4–6 digit PIN"
              />
            </div>

            <div className="roles-field">
              <Label>System role</Label>
              <div className="roles-permission-grid">
                {SYSTEM_ROLES.map((role) => {
                  const active = staffForm.role === role.staffRole
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() =>
                        setStaffForm((c) => ({
                          ...c,
                          role: role.staffRole as StaffRole,
                        }))
                      }
                      className={`roles-permission-chip${active ? ' active' : ''}`}
                    >
                      <div className="roles-permission-chip-text">
                        <div className="roles-permission-label">{role.label}</div>
                        <div className="roles-permission-group">
                          {role.permissions.length} permissions
                        </div>
                      </div>
                      <span
                        className={`roles-permission-check${active ? ' active' : ''}`}
                      >
                        <Check className="size-3.5" />
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </form>

          <SheetFooter className="roles-sheet-footer">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleInviteManager()}
              disabled={savingStaff}
              className="roles-hub-btn gap-2"
            >
              <Copy className="size-4" />
              {savingStaff ? 'Inviting…' : 'Invite Manager'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setStaffSheetOpen(false)}
              className="roles-hub-btn"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="add-staff-form"
              disabled={savingStaff}
              className="roles-hub-btn roles-hub-btn-primary gap-2"
            >
              <UserPlus className="size-4" />
              {savingStaff ? 'Creating…' : 'Create Staff'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet
        open={Boolean(viewRole)}
        onOpenChange={(open) => !open && setViewRole(null)}
      >
        <SheetContent className="roles-sheet overflow-y-auto sm:max-w-md">
          <SheetHeader className="roles-sheet-header">
            <SheetTitle>{viewRole?.label ?? 'Role Details'}</SheetTitle>
            <SheetDescription>
              View role metadata, member count, and assigned permissions.
            </SheetDescription>
          </SheetHeader>

          {viewRole && (
            <div className="roles-sheet-form">
              <div className={`roles-card ${viewRole.accentClass}`}>
                <div className="roles-card-top">
                  <div>
                    <h3>{viewRole.label}</h3>
                    <p className="roles-card-desc">{viewRole.description}</p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={
                      viewRole.system ? 'roles-badge-system' : 'roles-badge-custom'
                    }
                  >
                    {viewRole.system ? 'System Role' : 'Custom Role'}
                  </Badge>
                </div>
              </div>

              <div className="roles-detail-stats">
                <div className="roles-detail-stat">
                  <div className="roles-stat-label">Permissions</div>
                  <div className="roles-stat-value">{viewRole.permissions.length}</div>
                </div>
                <div className="roles-detail-stat">
                  <div className="roles-stat-label">Members</div>
                  <div className="roles-stat-value">{viewRole.memberCount ?? 0}</div>
                </div>
              </div>

              <div>
                <h4 className="roles-detail-heading">Assigned Permissions</h4>
                <p className="roles-hint">
                  Permissions granted to staff with this role.
                </p>
                <div className="roles-detail-perms">
                  {viewRole.permissions.map((permission) => (
                    <div key={permission} className="roles-detail-perm">
                      <div>
                        <div className="roles-permission-label">
                          {permissionLabel(permission)}
                        </div>
                        <div className="roles-permission-group">
                          {permissionGroup(permission)}
                        </div>
                      </div>
                      <Badge variant="outline" className="roles-role-badge">
                        {permission}
                      </Badge>
                    </div>
                  ))}
                  {viewRole.permissions.length === 0 && (
                    <div className="roles-empty">No permissions assigned.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          <SheetFooter className="roles-sheet-footer">
            <Button
              variant="outline"
              onClick={() => setViewRole(null)}
              className="roles-hub-btn"
            >
              Close
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export default RolesPermissionsHub
