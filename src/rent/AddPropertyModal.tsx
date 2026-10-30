import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { rentDashboardApi } from './api'
import type { RentProperty } from './types'

interface Props {
  /** Called with the newly created property on success. */
  onCreated: (property: RentProperty) => void
  /** Closes the modal without creating anything. */
  onClose: () => void
}

/**
 * Simple "Add property" modal — no stepper, no registration.
 * The user is already authenticated via Keycloak; this just creates
 * a property record linked to their account.
 */
export default function AddPropertyModal({ onCreated, onClose }: Props) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [ownerMomo, setOwnerMomo] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) { setError('Property name is required.'); return }
    if (!ownerName.trim()) { setError('Owner name is required.'); return }
    if (!ownerMomo.trim()) { setError('Owner MoMo number is required.'); return }

    setSaving(true)
    try {
      const property = await rentDashboardApi.createProperty({
        name: name.trim(),
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        ownerName: ownerName.trim(),
        ownerMomo: ownerMomo.trim(),
        ownerEmail: ownerEmail.trim() || undefined,
      })
      onCreated(property)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create property')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: '10px 12px', fontSize: 14,
    border: '1.5px solid #e5e7eb', borderRadius: 8,
    background: '#fff', color: '#111827',
    width: '100%', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4,
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto',
          background: '#fff', borderRadius: 16, padding: '28px 28px 24px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Property Management
            </p>
            <h2 style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 800 }}>Add property</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#9ca3af' }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }} noValidate>
          <label style={{ display: 'grid' }}>
            <span style={labelStyle}>Property name <span style={{ color: '#ef4444' }}>*</span></span>
            <input className="scanny-input" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Nakawa Heights" required disabled={saving} style={inputStyle} />
          </label>

          <label style={{ display: 'grid' }}>
            <span style={labelStyle}>Address <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>(optional)</span></span>
            <input className="scanny-input" value={address} onChange={(e) => setAddress(e.target.value)}
              placeholder="Street / area" disabled={saving} style={inputStyle} />
          </label>

          <label style={{ display: 'grid' }}>
            <span style={labelStyle}>City <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>(optional)</span></span>
            <input className="scanny-input" value={city} onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Kampala" disabled={saving} style={inputStyle} />
          </label>

          <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 14, marginTop: 4 }}>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6b7280', fontWeight: 600 }}>
              Owner details — where rent money goes
            </p>
          </div>

          <label style={{ display: 'grid' }}>
            <span style={labelStyle}>Owner name <span style={{ color: '#ef4444' }}>*</span></span>
            <input className="scanny-input" value={ownerName} onChange={(e) => setOwnerName(e.target.value)}
              placeholder="e.g. Grace Namukasa" required disabled={saving} style={inputStyle} />
          </label>

          <label style={{ display: 'grid' }}>
            <span style={labelStyle}>Owner MoMo number <span style={{ color: '#ef4444' }}>*</span></span>
            <input className="scanny-input" type="tel" value={ownerMomo}
              onChange={(e) => setOwnerMomo(e.target.value)}
              placeholder="07XX XXX XXX — rent payments go here" required disabled={saving} style={inputStyle} />
          </label>

          <label style={{ display: 'grid' }}>
            <span style={labelStyle}>
              Owner email <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
            </span>
            <input className="scanny-input" type="email" value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="owner@email.com" disabled={saving} style={inputStyle} />
          </label>

          {error && <p className="scanny-error" role="alert" style={{ fontSize: 13 }}>{error}</p>}

          <button type="submit" disabled={saving} className="scanny-btn scanny-btn-primary"
            style={{ marginTop: 4 }}>
            {saving ? 'Creating property…' : 'Create property'}
          </button>
        </form>
      </div>
    </div>
  )
}
