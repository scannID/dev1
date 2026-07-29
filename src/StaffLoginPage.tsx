import { FormEvent, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { setStaffSession } from './api/client'
import { operationsApi } from './api/operations'

export default function StaffLoginPage({
  initialBusinessId = '',
  onBack,
  onSuccess,
}: {
  initialBusinessId?: string
  onBack: () => void
  onSuccess: () => void
}) {
  const [businessId, setBusinessId] = useState(initialBusinessId)
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!businessId.trim() || !email.trim() || !pin.trim()) {
      setError('Branch ID, email, and PIN are required')
      return
    }
    setLoading(true)
    try {
      const session = await operationsApi.staffLogin(businessId.trim(), {
        email: email.trim().toLowerCase(),
        pin: pin.trim(),
      })
      if (session.staff.role !== 'MANAGER') {
        setError('Only branch managers can open the merchant portal. Use the kitchen/floor screens for other roles.')
        return
      }
      setStaffSession({
        token: session.sessionToken,
        businessId: session.businessId,
        email: session.staff.email,
        displayName: session.staff.displayName,
        role: session.staff.role,
        expiresAt: session.expiresAt,
      })
      toast.success(`Welcome, ${session.staff.displayName}`)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Staff login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: 'var(--background)',
        color: 'var(--foreground)',
        fontFamily: 'Outfit, ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <Toaster />
      <form
        onSubmit={(e) => void handleSubmit(e)}
        style={{
          width: 'min(420px, 100%)',
          display: 'grid',
          gap: 14,
          padding: 24,
          border: '1px solid var(--border)',
          borderRadius: 12,
          background: 'var(--card)',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            justifySelf: 'start',
            background: 'none',
            border: 'none',
            color: 'var(--muted-foreground)',
            cursor: 'pointer',
            padding: 0,
            fontSize: 13,
          }}
        >
          ← Back
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Branch manager login</h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--muted-foreground)' }}>
            Sign in with the email and PIN your owner created under Roles for this branch.
          </p>
        </div>

        {error ? (
          <div role="alert" style={{ color: 'var(--destructive)', fontSize: 13 }}>
            {error}
          </div>
        ) : null}

        <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
          Branch ID
          <input
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
            placeholder="kololo-xxxx"
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--background)',
              color: 'var(--foreground)',
            }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--background)',
              color: 'var(--foreground)',
            }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
          PIN
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--background)',
              color: 'var(--foreground)',
            }}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: 14,
            borderRadius: 8,
            border: 'none',
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          {loading ? 'Signing in…' : 'Sign in as manager'}
        </button>
      </form>
    </main>
  )
}
