import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useConfigs } from '@/hooks/usePlatform'
import type { ConfigAction, ConfigMap, ConfigSection } from '@/api/types'

function asString(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback
  return String(value)
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

const FEATURE_FLAGS: Array<{ key: string; label: string; desc: string }> = [
  { key: 'merchantSelfRegistration', label: 'Merchant self-registration', desc: 'Allow merchants to sign up without approval' },
  { key: 'customerAccounts', label: 'Customer accounts', desc: 'Enable customer login and order history' },
  { key: 'mobileMoneyPayments', label: 'Mobile money payments', desc: 'MTN / Airtel Money integration active' },
  { key: 'cardPayments', label: 'Card payments', desc: 'Visa / Mastercard via payment gateway' },
  { key: 'qrScanAnalytics', label: 'QR scan analytics', desc: 'Track scan events and device metadata' },
  { key: 'multiBusinessMerchants', label: 'Multi-business merchants', desc: 'Allow one account to manage multiple shops' },
  { key: 'customerOrderHistory', label: 'Customer order history', desc: 'Let customers view past orders' },
  { key: 'maintenanceMode', label: 'Maintenance mode', desc: 'Show maintenance page to all users' },
]

const DANGER_ACTIONS: Array<{ action: ConfigAction; title: string; desc: string }> = [
  { action: 'purge-test-data', title: 'Purge test data', desc: 'Remove all sample/seed orders and merchants' },
  { action: 'clear-qr-scan-logs', title: 'Clear QR scan logs', desc: 'Delete all historical scan event records' },
  { action: 'revoke-all-sessions', title: 'Revoke all sessions', desc: 'Force sign-out all active user sessions' },
  { action: 'reset-platform', title: 'Reset platform', desc: 'Restore config factory defaults (business data kept)' },
]

export default function ConfigsPage() {
  const { configs, loading, error, saving, updateSection, runAction, refresh } = useConfigs()
  const [draft, setDraft] = useState<Record<ConfigSection, ConfigMap> | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  useEffect(() => {
    if (configs) {
      setDraft({
        platform: { ...configs.platform },
        auth: { ...configs.auth },
        payments: { ...configs.payments },
        orders: { ...configs.orders },
        qr: { ...configs.qr },
        notifications: { ...configs.notifications },
        features: { ...configs.features },
      })
    }
  }, [configs])

  function setField(section: ConfigSection, key: string, value: string | number | boolean) {
    setDraft((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        [section]: { ...prev[section], [key]: value },
      }
    })
  }

  async function save(section: ConfigSection) {
    if (!draft) return
    try {
      await updateSection(section, draft[section])
      setSaved(section)
      setTimeout(() => setSaved(null), 2000)
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : `Failed to save ${section}`)
    }
  }

  async function toggleFeature(key: string, value: boolean) {
    if (!draft) return
    const next = { ...draft.features, [key]: value }
    setDraft({ ...draft, features: next })
    try {
      await updateSection('features', next)
      setSaved('features')
      setTimeout(() => setSaved(null), 2000)
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Failed to update feature flag')
      refresh()
    }
  }

  async function handleAction(action: ConfigAction) {
    const confirmed = window.confirm(`Run "${action}"? This may be destructive.`)
    if (!confirmed) return
    try {
      const result = await runAction(action)
      setActionMessage(result.message)
      if (action === 'reset-platform') {
        await refresh()
      }
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : `Failed to run ${action}`)
    }
  }

  if (loading && !draft) {
    return <LoadingSpinner fullPage label="Loading configs…" />
  }

  if (error && !draft) {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <p style={{ color: 'var(--destructive)' }}>{error}</p>
        <Button size="sm" className="w-fit" onClick={() => refresh()}>Retry</Button>
      </div>
    )
  }

  if (!draft) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {actionMessage && (
        <div className="admin-card" style={{ padding: '12px 16px' }}>
          <p style={{ margin: 0, fontSize: 13 }}>{actionMessage}</p>
        </div>
      )}

      {/* ── Row 1: Platform + Auth ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="admin-card">
          <div className="admin-card-header">
            <div><h3>Platform</h3><p>Core identity and URLs</p></div>
            {saved === 'platform' && <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">Saved</Badge>}
          </div>
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>Platform Name</Label>
              <Input value={asString(draft.platform.platformName)} onChange={(e) => setField('platform', 'platformName', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>Support Email</Label>
              <Input value={asString(draft.platform.supportEmail)} type="email" onChange={(e) => setField('platform', 'supportEmail', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>QR Scan Base URL</Label>
              <Input value={asString(draft.platform.qrScanBaseUrl)} onChange={(e) => setField('platform', 'qrScanBaseUrl', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>Merchant Portal URL</Label>
              <Input value={asString(draft.platform.merchantPortalUrl)} onChange={(e) => setField('platform', 'merchantPortalUrl', e.target.value)} />
            </div>
            <Button size="sm" className="w-fit" disabled={saving === 'platform'} onClick={() => save('platform')}>
              {saving === 'platform' ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-header">
            <div><h3>Authentication</h3><p>Keycloak SSO configuration</p></div>
            {saved === 'auth' && <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">Saved</Badge>}
          </div>
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>Keycloak Auth Server URL</Label>
              <Input value={asString(draft.auth.keycloakUrl)} onChange={(e) => setField('auth', 'keycloakUrl', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>Realm</Label>
              <Input value={asString(draft.auth.realm)} onChange={(e) => setField('auth', 'realm', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>Merchant Client ID</Label>
              <Input value={asString(draft.auth.merchantClientId)} onChange={(e) => setField('auth', 'merchantClientId', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>Admin Client ID</Label>
              <Input value={asString(draft.auth.adminClientId)} onChange={(e) => setField('auth', 'adminClientId', e.target.value)} />
            </div>
            <Button size="sm" className="w-fit" disabled={saving === 'auth'} onClick={() => save('auth')}>
              {saving === 'auth' ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Row 2: Payments + Orders ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="admin-card">
          <div className="admin-card-header">
            <div><h3>Payments</h3><p>Payment methods and limits</p></div>
            {saved === 'payments' && <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">Saved</Badge>}
          </div>
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>Default Currency</Label>
              <Input value={asString(draft.payments.defaultCurrency)} onChange={(e) => setField('payments', 'defaultCurrency', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>Min Order Amount (UGX)</Label>
              <Input value={asString(draft.payments.minOrderAmount)} type="number" onChange={(e) => setField('payments', 'minOrderAmount', asNumber(e.target.value))} />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>Max Order Amount (UGX)</Label>
              <Input value={asString(draft.payments.maxOrderAmount)} type="number" onChange={(e) => setField('payments', 'maxOrderAmount', asNumber(e.target.value))} />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>Payment Gateway URL</Label>
              <Input value={asString(draft.payments.paymentGatewayUrl)} onChange={(e) => setField('payments', 'paymentGatewayUrl', e.target.value)} />
            </div>
            <Button size="sm" className="w-fit" disabled={saving === 'payments'} onClick={() => save('payments')}>
              {saving === 'payments' ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-header">
            <div><h3>Orders</h3><p>Order lifecycle settings</p></div>
            {saved === 'orders' && <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">Saved</Badge>}
          </div>
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>Order Timeout (minutes)</Label>
              <Input value={asString(draft.orders.orderTimeoutMinutes)} type="number" onChange={(e) => setField('orders', 'orderTimeoutMinutes', asNumber(e.target.value))} />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>Max Items Per Order</Label>
              <Input value={asString(draft.orders.maxItemsPerOrder)} type="number" onChange={(e) => setField('orders', 'maxItemsPerOrder', asNumber(e.target.value))} />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>Auto-complete After (hours)</Label>
              <Input value={asString(draft.orders.autoCompleteAfterHours)} type="number" onChange={(e) => setField('orders', 'autoCompleteAfterHours', asNumber(e.target.value))} />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>Order ID Prefix</Label>
              <Input value={asString(draft.orders.orderIdPrefix)} onChange={(e) => setField('orders', 'orderIdPrefix', e.target.value)} />
            </div>
            <Button size="sm" className="w-fit" disabled={saving === 'orders'} onClick={() => save('orders')}>
              {saving === 'orders' ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Row 3: QR + Notifications ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="admin-card">
          <div className="admin-card-header">
            <div><h3>QR Codes</h3><p>QR generation and scan settings</p></div>
            {saved === 'qr' && <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">Saved</Badge>}
          </div>
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>QR Token Prefix</Label>
              <Input value={asString(draft.qr.qrTokenPrefix)} onChange={(e) => setField('qr', 'qrTokenPrefix', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>QR Code Size (px)</Label>
              <Input value={asString(draft.qr.qrCodeSizePx)} type="number" onChange={(e) => setField('qr', 'qrCodeSizePx', asNumber(e.target.value))} />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>Scan Rate Limit (per min)</Label>
              <Input value={asString(draft.qr.scanRateLimitPerMin)} type="number" onChange={(e) => setField('qr', 'scanRateLimitPerMin', asNumber(e.target.value))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Track scan location</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>Log GPS coordinates on scan</p>
              </div>
              <Switch checked={asBool(draft.qr.trackScanLocation)} onCheckedChange={(v) => setField('qr', 'trackScanLocation', v)} />
            </div>
            <Button size="sm" className="w-fit" disabled={saving === 'qr'} onClick={() => save('qr')}>
              {saving === 'qr' ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-header">
            <div><h3>Notifications</h3><p>SMS, email and push config</p></div>
            {saved === 'notif' || saved === 'notifications' ? (
              <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">Saved</Badge>
            ) : null}
          </div>
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Order SMS alerts</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>Notify merchants on new orders</p>
              </div>
              <Switch checked={asBool(draft.notifications.orderSmsAlerts)} onCheckedChange={(v) => setField('notifications', 'orderSmsAlerts', v)} />
            </div>
            <Separator />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Payment confirmation email</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>Send receipt to customer</p>
              </div>
              <Switch checked={asBool(draft.notifications.paymentConfirmationEmail)} onCheckedChange={(v) => setField('notifications', 'paymentConfirmationEmail', v)} />
            </div>
            <Separator />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>System alert emails</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>Send incidents to admin email</p>
              </div>
              <Switch checked={asBool(draft.notifications.systemAlertEmails)} onCheckedChange={(v) => setField('notifications', 'systemAlertEmails', v)} />
            </div>
            <Separator />
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>SMS Gateway URL</Label>
              <Input value={asString(draft.notifications.smsGatewayUrl)} onChange={(e) => setField('notifications', 'smsGatewayUrl', e.target.value)} />
            </div>
            <Button size="sm" className="w-fit" disabled={saving === 'notifications'} onClick={() => save('notifications')}>
              {saving === 'notifications' ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Row 4: Feature Flags ── */}
      <div className="admin-card">
        <div className="admin-card-header">
          <div><h3>Feature Flags</h3><p>Toggle platform capabilities on/off globally</p></div>
          {saved === 'features' && <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">Saved</Badge>}
        </div>
        <div style={{ padding: '18px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {FEATURE_FLAGS.map((f) => (
            <div key={f.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>{f.label}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted-foreground)' }}>{f.desc}</p>
              </div>
              <Switch
                checked={asBool(draft.features[f.key])}
                disabled={saving === 'features'}
                onCheckedChange={(v) => toggleFeature(f.key, v)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Danger Zone ── */}
      <div className="admin-card" style={{ borderColor: 'oklch(from var(--destructive) l c h / 30%)' }}>
        <div className="admin-card-header">
          <div><h3 style={{ color: 'var(--destructive)' }}>Danger Zone</h3><p>Irreversible platform actions</p></div>
        </div>
        <div style={{ padding: '18px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {DANGER_ACTIONS.map((d) => (
            <div key={d.action} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>{d.title}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted-foreground)' }}>{d.desc}</p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                disabled={saving === d.action}
                onClick={() => handleAction(d.action)}
              >
                {saving === d.action ? 'Running…' : 'Run'}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
