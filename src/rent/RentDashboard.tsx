import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { rentDashboardApi } from './api'
import type {
  PortfolioEntry,
  PropertyDashboard,
  RentProperty,
  RentUnit,
  TenantSummary,
  UnitDashboardRow,
} from './types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function money(n: number, currency = 'UGX') {
  return `${n.toLocaleString()} ${currency}`
}

function periodDisplay(label: string) {
  try {
    const [y, m] = label.split('-')
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString([], {
      month: 'long', year: 'numeric',
    })
  } catch { return label }
}

function currentPeriod() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  PAID:    { bg: '#dcfce7', color: '#166534' },
  UNPAID:  { bg: '#fee2e2', color: '#991b1b' },
  PARTIAL: { bg: '#fef3c7', color: '#92400e' },
  OVERDUE: { bg: '#fce7f3', color: '#9d174d' },
  WAIVED:  { bg: '#f3f4f6', color: '#6b7280' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { bg: '#f3f4f6', color: '#6b7280' }
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 20,
      fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.color,
    }}>
      {status}
    </span>
  )
}

// ── QR code panel ─────────────────────────────────────────────────────────────
// Generates a QR image from a URL and provides print + download actions.

function QRCodePanel({
  url,
  label,
  sublabel,
}: {
  url: string
  label: string
  sublabel?: string
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (!expanded || !url) return
    let cancelled = false
    QRCode.toDataURL(url, {
      width: 280,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#111827', light: '#ffffff' },
    }).then((d) => {
      if (!cancelled) setDataUrl(d)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [url, expanded])

  function handlePrint() {
    if (!dataUrl) return
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`
      <html><head><title>QR — ${label}</title>
      <style>
        body { display:flex; flex-direction:column; align-items:center;
               justify-content:center; min-height:100vh; font-family:sans-serif; gap:12px; }
        img  { width:260px; height:260px; }
        p    { margin:0; font-size:14px; color:#111; }
        small{ font-size:12px; color:#6b7280; word-break:break-all; max-width:280px; text-align:center; }
      </style></head>
      <body>
        <p><strong>${label}</strong></p>
        ${sublabel ? `<p style="font-size:13px;color:#6b7280">${sublabel}</p>` : ''}
        <img src="${dataUrl}" alt="QR code" />
        <small>${url}</small>
        <script>window.onload=()=>{window.print();window.close()}<\/script>
      </body></html>
    `)
    w.document.close()
  }

  return (
    <div style={{ marginTop: 20 }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', borderRadius: 10, width: '100%',
          background: '#f0f9ff', border: '1px solid #bae6fd',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 18 }}>📱</span>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0369a1' }}>
            {expanded ? 'Hide QR code' : 'Show QR code'}
          </p>
          <p style={{ margin: '1px 0 0', fontSize: 11, color: '#0284c7' }}>{label}</p>
        </div>
        <span style={{ fontSize: 14, color: '#0369a1' }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div style={{
          padding: '16px', background: '#f0f9ff',
          border: '1px solid #bae6fd', borderTop: 'none',
          borderRadius: '0 0 10px 10px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        }}>
          {dataUrl ? (
            <>
              <img
                ref={imgRef}
                src={dataUrl}
                alt={`QR code for ${label}`}
                width={220}
                height={220}
                style={{ borderRadius: 8, border: '4px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
              />
              <p style={{ margin: 0, fontSize: 11, color: '#6b7280', textAlign: 'center', wordBreak: 'break-all', maxWidth: 240 }}>
                {url}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={handlePrint}
                  style={{
                    fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 6,
                    background: '#0369a1', color: '#fff', border: 'none', cursor: 'pointer',
                  }}
                >
                  🖨 Print QR
                </button>
                <a
                  href={dataUrl}
                  download={`${label.replace(/\s+/g, '-')}-QR.png`}
                  style={{
                    fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 6,
                    background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb',
                    textDecoration: 'none',
                  }}
                >
                  ⬇ Download PNG
                </a>
              </div>
            </>
          ) : (
            <p style={{ fontSize: 12, color: '#6b7280' }}>Generating QR…</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Access-key login screen ───────────────────────────────────────────────────

function LoginPrompt({ onLogin }: { onLogin: (key: string) => void }) {
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = key.trim().toUpperCase()
    if (!trimmed) { setError('Enter your access key'); return }
    setLoading(true); setError(null)
    try {
      // Validate by calling /me — if it returns, key is valid
      const res = await rentDashboardApi.getMe()
      void res  // discard
      onLogin(trimmed)
    } catch {
      setError('Invalid access key. Check your email.')
    } finally { setLoading(false) }
  }

  return (
    <div className="scanny-page">
      <div className="scanny-page-narrow">
        <div className="scanny-card">
          <p className="scanny-eyebrow">Rent Manager</p>
          <h1 className="scanny-title">Dashboard login</h1>
          <p className="scanny-sub" style={{ marginTop: 6 }}>
            Enter the access key from your setup email (starts with RAK-).
          </p>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14, marginTop: 22 }} noValidate>
            <input
              className="scanny-input scanny-mono"
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              placeholder="RAK-XXXXXXXX"
              autoComplete="off"
              spellCheck={false}
              disabled={loading}
            />
            {error && <p className="scanny-error" role="alert">{error}</p>}
            <button type="submit" disabled={loading} className="scanny-btn scanny-btn-primary">
              {loading ? 'Checking…' : 'Open dashboard'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{
      background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb',
      padding: '12px 16px',
    }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
      <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: color ?? '#111827' }}>{value}</p>
    </div>
  )
}

// ── Unit row ──────────────────────────────────────────────────────────────────

function UnitRow({
  row,
  currency,
  canManage,
  onGenerateCharge,
  onShowQr,
  onEditUnit,
  onManageTenant,
}: {
  row: UnitDashboardRow
  currency: string
  canManage: boolean
  onGenerateCharge: (unitId: string) => void
  onShowQr: (unit: RentUnit) => void
  onEditUnit: (unit: RentUnit) => void
  onManageTenant: (unit: RentUnit) => void
}) {
  const { unit, currentCharge } = row
  const tenant = unit.activeTenant

  return (
    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
      <td style={{ padding: '10px 12px', fontWeight: 700, fontSize: 14 }}>
        {unit.unitNumber}
        {unit.floor ? <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>{unit.floor}</span> : null}
        {canManage && (
          <button
            type="button"
            onClick={() => onEditUnit(unit)}
            title="Edit unit"
            style={{ marginLeft: 6, fontSize: 10, padding: '1px 6px', borderRadius: 4, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', color: '#6b7280' }}
          >
            ✏
          </button>
        )}
      </td>
      <td style={{ padding: '10px 12px', fontSize: 13, color: '#374151' }}>
        {tenant ? (
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>{tenant.name}</p>
            <p style={{ margin: '1px 0 0', fontSize: 11, color: '#9ca3af' }}>{tenant.phone}</p>
            {tenant.leaseEnd && (
              <p style={{ margin: '1px 0 0', fontSize: 10, color: '#9ca3af' }}>
                Lease ends: {new Date(tenant.leaseEnd).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
            {canManage && (
              <button
                type="button"
                onClick={() => onManageTenant(unit)}
                style={{ marginTop: 4, fontSize: 10, padding: '2px 6px', borderRadius: 4, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', color: '#6b7280' }}
              >
                Manage
              </button>
            )}
          </div>
        ) : (
          <div>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>Vacant</span>
            {canManage && (
              <button
                type="button"
                onClick={() => onManageTenant(unit)}
                style={{ marginLeft: 8, fontSize: 10, padding: '2px 8px', borderRadius: 4, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', color: '#374151' }}
              >
                + Tenant
              </button>
            )}
          </div>
        )}
      </td>
      <td style={{ padding: '10px 12px', fontSize: 13 }}>
        {money(unit.monthlyAmount, currency)}
      </td>
      <td style={{ padding: '10px 12px' }}>
        {currentCharge ? (
          <div>
            <StatusBadge status={currentCharge.status} />
            {currentCharge.outstandingAmount > 0 && (
              <p style={{ margin: '3px 0 0', fontSize: 11, color: '#9ca3af' }}>
                {money(currentCharge.outstandingAmount, currency)} outstanding
              </p>
            )}
          </div>
        ) : tenant && canManage ? (
          <button
            type="button"
            onClick={() => onGenerateCharge(unit.id)}
            style={{
              fontSize: 11, padding: '3px 9px', borderRadius: 6,
              border: '1px solid #e5e7eb', background: '#f9fafb',
              color: '#6b7280', cursor: 'pointer',
            }}
          >
            + Generate
          </button>
        ) : (
          <span style={{ fontSize: 12, color: '#d1d5db' }}>—</span>
        )}
      </td>
      <td style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {tenant?.payUrl ? (
            <a
              href={tenant.payUrl}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 12, color: 'var(--primary)', textDecoration: 'none' }}
            >
              Pay link ↗
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => onShowQr(unit)}
            title="Show / print QR code"
            style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 6,
              border: '1px solid #e5e7eb', background: '#f9fafb',
              cursor: 'pointer', color: '#374151',
            }}
          >
            📱 QR
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Property detail view ──────────────────────────────────────────────────────

function PropertyView({
  propertyId,
  role,
  onBack,
}: {
  propertyId: string
  role: string
  onBack: () => void
}) {
  const canManage = role === 'MANAGER' || role === 'OWNER_MANAGER'
  const [dashboard, setDashboard] = useState<PropertyDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState(currentPeriod())

  // ── Tab navigation ────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'units' | 'settings' | 'access'>('units')

  // ── Add unit form ─────────────────────────────────────────────────────────
  const [showAddUnit, setShowAddUnit] = useState(false)
  const [addUnitNum, setAddUnitNum] = useState('')
  const [addUnitFloor, setAddUnitFloor] = useState('')
  const [addUnitAmount, setAddUnitAmount] = useState('')
  const [addUnitDeposit, setAddUnitDeposit] = useState('')
  const [addUnitDueDay, setAddUnitDueDay] = useState('5')
  const [addUnitGrace, setAddUnitGrace] = useState('0')
  const [addingUnit, setAddingUnit] = useState(false)
  const [addUnitError, setAddUnitError] = useState<string | null>(null)

  // ── Edit unit modal ───────────────────────────────────────────────────────
  const [editUnit, setEditUnit] = useState<RentUnit | null>(null)
  const [editUnitNum, setEditUnitNum] = useState('')
  const [editUnitFloor, setEditUnitFloor] = useState('')
  const [editUnitAmount, setEditUnitAmount] = useState('')
  const [editUnitDeposit, setEditUnitDeposit] = useState('')
  const [editUnitDueDay, setEditUnitDueDay] = useState('5')
  const [editUnitGrace, setEditUnitGrace] = useState('0')
  const [savingUnit, setSavingUnit] = useState(false)
  const [editUnitError, setEditUnitError] = useState<string | null>(null)

  // ── Tenant management modal ───────────────────────────────────────────────
  // manageTenantUnit = the unit whose tenant panel is open
  const [manageTenantUnit, setManageTenantUnit] = useState<RentUnit | null>(null)
  // sub-mode within the panel
  const [tenantPanel, setTenantPanel] = useState<'view' | 'add' | 'edit'>('view')
  const [tenantName, setTenantName] = useState('')
  const [tenantPhone, setTenantPhone] = useState('')
  const [tenantEmail, setTenantEmail] = useState('')
  const [tenantMoveIn, setTenantMoveIn] = useState('')
  const [tenantLeaseEnd, setTenantLeaseEnd] = useState('')
  const [editTenantPhone, setEditTenantPhone] = useState('')
  const [editTenantEmail, setEditTenantEmail] = useState('')
  const [editTenantLeaseEnd, setEditTenantLeaseEnd] = useState('')
  const [tenantOpBusy, setTenantOpBusy] = useState(false)
  const [tenantOpError, setTenantOpError] = useState<string | null>(null)

  // ── Unit QR modal ─────────────────────────────────────────────────────────
  const [activeQrUnit, setActiveQrUnit] = useState<RentUnit | null>(null)

  // ── Edit property settings ────────────────────────────────────────────────
  const [propName, setPropName] = useState('')
  const [propAddress, setPropAddress] = useState('')
  const [propCity, setPropCity] = useState('')
  const [propOwnerName, setPropOwnerName] = useState('')
  const [propOwnerMomo, setPropOwnerMomo] = useState('')
  const [propTimezone, setPropTimezone] = useState('')
  const [propPartial, setPropPartial] = useState(true)
  const [propMinPayment, setPropMinPayment] = useState('0')
  const [savingProp, setSavingProp] = useState(false)
  const [propSaveError, setPropSaveError] = useState<string | null>(null)
  const [propSaveOk, setPropSaveOk] = useState(false)

  // ── Access management ─────────────────────────────────────────────────────
  const [grantEmail, setGrantEmail] = useState('')
  const [grantRole, setGrantRole] = useState('MANAGER')
  const [grantingAccess, setGrantingAccess] = useState(false)
  const [grantError, setGrantError] = useState<string | null>(null)
  const [grantOk, setGrantOk] = useState(false)

  const load = useCallback((p = period) => {
    setLoading(true)
    rentDashboardApi.getPropertyDashboard(propertyId, p)
      .then((d) => {
        setDashboard(d)
        // Seed property settings fields on first load
        setPropName(d.property.name)
        setPropAddress(d.property.address)
        setPropCity(d.property.city)
        setPropOwnerName(d.property.ownerName)
        setPropOwnerMomo(d.property.ownerMomo)
        setPropTimezone(d.property.timezone)
        setPropPartial(d.property.partialPaymentAllowed)
        setPropMinPayment(String(d.property.minPaymentAmount))
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [propertyId, period])

  useEffect(() => { load() }, [load])

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleGenerateCharges() {
    await rentDashboardApi.generateCharges(propertyId, { periodLabel: period })
    load()
  }

  async function handleGenerateSingle(unitId: string) {
    await rentDashboardApi.generateChargeForUnit(propertyId, unitId, { periodLabel: period })
    load()
  }

  async function handleRegeneratePropertyQr() {
    if (!window.confirm('This will invalidate the current building QR. Anyone with the old QR or link will not be able to pay. Continue?')) return
    try {
      await rentDashboardApi.regeneratePropertyQrToken(propertyId)
      load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to regenerate QR')
    }
  }

  async function handleRegenerateTenantToken(unitId: string, tenantId: string) {
    if (!window.confirm('This will invalidate the tenant\'s current pay link and QR. They must use the new link to pay. Continue?')) return
    try {
      await rentDashboardApi.regenerateTenantPayToken(propertyId, unitId, tenantId)
      setActiveQrUnit(null)
      load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to regenerate token')
    }
  }

  // ── Add unit ──────────────────────────────────────────────────────────────
  async function handleAddUnit(e: FormEvent) {
    e.preventDefault()
    const amount = parseInt(addUnitAmount.replace(/,/g, ''), 10)
    if (!addUnitNum.trim() || isNaN(amount)) { setAddUnitError('Unit number and amount required'); return }
    setAddingUnit(true); setAddUnitError(null)
    try {
      await rentDashboardApi.addUnit(propertyId, {
        unitNumber: addUnitNum.trim(),
        floor: addUnitFloor.trim() || undefined,
        monthlyAmount: amount,
        depositAmount: parseInt(addUnitDeposit.replace(/,/g, ''), 10) || 0,
        dueDayOfMonth: parseInt(addUnitDueDay, 10) || 5,
        gracePeriodDays: parseInt(addUnitGrace, 10) || 0,
      })
      setAddUnitNum(''); setAddUnitFloor(''); setAddUnitAmount('')
      setAddUnitDeposit(''); setAddUnitDueDay('5'); setAddUnitGrace('0')
      setShowAddUnit(false)
      load()
    } catch (err) {
      setAddUnitError(err instanceof Error ? err.message : 'Failed')
    } finally { setAddingUnit(false) }
  }

  // ── Edit unit ─────────────────────────────────────────────────────────────
  function openEditUnit(unit: RentUnit) {
    setEditUnit(unit)
    setEditUnitNum(unit.unitNumber)
    setEditUnitFloor(unit.floor)
    setEditUnitAmount(String(unit.monthlyAmount))
    setEditUnitDeposit(String(unit.depositAmount))
    setEditUnitDueDay(String(unit.dueDayOfMonth))
    setEditUnitGrace(String(unit.gracePeriodDays))
    setEditUnitError(null)
  }

  async function handleSaveUnit(e: FormEvent) {
    e.preventDefault()
    if (!editUnit) return
    const amount = parseInt(editUnitAmount.replace(/,/g, ''), 10)
    if (isNaN(amount) || amount < 0) { setEditUnitError('Invalid amount'); return }
    setSavingUnit(true); setEditUnitError(null)
    try {
      await rentDashboardApi.updateUnit(propertyId, editUnit.id, {
        unitNumber: editUnitNum.trim() || undefined,
        floor: editUnitFloor,
        monthlyAmount: amount,
        depositAmount: parseInt(editUnitDeposit.replace(/,/g, ''), 10) || 0,
        dueDayOfMonth: parseInt(editUnitDueDay, 10) || 5,
        gracePeriodDays: parseInt(editUnitGrace, 10) || 0,
      })
      setEditUnit(null)
      load()
    } catch (err) {
      setEditUnitError(err instanceof Error ? err.message : 'Failed')
    } finally { setSavingUnit(false) }
  }

  // ── Tenant management ─────────────────────────────────────────────────────
  function openManageTenant(unit: RentUnit) {
    setManageTenantUnit(unit)
    setTenantPanel(unit.activeTenant ? 'view' : 'add')
    setTenantName(''); setTenantPhone(''); setTenantEmail('')
    setTenantMoveIn(''); setTenantLeaseEnd('')
    setTenantOpError(null)
  }

  async function handleAddTenant(e: FormEvent) {
    e.preventDefault()
    if (!manageTenantUnit || !tenantName.trim() || !tenantPhone.trim()) {
      setTenantOpError('Name and phone are required'); return
    }
    setTenantOpBusy(true); setTenantOpError(null)
    try {
      await rentDashboardApi.addTenant(propertyId, manageTenantUnit.id, {
        name: tenantName.trim(),
        phone: tenantPhone.trim(),
        email: tenantEmail.trim() || undefined,
        moveInDate: tenantMoveIn || undefined,
        leaseEnd: tenantLeaseEnd || undefined,
      })
      setManageTenantUnit(null)
      load()
    } catch (err) {
      setTenantOpError(err instanceof Error ? err.message : 'Failed')
    } finally { setTenantOpBusy(false) }
  }

  function openEditTenant(tenant: TenantSummary) {
    setEditTenantPhone(tenant.phone)
    setEditTenantEmail(tenant.email)
    setEditTenantLeaseEnd(tenant.leaseEnd ?? '')
    setTenantPanel('edit')
    setTenantOpError(null)
  }

  async function handleUpdateTenant(e: FormEvent) {
    e.preventDefault()
    if (!manageTenantUnit?.activeTenant) return
    setTenantOpBusy(true); setTenantOpError(null)
    try {
      await rentDashboardApi.updateTenant(propertyId, manageTenantUnit.id, manageTenantUnit.activeTenant.id, {
        phone: editTenantPhone.trim() || undefined,
        email: editTenantEmail.trim(),
        leaseEnd: editTenantLeaseEnd || undefined,
      })
      setTenantPanel('view')
      load()
    } catch (err) {
      setTenantOpError(err instanceof Error ? err.message : 'Failed')
    } finally { setTenantOpBusy(false) }
  }

  async function handleDeactivateTenant(unitId: string, tenantId: string) {
    if (!window.confirm('Remove this tenant from the unit? Their pay link will stop working.')) return
    setTenantOpBusy(true); setTenantOpError(null)
    try {
      await rentDashboardApi.deactivateTenant(propertyId, unitId, tenantId)
      setManageTenantUnit(null)
      load()
    } catch (err) {
      setTenantOpError(err instanceof Error ? err.message : 'Failed')
    } finally { setTenantOpBusy(false) }
  }

  // ── Save property settings ────────────────────────────────────────────────
  async function handleSaveProperty(e: FormEvent) {
    e.preventDefault()
    setSavingProp(true); setPropSaveError(null); setPropSaveOk(false)
    try {
      await rentDashboardApi.updateProperty(propertyId, {
        name: propName.trim() || undefined,
        address: propAddress,
        city: propCity,
        ownerName: propOwnerName.trim() || undefined,
        ownerMomo: propOwnerMomo.trim() || undefined,
        timezone: propTimezone.trim() || undefined,
        partialPaymentAllowed: propPartial,
        minPaymentAmount: parseInt(propMinPayment, 10) || 0,
      })
      setPropSaveOk(true)
      load()
    } catch (err) {
      setPropSaveError(err instanceof Error ? err.message : 'Failed to save')
    } finally { setSavingProp(false) }
  }

  // ── Grant access ──────────────────────────────────────────────────────────
  async function handleGrantAccess(e: FormEvent) {
    e.preventDefault()
    if (!grantEmail.trim()) { setGrantError('Email is required'); return }
    setGrantingAccess(true); setGrantError(null); setGrantOk(false)
    try {
      await rentDashboardApi.grantAccess(propertyId, grantEmail.trim(), grantRole)
      setGrantEmail(''); setGrantOk(true)
      load()
    } catch (err) {
      setGrantError(err instanceof Error ? err.message : 'Failed')
    } finally { setGrantingAccess(false) }
  }

  if (loading && !dashboard) return (
    <div className="scanny-page">
      <div className="scanny-page-narrow" style={{ paddingTop: 40, textAlign: 'center' }}>
        <p style={{ color: '#6b7280' }}>Loading property…</p>
      </div>
    </div>
  )

  if (error || !dashboard) return (
    <div className="scanny-page">
      <div className="scanny-page-narrow" style={{ paddingTop: 40 }}>
        <p className="scanny-error">{error ?? 'Could not load property'}</p>
      </div>
    </div>
  )

  const d = dashboard

  return (
    <div className="scanny-page" style={{ padding: '16px 12px 60px' }}>
      <button type="button" onClick={onBack} className="scanny-back">← Portfolio</button>

      {/* Header */}
      <div style={{ marginTop: 12, marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {role}
        </p>
        <h1 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800 }}>{d.property.name}</h1>
        <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>
          {d.property.address}{d.property.city ? `, ${d.property.city}` : ''}
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 18, borderBottom: '2px solid #e5e7eb' }}>
        {(['units', ...(canManage ? ['settings', 'access'] : [])] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 14px', fontSize: 13, fontWeight: activeTab === tab ? 700 : 500,
              borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -2, background: 'none', border: 'none', borderRadius: 0,
              cursor: 'pointer', color: activeTab === tab ? 'var(--primary)' : '#6b7280',
              textTransform: 'capitalize',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── UNITS TAB ───────────────────────────────────────────────────── */}
      {activeTab === 'units' && (
        <>
          {/* Period selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Period:</span>
            <input
              type="month"
              value={period}
              onChange={(e) => { setPeriod(e.target.value); load(e.target.value) }}
              style={{ fontSize: 13, padding: '4px 8px', borderRadius: 6, border: '1px solid #e5e7eb' }}
            />
            {canManage && (
              <button
                type="button"
                onClick={handleGenerateCharges}
                style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', color: '#374151' }}
              >
                Generate all charges
              </button>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => rentDashboardApi.triggerCsvExport(propertyId, period)}
                style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', color: '#374151' }}
              >
                ⬇ Export CSV
              </button>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
            <Stat label="Units" value={d.totalUnits} />
            <Stat label="Occupied" value={d.occupiedUnits} />
            <Stat label="Paid" value={d.paidThisPeriod} color="#059669" />
            <Stat label="Unpaid" value={d.unpaidThisPeriod} color="#dc2626" />
            <Stat label="Overdue" value={d.overdueCount} color="#9d174d" />
            <Stat label="Collected" value={money(d.totalCollectedThisPeriod, d.property.currency)} color="#1d4ed8" />
          </div>

          {/* Units table */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Units — {periodDisplay(period)}</h2>
              {canManage && (
                <button type="button" onClick={() => setShowAddUnit(!showAddUnit)}
                  style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer' }}>
                  + Add unit
                </button>
              )}
            </div>

            {/* Add unit expanded form */}
            {showAddUnit && (
              <form onSubmit={handleAddUnit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, padding: '12px 16px', background: '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                <input className="scanny-input" value={addUnitNum} onChange={(e) => setAddUnitNum(e.target.value)}
                  placeholder="Unit number*" style={{ fontSize: 13 }} required />
                <input className="scanny-input" value={addUnitFloor} onChange={(e) => setAddUnitFloor(e.target.value)}
                  placeholder="Floor (optional)" style={{ fontSize: 13 }} />
                <input className="scanny-input" type="number" value={addUnitAmount} onChange={(e) => setAddUnitAmount(e.target.value)}
                  placeholder="Monthly rent*" style={{ fontSize: 13 }} required />
                <input className="scanny-input" type="number" value={addUnitDeposit} onChange={(e) => setAddUnitDeposit(e.target.value)}
                  placeholder="Deposit (optional)" style={{ fontSize: 13 }} />
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <label style={{ fontSize: 12, color: '#374151', whiteSpace: 'nowrap' }}>Due day</label>
                  <input className="scanny-input" type="number" min={1} max={28} value={addUnitDueDay} onChange={(e) => setAddUnitDueDay(e.target.value)}
                    style={{ fontSize: 13, width: 60 }} />
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <label style={{ fontSize: 12, color: '#374151', whiteSpace: 'nowrap' }}>Grace days</label>
                  <input className="scanny-input" type="number" min={0} value={addUnitGrace} onChange={(e) => setAddUnitGrace(e.target.value)}
                    style={{ fontSize: 13, width: 60 }} />
                </div>
                {addUnitError && <p className="scanny-error" style={{ gridColumn: '1/-1', margin: 0, fontSize: 12 }}>{addUnitError}</p>}
                <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8 }}>
                  <button type="submit" disabled={addingUnit} className="scanny-btn scanny-btn-primary" style={{ fontSize: 13, padding: '7px 16px' }}>
                    {addingUnit ? 'Adding…' : 'Add unit'}
                  </button>
                  <button type="button" onClick={() => setShowAddUnit(false)} style={{ padding: '7px 12px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', background: '#fff' }}>
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                    {['Unit', 'Tenant', 'Monthly', 'Status', 'Pay link'].map((h) => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9ca3af' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.units.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: '20px 12px', color: '#9ca3af', textAlign: 'center' }}>No units yet. Add one above.</td></tr>
                  ) : d.units.map((row) => (
                    <UnitRow
                      key={row.unit.id}
                      row={row}
                      currency={d.property.currency}
                      canManage={canManage}
                      onGenerateCharge={handleGenerateSingle}
                      onShowQr={setActiveQrUnit}
                      onEditUnit={openEditUnit}
                      onManageTenant={openManageTenant}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent payments */}
          {d.recentPayments.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Recent payments</h2>
              </div>
              <div style={{ padding: '8px 0' }}>
                {d.recentPayments.map((p) => (
                  <div key={p.transactionRef} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{money(p.amount, p.currency)}</p>
                      <p style={{ margin: '1px 0 0', fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{p.transactionRef}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <StatusBadge status={p.status} />
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }}>
                        {p.paidAt ? new Date(p.paidAt).toLocaleDateString([], { day: 'numeric', month: 'short' }) : '—'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Property-level QR */}
          <QRCodePanel
            url={d.property.qrCodeUrl}
            label={`${d.property.name} — Property QR`}
            sublabel="Print and place at the building entrance. Tenants scan to select their unit and pay."
          />
          {canManage && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                type="button"
                onClick={handleRegeneratePropertyQr}
                style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff1f2', cursor: 'pointer', color: '#991b1b' }}
              >
                🔄 Invalidate &amp; regenerate property QR
              </button>
              <button
                type="button"
                onClick={() => rentDashboardApi.downloadBulkQrPdf(propertyId, d.property.name)}
                style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', color: '#374151' }}
              >
                ⬇ All unit QRs (PDF)
              </button>
            </div>
          )}
        </>
      )}

      {/* ── SETTINGS TAB ────────────────────────────────────────────────── */}
      {activeTab === 'settings' && canManage && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20, maxWidth: 520 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Property settings</h2>
          <form onSubmit={handleSaveProperty} style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Property name</span>
              <input className="scanny-input" value={propName} onChange={(e) => setPropName(e.target.value)} required />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Address</span>
              <input className="scanny-input" value={propAddress} onChange={(e) => setPropAddress(e.target.value)} />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>City</span>
              <input className="scanny-input" value={propCity} onChange={(e) => setPropCity(e.target.value)} />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Owner name</span>
              <input className="scanny-input" value={propOwnerName} onChange={(e) => setPropOwnerName(e.target.value)} required />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>MoMo number <span style={{ fontWeight: 400, color: '#9ca3af' }}>(rent destination)</span></span>
              <input className="scanny-input" value={propOwnerMomo} onChange={(e) => setPropOwnerMomo(e.target.value)} required />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Timezone</span>
              <input className="scanny-input" value={propTimezone} onChange={(e) => setPropTimezone(e.target.value)} placeholder="Africa/Kampala" />
            </label>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={propPartial} onChange={(e) => setPropPartial(e.target.checked)} />
              <span style={{ fontSize: 13 }}>Allow partial payments</span>
            </label>
            {propPartial && (
              <label style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Minimum payment amount ({d.property.currency})</span>
                <input className="scanny-input" type="number" min={0} value={propMinPayment} onChange={(e) => setPropMinPayment(e.target.value)} />
              </label>
            )}
            {propSaveError && <p className="scanny-error" style={{ margin: 0, fontSize: 12 }}>{propSaveError}</p>}
            {propSaveOk && <p style={{ margin: 0, fontSize: 12, color: '#059669', fontWeight: 600 }}>✓ Settings saved</p>}
            <button type="submit" disabled={savingProp} className="scanny-btn scanny-btn-primary" style={{ justifySelf: 'start', fontSize: 13, padding: '8px 20px' }}>
              {savingProp ? 'Saving…' : 'Save settings'}
            </button>
          </form>
        </div>
      )}

      {/* ── ACCESS TAB ──────────────────────────────────────────────────── */}
      {activeTab === 'access' && canManage && (
        <div style={{ maxWidth: 520 }}>
          {/* Current access list */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Who has access</h2>
            </div>
            {d.accessList.length === 0 ? (
              <p style={{ padding: '16px', color: '#9ca3af', fontSize: 13 }}>No access entries yet.</p>
            ) : d.accessList.map((entry) => (
              <div key={entry.accountId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #f9fafb' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{entry.accountName}</p>
                  <p style={{ margin: '1px 0 0', fontSize: 11, color: '#9ca3af' }}>{entry.accountEmail}</p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: '#f3f4f6', color: '#6b7280' }}>
                  {entry.role}
                </span>
              </div>
            ))}
          </div>

          {/* Grant access form */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>Invite someone</h3>
            <form onSubmit={handleGrantAccess} style={{ display: 'grid', gap: 12 }}>
              <label style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Email address</span>
                <input className="scanny-input" type="email" value={grantEmail} onChange={(e) => setGrantEmail(e.target.value)} placeholder="manager@example.com" required />
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Role</span>
                <select className="scanny-input" value={grantRole} onChange={(e) => setGrantRole(e.target.value)} style={{ fontSize: 13 }}>
                  <option value="MANAGER">Manager (full management, no ownership)</option>
                  <option value="OWNER">Owner (view-only)</option>
                  <option value="OWNER_MANAGER">Owner + Manager (full access)</option>
                </select>
              </label>
              {grantError && <p className="scanny-error" style={{ margin: 0, fontSize: 12 }}>{grantError}</p>}
              {grantOk && <p style={{ margin: 0, fontSize: 12, color: '#059669', fontWeight: 600 }}>✓ Access granted</p>}
              <button type="submit" disabled={grantingAccess} className="scanny-btn scanny-btn-primary" style={{ justifySelf: 'start', fontSize: 13, padding: '8px 18px' }}>
                {grantingAccess ? 'Granting…' : 'Grant access'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT UNIT MODAL ─────────────────────────────────────────────── */}
      {editUnit && (
        <div
          role="dialog" aria-modal="true" aria-label={`Edit unit ${editUnit.unitNumber}`}
          style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}
        >
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 400, width: '92%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Edit unit {editUnit.unitNumber}</h3>
              <button type="button" onClick={() => setEditUnit(null)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#6b7280' }}>✕</button>
            </div>
            <form onSubmit={handleSaveUnit} style={{ display: 'grid', gap: 10 }}>
              <label style={{ display: 'grid', gap: 3, fontSize: 12 }}>
                <span style={{ fontWeight: 600 }}>Unit number</span>
                <input className="scanny-input" value={editUnitNum} onChange={(e) => setEditUnitNum(e.target.value)} style={{ fontSize: 13 }} />
              </label>
              <label style={{ display: 'grid', gap: 3, fontSize: 12 }}>
                <span style={{ fontWeight: 600 }}>Floor</span>
                <input className="scanny-input" value={editUnitFloor} onChange={(e) => setEditUnitFloor(e.target.value)} placeholder="e.g. Ground, 2nd" style={{ fontSize: 13 }} />
              </label>
              <label style={{ display: 'grid', gap: 3, fontSize: 12 }}>
                <span style={{ fontWeight: 600 }}>Monthly rent</span>
                <input className="scanny-input" type="number" value={editUnitAmount} onChange={(e) => setEditUnitAmount(e.target.value)} style={{ fontSize: 13 }} required />
              </label>
              <label style={{ display: 'grid', gap: 3, fontSize: 12 }}>
                <span style={{ fontWeight: 600 }}>Deposit</span>
                <input className="scanny-input" type="number" value={editUnitDeposit} onChange={(e) => setEditUnitDeposit(e.target.value)} style={{ fontSize: 13 }} />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'grid', gap: 3, fontSize: 12 }}>
                  <span style={{ fontWeight: 600 }}>Due day (1–28)</span>
                  <input className="scanny-input" type="number" min={1} max={28} value={editUnitDueDay} onChange={(e) => setEditUnitDueDay(e.target.value)} style={{ fontSize: 13 }} />
                </label>
                <label style={{ display: 'grid', gap: 3, fontSize: 12 }}>
                  <span style={{ fontWeight: 600 }}>Grace days</span>
                  <input className="scanny-input" type="number" min={0} value={editUnitGrace} onChange={(e) => setEditUnitGrace(e.target.value)} style={{ fontSize: 13 }} />
                </label>
              </div>
              {editUnitError && <p className="scanny-error" style={{ margin: 0, fontSize: 12 }}>{editUnitError}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button type="submit" disabled={savingUnit} className="scanny-btn scanny-btn-primary" style={{ fontSize: 13, padding: '8px 18px' }}>
                  {savingUnit ? 'Saving…' : 'Save changes'}
                </button>
                <button type="button" onClick={() => setEditUnit(null)} style={{ fontSize: 13, padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', background: '#fff' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── TENANT MANAGEMENT MODAL ─────────────────────────────────────── */}
      {manageTenantUnit && (
        <div
          role="dialog" aria-modal="true" aria-label={`Manage tenant — Unit ${manageTenantUnit.unitNumber}`}
          style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}
        >
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 380, width: '92%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                Unit {manageTenantUnit.unitNumber} — {manageTenantUnit.activeTenant ? manageTenantUnit.activeTenant.name : 'Vacant'}
              </h3>
              <button type="button" onClick={() => setManageTenantUnit(null)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#6b7280' }}>✕</button>
            </div>

            {/* View existing tenant */}
            {tenantPanel === 'view' && manageTenantUnit.activeTenant && (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ background: '#f9fafb', borderRadius: 8, padding: 12, fontSize: 13 }}>
                  <p style={{ margin: 0 }}><strong>Phone:</strong> {manageTenantUnit.activeTenant.phone}</p>
                  {manageTenantUnit.activeTenant.email && <p style={{ margin: '4px 0 0' }}><strong>Email:</strong> {manageTenantUnit.activeTenant.email}</p>}
                  {manageTenantUnit.activeTenant.moveInDate && <p style={{ margin: '4px 0 0' }}><strong>Moved in:</strong> {manageTenantUnit.activeTenant.moveInDate}</p>}
                  {manageTenantUnit.activeTenant.leaseEnd && <p style={{ margin: '4px 0 0' }}><strong>Lease ends:</strong> {manageTenantUnit.activeTenant.leaseEnd}</p>}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => openEditTenant(manageTenantUnit.activeTenant!)} className="scanny-btn scanny-btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}>
                    ✏ Edit details
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeactivateTenant(manageTenantUnit.id, manageTenantUnit.activeTenant!.id)}
                    disabled={tenantOpBusy}
                    style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff1f2', color: '#991b1b', cursor: 'pointer' }}
                  >
                    Remove tenant
                  </button>
                </div>
                {tenantOpError && <p className="scanny-error" style={{ margin: 0, fontSize: 12 }}>{tenantOpError}</p>}
              </div>
            )}

            {/* Add new tenant */}
            {tenantPanel === 'add' && (
              <form onSubmit={handleAddTenant} style={{ display: 'grid', gap: 10 }}>
                <input className="scanny-input" value={tenantName} onChange={(e) => setTenantName(e.target.value)} placeholder="Full name*" required style={{ fontSize: 13 }} />
                <input className="scanny-input" type="tel" value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)} placeholder="Phone number*" required style={{ fontSize: 13 }} />
                <input className="scanny-input" type="email" value={tenantEmail} onChange={(e) => setTenantEmail(e.target.value)} placeholder="Email (optional)" style={{ fontSize: 13 }} />
                <label style={{ display: 'grid', gap: 3 }}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>Move-in date (optional)</span>
                  <input className="scanny-input" type="date" value={tenantMoveIn} onChange={(e) => setTenantMoveIn(e.target.value)} style={{ fontSize: 13 }} />
                </label>
                <label style={{ display: 'grid', gap: 3 }}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>Lease end date (optional)</span>
                  <input className="scanny-input" type="date" value={tenantLeaseEnd} onChange={(e) => setTenantLeaseEnd(e.target.value)} style={{ fontSize: 13 }} />
                </label>
                {tenantOpError && <p className="scanny-error" style={{ margin: 0, fontSize: 12 }}>{tenantOpError}</p>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" disabled={tenantOpBusy} className="scanny-btn scanny-btn-primary" style={{ fontSize: 13, padding: '8px 16px' }}>
                    {tenantOpBusy ? 'Saving…' : 'Add tenant'}
                  </button>
                  <button type="button" onClick={() => setManageTenantUnit(null)} style={{ fontSize: 13, padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', background: '#fff' }}>
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Edit existing tenant */}
            {tenantPanel === 'edit' && (
              <form onSubmit={handleUpdateTenant} style={{ display: 'grid', gap: 10 }}>
                <label style={{ display: 'grid', gap: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Phone number</span>
                  <input className="scanny-input" type="tel" value={editTenantPhone} onChange={(e) => setEditTenantPhone(e.target.value)} style={{ fontSize: 13 }} />
                </label>
                <label style={{ display: 'grid', gap: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Email</span>
                  <input className="scanny-input" type="email" value={editTenantEmail} onChange={(e) => setEditTenantEmail(e.target.value)} style={{ fontSize: 13 }} />
                </label>
                <label style={{ display: 'grid', gap: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Lease end date</span>
                  <input className="scanny-input" type="date" value={editTenantLeaseEnd} onChange={(e) => setEditTenantLeaseEnd(e.target.value)} style={{ fontSize: 13 }} />
                </label>
                {tenantOpError && <p className="scanny-error" style={{ margin: 0, fontSize: 12 }}>{tenantOpError}</p>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" disabled={tenantOpBusy} className="scanny-btn scanny-btn-primary" style={{ fontSize: 13, padding: '8px 16px' }}>
                    {tenantOpBusy ? 'Saving…' : 'Save changes'}
                  </button>
                  <button type="button" onClick={() => setTenantPanel('view')} style={{ fontSize: 13, padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', background: '#fff' }}>
                    ← Back
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── UNIT QR MODAL ───────────────────────────────────────────────── */}
      {activeQrUnit && (
        <div
          role="dialog" aria-modal="true" aria-label={`QR code for Unit ${activeQrUnit.unitNumber}`}
          style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}
        >
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 340, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Unit {activeQrUnit.unitNumber} — QR code</h3>
              <button type="button" onClick={() => setActiveQrUnit(null)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#6b7280' }}>✕</button>
            </div>
            <QRCodePanel
              url={activeQrUnit.qrCodeUrl ?? activeQrUnit.activeTenant?.payUrl ?? d.property.qrCodeUrl}
              label={`Unit ${activeQrUnit.unitNumber}${activeQrUnit.activeTenant ? ` — ${activeQrUnit.activeTenant.name}` : ''}`}
              sublabel={
                activeQrUnit.activeTenant
                  ? 'Personal pay link — goes straight to this tenant\'s payment page.'
                  : 'Unit QR — tenant selects their details on the pay page.'
              }
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {canManage && (
                <>
                  <button
                    type="button"
                    onClick={() => void rentDashboardApi.regenerateUnitQrToken(propertyId, activeQrUnit.id).then(() => { setActiveQrUnit(null); load() })}
                    style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff1f2', color: '#991b1b', cursor: 'pointer' }}
                  >
                    🔄 New unit QR
                  </button>
                  {activeQrUnit.activeTenant && (
                    <button
                      type="button"
                      onClick={() => void handleRegenerateTenantToken(activeQrUnit.id, activeQrUnit.activeTenant!.id)}
                      style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff1f2', color: '#991b1b', cursor: 'pointer' }}
                    >
                      🔄 New tenant link
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => rentDashboardApi.downloadUnitQr(propertyId, activeQrUnit.id, activeQrUnit.unitNumber)}
                    style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', color: '#374151', cursor: 'pointer' }}
                  >
                    ⬇ PNG
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Portfolio list ────────────────────────────────────────────────────────────

function PortfolioList({
  onSelectProperty,
}: {
  onSelectProperty: (id: string, role: string) => void
}) {
  const [portfolio, setPortfolio] = useState<PortfolioEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    rentDashboardApi.getPortfolio()
      .then(setPortfolio)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p style={{ padding: 20, color: '#6b7280', textAlign: 'center' }}>Loading portfolio…</p>
  if (error) return <p className="scanny-error" style={{ padding: 20 }}>{error}</p>

  if (portfolio.length === 0) {
    return (
      <div style={{ padding: '32px 20px', textAlign: 'center', color: '#9ca3af' }}>
        <p style={{ fontSize: 32, margin: 0 }}>🏢</p>
        <p style={{ marginTop: 12, fontSize: 14 }}>No properties yet. Add your first one to get started.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 12, padding: '0 0 20px' }}>
      {portfolio.map((p) => (
        <button
          key={p.propertyId}
          type="button"
          onClick={() => onSelectProperty(p.propertyId, p.role)}
          style={{
            display: 'grid', textAlign: 'left', padding: '14px 16px',
            background: '#fff', borderRadius: 12, border: '1.5px solid #e5e7eb',
            cursor: 'pointer', gap: 6,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{p.propertyName}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9ca3af' }}>{p.city}</p>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: '#f3f4f6', color: '#6b7280' }}>
              {p.role}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#6b7280' }}>
            <span>{p.totalUnits} units · {p.occupiedUnits} occupied</span>
            {p.overdueCount > 0 && (
              <span style={{ color: '#dc2626', fontWeight: 600 }}>⚠ {p.overdueCount} overdue</span>
            )}
          </div>
        </button>
      ))}
    </div>
  )
}

// ── Root component ────────────────────────────────────────────────────────────

export default function RentDashboard({
  onOpenCreate,
}: {
  onOpenCreate: () => void
}) {
  const [selectedProperty, setSelectedProperty] = useState<{ id: string; role: string } | null>(null)

  if (selectedProperty) {
    return (
      <PropertyView
        propertyId={selectedProperty.id}
        role={selectedProperty.role}
        onBack={() => setSelectedProperty(null)}
      />
    )
  }

  return (
    <div className="scanny-page" style={{ padding: '16px 12px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Rent Manager
          </p>
          <h1 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800 }}>My Portfolio</h1>
        </div>
        <button
          type="button"
          onClick={onOpenCreate}
          style={{
            fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 8,
            background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer',
          }}
        >
          + Add property
        </button>
      </div>

      <PortfolioList onSelectProperty={(id, role) => setSelectedProperty({ id, role })} />
    </div>
  )
}
