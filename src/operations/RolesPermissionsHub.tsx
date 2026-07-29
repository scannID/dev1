import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Check,
  Eye,
  Mail,
  Shield,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react'
import { toast } from 'sonner'
import { operationsApi, type StaffMember } from '../api/operations'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  ACCESS_LEVELS,
  BRANCH_MANAGER_PERMISSIONS,
  formatStaffRoleLabel,
  getInitials,
  permissionGroup,
  permissionLabel,
  type PermissionId,
  type RoleDefinition,
} from './roleCatalog'

type HubView = 'roles' | 'staff'

export function RolesPermissionsHub({ businessId }: { businessId: string }) {
  const [view, setView] = useState<HubView>('roles')
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loadingStaff, setLoadingStaff] = useState(true)
  const [staffSearchQuery, setStaffSearchQuery] = useState('')
  const [staffSheetOpen, setStaffSheetOpen] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [savingStaff, setSavingStaff] = useState(false)
  const [viewRole, setViewRole] = useState<RoleDefinition | null>(null)

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

  const branchManagers = useMemo(
    () => staff.filter((m) => m.role === 'MANAGER'),
    [staff],
  )
  const activeBranchManagers = branchManagers.filter((m) => m.active).length
  const pendingInvites = staff.filter((m) => m.invitePending).length

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

  const accessLevels = useMemo((): RoleDefinition[] => {
    return ACCESS_LEVELS.map((level) => ({
      ...level,
      memberCount: level.id === 'MANAGER' ? branchManagers.length : undefined,
    }))
  }, [branchManagers.length])

  async function handleAddStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email.trim() || !displayName.trim()) {
      toast.error('Fill email and display name')
      return
    }
    setSavingStaff(true)
    try {
      const created = await operationsApi.createStaff(businessId, {
        email: email.trim(),
        displayName: displayName.trim(),
        role: 'MANAGER',
      })
      setStaff((current) => [created, ...current])
      setDisplayName('')
      setEmail('')
      setStaffSheetOpen(false)
      toast.success('Branch Manager invite sent to ' + email.trim())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to invite staff')
    } finally {
      setSavingStaff(false)
    }
  }

  async function handleResendInvite(member: StaffMember) {
    try {
      await operationsApi.resendInvite(businessId, member.id)
      toast.success('Invite resent to ' + member.email)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resend invite')
    }
  }

  return (
    <div className="roles-hub">
      <div className="roles-hub-header">
        <div className="roles-hub-header-row">
          {view === 'roles' ? (
            <>
              <div>
                <h2 className="roles-hub-title">Access levels</h2>
                <p className="roles-hub-subtitle">
                  General Manager (you) owns Overview and Reports across branches.
                  Invite a Branch Manager per location to run day-to-day ops.
                </p>
              </div>
              <div className="roles-hub-actions">
                <Button
                  variant="outline"
                  onClick={() => setView('staff')}
                  className="roles-hub-btn gap-2"
                >
                  <Users className="size-4" />
                  Branch Managers
                </Button>
                <Button
                  onClick={() => setStaffSheetOpen(true)}
                  className="roles-hub-btn roles-hub-btn-primary gap-2"
                >
                  <UserPlus className="size-4" />
                  Invite Branch Manager
                </Button>
              </div>
            </>
          ) : (
            <>
              <div>
                <h2 className="roles-hub-title">Branch Managers</h2>
                <p className="roles-hub-subtitle">
                  People invited for this branch. They sign in with the portal login
                  and get full branch ops — not Overview or Reports.
                </p>
              </div>
              <div className="roles-hub-actions">
                <Button
                  variant="outline"
                  onClick={() => setView('roles')}
                  className="roles-hub-btn gap-2"
                >
                  <Shield className="size-4" />
                  Access levels
                </Button>
                <Button
                  onClick={() => setStaffSheetOpen(true)}
                  className="roles-hub-btn roles-hub-btn-primary gap-2"
                >
                  <UserPlus className="size-4" />
                  Invite Branch Manager
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="roles-stats roles-stats-3">
        {(view === 'roles'
          ? [
              {
                label: 'Access levels',
                value: 2,
                icon: Shield,
                tone: 'roles-stat-tone-blue',
              },
              {
                label: 'Branch Managers',
                value: branchManagers.length,
                icon: Users,
                tone: 'roles-stat-tone-primary',
              },
              {
                label: 'Branch permissions',
                value: BRANCH_MANAGER_PERMISSIONS.length,
                icon: ShieldCheck,
                tone: 'roles-stat-tone-blue',
              },
            ]
          : [
              {
                label: 'Total',
                value: staff.length,
                icon: Users,
                tone: 'roles-stat-tone-primary',
              },
              {
                label: 'Active',
                value: activeBranchManagers,
                icon: UserCheck,
                tone: 'roles-stat-tone-green',
              },
              {
                label: 'Pending invites',
                value: pendingInvites,
                icon: UserX,
                tone: 'roles-stat-tone-amber',
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

      {view === 'staff' ? (
        <section className="roles-panel">
          <div className="roles-panel-header">
            <div>
              <h3>Team for this branch</h3>
              <p>Search by name or email. Role is always Branch Manager.</p>
            </div>
          </div>
          <div className="roles-panel-body">
            <div className="roles-search-wrap">
              <Input
                value={staffSearchQuery}
                onChange={(e) => setStaffSearchQuery(e.target.value)}
                placeholder="Search by name or email"
                className="roles-search-input roles-search-input-plain"
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
                      ? 'No Branch Managers yet — invite someone for this location.'
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
                            member.invitePending
                              ? 'roles-status-pending'
                              : member.active
                                ? 'roles-status-active'
                                : 'roles-status-inactive'
                          }
                        >
                          {member.invitePending
                            ? 'Pending'
                            : member.active
                              ? 'Active'
                              : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="roles-staff-action">
                        {member.invitePending ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="roles-hub-btn gap-1"
                            onClick={() => void handleResendInvite(member)}
                          >
                            <Mail className="size-3.5" />
                            Resend
                          </Button>
                        ) : (
                          <span className="roles-staff-muted">—</span>
                        )}
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
          <section className="roles-grid roles-grid-access">
            {accessLevels.map((level) => (
              <article key={level.id} className={`roles-card ${level.accentClass}`}>
                <div className="roles-card-top">
                  <div>
                    <h3>{level.label}</h3>
                    <Badge
                      variant="secondary"
                      className={
                        level.id === 'GENERAL_MANAGER'
                          ? 'roles-badge-gm'
                          : 'roles-badge-system'
                      }
                    >
                      {level.id === 'GENERAL_MANAGER' ? 'Owner login' : 'Inviteable'}
                    </Badge>
                  </div>
                </div>

                <p className="roles-card-desc">{level.description}</p>

                <div className="roles-card-meta">
                  <span>
                    <Shield className="size-4" />
                    {level.permissions.length} capabilities
                  </span>
                  {level.id === 'MANAGER' ? (
                    <span>
                      <Users className="size-4" />
                      {level.memberCount ?? 0} on this branch
                    </span>
                  ) : (
                    <span>
                      <ShieldCheck className="size-4" />
                      Overview · Reports · Roles
                    </span>
                  )}
                </div>

                <div className="roles-card-actions">
                  <Button
                    variant="outline"
                    onClick={() => setViewRole(level)}
                    className="roles-card-view gap-2"
                  >
                    <Eye className="size-4" />
                    View access
                  </Button>
                  {level.id === 'MANAGER' ? (
                    <Button
                      onClick={() => setStaffSheetOpen(true)}
                      className="roles-hub-btn roles-hub-btn-primary gap-2"
                    >
                      <UserPlus className="size-4" />
                      Invite
                    </Button>
                  ) : null}
                </div>
              </article>
            ))}
          </section>
        </div>
      )}

      <Sheet open={staffSheetOpen} onOpenChange={setStaffSheetOpen}>
        <SheetContent className="roles-sheet overflow-y-auto sm:max-w-lg">
          <SheetHeader className="roles-sheet-header">
            <SheetTitle>Invite Branch Manager</SheetTitle>
            <SheetDescription>
              They get full ops for this branch only. Overview and Reports stay with
              you as General Manager.
            </SheetDescription>
          </SheetHeader>

          <form id="add-staff-form" onSubmit={handleAddStaff} className="roles-sheet-form">
            <div className="roles-create-fields">
              <div className="roles-field">
                <Label htmlFor="staff-display-name">Display name</Label>
                <Input
                  id="staff-display-name"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Amina Okello"
                />
              </div>
              <div className="roles-field">
                <Label htmlFor="staff-email">Email</Label>
                <Input
                  id="staff-email"
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="amina@venue.com"
                />
              </div>
            </div>

            <div className="roles-invite-role">
              <div className="roles-invite-role-row">
                <Check className="size-4" />
                <div>
                  <strong>Branch Manager</strong>
                  <p>Orders, kitchen, catalog, floor, and venue for this branch.</p>
                </div>
              </div>
            </div>
          </form>

          <SheetFooter className="roles-sheet-footer">
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
              {savingStaff ? 'Sending invite…' : 'Send Invite'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={Boolean(viewRole)} onOpenChange={(open) => !open && setViewRole(null)}>
        <SheetContent className="roles-sheet overflow-y-auto sm:max-w-md">
          <SheetHeader className="roles-sheet-header">
            <SheetTitle>{viewRole?.label ?? 'Access details'}</SheetTitle>
            <SheetDescription>
              {viewRole?.id === 'GENERAL_MANAGER'
                ? 'What the owner login can do across the business.'
                : 'What a Branch Manager can do on this location.'}
            </SheetDescription>
          </SheetHeader>

          {viewRole && (
            <div className="roles-sheet-form">
              <div className={`roles-card ${viewRole.accentClass}`}>
                <h3>{viewRole.label}</h3>
                <p className="roles-card-desc">{viewRole.description}</p>
              </div>

              {viewRole.id === 'GENERAL_MANAGER' ? (
                <div className="roles-gm-callouts">
                  <div className="roles-gm-callout">Overview dashboard</div>
                  <div className="roles-gm-callout">Reports</div>
                  <div className="roles-gm-callout">Invite Branch Managers</div>
                  <div className="roles-gm-callout">All branches</div>
                </div>
              ) : null}

              <div>
                <h4 className="roles-detail-heading">
                  {viewRole.id === 'GENERAL_MANAGER'
                    ? 'Also includes branch ops'
                    : 'Branch capabilities'}
                </h4>
                <div className="roles-detail-perms">
                  {viewRole.permissions
                    .filter((p) => viewRole.id !== 'GENERAL_MANAGER' || !ownerOnlyPerm(p))
                    .map((permission) => (
                      <div key={permission} className="roles-detail-perm">
                        <div>
                          <div className="roles-permission-label">
                            {permissionLabel(permission)}
                          </div>
                          <div className="roles-permission-group">
                            {permissionGroup(permission)}
                          </div>
                        </div>
                      </div>
                    ))}
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

function ownerOnlyPerm(permission: PermissionId): boolean {
  return permission === 'staff:manage' || permission === 'reports:read'
}

export default RolesPermissionsHub
