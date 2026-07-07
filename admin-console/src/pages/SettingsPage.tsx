import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'

export default function SettingsPage() {
  return (
    <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Platform settings */}
      <div className="admin-card">
        <div className="admin-card-header"><div><h3>Platform Settings</h3><p>Global configuration for Scanny</p></div></div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
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
          <Button className="w-fit">Save changes</Button>
        </div>
      </div>

      {/* Feature flags */}
      <div className="admin-card">
        <div className="admin-card-header"><div><h3>Feature Flags</h3><p>Toggle platform features</p></div></div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: 'Merchant self-registration',   desc: 'Allow merchants to sign up without admin approval', on: true  },
            { label: 'Customer accounts',            desc: 'Enable customer login and order history',           on: true  },
            { label: 'Mobile money payments',        desc: 'MTN / Airtel Money integration',                   on: true  },
            { label: 'Card payments',                desc: 'Visa / Mastercard via payment gateway',             on: true  },
            { label: 'Maintenance mode',             desc: 'Show maintenance page to all users',               on: false },
            { label: 'Analytics tracking',           desc: 'Collect anonymous usage data',                     on: true  },
          ].map((f) => (
            <div key={f.label}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>{f.label}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>{f.desc}</p>
                </div>
                <Switch defaultChecked={f.on} />
              </div>
              <Separator className="mt-3" />
            </div>
          ))}
        </div>
      </div>

      {/* Danger zone */}
      <div className="admin-card" style={{ borderColor: 'oklch(from var(--destructive) l c h / 30%)' }}>
        <div className="admin-card-header"><div><h3 style={{ color: 'var(--destructive)' }}>Danger Zone</h3><p>Irreversible actions</p></div></div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Purge test data</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>Remove all sample/seed orders and merchants</p>
            </div>
            <Button variant="destructive" size="sm">Purge</Button>
          </div>
          <Separator />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Reset platform</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>Wipe all data and restore defaults</p>
            </div>
            <Button variant="destructive" size="sm">Reset</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
