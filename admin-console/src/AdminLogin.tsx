import { Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import MeshGradientBackground from '@/components/MeshGradientBackground'
import CursorField from '@/components/CursorField'

export default function AdminLogin({
  onLogin,
  error,
  busy,
}: {
  onLogin: () => void
  error?: string | null
  busy?: boolean
}) {
  return (
    <div className="admin-login">
      <MeshGradientBackground />
      <CursorField />
      <div className="admin-login-card">
        <div className="admin-login-brand">
          <img src="/kode-icon.svg" alt="" className="admin-login-logo" />
          <div>
            <p className="admin-login-name">Kode</p>
            <p className="admin-login-tag">Admin Console</p>
          </div>
        </div>

        <div className="admin-login-body">
          <h1 className="admin-login-title">Sign in</h1>
          <p className="admin-login-sub">
            Use your administrator account to access the platform console.
          </p>

          {error ? <p className="admin-login-error">{error}</p> : null}

          <Button
            className="admin-login-btn w-full"
            size="lg"
            onClick={onLogin}
            disabled={busy}
          >
            <Shield size={16} />
            {busy ? 'Redirecting…' : 'Sign in'}
          </Button>
        </div>

        <p className="admin-login-foot">
          Authorised access only · © {new Date().getFullYear()} Kode
        </p>
      </div>
    </div>
  )
}
