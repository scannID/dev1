import { useState, FormEvent } from 'react'
import { ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import keycloak from './keycloak'

/* ─── Design tokens ─────────────────────────────────────────────────── */
const C = {
  bg: 'var(--background)',
  card: 'var(--card)',
  text: 'var(--foreground)',
  muted: 'var(--muted-foreground)',
  border: 'var(--border)',
  primary: 'var(--primary)',
  primaryFg: 'var(--primary-foreground)',
  destructive: 'var(--destructive)',
}

type View = 'login' | 'register' | 'forgot'

interface AuthPageProps {
  onBack: () => void
  onSuccess: () => void
}

export default function AuthPage({ onBack, onSuccess }: AuthPageProps) {
  const [view, setView] = useState<View>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Login form state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Register form state
  const [regBusinessName, setRegBusinessName] = useState('')
  const [regBusinessType, setRegBusinessType] = useState<'Restaurant' | 'Bar' | 'School' | 'Boutique'>('Restaurant')
  const [regEmail, setRegEmail] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regPaymentDest, setRegPaymentDest] = useState('')
  const [regPaymentType, setRegPaymentType] = useState<'MOBILE_MONEY' | 'BANK_ACCOUNT'>('MOBILE_MONEY')

  // Forgot password form state
  const [forgotEmail, setForgotEmail] = useState('')

  const resetError = () => {
    setError('')
    setSuccess('')
  }

  // Handle login via Keycloak
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    resetError()

    if (!loginEmail.trim() || !loginPassword.trim()) {
      setError('Please enter both email and password')
      return
    }

    setLoading(true)
    try {
      // Use Keycloak's login - this will redirect to Keycloak and back
      await keycloak.login({ 
        redirectUri: window.location.origin,
        loginHint: loginEmail 
      })
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  // Handle merchant registration
  const handleRegister = async (e: FormEvent) => {
    e.preventDefault()
    resetError()

    // Validation
    if (!regBusinessName.trim() || !regEmail.trim() || !regPhone.trim() || !regPaymentDest.trim()) {
      setError('Please fill in all required fields')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) {
      setError('Please enter a valid email address')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('http://localhost:4000/api/auth/merchant/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: regBusinessName.trim(),
          businessType: regBusinessType,
          email: regEmail.trim().toLowerCase(),
          phone: regPhone.trim(),
          paymentDestination: regPaymentDest.trim(),
          paymentType: regPaymentType,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Registration failed')
      }

      setSuccess('Registration successful! Check your email to verify your account and set your password.')
      toast.success('Merchant account created successfully')
      // Clear form
      setRegBusinessName('')
      setRegEmail('')
      setRegPhone('')
      setRegPaymentDest('')
      // Switch to login view after 3 seconds
      setTimeout(() => {
        setView('login')
        setSuccess('')
      }, 3000)
    } catch (err: any) {
      const message = err.message || 'Registration failed. Please try again.'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  // Handle forgot password
  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault()
    resetError()

    if (!forgotEmail.trim()) {
      setError('Please enter your email address')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail)) {
      setError('Please enter a valid email address')
      return
    }

    setLoading(true)
    try {
      // TODO: Implement password reset via Keycloak API
      // For now, show a message
      setSuccess('Password reset instructions have been sent to your email.')
      setTimeout(() => {
        setView('login')
        setSuccess('')
      }, 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: C.bg,
      padding: '24px',
      position: 'relative',
    }}>
      <Toaster />
      {/* Background pattern */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `linear-gradient(${C.border} 1px, transparent 1px), linear-gradient(90deg, ${C.border} 1px, transparent 1px)`,
        backgroundSize: '48px 48px',
        opacity: 0.3,
        pointerEvents: 'none',
      }} />

      {/* Back button */}
      <button
        onClick={onBack}
        style={{
          position: 'absolute',
          top: 24,
          left: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          color: C.text,
          fontSize: 14,
          fontWeight: 500,
          cursor: 'pointer',
          zIndex: 10,
        }}
      >
        <ArrowLeft size={16} />
        Back
      </button>

      {/* Auth card */}
      <div style={{
        width: '100%',
        maxWidth: view === 'register' ? 600 : 420,
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        padding: '40px 32px',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.12)',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40,
              height: 40,
              background: C.primary,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="22" height="22" viewBox="0 0 18 18" fill="none">
                <rect x="1" y="1" width="6" height="6" rx="1" fill="white" />
                <rect x="11" y="1" width="6" height="6" rx="1" fill="white" />
                <rect x="1" y="11" width="6" height="6" rx="1" fill="white" />
                <rect x="11" y="11" width="3" height="3" rx="0.5" fill="white" />
                <rect x="15" y="11" width="2" height="2" rx="0.5" fill="white" />
                <rect x="11" y="15" width="2" height="2" rx="0.5" fill="white" />
                <rect x="14" y="14" width="3" height="3" rx="0.5" fill="white" />
              </svg>
            </div>
            <span style={{ color: C.text, fontWeight: 700, fontSize: 22, letterSpacing: '-0.01em' }}>Kode</span>
          </div>
        </div>

        {/* Title */}
        <h1 style={{
          margin: '0 0 8px',
          color: C.text,
          fontSize: 28,
          fontWeight: 700,
          textAlign: 'center',
          letterSpacing: '-0.02em',
        }}>
          {view === 'login' && 'Welcome back'}
          {view === 'register' && 'Create your account'}
          {view === 'forgot' && 'Reset password'}
        </h1>
        <p style={{
          margin: '0 0 32px',
          color: C.muted,
          fontSize: 14,
          textAlign: 'center',
        }}>
          {view === 'login' && 'Sign in to manage your QR ordering'}
          {view === 'register' && 'Set up your business in minutes'}
          {view === 'forgot' && 'Enter your email to receive reset instructions'}
        </p>

        {/* Error/Success messages */}
        {error && (
          <div style={{
            padding: '12px 16px',
            marginBottom: 20,
            background: `${C.destructive}15`,
            border: `1px solid ${C.destructive}40`,
            borderRadius: 8,
            color: C.destructive,
            fontSize: 13,
            fontWeight: 500,
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            padding: '12px 16px',
            marginBottom: 20,
            background: `${C.primary}15`,
            border: `1px solid ${C.primary}40`,
            borderRadius: 8,
            color: C.primary,
            fontSize: 13,
            fontWeight: 500,
          }}>
            {success}
          </div>
        )}

        {/* Login Form */}
        {view === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'grid', gap: 20 }}>
            <label style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>Email</span>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={loading}
                style={{
                  padding: '12px 14px',
                  fontSize: 14,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  background: C.bg,
                  color: C.text,
                }}
              />
            </label>

            <label style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>Password</span>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '12px 44px 12px 14px',
                    fontSize: 14,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    background: C.bg,
                    color: C.text,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    padding: 4,
                    cursor: 'pointer',
                    color: C.muted,
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            <button
              type="button"
              onClick={() => setView('forgot')}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: C.primary,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'right',
                marginTop: -12,
              }}
            >
              Forgot password?
            </button>

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '14px',
                fontSize: 15,
                fontWeight: 600,
                color: C.primaryFg,
                background: C.primary,
                border: 'none',
                borderRadius: 8,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>

            <div style={{
              textAlign: 'center',
              fontSize: 14,
              color: C.muted,
              marginTop: 8,
            }}>
              New here?{' '}
              <button
                type="button"
                onClick={() => setView('register')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: C.primary,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Create an account
              </button>
            </div>
          </form>
        )}

        {/* Register Form */}
        {view === 'register' && (
          <form onSubmit={handleRegister} style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <label style={{ display: 'grid', gap: 8 }}>
                <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>Business name *</span>
                <input
                  type="text"
                  value={regBusinessName}
                  onChange={(e) => setRegBusinessName(e.target.value)}
                  placeholder="Brew House Café"
                  disabled={loading}
                  style={{
                    padding: '12px 14px',
                    fontSize: 14,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    background: C.bg,
                    color: C.text,
                  }}
                />
              </label>

              <label style={{ display: 'grid', gap: 8 }}>
                <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>Business type *</span>
                <select
                  value={regBusinessType}
                  onChange={(e) => setRegBusinessType(e.target.value as any)}
                  disabled={loading}
                  style={{
                    padding: '12px 14px',
                    fontSize: 14,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    background: C.bg,
                    color: C.text,
                  }}
                >
                  <option value="Restaurant">Restaurant</option>
                  <option value="Bar">Bar</option>
                  <option value="School">School</option>
                  <option value="Boutique">Boutique</option>
                </select>
              </label>
            </div>

            <label style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>Email *</span>
              <input
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={loading}
                style={{
                  padding: '12px 14px',
                  fontSize: 14,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  background: C.bg,
                  color: C.text,
                }}
              />
            </label>

            <label style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>Phone number *</span>
              <input
                type="tel"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                placeholder="+256 700 000 000"
                disabled={loading}
                style={{
                  padding: '12px 14px',
                  fontSize: 14,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  background: C.bg,
                  color: C.text,
                }}
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <label style={{ display: 'grid', gap: 8 }}>
                <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>Payment type *</span>
                <select
                  value={regPaymentType}
                  onChange={(e) => setRegPaymentType(e.target.value as any)}
                  disabled={loading}
                  style={{
                    padding: '12px 14px',
                    fontSize: 14,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    background: C.bg,
                    color: C.text,
                  }}
                >
                  <option value="MOBILE_MONEY">Mobile Money</option>
                  <option value="BANK_ACCOUNT">Bank Account</option>
                </select>
              </label>

              <label style={{ display: 'grid', gap: 8 }}>
                <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>
                  {regPaymentType === 'MOBILE_MONEY' ? 'Mobile number' : 'Account number'} *
                </span>
                <input
                  type="text"
                  value={regPaymentDest}
                  onChange={(e) => setRegPaymentDest(e.target.value)}
                  placeholder={regPaymentType === 'MOBILE_MONEY' ? '+256 700 000 000' : '123456789'}
                  disabled={loading}
                  style={{
                    padding: '12px 14px',
                    fontSize: 14,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    background: C.bg,
                    color: C.text,
                  }}
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '14px',
                fontSize: 15,
                fontWeight: 600,
                color: C.primaryFg,
                background: C.primary,
                border: 'none',
                borderRadius: 8,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginTop: 4,
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  Creating account...
                </>
              ) : (
                'Create account'
              )}
            </button>

            <div style={{
              textAlign: 'center',
              fontSize: 14,
              color: C.muted,
              marginTop: 4,
            }}>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setView('login')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: C.primary,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Sign in
              </button>
            </div>
          </form>
        )}

        {/* Forgot Password Form */}
        {view === 'forgot' && (
          <form onSubmit={handleForgotPassword} style={{ display: 'grid', gap: 20 }}>
            <label style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>Email</span>
              <input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={loading}
                style={{
                  padding: '12px 14px',
                  fontSize: 14,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  background: C.bg,
                  color: C.text,
                }}
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '14px',
                fontSize: 15,
                fontWeight: 600,
                color: C.primaryFg,
                background: C.primary,
                border: 'none',
                borderRadius: 8,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  Sending...
                </>
              ) : (
                'Send reset link'
              )}
            </button>

            <div style={{
              textAlign: 'center',
              fontSize: 14,
              color: C.muted,
              marginTop: 8,
            }}>
              Remember your password?{' '}
              <button
                type="button"
                onClick={() => setView('login')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: C.primary,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Sign in
              </button>
            </div>
          </form>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
