import { type FormEvent, useState } from 'react'
import { rentAuthApi, rentDashboardApi } from './api'
import { loginAsRentManager } from '../keycloak'

type Step = 'register' | 'property' | 'done'

interface Props {
  /** Called after the first property is created. Navigates to the dashboard. */
  onDone: () => void
  onCancel: () => void
}

export default function RentCreate({ onDone, onCancel }: Props) {
  const [step, setStep] = useState<Step>('register')

  // Step 1 — registration
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [registering, setRegistering] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [registered, setRegistered] = useState(false)

  // Step 2 — first property
  const [propName, setPropName] = useState('')
  const [propAddress, setPropAddress] = useState('')
  const [propCity, setPropCity] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [ownerMomo, setOwnerMomo] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [creatingProp, setCreatingProp] = useState(false)
  const [propError, setPropError] = useState<string | null>(null)

  async function handleRegister(e: FormEvent) {
    e.preventDefault()
    setRegisterError(null)
    if (!name.trim() || !email.trim()) { setRegisterError('Name and email are required'); return }
    setRegistering(true)
    try {
      await rentAuthApi.register({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
      })
      setOwnerName(name.trim())
      setRegistered(true)
      setStep('property')
    } catch (err) {
      setRegisterError(err instanceof Error ? err.message : 'Could not create account')
    } finally {
      setRegistering(false)
    }
  }

  async function handleCreateProperty(e: FormEvent) {
    e.preventDefault()
    setPropError(null)
    if (!propName.trim()) { setPropError('Property name is required'); return }
    if (!ownerMomo.trim()) { setPropError('Owner MoMo number is required'); return }
    setCreatingProp(true)
    try {
      await rentDashboardApi.createProperty({
        name: propName.trim(),
        address: propAddress.trim() || undefined,
        city: propCity.trim() || undefined,
        ownerName: ownerName.trim() || name.trim(),
        ownerMomo: ownerMomo.trim(),
        ownerEmail: ownerEmail.trim() || undefined,
      })
      setStep('done')
    } catch (err) {
      setPropError(err instanceof Error ? err.message : 'Could not create property')
    } finally {
      setCreatingProp(false)
    }
  }

  const inputStyle = { display: 'grid' as const, gap: 4, fontSize: 13 }
  const labelStyle = { fontSize: 13, fontWeight: 600 as const, color: '#374151' }
  const optStyle = { fontSize: 11, color: '#9ca3af', fontWeight: 400 as const }

  return (
    <div className="scanny-page">
      <div className="scanny-page-narrow">
        <button type="button" onClick={onCancel} className="scanny-back">← Back</button>

        {/* Step indicators */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, marginBottom: 20 }}>
          {(['register', 'property', 'done'] as Step[]).map((s, i) => {
            const idx = (['register', 'property', 'done'] as Step[]).indexOf(step)
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                  background: step === s ? 'var(--primary)' : (idx > i ? '#d1fae5' : '#f3f4f6'),
                  color: step === s ? '#fff' : (idx > i ? '#065f46' : '#9ca3af'),
                }}>
                  {idx > i ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 12, color: step === s ? '#111827' : '#9ca3af', fontWeight: step === s ? 600 : 400 }}>
                  {s === 'register' ? 'Account' : s === 'property' ? 'First property' : 'Done'}
                </span>
                {i < 2 && <span style={{ color: '#e5e7eb' }}>›</span>}
              </div>
            )
          })}
        </div>

        {/* ── Step 1: Register ─────────────────────────────────────────────── */}
        {step === 'register' && (
          <div className="scanny-card">
            <p className="scanny-eyebrow">Rent Manager Setup</p>
            <h1 className="scanny-title">Create your account</h1>
            <p className="scanny-sub" style={{ marginTop: 6 }}>
              We'll create your account and send you a verification email.
              Come back here after verifying to finish setup.
            </p>

            <form onSubmit={handleRegister} style={{ display: 'grid', gap: 14, marginTop: 22 }} noValidate>
              <label style={inputStyle}>
                <span style={labelStyle}>Full name <span style={{ color: '#ef4444' }}>*</span></span>
                <input className="scanny-input" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. James Mukasa" required disabled={registering} />
              </label>

              <label style={inputStyle}>
                <span style={labelStyle}>Email address <span style={{ color: '#ef4444' }}>*</span></span>
                <input className="scanny-input" type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com" required disabled={registering} />
              </label>

              <label style={inputStyle}>
                <span style={labelStyle}>Phone <span style={optStyle}>(optional)</span></span>
                <input className="scanny-input" type="tel" value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07XX XXX XXX" disabled={registering} />
              </label>

              {registerError && <p className="scanny-error" role="alert">{registerError}</p>}

              <button type="submit" disabled={registering} className="scanny-btn scanny-btn-primary">
                {registering ? 'Creating account…' : 'Continue →'}
              </button>
            </form>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f3f4f6', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => loginAsRentManager(window.location.origin + '/rent/dashboard')}
                  style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                >
                  Sign in
                </button>
              </p>
            </div>
          </div>
        )}

        {/* ── Step 2: First property ──────────────────────────────────────── */}
        {step === 'property' && (
          <div className="scanny-card">
            <p className="scanny-eyebrow">Step 2 of 2</p>
            <h1 className="scanny-title">Add your first property</h1>
            <p className="scanny-sub" style={{ marginTop: 6 }}>
              {registered
                ? 'We sent you a verification email. You can add your property now — then sign in after verifying.'
                : 'You can add more properties from your dashboard later.'}
            </p>

            <form onSubmit={handleCreateProperty} style={{ display: 'grid', gap: 14, marginTop: 22 }} noValidate>
              <label style={inputStyle}>
                <span style={labelStyle}>Property name <span style={{ color: '#ef4444' }}>*</span></span>
                <input className="scanny-input" value={propName} onChange={(e) => setPropName(e.target.value)}
                  placeholder="e.g. Nakawa Heights" required disabled={creatingProp} />
              </label>

              <label style={inputStyle}>
                <span style={labelStyle}>Address <span style={optStyle}>(optional)</span></span>
                <input className="scanny-input" value={propAddress} onChange={(e) => setPropAddress(e.target.value)}
                  placeholder="Street / area" disabled={creatingProp} />
              </label>

              <label style={inputStyle}>
                <span style={labelStyle}>City <span style={optStyle}>(optional)</span></span>
                <input className="scanny-input" value={propCity} onChange={(e) => setPropCity(e.target.value)}
                  placeholder="e.g. Kampala" disabled={creatingProp} />
              </label>

              <hr style={{ border: 'none', borderTop: '1px solid #f3f4f6', margin: '4px 0' }} />
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280', fontWeight: 600 }}>
                Owner details — where rent money goes
              </p>

              <label style={inputStyle}>
                <span style={labelStyle}>Owner name <span style={{ color: '#ef4444' }}>*</span></span>
                <input className="scanny-input" value={ownerName} onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="e.g. Grace Namukasa" required disabled={creatingProp} />
              </label>

              <label style={inputStyle}>
                <span style={labelStyle}>Owner MoMo number <span style={{ color: '#ef4444' }}>*</span></span>
                <input className="scanny-input" type="tel" value={ownerMomo}
                  onChange={(e) => setOwnerMomo(e.target.value)}
                  placeholder="07XX XXX XXX — rent payments go here" required disabled={creatingProp} />
              </label>

              <label style={inputStyle}>
                <span style={labelStyle}>
                  Owner email <span style={optStyle}>(optional — gives them dashboard access)</span>
                </span>
                <input className="scanny-input" type="email" value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="owner@email.com" disabled={creatingProp} />
              </label>

              {propError && <p className="scanny-error" role="alert">{propError}</p>}

              <button type="submit" disabled={creatingProp} className="scanny-btn scanny-btn-primary">
                {creatingProp ? 'Creating property…' : 'Create property →'}
              </button>
            </form>
          </div>
        )}

        {/* ── Step 3: Done ─────────────────────────────────────────────────── */}
        {step === 'done' && (
          <div className="scanny-card">
            <p className="scanny-eyebrow">You're all set 🎉</p>
            <h1 className="scanny-title">Property created</h1>
            <p className="scanny-sub" style={{ marginTop: 6 }}>
              Check your email for a verification link and password setup.
              Once you've set your password, sign in to open your dashboard.
            </p>

            <div className="scanny-panel" style={{ marginTop: 20, background: '#f0fdf4', borderColor: '#bbf7d0' }}>
              <p style={{ margin: 0, fontSize: 13, color: '#166534', lineHeight: 1.6 }}>
                ✓ Account created for <strong>{email}</strong><br />
                ✓ Verification email sent — check your inbox<br />
                ✓ First property added and ready
              </p>
            </div>

            <button
              type="button"
              onClick={() => loginAsRentManager(window.location.origin + '/rent/dashboard')}
              className="scanny-btn scanny-btn-primary"
              style={{ marginTop: 20 }}
            >
              Sign in to my dashboard →
            </button>

            <p style={{ marginTop: 12, textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>
              You may need to verify your email first before you can sign in.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
