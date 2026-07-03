import { useState } from 'react'
import { Button } from '../../../src/components/ui/button'
import { Input } from '../../../src/components/ui/input'
import { Label } from '../../../src/components/ui/label'
import { Separator } from '../../../src/components/ui/separator'
import { Switch } from '../../../src/components/ui/switch'
import { Badge } from '../../../src/components/ui/badge'

export default function ConfigsPage() {
  const [saved, setSaved] = useState<string | null>(null)

  function save(section: string) {
    setSaved(section)
    setTimeout(() => setSaved(null), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Row 1: Platform + Auth ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Platform */}
        <div className="admin-card">
          <div className="admin-card-header">
            <div><h3>Platform</h3><p>Core identity and URLs</p></div>
            {saved === 'platform' && <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">Saved</Badge>}
          </div>
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>Platform Name</Label>
              <Input defaultValue="Scanny" />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>Support Email</Label>
              <Input defaultValue="support@scanny.app" type="email" />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>QR Scan Base URL</Label>
              <Input defaultValue="https://scanny.app/b" />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>Merchant Portal URL</Label>
              <Input defaultValue="https://app.scanny.app" />
            </div>
            <Button size="sm" className="w-fit" onClick={() => save('platform')}>Save</Button>
          </div>
        </div>

        {/* Auth / Keycloak */}
        <div className="admin-card">
          <div className="admin-card-header">
            <div><h3>Authentication</h3><p>Keycloak SSO configuration</p></div>
            {saved === 'auth' && <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">Saved</Badge>}
          </div>
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>Keycloak Auth Server URL</Label>
              <Input defaultValue="http://localhost:8080" />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>Realm</Label>
              <Input defaultValue="master" />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>Merchant Client ID</Label>
              <Input defaultValue="scanny-client" />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>Admin Client ID</Label>
              <Input defaultValue="scanny-admin" />
            </div>
            <Button size="sm" className="w-fit" onClick={() => save('auth')}>Save</Button>
          </div>
        </div>
      </div>

      {/* ── Row 2: Payments + Orders ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Payments */}
        <div className="admin-card">
          <div className="admin-card-header">
            <div><h3>Payments</h3><p>Payment methods and limits</p></div>
            {saved === 'payments' && <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">Saved</Badge>}
          </div>
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>Default Currency</Label>
              <Input defaultValue="UGX" />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>Min Order Amount (UGX)</Label>
              <Input defaultValue="1000" type="number" />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>Max Order Amount (UGX)</Label>
              <Input defaultValue="5000000" type="number" />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>Payment Gateway URL</Label>
              <Input defaultValue="https://payments.scanny.app" />
            </div>
            <Button size="sm" className="w-fit" onClick={() => save('payments')}>Save</Button>
          </div>
        </div>

        {/* Orders */}
        <div className="admin-card">
          <div className="admin-card-header">
            <div><h3>Orders</h3><p>Order lifecycle settings</p></div>
            {saved === 'orders' && <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">Saved</Badge>}
          </div>
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>Order Timeout (minutes)</Label>
              <Input defaultValue="30" type="number" />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>Max Items Per Order</Label>
              <Input defaultValue="20" type="number" />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>Auto-complete After (hours)</Label>
              <Input defaultValue="2" type="number" />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>Order ID Prefix</Label>
              <Input defaultValue="ORD-" />
            </div>
            <Button size="sm" className="w-fit" onClick={() => save('orders')}>Save</Button>
          </div>
        </div>
      </div>

      {/* ── Row 3: QR + Notifications ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* QR */}
        <div className="admin-card">
          <div className="admin-card-header">
            <div><h3>QR Codes</h3><p>QR generation and scan settings</p></div>
            {saved === 'qr' && <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">Saved</Badge>}
          </div>
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>QR Token Prefix</Label>
              <Input defaultValue="SIT-" />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>QR Code Size (px)</Label>
              <Input defaultValue="220" type="number" />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>Scan Rate Limit (per min)</Label>
              <Input defaultValue="60" type="number" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Track scan location</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>Log GPS coordinates on scan</p>
              </div>
              <Switch defaultChecked={false} />
            </div>
            <Button size="sm" className="w-fit" onClick={() => save('qr')}>Save</Button>
          </div>
        </div>

        {/* Notifications */}
        <div className="admin-card">
          <div className="admin-card-header">
            <div><h3>Notifications</h3><p>SMS, email and push config</p></div>
            {saved === 'notif' && <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">Saved</Badge>}
          </div>
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Order SMS alerts</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>Notify merchants on new orders</p>
              </div>
              <Switch defaultChecked={true} />
            </div>
            <Separator />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Payment confirmation email</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>Send receipt to customer</p>
              </div>
              <Switch defaultChecked={true} />
            </div>
            <Separator />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>System alert emails</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>Send incidents to admin email</p>
              </div>
              <Switch defaultChecked={true} />
            </div>
            <Separator />
            <div style={{ display: 'grid', gap: 6 }}>
              <Label>SMS Gateway URL</Label>
              <Input defaultValue="https://sms.scanny.app" />
            </div>
            <Button size="sm" className="w-fit" onClick={() => save('notif')}>Save</Button>
          </div>
        </div>
      </div>

      {/* ── Row 4: Feature Flags full width ── */}
      <div className="admin-card">
        <div className="admin-card-header">
          <div><h3>Feature Flags</h3><p>Toggle platform capabilities on/off globally</p></div>
        </div>
        <div style={{ padding: '18px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            { label: 'Merchant self-registration',  desc: 'Allow merchants to sign up without approval', on: true  },
            { label: 'Customer accounts',           desc: 'Enable customer login and order history',     on: true  },
            { label: 'Mobile money payments',       desc: 'MTN / Airtel Money integration active',      on: true  },
            { label: 'Card payments',               desc: 'Visa / Mastercard via payment gateway',      on: true  },
            { label: 'QR scan analytics',           desc: 'Track scan events and device metadata',      on: true  },
            { label: 'Multi-business merchants',    desc: 'Allow one account to manage multiple shops', on: false },
            { label: 'Customer order history',      desc: 'Let customers view past orders',             on: true  },
            { label: 'Maintenance mode',            desc: 'Show maintenance page to all users',         on: false },
          ].map((f) => (
            <div key={f.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>{f.label}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted-foreground)' }}>{f.desc}</p>
              </div>
              <Switch defaultChecked={f.on} />
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
          {[
            { title: 'Purge test data',       desc: 'Remove all sample/seed orders and merchants' },
            { title: 'Clear QR scan logs',    desc: 'Delete all historical scan event records'    },
            { title: 'Revoke all sessions',   desc: 'Force sign-out all active user sessions'     },
            { title: 'Reset platform',        desc: 'Wipe all data and restore factory defaults'  },
          ].map((d) => (
            <div key={d.title} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>{d.title}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted-foreground)' }}>{d.desc}</p>
              </div>
              <Button variant="destructive" size="sm">Run</Button>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
