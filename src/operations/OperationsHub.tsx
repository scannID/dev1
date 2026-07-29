import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { operationsApi, type Branch, type OperationsSettings } from '../api/operations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RolesPermissionsHub } from './RolesPermissionsHub'
import { hasPermission } from './roleCatalog'
import type { StaffRole } from '../api/operations'

export function OperationsHub({
  businessId,
  staffMode = false,
  staffRole,
  onBranchCreated,
}: {
  businessId: string
  staffMode?: boolean
  staffRole?: string | null
  onBranchCreated?: (branchId: string) => void
}) {
  const [settings, setSettings] = useState<OperationsSettings | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchName, setBranchName] = useState('')
  const [branchLabel, setBranchLabel] = useState('')
  const [branchAddress, setBranchAddress] = useState('')
  const [branchPhone, setBranchPhone] = useState('')
  const [creatingBranch, setCreatingBranch] = useState(false)
  const [buildingCatalogFor, setBuildingCatalogFor] = useState<string | null>(null)

  useEffect(() => {
    void operationsApi
      .getSettings(businessId)
      .then(setSettings)
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load venue settings'))
  }, [businessId])

  useEffect(() => {
    if (staffMode) return
    void operationsApi
      .listBranches(businessId)
      .then(setBranches)
      .catch(() => setBranches([]))
  }, [businessId, staffMode])

  async function saveSettings(patch: Partial<OperationsSettings>) {
    try {
      const next = await operationsApi.updateSettings(businessId, patch)
      setSettings(next)
      toast.success('Settings saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings')
    }
  }

  async function createBranch() {
    if (!branchName.trim() || !branchLabel.trim()) {
      toast.error('Branch name and label are required')
      return
    }
    setCreatingBranch(true)
    try {
      const branch = await operationsApi.createBranch(businessId, {
        name: branchName.trim(),
        branchLabel: branchLabel.trim(),
        address: branchAddress.trim() || undefined,
        phone: branchPhone.trim() || undefined,
      })
      setBranches((current) => [...current, branch])
      setBranchName('')
      setBranchLabel('')
      setBranchAddress('')
      setBranchPhone('')
      toast.success(`Branch “${branch.branchLabel}” created`)
      onBranchCreated?.(branch.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create branch')
    } finally {
      setCreatingBranch(false)
    }
  }

  async function buildCatalog(branchId: string) {
    setBuildingCatalogFor(branchId)
    try {
      const res = await operationsApi.buildCatalog(branchId)
      if (res.built && res.itemsAdded > 0 && res.existingItems > 0) {
        toast.success(`Synced ${res.itemsAdded} photos from Main`)
      } else if (res.built) {
        toast.success(`Catalog built (${res.itemsAdded} items)`)
      } else {
        toast.success(`Catalog already built (${res.existingItems} items)`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to build catalog')
    } finally {
      setBuildingCatalogFor(null)
    }
  }

  const staffLoginHint = typeof window !== 'undefined'
    ? `${window.location.origin}/?staff=1&business=${encodeURIComponent(businessId)}`
    : ''

  return (
    <div className="operations-hub">
      <Tabs defaultValue="roles">
        <TabsList>
          <TabsTrigger value="roles">Roles &amp; staff</TabsTrigger>
          {(!staffMode || !staffRole || hasPermission(staffRole as StaffRole, 'venue:settings')) ? (
            <TabsTrigger value="settings">Venue</TabsTrigger>
          ) : null}
          {!staffMode ? <TabsTrigger value="branches">Branches</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="roles">
          <RolesPermissionsHub businessId={businessId} />
        </TabsContent>

        <TabsContent value="settings">
          {settings ? (
            <div className="operations-panel">
              <div className="operations-row">
                <Label>Accepting orders</Label>
                <Switch className="" checked={settings.acceptingOrders} onCheckedChange={(v) => void saveSettings({ acceptingOrders: v })} />
              </div>
              <div className="operations-row">
                <Label>Busy mode</Label>
                <Switch className="" checked={settings.busyMode} onCheckedChange={(v) => void saveSettings({ busyMode: v })} />
              </div>
              <div className="operations-field">
                <Label>Busy ETA (minutes)</Label>
                <Input type="number" value={settings.busyEtaMinutes} onChange={(e) => setSettings({ ...settings, busyEtaMinutes: Number(e.target.value) })} />
              </div>
              <div className="operations-field">
                <Label>Pause message</Label>
                <Textarea className="" value={settings.pauseMessage} onChange={(e) => setSettings({ ...settings, pauseMessage: e.target.value })} />
              </div>
              <div className="operations-row">
                <Label>Daily digest</Label>
                <Switch className="" checked={settings.dailyDigestEnabled} onCheckedChange={(v) => void saveSettings({ dailyDigestEnabled: v })} />
              </div>
              <Button onClick={() => settings && void saveSettings({
                acceptingOrders: settings.acceptingOrders,
                busyMode: settings.busyMode,
                busyEtaMinutes: settings.busyEtaMinutes,
                pauseMessage: settings.pauseMessage,
                dailyDigestEnabled: settings.dailyDigestEnabled,
              })}>Save venue settings</Button>
              <div className="operations-actions">
                <Button variant="outline" onClick={() => window.open(`/kitchen/${businessId}`, '_blank')}>Open kitchen screen</Button>
                <Button variant="outline" onClick={() => void operationsApi.exportCatalogCsv(businessId).then((csv) => {
                  const blob = new Blob([csv], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `catalog-${businessId}.csv`
                  a.click()
                  URL.revokeObjectURL(url)
                })}>Export catalog CSV</Button>
              </div>
            </div>
          ) : null}
        </TabsContent>

        {!staffMode ? (
          <TabsContent value="branches">
            <div className="operations-panel">
              <p className="text-sm text-muted-foreground" style={{ marginBottom: 16 }}>
                Create another location under this business. New branches start with an empty catalog.
                Invite a Branch Manager under Roles while switched into that branch — they sign in with the same portal login after setting their password from the invite email.
              </p>

              <div style={{ display: 'grid', gap: 12, marginBottom: 24 }}>
                {branches.map((branch) => (
                  <div
                    key={branch.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '12px 14px',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                    }}
                  >
                    <div>
                      <strong>{branch.branchLabel}</strong>
                      {branch.primary ? (
                        <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--muted-foreground)' }}>Main</span>
                      ) : null}
                      <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{branch.name}</div>
                      {branch.address ? (
                        <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{branch.address}</div>
                      ) : null}
                      <div style={{ fontSize: 11, fontFamily: 'monospace', marginTop: 4 }}>{branch.id}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch' }}>
                      {!branch.primary ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={buildingCatalogFor === branch.id}
                          onClick={() => void buildCatalog(branch.id)}
                        >
                          {buildingCatalogFor === branch.id ? 'Building…' : 'Build catalog'}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              <div className="operations-field">
                <Label>Branch display name</Label>
                <Input value={branchName} onChange={(e) => setBranchName(e.target.value)} placeholder="Kode Kololo" />
              </div>
              <div className="operations-field">
                <Label>Branch label</Label>
                <Input value={branchLabel} onChange={(e) => setBranchLabel(e.target.value)} placeholder="Kololo" />
              </div>
              <div className="operations-field">
                <Label>Address (optional)</Label>
                <Input value={branchAddress} onChange={(e) => setBranchAddress(e.target.value)} />
              </div>
              <div className="operations-field">
                <Label>Phone (optional)</Label>
                <Input value={branchPhone} onChange={(e) => setBranchPhone(e.target.value)} />
              </div>
              <Button disabled={creatingBranch} onClick={() => void createBranch()}>
                {creatingBranch ? 'Creating…' : 'Create branch'}
              </Button>
            </div>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  )
}
