import { useCallback, useEffect, useState } from 'react'
import { UserPlus, ShieldCheck, ShieldOff, RotateCcw, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { InlineSpinner } from '../components/LoadingSpinner'
import { adminUsersApi } from '../api/services'
import {
  type AdminUserRow,
  type AdminPermission,
  ADMIN_PERMISSION_META,
  GRANTABLE_PERMISSIONS,
} from '../api/types'

// Group the grantable permissions by their section
const PERMISSION_GROUPS = GRANTABLE_PERMISSIONS.reduce<Record<string, AdminPermission[]>>(
  (acc, perm) => {
    const group = ADMIN_PERMISSION_META[perm].group
    if (!acc[group]) acc[group] = []
    acc[group].push(perm)
    return acc
  },
  {},
)

export default function AdminsPage() {
  const [admins, setAdmins] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Invite sheet
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [invitePerms, setInvitePerms] = useState<Set<AdminPermission>>(new Set())
  const [inviting, setSaving] = useState(false)

  // Edit permissions sheet
  const [editTarget, setEditTarget] = useState<AdminUserRow | null>(null)
  const [editPerms, setEditPerms] = useState<Set<AdminPermission>>(new Set())
  const [saving, setUpdating] = useState(false)

  // Revoke / restore confirm dialogs
  const [revokeTarget, setRevokeTarget] = useState<AdminUserRow | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<AdminUserRow | null>(null)
  const [actioning, setActioning] = useState(false)

  // Expanded row (shows permission chips)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Resend invite
  const [resending, setResending] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await adminUsersApi.list()
      setAdmins(data.admins)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admins')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // ── Invite ──────────────────────────────────────────────────────────────────

  function openInvite() {
    setInviteEmail('')
    setInviteName('')
    setInvitePerms(new Set())
    setInviteOpen(true)
  }

  async function submitInvite() {
    if (!inviteEmail.trim() || !inviteName.trim()) {
      toast.error('Email and display name are required')
      return
    }
    setSaving(true)
    try {
      await adminUsersApi.invite({
        email: inviteEmail.trim(),
        displayName: inviteName.trim(),
        permissions: Array.from(invitePerms),
      })
      toast.success(`Invite sent to ${inviteEmail.trim()}`)
      setInviteOpen(false)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setSaving(false)
    }
  }

  // ── Edit permissions ────────────────────────────────────────────────────────

  function openEdit(admin: AdminUserRow) {
    setEditTarget(admin)
    setEditPerms(new Set(admin.permissions))
  }

  async function submitEdit() {
    if (!editTarget) return
    setUpdating(true)
    try {
      await adminUsersApi.updatePermissions(editTarget.id, Array.from(editPerms))
      toast.success('Permissions updated')
      setEditTarget(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update permissions')
    } finally {
      setUpdating(false)
    }
  }

  // ── Revoke ──────────────────────────────────────────────────────────────────

  async function confirmRevoke() {
    if (!revokeTarget) return
    setActioning(true)
    try {
      await adminUsersApi.revoke(revokeTarget.id)
      toast.success(`${revokeTarget.displayName}'s access revoked`)
      setRevokeTarget(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke access')
    } finally {
      setActioning(false)
    }
  }

  // ── Restore ─────────────────────────────────────────────────────────────────

  async function confirmRestore() {
    if (!restoreTarget) return
    setActioning(true)
    try {
      await adminUsersApi.restore(restoreTarget.id)
      toast.success(`${restoreTarget.displayName} re-enabled`)
      setRestoreTarget(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to restore admin')
    } finally {
      setActioning(false)
    }
  }

  // ── Resend invite ────────────────────────────────────────────────────────────

  async function resendInvite(admin: AdminUserRow) {
    setResending(true)
    try {
      await adminUsersApi.resendInvite(admin.id)
      toast.success(`Invite resent to ${admin.email}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resend invite')
    } finally {
      setResending(false)
    }
  }

  // ── Permission toggle helper — used by PermissionPicker ─────────────────────

  function selectAll(set: Set<AdminPermission>, setFn: (s: Set<AdminPermission>) => void) {
    setFn(new Set(GRANTABLE_PERMISSIONS))
  }

  function clearAll(set: Set<AdminPermission>, setFn: (s: Set<AdminPermission>) => void) {
    setFn(new Set())
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Header actions ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button onClick={openInvite} className="gap-2">
          <UserPlus size={15} />
          Invite Admin
        </Button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', marginBottom: 16, color: 'crimson', fontSize: 13 }}>
          {error}
        </div>
      )}
      {loading && (
        <div className="admin-loading-banner">
          <InlineSpinner label="Loading admins…" />
        </div>
      )}

      {/* ── Admin table ── */}
      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <h3>Admin Accounts</h3>
            <p>Manage who has access to the console and what they can see</p>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Name', 'Email', 'Type', 'Status', 'Invited by', 'Since', ''].map((h) => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && admins.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 16, color: 'var(--muted-foreground)' }}>
                    No admin accounts yet. Invite one above.
                  </td>
                </tr>
              )}
              {admins.map((admin) => {
                const isExpanded = expandedId === admin.id
                return (
                  <>
                    <tr
                      key={admin.id}
                      style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                      onClick={() => setExpandedId(isExpanded ? null : admin.id)}
                    >
                      {/* Name */}
                      <td style={{ padding: '10px 16px', fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                            background: admin.superAdmin ? 'oklch(0.4 0.18 260)' : 'oklch(0.6 0.12 200)',
                            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700,
                          }}>
                            {admin.displayName.slice(0, 2).toUpperCase()}
                          </div>
                          {admin.displayName}
                        </div>
                      </td>

                      {/* Email */}
                      <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)' }}>
                        {admin.email}
                      </td>

                      {/* Type */}
                      <td style={{ padding: '10px 16px' }}>
                        {admin.superAdmin ? (
                          <Badge className="bg-primary/10 text-primary gap-1">
                            <ShieldCheck size={11} /> Super Admin
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Sub-Admin</Badge>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '10px 16px' }}>
                        <Badge
                          variant="secondary"
                          className={
                            admin.pending
                              ? 'bg-amber-50 text-amber-700'
                              : admin.active
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-red-50 text-red-600'
                          }
                        >
                          {admin.pending ? 'Pending' : admin.active ? 'Active' : 'Revoked'}
                        </Badge>
                      </td>

                      {/* Invited by */}
                      <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)', fontSize: 12 }}>
                        {admin.invitedByEmail ?? '—'}
                      </td>

                      {/* Since */}
                      <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)', fontSize: 12 }}>
                        {new Date(admin.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '10px 16px' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {isExpanded
                            ? <ChevronUp size={14} style={{ color: 'var(--muted-foreground)' }} />
                            : <ChevronDown size={14} style={{ color: 'var(--muted-foreground)' }} />}

                          {/* Pending: resend invite only */}
                          {!admin.superAdmin && admin.pending && (
                            <Button
                              size="sm"
                              variant="outline"
                              style={{ fontSize: 11, padding: '2px 10px', height: 26 }}
                              disabled={resending}
                              onClick={() => void resendInvite(admin)}
                            >
                              <RefreshCw size={11} />
                              Resend
                            </Button>
                          )}

                          {/* Active: edit + revoke */}
                          {!admin.superAdmin && admin.active && !admin.pending && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                style={{ fontSize: 11, padding: '2px 10px', height: 26 }}
                                onClick={() => openEdit(admin)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive border-destructive/40 hover:bg-destructive/5"
                                style={{ fontSize: 11, padding: '2px 10px', height: 26 }}
                                onClick={() => setRevokeTarget(admin)}
                              >
                                <ShieldOff size={11} />
                                Revoke
                              </Button>
                            </>
                          )}

                          {/* Revoked: restore only */}
                          {!admin.superAdmin && !admin.active && !admin.pending && (
                            <Button
                              size="sm"
                              variant="outline"
                              style={{ fontSize: 11, padding: '2px 10px', height: 26 }}
                              onClick={() => setRestoreTarget(admin)}
                            >
                              <RotateCcw size={11} />
                              Restore
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded row — permission chips */}
                    {isExpanded && (
                      <tr key={`${admin.id}-expanded`} style={{ borderBottom: '1px solid var(--border)', background: 'var(--muted)/30' }}>
                        <td colSpan={7} style={{ padding: '8px 16px 12px 56px' }}>
                          {admin.superAdmin ? (
                            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>
                              Super admin — full access to everything.
                            </p>
                          ) : admin.permissions.length === 0 ? (
                            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>
                              No permissions granted.
                            </p>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {admin.permissions.map((p) => (
                                <Badge key={p} variant="secondary" style={{ fontSize: 11 }}>
                                  {ADMIN_PERMISSION_META[p]?.label ?? p}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Invite sheet ── */}
      <Sheet open={inviteOpen} onOpenChange={setInviteOpen}>
        <SheetContent side="right" className="w-full max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle>Invite Admin</SheetTitle>
            <SheetDescription>
              They'll receive an email to set their password. Choose what sections they can access.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 grid gap-5">
            <div className="grid gap-1.5">
              <Label>Email *</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="admin@example.com"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Display name *</Label>
              <Input
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Jane Nakato"
              />
            </div>

            <PermissionPicker
              selected={invitePerms}
              onChange={setInvitePerms}
              onSelectAll={() => selectAll(invitePerms, setInvitePerms)}
              onClearAll={() => clearAll(invitePerms, setInvitePerms)}
            />
          </div>

          <SheetFooter className="border-t px-6 py-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={inviting}>
              Cancel
            </Button>
            <Button onClick={() => void submitInvite()} disabled={inviting} className="gap-2">
              <UserPlus size={14} />
              {inviting ? 'Sending…' : 'Send Invite'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Edit permissions sheet ── */}
      <Sheet open={Boolean(editTarget)} onOpenChange={(open) => !open && setEditTarget(null)}>
        <SheetContent side="right" className="w-full max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle>Edit Permissions</SheetTitle>
            <SheetDescription>
              {editTarget?.displayName} · {editTarget?.email}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <PermissionPicker
              selected={editPerms}
              onChange={setEditPerms}
              onSelectAll={() => selectAll(editPerms, setEditPerms)}
              onClearAll={() => clearAll(editPerms, setEditPerms)}
            />
          </div>

          <SheetFooter className="border-t px-6 py-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void submitEdit()} disabled={saving}>
              {saving ? 'Saving…' : 'Save Permissions'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Revoke confirm ── */}
      <AlertDialog open={Boolean(revokeTarget)} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke access for {revokeTarget?.displayName}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will be immediately logged out and can no longer access the admin console. You can restore their access at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actioning}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={actioning} onClick={() => void confirmRevoke()}>
              {actioning ? 'Revoking…' : 'Revoke Access'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Restore confirm ── */}
      <AlertDialog open={Boolean(restoreTarget)} onOpenChange={(open) => !open && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore {restoreTarget?.displayName}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will be able to log in again with their previously set permissions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actioning}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={actioning} onClick={() => void confirmRestore()}>
              {actioning ? 'Restoring…' : 'Restore Access'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ── Permission picker sub-component ────────────────────────────────────────────

function PermissionPicker({
  selected,
  onChange,
  onSelectAll,
  onClearAll,
}: {
  selected: Set<AdminPermission>
  onChange: (s: Set<AdminPermission>) => void
  onSelectAll: () => void
  onClearAll: () => void
}) {
  function toggle(perm: AdminPermission) {
    const next = new Set(selected)
    if (next.has(perm)) next.delete(perm)
    else next.add(perm)
    onChange(next)
  }

  return (
    <div className="grid gap-4">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Label>Permissions</Label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={{ fontSize: 11, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }} onClick={onSelectAll}>
            Select all
          </button>
          <button type="button" style={{ fontSize: 11, color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer' }} onClick={onClearAll}>
            Clear
          </button>
        </div>
      </div>

      {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
        <div key={group} className="grid gap-2">
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: 0 }}>
            {group}
          </p>
          <div style={{ display: 'grid', gap: 6 }}>
            {perms.map((perm) => {
              const checked = selected.has(perm)
              return (
                <label
                  key={perm}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                    padding: '8px 10px', borderRadius: 8, fontSize: 13,
                    background: checked ? 'var(--primary)/8' : 'var(--muted)',
                    border: `1px solid ${checked ? 'var(--primary)' : 'transparent'}`,
                    transition: 'all 0.12s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(perm)}
                    style={{ accentColor: 'var(--primary)', width: 15, height: 15 }}
                  />
                  <span style={{ fontWeight: checked ? 600 : 400 }}>
                    {ADMIN_PERMISSION_META[perm].label}
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
