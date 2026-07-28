import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { operationsApi, type OperationsSettings } from '../api/operations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RolesPermissionsHub } from './RolesPermissionsHub'

export function OperationsHub({ businessId }: { businessId: string }) {
  const [settings, setSettings] = useState<OperationsSettings | null>(null)

  useEffect(() => {
    void operationsApi
      .getSettings(businessId)
      .then(setSettings)
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load venue settings'))
  }, [businessId])

  async function saveSettings(patch: Partial<OperationsSettings>) {
    try {
      const next = await operationsApi.updateSettings(businessId, patch)
      setSettings(next)
      toast.success('Settings saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings')
    }
  }

  return (
    <div className="operations-hub">
      <Tabs defaultValue="roles">
        <TabsList>
          <TabsTrigger value="roles">Roles &amp; staff</TabsTrigger>
          <TabsTrigger value="settings">Venue</TabsTrigger>
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
      </Tabs>
    </div>
  )
}
