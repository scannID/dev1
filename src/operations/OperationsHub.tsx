import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { operationsApi, type Branch, type OperationsSettings } from '../api/operations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RolesPermissionsHub } from './RolesPermissionsHub'
import { hasPermission } from './roleCatalog'
import type { StaffRole } from '../api/operations'

export type OperationsTab = 'roles' | 'settings' | 'branches'
const BUSY_TIMER_STORAGE_PREFIX = 'Kodte:busy-until:'

type BusyTimerSnapshot = {
  busyUntilMs: number
  etaMinutes: number
  pauseMessage: string
}

function busyTimerKeyFor(businessId: string): string {
  return `${BUSY_TIMER_STORAGE_PREFIX}${businessId}`
}

function readBusyTimer(key: string): BusyTimerSnapshot | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<BusyTimerSnapshot>
    if (
      typeof parsed.busyUntilMs !== 'number'
      || typeof parsed.etaMinutes !== 'number'
      || typeof parsed.pauseMessage !== 'string'
    ) return null
    return {
      busyUntilMs: parsed.busyUntilMs,
      etaMinutes: parsed.etaMinutes,
      pauseMessage: parsed.pauseMessage,
    }
  } catch {
    return null
  }
}

function writeBusyTimer(key: string, snapshot: BusyTimerSnapshot) {
  try {
    localStorage.setItem(key, JSON.stringify(snapshot))
  } catch {
    // ignore storage failures
  }
}

function clearBusyTimer(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore storage failures
  }
}

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds)
  const mins = Math.floor(safe / 60)
  const secs = safe % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function OperationsHub({
  businessId,
  staffMode = false,
  staffRole,
  onBranchCreated,
  activeTab,
  showTabs = true,
}: {
  businessId: string
  staffMode?: boolean
  staffRole?: string | null
  onBranchCreated?: (branchId: string) => void
  activeTab?: OperationsTab
  showTabs?: boolean
}) {
  const [tab, setTab] = useState<OperationsTab>('roles')
  const [settings, setSettings] = useState<OperationsSettings | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchName, setBranchName] = useState('')
  const [branchLabel, setBranchLabel] = useState('')
  const [branchAddress, setBranchAddress] = useState('')
  const [branchPhone, setBranchPhone] = useState('')
  const [creatingBranch, setCreatingBranch] = useState(false)
  const [buildingCatalogFor, setBuildingCatalogFor] = useState<string | null>(null)
  const [busyCountdownSec, setBusyCountdownSec] = useState<number | null>(null)
  const autoStoppingBusyRef = useRef(false)

  const syncBusyCountdown = useCallback((next: OperationsSettings, forceReset = false) => {
    const key = busyTimerKeyFor(businessId)
    const etaMinutes = Math.max(0, Math.round(Number(next.busyEtaMinutes) || 0))
    const pauseMessage = next.pauseMessage?.trim() || ''
    const isBusy = Boolean(next.busyMode) && etaMinutes > 0
    if (!isBusy) {
      clearBusyTimer(key)
      setBusyCountdownSec(null)
      return
    }
    const now = Date.now()
    const existing = readBusyTimer(key)
    const needsReset = forceReset
      || !existing
      || existing.etaMinutes !== etaMinutes
      || existing.pauseMessage !== pauseMessage
      || existing.busyUntilMs <= now
    const busyUntilMs = needsReset ? now + etaMinutes * 60_000 : existing.busyUntilMs
    if (needsReset) {
      writeBusyTimer(key, {
        busyUntilMs,
        etaMinutes,
        pauseMessage,
      })
    }
    const remaining = Math.max(0, Math.ceil((busyUntilMs - now) / 1000))
    setBusyCountdownSec(remaining)
  }, [businessId])

  useEffect(() => {
    void operationsApi
      .getSettings(businessId)
      .then((next) => {
        setSettings(next)
        syncBusyCountdown(next)
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load venue settings'))
  }, [businessId, syncBusyCountdown])

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
      syncBusyCountdown(next, true)
      toast.success('Settings saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings')
    }
  }

  useEffect(() => {
    if (busyCountdownSec == null) return
    if (busyCountdownSec <= 0) return
    const id = window.setInterval(() => {
      setBusyCountdownSec((seconds) => {
        if (seconds == null) return seconds
        if (seconds <= 0) return 0
        return seconds - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [busyCountdownSec])

  useEffect(() => {
    if (busyCountdownSec !== 0 || !settings?.busyMode) return
    if (autoStoppingBusyRef.current) return
    autoStoppingBusyRef.current = true
    void operationsApi
      .updateSettings(businessId, {
        busyMode: false,
        acceptingOrders: true,
        busyEtaMinutes: 0,
      })
      .then((next) => {
        setSettings(next)
        syncBusyCountdown(next)
        toast.success('Busy mode ended automatically')
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to auto-end busy mode')
      })
      .finally(() => {
        autoStoppingBusyRef.current = false
      })
  }, [busyCountdownSec, settings?.busyMode, businessId, syncBusyCountdown])

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

  const currentTab = activeTab ?? tab

  function handleTabChange(nextTab: string) {
    if (nextTab === 'roles' || nextTab === 'settings' || nextTab === 'branches') {
      setTab(nextTab)
    }
  }

  return (
    <div className="operations-hub">
      <Tabs value={currentTab} onValueChange={handleTabChange}>
        {showTabs ? (
          <TabsList>
            <TabsTrigger value="roles">Staff</TabsTrigger>
            {(!staffMode || !staffRole || hasPermission(staffRole as StaffRole, 'venue:settings')) ? (
              <TabsTrigger value="settings">Busy mode</TabsTrigger>
            ) : null}
            {!staffMode ? <TabsTrigger value="branches">Branches</TabsTrigger> : null}
          </TabsList>
        ) : null}

        <TabsContent value="roles">
          <RolesPermissionsHub businessId={businessId} />
        </TabsContent>

        <TabsContent value="settings">
          {settings ? (
            <div className="operations-panel">
              <div className="operations-row">
                <Label>Order flow</Label>
                <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
                  {settings.busyMode ? 'Busy active' : 'Open'}
                </span>
              </div>
              <div className="operations-field">
                <Label>Busy ETA (minutes)</Label>
                <Input
                  type="number"
                  min={0}
                  value={settings.busyEtaMinutes}
                  onChange={(e) => setSettings({ ...settings, busyEtaMinutes: Math.max(0, Number(e.target.value) || 0) })}
                />
                {busyCountdownSec != null ? (
                  <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                    Countdown: {formatCountdown(busyCountdownSec)}
                  </span>
                ) : null}
              </div>
              <div className="operations-field">
                <Label>Pause message</Label>
                <Textarea className="" value={settings.pauseMessage} onChange={(e) => setSettings({ ...settings, pauseMessage: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%' }}>
                <Button style={{ width: '100%' }} onClick={() => settings && void saveSettings({
                  acceptingOrders: (Math.round(Number(settings.busyEtaMinutes) || 0) <= 0),
                  busyMode: (Math.round(Number(settings.busyEtaMinutes) || 0) > 0),
                  busyEtaMinutes: Math.max(0, Math.round(Number(settings.busyEtaMinutes) || 0)),
                  pauseMessage: settings.pauseMessage,
                  dailyDigestEnabled: settings.dailyDigestEnabled,
                })}>Save busy mode</Button>
                <Button
                  type="button"
                  variant="destructive"
                  style={{ width: '100%' }}
                  disabled={!settings.busyMode}
                  onClick={() => void saveSettings({
                    busyMode: false,
                    acceptingOrders: true,
                    busyEtaMinutes: 0,
                  })}
                >
                  Revoke busy mode
                </Button>
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
                <Input value={branchName} onChange={(e) => setBranchName(e.target.value)} placeholder="Kodte Kololo" />
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
