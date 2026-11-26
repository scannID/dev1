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
  
  // Initial unit fields
  const [unitNumber, setUnitNumber] = useState('')
  const [unitFloor, setUnitFloor] = useState('')
  const [monthlyRent, setMonthlyRent] = useState('')
  const [bedrooms, setBedrooms] = useState('')
  const [bathrooms, setBathrooms] = useState('')
  const [amenities, setAmenities] = useState('')
  const [securityDepositRequired, setSecurityDepositRequired] = useState(false)
  
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) { setError('Property name is required.'); return }
    if (!ownerName.trim()) { setError('Owner name is required.'); return }
    if (!ownerMomo.trim()) { setError('Owner MoMo number is required.'); return }
    if (!unitNumber.trim()) { setError('Unit number is required (at least one unit).'); return }
    if (!monthlyRent.trim() || isNaN(Number(monthlyRent))) { 
      setError('Monthly rent is required and must be a number.'); 
      return 
    }
    if (!bedrooms.trim() || isNaN(Number(bedrooms))) {
      setError('Number of bedrooms is required.')
      return
    }
    if (!bathrooms.trim() || isNaN(Number(bathrooms))) {
      setError('Number of bathrooms is required.')
      return
    }

    setSaving(true)
    let createdPropertyId: string | null = null
    
    try {
      // Create property
      console.log('Creating property...', {
        name: name.trim(),
        ownerName: ownerName.trim(),
        ownerMomo: ownerMomo.trim(),
      })
      const property = await rentDashboardApi.createProperty({
        name: name.trim(),
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        ownerName: ownerName.trim(),
        ownerMomo: ownerMomo.trim(),
        ownerEmail: ownerEmail.trim() || undefined,
      })
      console.log('Property created:', property)
      createdPropertyId = property.id
      
      // Create initial unit
      const finalAmenities = securityDepositRequired 
        ? (amenities.trim() ? amenities.trim() + ',[SECURITY_DEPOSIT_REQUIRED]' : '[SECURITY_DEPOSIT_REQUIRED]')
        : amenities.trim() || undefined
      
      console.log('Creating initial unit...', {
        propertyId: property.id,
        unitNumber: unitNumber.trim(),
        floor: unitFloor.trim() || undefined,
        monthlyAmount: Number(monthlyRent),
        bedrooms: Number(bedrooms),
        bathrooms: Number(bathrooms),
        amenities: finalAmenities,
      })
      const unit = await rentDashboardApi.addUnit(property.id, {
        unitNumber: unitNumber.trim(),
        floor: unitFloor.trim() || undefined,
        monthlyAmount: Number(monthlyRent),
        bedrooms: Number(bedrooms),
        bathrooms: Number(bathrooms),
        amenities: finalAmenities,
      })
      console.log('Unit created successfully:', unit)
      
      // Success - close modal and refresh
      onCreated(property)
    } catch (err) {
      console.error('Error creating property/unit:', err)
      
      // If property was created but unit failed, show specific error
      if (createdPropertyId) {
        setError(`Property created but unit creation failed: ${err instanceof Error ? err.message : 'Unknown error'}. Please add a unit manually.`)
        // Still call onCreated to refresh the list so user can see the property
        setTimeout(() => {
          onCreated({ id: createdPropertyId } as any)
        }, 2000)
      } else {
        setError(err instanceof Error ? err.message : 'Could not create property')
      }
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

          <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 14, marginTop: 4 }}>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6b7280', fontWeight: 600 }}>
              Initial unit — at least one unit required
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
            <label style={{ display: 'grid' }}>
              <span style={labelStyle}>Unit number <span style={{ color: '#ef4444' }}>*</span></span>
              <input className="scanny-input" value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)}
                placeholder="e.g. A1 or 101" required disabled={saving} style={inputStyle} />
            </label>

            <label style={{ display: 'grid' }}>
              <span style={labelStyle}>Floor</span>
              <input className="scanny-input" value={unitFloor} onChange={(e) => setUnitFloor(e.target.value)}
                placeholder="e.g. 1st" disabled={saving} style={inputStyle} />
            </label>
          </div>

          <label style={{ display: 'grid' }}>
            <span style={labelStyle}>Monthly rent <span style={{ color: '#ef4444' }}>*</span></span>
            <input className="scanny-input" type="number" value={monthlyRent}
              onChange={(e) => setMonthlyRent(e.target.value)}
              placeholder="e.g. 500000" required disabled={saving} style={inputStyle} />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={{ display: 'grid' }}>
              <span style={labelStyle}>Bedrooms <span style={{ color: '#ef4444' }}>*</span></span>
              <input className="scanny-input" type="number" min="0" value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
                placeholder="e.g. 2" required disabled={saving} style={inputStyle} />
            </label>

            <label style={{ display: 'grid' }}>
              <span style={labelStyle}>Bathrooms <span style={{ color: '#ef4444' }}>*</span></span>
              <input className="scanny-input" type="number" min="0" value={bathrooms}
                onChange={(e) => setBathrooms(e.target.value)}
                placeholder="e.g. 1" required disabled={saving} style={inputStyle} />
            </label>
          </div>

          <label style={{ display: 'grid' }}>
            <span style={labelStyle}>Amenities</span>
            <textarea 
              className="scanny-input" 
              value={amenities}
              onChange={(e) => setAmenities(e.target.value)}
              placeholder="WiFi, AC, Parking, Furnished, Balcony..." 
              disabled={saving} 
              style={{...inputStyle, minHeight: 70, resize: 'vertical', fontFamily: 'inherit'}} 
            />
          </label>

          <label 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 10, 
              padding: '12px 14px', 
              border: '1.5px solid #e5e7eb', 
              borderRadius: 8, 
              cursor: 'pointer', 
              background: securityDepositRequired ? 'rgba(234, 88, 12, 0.05)' : 'transparent' 
            }}
          >
            <input 
              type="checkbox" 
              checked={securityDepositRequired}
              onChange={(e) => setSecurityDepositRequired(e.target.checked)}
              disabled={saving}
              style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#2563eb' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Security Deposit Required <span style={{ color: '#ef4444' }}>*</span></div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                When checked, "Security deposit required" will be shown on the vacant units page
              </div>
            </div>
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
