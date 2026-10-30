import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Building2, AlertTriangle, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock, DollarSign, FileText, Home, LayoutGrid, LogOut, Maximize2, Menu, Minimize2, Moon, Plus, Search, Sun, Users, Wallet, Wrench, X } from 'lucide-react'
import { rentDashboardApi } from './api'
import { logoutRentManager } from '../keycloak'
import { applyDarkMode, persistDarkMode, readDarkMode } from '../lib/theme'
import { usePagination } from '../hooks/usePagination'
import { PaginationBar } from '../components/PaginationBar'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import type {
  PortfolioEntry,
  PropertyDashboard,
  RentAccount,
  RentCharge,
  RentProperty,
  RentUnit,
  TenantSummary,
  UnitDashboardRow,
  MaintenanceRequest,
} from './types'
import AddPropertyModal from './AddPropertyModal'

// ── Helpers ──────────────────────────────────────────────────────────────────

function money(n: number, currency = 'UGX') {
  return `${n.toLocaleString()} ${currency}`
}

function periodDisplay(label: string) {
  try {
    const [year, month] = label.split('-').map(Number)
    return new Date(year, month - 1).toLocaleDateString([], { month: 'long', year: 'numeric' })
  } catch {
    return label
  }
}

function currentPeriod(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.ceil((t - Date.now()) / (1000 * 60 * 60 * 24))
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  PAID: { bg: '#dcfce7', color: '#166534' },
  UNPAID: { bg: '#fee2e2', color: '#991b1b' },
  PARTIAL: { bg: '#fef3c7', color: '#92400e' },
  OVERDUE: { bg: '#fce7f3', color: '#9d174d' },
  WAIVED: { bg: '#f3f4f6', color: '#6b7280' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { bg: '#f3f4f6', color: '#6b7280' }
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
        background: s.bg,
        color: s.color,
      }}
    >
      {status}
    </span>
  )
}

// ── QRCodePanel ───────────────────────────────────────────────────────────────

function QRCodePanel({
  url,
  label,
  sublabel,
  defaultExpanded = true,
  size = 180,
}: {
  url: string
  label: string
  sublabel?: string
  defaultExpanded?: boolean
  size?: number
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [genError, setGenError] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (!url) {
      setDataUrl(null)
      setGenError('No QR URL')
      return
    }
    let cancelled = false
    setGenError(null)
    QRCode.toDataURL(url, {
      width: Math.max(size, 400),
      margin: 4,
      errorCorrectionLevel: 'M',
      color: { dark: '#111827', light: '#ffffff' },
    })
      .then((d) => {
        if (!cancelled) setDataUrl(d)
      })
      .catch(() => {
        if (!cancelled) setGenError('Could not generate QR image')
      })
    return () => {
      cancelled = true
    }
  }, [url, size])

  function handlePrint() {
    if (!dataUrl) return
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(
      `<html><head><title>QR — ${label}</title><style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;gap:12px;}img{width:260px;height:260px;}p{margin:0;font-size:14px;color:#111;}small{font-size:12px;color:#6b7280;word-break:break-all;max-width:280px;text-align:center;}</style></head><body><p><strong>${label}</strong></p>${sublabel ? `<p style="font-size:13px;color:#6b7280">${sublabel}</p>` : ''}<img src="${dataUrl}" alt="QR code" /><small>${url}</small><script>window.onload=()=>{window.print();window.close()}<\/script></body></html>`,
    )
    w.document.close()
  }

  function handleCopy() {
    void navigator.clipboard.writeText(url).catch(() => {})
  }

  return (
    <div style={{ marginTop: 12 }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          fontSize: 13,
          padding: '6px 14px',
          borderRadius: 6,
          border: '1px solid var(--border)',
          background: 'var(--card)',
          cursor: 'pointer',
          color: 'var(--foreground)',
        }}
      >
        {expanded ? '▲ Hide QR code' : '▼ Show QR code'}
      </button>
      {expanded && (
        <div
          style={{
            marginTop: 12,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          {dataUrl ? (
            <img
              ref={imgRef}
              src={dataUrl}
              alt={`QR code for ${label}`}
              style={{
                width: size,
                height: size,
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: '#fff',
              }}
            />
          ) : (
            <p style={{ color: genError ? 'var(--destructive)' : 'var(--muted-foreground)', fontSize: 13 }}>
              {genError ?? 'Generating…'}
            </p>
          )}
          {sublabel && (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)' }}>{sublabel}</p>
          )}
          <p
            style={{
              margin: 0,
              fontSize: 11,
              color: 'var(--muted-foreground)',
              wordBreak: 'break-all',
              maxWidth: 320,
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            {url}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handlePrint}
              disabled={!dataUrl}
              style={{
                fontSize: 12,
                padding: '5px 12px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--card)',
                cursor: 'pointer',
                color: 'var(--foreground)',
              }}
            >
              Print
            </button>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                fontSize: 12,
                padding: '5px 12px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--card)',
                cursor: 'pointer',
                color: 'var(--foreground)',
              }}
            >
              Copy link
            </button>
            {dataUrl && (
              <a
                href={dataUrl}
                download={`${label.replace(/\s+/g, '-')}.png`}
                style={{
                  fontSize: 12,
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--card)',
                  textDecoration: 'none',
                  color: 'var(--foreground)',
                }}
              >
                Download PNG
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Stat (used inside PropertyView units tab) ─────────────────────────────────

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div
      style={{
        background: 'var(--card)',
        borderRadius: 8,
        border: '1px solid var(--border)',
        padding: '12px 14px',
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--muted-foreground)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {label}
      </p>
      <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 800, color: color ?? 'var(--foreground)' }}>
        {value}
      </p>
    </div>
  )
}

// ── Shared input styling ──────────────────────────────────────────────────────

const fieldInputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '9px 11px',
  fontSize: 14,
  border: '1.5px solid var(--border)',
  borderRadius: 8,
  background: 'var(--card)',
  color: 'var(--foreground)',
  fontFamily: 'inherit',
  outline: 'none',
}

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--foreground)',
  marginBottom: 4,
}

const btnPrimaryStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '9px 16px',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 700,
  border: '1.5px solid var(--primary)',
  background: 'var(--primary)',
  color: 'var(--primary-foreground)',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const btnSecondaryStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '9px 16px',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 700,
  border: '1.5px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--foreground)',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

// ── UnitRow (table row inside PropertyView units tab) ─────────────────────────

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
    <TableRow className="border-b border-border hover:bg-muted/40">
      <TableCell className="pl-5 py-2.5">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="text-sm font-bold text-foreground">{unit.unitNumber}</span>
          {unit.floor && <span className="text-xs text-muted-foreground">· {unit.floor}</span>}
          {canManage && (
            <button type="button" onClick={() => onEditUnit(unit)} title="Edit unit" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--muted-foreground)', lineHeight: 1 }}>✎</button>
          )}
        </div>
      </TableCell>
      <TableCell className="py-2.5">
        {tenant ? (
          <div>
            <p className="text-sm font-medium text-foreground" style={{ margin: 0 }}>{tenant.name}</p>
            <p className="text-xs text-muted-foreground" style={{ margin: '1px 0 0' }}>
              {tenant.phone}{tenant.leaseEnd ? ` · ${tenant.leaseEnd.slice(0, 10)}` : ''}
            </p>
            {canManage && (
              <button type="button" onClick={() => onManageTenant(unit)} className="scanny-link-btn" style={{ fontSize: 11, marginTop: 2 }}>Manage</button>
            )}
          </div>
        ) : (
          <div>
            <span className="text-sm text-muted-foreground">Vacant</span>
            {canManage && (
              <button type="button" onClick={() => onManageTenant(unit)} className="scanny-link-btn" style={{ display: 'block', fontSize: 11, marginTop: 2 }}>Add tenant</button>
            )}
          </div>
        )}
      </TableCell>
      <TableCell className="text-sm font-mono font-medium text-foreground py-2.5">{money(unit.monthlyAmount, currency)}</TableCell>
      <TableCell className="py-2.5">
        {currentCharge ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <StatusBadge status={currentCharge.status} />
            {currentCharge.outstandingAmount > 0 && currentCharge.status !== 'PAID' && (
              <span className="text-xs text-muted-foreground">bal {money(currentCharge.outstandingAmount, currency)}</span>
            )}
          </div>
        ) : tenant ? (
          canManage ? (
            <button type="button" onClick={() => onGenerateCharge(unit.id)} className="scanny-link-btn" style={{ fontSize: 12 }}>Generate</button>
          ) : <span className="text-muted-foreground text-sm">—</span>
        ) : <span className="text-muted-foreground text-sm">—</span>}
      </TableCell>
      <TableCell className="pr-5 py-2.5">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {unit.qrCodeUrl && (
            <button type="button" onClick={() => onShowQr(unit)} className="scanny-link-btn" style={{ fontSize: 12 }}>Unit QR</button>
          )}
          {tenant?.payUrl && (
            <a href={tenant.payUrl} target="_blank" rel="noreferrer" className="scanny-link" style={{ fontSize: 12 }}>Pay link</a>
          )}
          {!unit.qrCodeUrl && !tenant?.payUrl && <span className="text-muted-foreground text-sm">—</span>}
        </div>
      </TableCell>
    </TableRow>
  )
}

// ── PropertyView (full management screen, opened from the Units tab) ──────────

function PropertyView({ propertyId, role, onBack }: { propertyId: string; role: string; onBack: () => void }) {
  const canManage = role === 'MANAGER' || role === 'OWNER_MANAGER'

  const [dashboard, setDashboard] = useState<PropertyDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<string>(currentPeriod())
  const [activeTab, setActiveTab] = useState<'units' | 'settings' | 'access'>('units')

  // Add unit inline form
  const [showAddUnit, setShowAddUnit] = useState(false)
  const [addUnitNum, setAddUnitNum] = useState('')
  const [addUnitFloor, setAddUnitFloor] = useState('')
  const [addUnitAmount, setAddUnitAmount] = useState('')
  const [addUnitDeposit, setAddUnitDeposit] = useState('')
  const [addUnitDueDay, setAddUnitDueDay] = useState('5')
  const [addUnitGrace, setAddUnitGrace] = useState('0')
  const [addingUnit, setAddingUnit] = useState(false)
  const [addUnitError, setAddUnitError] = useState<string | null>(null)

  // Edit unit modal
  const [editUnit, setEditUnit] = useState<RentUnit | null>(null)
  const [editUnitNum, setEditUnitNum] = useState('')
  const [editUnitFloor, setEditUnitFloor] = useState('')
  const [editUnitAmount, setEditUnitAmount] = useState('')
  const [editUnitDeposit, setEditUnitDeposit] = useState('')
  const [editUnitDueDay, setEditUnitDueDay] = useState('5')
  const [editUnitGrace, setEditUnitGrace] = useState('0')
  const [savingUnit, setSavingUnit] = useState(false)
  const [editUnitError, setEditUnitError] = useState<string | null>(null)

  // Tenant management modal
  const [manageTenantUnit, setManageTenantUnit] = useState<RentUnit | null>(null)
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

  // Unit QR modal
  const [activeQrUnit, setActiveQrUnit] = useState<RentUnit | null>(null)

  // Property settings form
  const [propName, setPropName] = useState('')
  const [propAddress, setPropAddress] = useState('')
  const [propCity, setPropCity] = useState('')
  const [propOwnerName, setPropOwnerName] = useState('')
  const [propOwnerMomo, setPropOwnerMomo] = useState('')
  const [propTimezone, setPropTimezone] = useState('Africa/Kampala')
  const [propPartial, setPropPartial] = useState(true)
  const [propMinPayment, setPropMinPayment] = useState('0')
  const [savingProp, setSavingProp] = useState(false)
  const [propSaveError, setPropSaveError] = useState<string | null>(null)
  const [propSaveOk, setPropSaveOk] = useState(false)

  // Access form
  const [grantEmail, setGrantEmail] = useState('')
  const [grantRole, setGrantRole] = useState('MANAGER')
  const [grantingAccess, setGrantingAccess] = useState(false)
  const [grantError, setGrantError] = useState<string | null>(null)
  const [grantOk, setGrantOk] = useState(false)

  const seededRef = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const d = await rentDashboardApi.getPropertyDashboard(propertyId, period)
      setDashboard(d)
      if (!seededRef.current) {
        setPropName(d.property.name)
        setPropAddress(d.property.address)
        setPropCity(d.property.city)
        setPropOwnerName(d.property.ownerName)
        setPropOwnerMomo(d.property.ownerMomo)
        setPropTimezone(d.property.timezone)
        setPropPartial(d.property.partialPaymentAllowed)
        setPropMinPayment(String(d.property.minPaymentAmount))
        seededRef.current = true
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load property')
    } finally {
      setLoading(false)
    }
  }, [propertyId, period])

  useEffect(() => {
    void load()
  }, [load])

  const currency = dashboard?.property.currency ?? 'UGX'

  async function handleGenerateCharges() {
    try {
      await rentDashboardApi.generateCharges(propertyId, { periodLabel: period })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate charges')
    }
  }

  async function handleGenerateSingle(unitId: string) {
    try {
      await rentDashboardApi.generateChargeForUnit(propertyId, unitId, { periodLabel: period })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate charge')
    }
  }

  async function handleRegeneratePropertyQr() {
    if (!window.confirm('Regenerate the property QR token? Previously printed QR codes will stop working.')) return
    try {
      await rentDashboardApi.regeneratePropertyQrToken(propertyId)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate QR')
    }
  }

  async function handleRegenerateUnitQr(unitId: string) {
    if (!window.confirm('Regenerate this unit\'s QR token? Previously printed door stickers will stop working.')) return
    try {
      const updated = await rentDashboardApi.regenerateUnitQrToken(propertyId, unitId)
      setActiveQrUnit(updated)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate QR')
    }
  }

  async function handleRegenerateTenantToken(unitId: string, tenantId: string) {
    if (!window.confirm('Regenerate the tenant\'s pay token? Their old pay link will stop working.')) return
    try {
      await rentDashboardApi.regenerateTenantPayToken(propertyId, unitId, tenantId)
      setActiveQrUnit(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate token')
    }
  }

  async function handleAddUnit(e: FormEvent) {
    e.preventDefault()
    setAddUnitError(null)
    if (!addUnitNum.trim()) {
      setAddUnitError('Unit number is required')
      return
    }
    const monthly = Number(addUnitAmount)
    if (!addUnitAmount || Number.isNaN(monthly)) {
      setAddUnitError('Monthly amount is required')
      return
    }
    setAddingUnit(true)
    try {
      const created = await rentDashboardApi.addUnit(propertyId, {
        unitNumber: addUnitNum.trim(),
        floor: addUnitFloor.trim() || undefined,
        monthlyAmount: monthly,
        depositAmount: addUnitDeposit ? Number(addUnitDeposit) : undefined,
        dueDayOfMonth: Number(addUnitDueDay) || 5,
        gracePeriodDays: Number(addUnitGrace) || 0,
      })
      setAddUnitNum('')
      setAddUnitFloor('')
      setAddUnitAmount('')
      setAddUnitDeposit('')
      setAddUnitDueDay('5')
      setAddUnitGrace('0')
      setShowAddUnit(false)
      await load()
      // Immediately show the unit QR that was generated on create
      if (created?.qrCodeUrl) setActiveQrUnit(created)
    } catch (err) {
      setAddUnitError(err instanceof Error ? err.message : 'Could not add unit')
    } finally {
      setAddingUnit(false)
    }
  }

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
    setEditUnitError(null)
    const monthly = Number(editUnitAmount)
    if (Number.isNaN(monthly)) {
      setEditUnitError('Monthly amount must be a number')
      return
    }
    setSavingUnit(true)
    try {
      await rentDashboardApi.updateUnit(propertyId, editUnit.id, {
        unitNumber: editUnitNum.trim(),
        floor: editUnitFloor.trim() || undefined,
        monthlyAmount: monthly,
        depositAmount: editUnitDeposit ? Number(editUnitDeposit) : 0,
        dueDayOfMonth: Number(editUnitDueDay) || 5,
        gracePeriodDays: Number(editUnitGrace) || 0,
      })
      setEditUnit(null)
      await load()
    } catch (err) {
      setEditUnitError(err instanceof Error ? err.message : 'Could not save unit')
    } finally {
      setSavingUnit(false)
    }
  }

  function openManageTenant(unit: RentUnit) {
    setManageTenantUnit(unit)
    setTenantPanel(unit.activeTenant ? 'view' : 'add')
    setTenantName('')
    setTenantPhone('')
    setTenantEmail('')
    setTenantMoveIn('')
    setTenantLeaseEnd('')
    setTenantOpError(null)
  }

  async function handleAddTenant(e: FormEvent) {
    e.preventDefault()
    if (!manageTenantUnit) return
    setTenantOpError(null)
    if (!tenantName.trim() || !tenantPhone.trim()) {
      setTenantOpError('Name and phone are required')
      return
    }
    setTenantOpBusy(true)
    try {
      await rentDashboardApi.addTenant(propertyId, manageTenantUnit.id, {
        name: tenantName.trim(),
        phone: tenantPhone.trim(),
        email: tenantEmail.trim() || undefined,
        moveInDate: tenantMoveIn || undefined,
        leaseEnd: tenantLeaseEnd || undefined,
      })
      setManageTenantUnit(null)
      await load()
    } catch (err) {
      setTenantOpError(err instanceof Error ? err.message : 'Could not add tenant')
    } finally {
      setTenantOpBusy(false)
    }
  }

  function openEditTenant(tenant: TenantSummary) {
    setEditTenantPhone(tenant.phone)
    setEditTenantEmail(tenant.email)
    setEditTenantLeaseEnd(tenant.leaseEnd ? tenant.leaseEnd.slice(0, 10) : '')
    setTenantPanel('edit')
    setTenantOpError(null)
  }

  async function handleUpdateTenant(e: FormEvent) {
    e.preventDefault()
    if (!manageTenantUnit?.activeTenant) return
    setTenantOpError(null)
    setTenantOpBusy(true)
    try {
      await rentDashboardApi.updateTenant(propertyId, manageTenantUnit.id, manageTenantUnit.activeTenant.id, {
        phone: editTenantPhone.trim() || undefined,
        email: editTenantEmail.trim() || undefined,
        leaseEnd: editTenantLeaseEnd || '',
      })
      setTenantPanel('view')
      await load()
    } catch (err) {
      setTenantOpError(err instanceof Error ? err.message : 'Could not update tenant')
    } finally {
      setTenantOpBusy(false)
    }
  }

  async function handleDeactivateTenant(unitId: string, tenantId: string) {
    if (!window.confirm('Deactivate this tenant? They will no longer be able to pay via their link.')) return
    setTenantOpBusy(true)
    try {
      await rentDashboardApi.deactivateTenant(propertyId, unitId, tenantId)
      setManageTenantUnit(null)
      await load()
    } catch (err) {
      setTenantOpError(err instanceof Error ? err.message : 'Could not deactivate tenant')
    } finally {
      setTenantOpBusy(false)
    }
  }

  async function handleSaveProperty(e: FormEvent) {
    e.preventDefault()
    setPropSaveError(null)
    setPropSaveOk(false)
    setSavingProp(true)
    try {
      await rentDashboardApi.updateProperty(propertyId, {
        name: propName.trim(),
        address: propAddress.trim(),
        city: propCity.trim(),
        ownerName: propOwnerName.trim(),
        ownerMomo: propOwnerMomo.trim(),
        timezone: propTimezone.trim(),
        partialPaymentAllowed: propPartial,
        minPaymentAmount: Number(propMinPayment) || 0,
      })
      setPropSaveOk(true)
      await load()
    } catch (err) {
      setPropSaveError(err instanceof Error ? err.message : 'Could not save property')
    } finally {
      setSavingProp(false)
    }
  }

  async function handleGrantAccess(e: FormEvent) {
    e.preventDefault()
    setGrantError(null)
    setGrantOk(false)
    if (!grantEmail.trim()) {
      setGrantError('Email is required')
      return
    }
    setGrantingAccess(true)
    try {
      await rentDashboardApi.grantAccess(propertyId, grantEmail.trim(), grantRole)
      setGrantEmail('')
      setGrantOk(true)
      await load()
    } catch (err) {
      setGrantError(err instanceof Error ? err.message : 'Could not grant access')
    } finally {
      setGrantingAccess(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading && !dashboard) {
    return (
      <div className="scanny-page" style={{ padding: '16px 12px 60px' }}>
        <button type="button" onClick={onBack} className="scanny-back">
          ← Portfolio
        </button>
        <p style={{ padding: 40, color: 'var(--muted-foreground)', textAlign: 'center' }}>Loading property…</p>
      </div>
    )
  }

  if (error && !dashboard) {
    return (
      <div className="scanny-page" style={{ padding: '16px 12px 60px' }}>
        <button type="button" onClick={onBack} className="scanny-back">
          ← Portfolio
        </button>
        <p className="scanny-error" style={{ padding: 16 }}>
          {error}
        </p>
      </div>
    )
  }

  const d = dashboard!
  const tabs: { key: 'units' | 'settings' | 'access'; label: string }[] = [
    { key: 'units', label: 'Units' },
    ...(canManage ? [{ key: 'settings' as const, label: 'Settings' }] : []),
    ...(canManage ? [{ key: 'access' as const, label: 'Access' }] : []),
  ]

  return (
    <div className="scanny-page" style={{ padding: '16px 12px 60px' }}>
      <button type="button" onClick={onBack} className="scanny-back">
        ← Portfolio
      </button>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 10,
            background: 'var(--muted)',
            color: 'var(--muted-foreground)',
          }}
        >
          {role}
        </span>
        <h1 style={{ margin: '8px 0 2px', fontSize: 22, fontWeight: 800 }}>{d.property.name}</h1>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>
          {[d.property.address, d.property.city].filter(Boolean).join(', ')}
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: '10px 16px',
              fontSize: 14,
              fontWeight: 700,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === t.key ? 'var(--primary)' : 'var(--muted-foreground)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="scanny-error" style={{ marginBottom: 16 }}>
          {error}
        </p>
      )}

      {/* ── Units tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'units' && (
        <div>
          {/* Period controls */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              Period
              <input
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                style={{ ...fieldInputStyle, width: 'auto', padding: '6px 8px' }}
              />
            </label>
            {canManage && (
              <button type="button" onClick={handleGenerateCharges} style={btnPrimaryStyle}>
                Generate all charges
              </button>
            )}
            <button
              type="button"
              onClick={() => rentDashboardApi.triggerCsvExport(propertyId, period)}
              style={btnSecondaryStyle}
            >
              Export CSV
            </button>
          </div>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 20 }}>
            <Stat label="Units" value={d.totalUnits} />
            <Stat label="Occupied" value={d.occupiedUnits} />
            <Stat label="Paid" value={d.paidThisPeriod} color="var(--primary)" />
            <Stat label="Unpaid" value={d.unpaidThisPeriod} />
            <Stat label="Overdue" value={d.overdueCount} color="var(--destructive)" />
            <Stat label="Collected" value={money(d.totalCollectedThisPeriod, currency)} />
          </div>

          {/* Property QR near the top so it is visible without scrolling past the unit table */}
          <section
            style={{
              marginBottom: 20,
              padding: 16,
              border: '1px solid var(--border)',
              borderRadius: 12,
              background: 'var(--card)',
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>Property QR</h3>
            <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--muted-foreground)' }}>
              Building entrance QR — tenants scan, pick their unit, then pay or view activity.
            </p>
            <QRCodePanel
              url={d.property.qrCodeUrl}
              label={d.property.name}
              sublabel="Shows all units on this property"
              defaultExpanded
              size={160}
            />
            {canManage && (
              <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                <button type="button" onClick={handleRegeneratePropertyQr} style={btnSecondaryStyle}>
                  Regenerate QR
                </button>
                <button
                  type="button"
                  onClick={() => rentDashboardApi.downloadBulkQrPdf(propertyId, d.property.name)}
                  style={btnSecondaryStyle}
                >
                  Download bulk QR PDF
                </button>
              </div>
            )}
          </section>

          {/* Units table */}
          <div className="overflow-hidden rounded-xl border border-border bg-card" style={{ marginBottom: 16 }}>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border">
                  <TableHead className="pl-5 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Unit</TableHead>
                  <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Tenant</TableHead>
                  <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Monthly</TableHead>
                  <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Status</TableHead>
                  <TableHead className="pr-5 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Pay link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.units.map((row) => (
                  <UnitRow
                    key={row.unit.id}
                    row={row}
                    currency={currency}
                    canManage={canManage}
                    onGenerateCharge={handleGenerateSingle}
                    onShowQr={setActiveQrUnit}
                    onEditUnit={openEditUnit}
                    onManageTenant={openManageTenant}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Add unit inline form */}
          {canManage && (
            <div style={{ marginBottom: 20 }}>
              {!showAddUnit ? (
                <button type="button" onClick={() => setShowAddUnit(true)} style={btnSecondaryStyle}>
                  <Plus size={16} /> Add unit
                </button>
              ) : (
                <form
                  onSubmit={handleAddUnit}
                  style={{
                    display: 'grid',
                    gap: 10,
                    padding: 16,
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    background: 'var(--card)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 14 }}>Add unit</strong>
                    <button
                      type="button"
                      onClick={() => setShowAddUnit(false)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)' }}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label style={{ display: 'grid' }}>
                      <span style={fieldLabelStyle}>Unit number *</span>
                      <input className="scanny-input" value={addUnitNum} onChange={(e) => setAddUnitNum(e.target.value)} style={fieldInputStyle} placeholder="A1" disabled={addingUnit} />
                    </label>
                    <label style={{ display: 'grid' }}>
                      <span style={fieldLabelStyle}>Floor</span>
                      <input className="scanny-input" value={addUnitFloor} onChange={(e) => setAddUnitFloor(e.target.value)} style={fieldInputStyle} placeholder="Ground" disabled={addingUnit} />
                    </label>
                    <label style={{ display: 'grid' }}>
                      <span style={fieldLabelStyle}>Monthly amount *</span>
                      <input className="scanny-input" type="number" value={addUnitAmount} onChange={(e) => setAddUnitAmount(e.target.value)} style={fieldInputStyle} placeholder="500000" disabled={addingUnit} />
                    </label>
                    <label style={{ display: 'grid' }}>
                      <span style={fieldLabelStyle}>Deposit</span>
                      <input className="scanny-input" type="number" value={addUnitDeposit} onChange={(e) => setAddUnitDeposit(e.target.value)} style={fieldInputStyle} placeholder="0" disabled={addingUnit} />
                    </label>
                    <label style={{ display: 'grid' }}>
                      <span style={fieldLabelStyle}>Due day</span>
                      <input className="scanny-input" type="number" value={addUnitDueDay} onChange={(e) => setAddUnitDueDay(e.target.value)} style={fieldInputStyle} disabled={addingUnit} />
                    </label>
                    <label style={{ display: 'grid' }}>
                      <span style={fieldLabelStyle}>Grace (days)</span>
                      <input className="scanny-input" type="number" value={addUnitGrace} onChange={(e) => setAddUnitGrace(e.target.value)} style={fieldInputStyle} disabled={addingUnit} />
                    </label>
                  </div>
                  {addUnitError && <p className="scanny-error" style={{ fontSize: 13 }}>{addUnitError}</p>}
                  <button type="submit" disabled={addingUnit} style={btnPrimaryStyle}>
                    {addingUnit ? 'Adding…' : 'Add unit'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Recent payments */}
          {d.recentPayments.length > 0 && (
            <section style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>Recent payments</h3>
              <div style={{ display: 'grid', gap: 6 }}>
                {d.recentPayments.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '10px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      background: 'var(--card)',
                      fontSize: 13,
                    }}
                  >
                    <span style={{ fontFamily: 'ui-monospace, monospace' }}>{p.transactionRef}</span>
                    <span>{money(p.amount, currency)} · {p.status}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>
      )}

      {/* ── Settings tab ──────────────────────────────────────────────────── */}
      {activeTab === 'settings' && canManage && (
        <form onSubmit={handleSaveProperty} style={{ display: 'grid', gap: 14, maxWidth: 560 }}>
          <label style={{ display: 'grid' }}>
            <span style={fieldLabelStyle}>Property name</span>
            <input className="scanny-input" value={propName} onChange={(e) => setPropName(e.target.value)} style={fieldInputStyle} disabled={savingProp} />
          </label>
          <label style={{ display: 'grid' }}>
            <span style={fieldLabelStyle}>Address</span>
            <input className="scanny-input" value={propAddress} onChange={(e) => setPropAddress(e.target.value)} style={fieldInputStyle} disabled={savingProp} />
          </label>
          <label style={{ display: 'grid' }}>
            <span style={fieldLabelStyle}>City</span>
            <input className="scanny-input" value={propCity} onChange={(e) => setPropCity(e.target.value)} style={fieldInputStyle} disabled={savingProp} />
          </label>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 600 }}>
            Owner details
          </div>
          <label style={{ display: 'grid' }}>
            <span style={fieldLabelStyle}>Owner name</span>
            <input className="scanny-input" value={propOwnerName} onChange={(e) => setPropOwnerName(e.target.value)} style={fieldInputStyle} disabled={savingProp} />
          </label>
          <label style={{ display: 'grid' }}>
            <span style={fieldLabelStyle}>Owner MoMo number</span>
            <input className="scanny-input" value={propOwnerMomo} onChange={(e) => setPropOwnerMomo(e.target.value)} style={fieldInputStyle} disabled={savingProp} />
          </label>
          <label style={{ display: 'grid' }}>
            <span style={fieldLabelStyle}>Timezone</span>
            <input className="scanny-input" value={propTimezone} onChange={(e) => setPropTimezone(e.target.value)} style={fieldInputStyle} disabled={savingProp} />
          </label>
          <label style={{ display: 'grid' }}>
            <span style={fieldLabelStyle}>Min payment amount</span>
            <input className="scanny-input" type="number" value={propMinPayment} onChange={(e) => setPropMinPayment(e.target.value)} style={fieldInputStyle} disabled={savingProp} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={propPartial} onChange={(e) => setPropPartial(e.target.checked)} disabled={savingProp} />
            <span style={{ fontSize: 14 }}>Allow partial payments</span>
          </label>
          {propSaveError && <p className="scanny-error">{propSaveError}</p>}
          {propSaveOk && <p className="scanny-hint scanny-hint-ok">Saved.</p>}
          <button type="submit" disabled={savingProp} style={btnPrimaryStyle}>
            {savingProp ? 'Saving…' : 'Save settings'}
          </button>
        </form>
      )}

      {/* ── Access tab ────────────────────────────────────────────────────── */}
      {activeTab === 'access' && canManage && (
        <div style={{ maxWidth: 560 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px' }}>People with access</h3>
          <div style={{ display: 'grid', gap: 8, marginBottom: 24 }}>
            {d.accessList.length === 0 && (
              <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>No other accounts have access.</p>
            )}
            {d.accessList.map((a) => (
              <div
                key={a.accountId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  background: 'var(--card)',
                  fontSize: 13,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{a.accountName}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{a.accountEmail}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                  {a.role}
                </span>
              </div>
            ))}
          </div>

          <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px' }}>Grant access</h3>
          <form onSubmit={handleGrantAccess} style={{ display: 'grid', gap: 10 }}>
            <label style={{ display: 'grid' }}>
              <span style={fieldLabelStyle}>Email</span>
              <input className="scanny-input" type="email" value={grantEmail} onChange={(e) => setGrantEmail(e.target.value)} style={fieldInputStyle} placeholder="manager@email.com" disabled={grantingAccess} />
            </label>
            <label style={{ display: 'grid' }}>
              <span style={fieldLabelStyle}>Role</span>
              <select className="scanny-select" value={grantRole} onChange={(e) => setGrantRole(e.target.value)} style={fieldInputStyle} disabled={grantingAccess}>
                <option value="MANAGER">Manager</option>
                <option value="OWNER_MANAGER">Owner manager</option>
                <option value="OWNER">Owner</option>
              </select>
            </label>
            {grantError && <p className="scanny-error">{grantError}</p>}
            {grantOk && <p className="scanny-hint scanny-hint-ok">Access granted.</p>}
            <button type="submit" disabled={grantingAccess} style={btnPrimaryStyle}>
              {grantingAccess ? 'Granting…' : 'Grant access'}
            </button>
          </form>
        </div>
      )}

      {/* ── Edit unit modal ─────────────────────────────────────────────── */}
      {editUnit && (
        <div
          onClick={() => setEditUnit(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 420,
              background: 'var(--card)',
              borderRadius: 16,
              padding: '24px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Edit unit {editUnit.unitNumber}</h2>
              <button type="button" onClick={() => setEditUnit(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveUnit} style={{ display: 'grid', gap: 12 }} noValidate>
              <label style={{ display: 'grid' }}>
                <span style={fieldLabelStyle}>Unit number</span>
                <input className="scanny-input" value={editUnitNum} onChange={(e) => setEditUnitNum(e.target.value)} style={fieldInputStyle} disabled={savingUnit} />
              </label>
              <label style={{ display: 'grid' }}>
                <span style={fieldLabelStyle}>Floor</span>
                <input className="scanny-input" value={editUnitFloor} onChange={(e) => setEditUnitFloor(e.target.value)} style={fieldInputStyle} disabled={savingUnit} />
              </label>
              <label style={{ display: 'grid' }}>
                <span style={fieldLabelStyle}>Monthly amount</span>
                <input className="scanny-input" type="number" value={editUnitAmount} onChange={(e) => setEditUnitAmount(e.target.value)} style={fieldInputStyle} disabled={savingUnit} />
              </label>
              <label style={{ display: 'grid' }}>
                <span style={fieldLabelStyle}>Deposit</span>
                <input className="scanny-input" type="number" value={editUnitDeposit} onChange={(e) => setEditUnitDeposit(e.target.value)} style={fieldInputStyle} disabled={savingUnit} />
              </label>
              <label style={{ display: 'grid' }}>
                <span style={fieldLabelStyle}>Due day of month</span>
                <input className="scanny-input" type="number" value={editUnitDueDay} onChange={(e) => setEditUnitDueDay(e.target.value)} style={fieldInputStyle} disabled={savingUnit} />
              </label>
              <label style={{ display: 'grid' }}>
                <span style={fieldLabelStyle}>Grace period (days)</span>
                <input className="scanny-input" type="number" value={editUnitGrace} onChange={(e) => setEditUnitGrace(e.target.value)} style={fieldInputStyle} disabled={savingUnit} />
              </label>
              {editUnitError && <p className="scanny-error">{editUnitError}</p>}
              <button type="submit" disabled={savingUnit} style={btnPrimaryStyle}>
                {savingUnit ? 'Saving…' : 'Save unit'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Tenant management modal ──────────────────────────────────────── */}
      {manageTenantUnit && (
        <div
          onClick={() => setManageTenantUnit(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 440,
              background: 'var(--card)',
              borderRadius: 16,
              padding: '24px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                {tenantPanel === 'view' ? 'Tenant' : tenantPanel === 'add' ? 'Add tenant' : 'Edit tenant'} — Unit {manageTenantUnit.unitNumber}
              </h2>
              <button type="button" onClick={() => setManageTenantUnit(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)' }}>
                <X size={20} />
              </button>
            </div>

            {tenantOpError && <p className="scanny-error" style={{ marginBottom: 12 }}>{tenantOpError}</p>}

            {/* View panel */}
            {tenantPanel === 'view' && manageTenantUnit.activeTenant && (
              <div style={{ display: 'grid', gap: 10 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>Name</p>
                  <p style={{ margin: '2px 0 0', fontWeight: 600 }}>{manageTenantUnit.activeTenant.name}</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>Phone</p>
                  <p style={{ margin: '2px 0 0' }}>{manageTenantUnit.activeTenant.phone}</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>Email</p>
                  <p style={{ margin: '2px 0 0' }}>{manageTenantUnit.activeTenant.email || '—'}</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>Move-in</p>
                  <p style={{ margin: '2px 0 0' }}>{manageTenantUnit.activeTenant.moveInDate ? manageTenantUnit.activeTenant.moveInDate.slice(0, 10) : '—'}</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>Lease end</p>
                  <p style={{ margin: '2px 0 0' }}>{manageTenantUnit.activeTenant.leaseEnd ? manageTenantUnit.activeTenant.leaseEnd.slice(0, 10) : 'Open-ended'}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => openEditTenant(manageTenantUnit.activeTenant!)} style={btnSecondaryStyle}>
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={tenantOpBusy}
                    onClick={() => handleDeactivateTenant(manageTenantUnit.id, manageTenantUnit.activeTenant!.id)}
                    style={{ ...btnSecondaryStyle, color: 'var(--destructive)', borderColor: 'var(--destructive)' }}
                  >
                    Deactivate
                  </button>
                  <button
                    type="button"
                    disabled={tenantOpBusy}
                    onClick={() => handleRegenerateTenantToken(manageTenantUnit.id, manageTenantUnit.activeTenant!.id)}
                    style={btnSecondaryStyle}
                  >
                    Regenerate pay token
                  </button>
                </div>
              </div>
            )}

            {/* Add panel */}
            {tenantPanel === 'add' && (
              <form onSubmit={handleAddTenant} style={{ display: 'grid', gap: 12 }} noValidate>
                <label style={{ display: 'grid' }}>
                  <span style={fieldLabelStyle}>Name *</span>
                  <input className="scanny-input" value={tenantName} onChange={(e) => setTenantName(e.target.value)} style={fieldInputStyle} disabled={tenantOpBusy} />
                </label>
                <label style={{ display: 'grid' }}>
                  <span style={fieldLabelStyle}>Phone *</span>
                  <input className="scanny-input" type="tel" value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)} style={fieldInputStyle} disabled={tenantOpBusy} />
                </label>
                <label style={{ display: 'grid' }}>
                  <span style={fieldLabelStyle}>Email</span>
                  <input className="scanny-input" type="email" value={tenantEmail} onChange={(e) => setTenantEmail(e.target.value)} style={fieldInputStyle} disabled={tenantOpBusy} />
                </label>
                <label style={{ display: 'grid' }}>
                  <span style={fieldLabelStyle}>Move-in date</span>
                  <input className="scanny-input" type="date" value={tenantMoveIn} onChange={(e) => setTenantMoveIn(e.target.value)} style={fieldInputStyle} disabled={tenantOpBusy} />
                </label>
                <label style={{ display: 'grid' }}>
                  <span style={fieldLabelStyle}>Lease end</span>
                  <input className="scanny-input" type="date" value={tenantLeaseEnd} onChange={(e) => setTenantLeaseEnd(e.target.value)} style={fieldInputStyle} disabled={tenantOpBusy} />
                </label>
                <button type="submit" disabled={tenantOpBusy} style={btnPrimaryStyle}>
                  {tenantOpBusy ? 'Adding…' : 'Add tenant'}
                </button>
              </form>
            )}

            {/* Edit panel */}
            {tenantPanel === 'edit' && (
              <form onSubmit={handleUpdateTenant} style={{ display: 'grid', gap: 12 }} noValidate>
                <label style={{ display: 'grid' }}>
                  <span style={fieldLabelStyle}>Phone</span>
                  <input className="scanny-input" type="tel" value={editTenantPhone} onChange={(e) => setEditTenantPhone(e.target.value)} style={fieldInputStyle} disabled={tenantOpBusy} />
                </label>
                <label style={{ display: 'grid' }}>
                  <span style={fieldLabelStyle}>Email</span>
                  <input className="scanny-input" type="email" value={editTenantEmail} onChange={(e) => setEditTenantEmail(e.target.value)} style={fieldInputStyle} disabled={tenantOpBusy} />
                </label>
                <label style={{ display: 'grid' }}>
                  <span style={fieldLabelStyle}>Lease end</span>
                  <input className="scanny-input" type="date" value={editTenantLeaseEnd} onChange={(e) => setEditTenantLeaseEnd(e.target.value)} style={fieldInputStyle} disabled={tenantOpBusy} />
                </label>
                <button type="submit" disabled={tenantOpBusy} style={btnPrimaryStyle}>
                  {tenantOpBusy ? 'Saving…' : 'Save tenant'}
                </button>
                <button type="button" onClick={() => setTenantPanel('view')} style={btnSecondaryStyle}>
                  Back
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Unit QR modal ────────────────────────────────────────────────── */}
      {activeQrUnit && (
        <div
          onClick={() => setActiveQrUnit(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 420,
              background: 'var(--card)',
              borderRadius: 16,
              padding: '24px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>QR — Unit {activeQrUnit.unitNumber}</h2>
              <button type="button" onClick={() => setActiveQrUnit(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)' }}>
                <X size={20} />
              </button>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--muted-foreground)' }}>
              Give this QR to the tenant — they can view activity and pay rent for this unit.
            </p>
            <QRCodePanel
              url={activeQrUnit.qrCodeUrl ?? ''}
              label={`Unit ${activeQrUnit.unitNumber}`}
              sublabel={activeQrUnit.activeTenant?.name ?? 'Door sticker / tenant QR'}
              defaultExpanded
            />
            {canManage && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => handleRegenerateUnitQr(activeQrUnit.id)} style={btnSecondaryStyle}>
                  Regenerate unit QR
                </button>
                <button
                  type="button"
                  onClick={() => rentDashboardApi.downloadUnitQr(propertyId, activeQrUnit.id, activeQrUnit.unitNumber)}
                  style={btnSecondaryStyle}
                >
                  Download QR
                </button>
                {activeQrUnit.activeTenant && (
                  <button
                    type="button"
                    onClick={() => handleRegenerateTenantToken(activeQrUnit.id, activeQrUnit.activeTenant!.id)}
                    style={btnSecondaryStyle}
                  >
                    Regenerate tenant token
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── PortfolioList ──────────────────────────────────────────────────────────────

function PortfolioList({
  portfolio,
  onSelect,
  onAddProperty,
}: {
  portfolio: PortfolioEntry[]
  onSelect: (id: string, role: string) => void
  onAddProperty: () => void
}) {
  if (portfolio.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted-foreground)' }}>
        <Building2 size={36} style={{ opacity: 0.3, marginBottom: 12 }} />
        <p style={{ marginTop: 0, fontSize: 14 }}>No properties yet.</p>
        <button type="button" onClick={onAddProperty} style={{ marginTop: 16, padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'var(--primary-foreground)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
          Add property
        </button>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Properties</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted-foreground)' }}>{portfolio.length} {portfolio.length === 1 ? 'property' : 'properties'}</p>
        </div>
        <button type="button" onClick={onAddProperty} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'var(--primary-foreground)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> Add property
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border">
              <TableHead className="pl-5 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Property</TableHead>
              <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">City</TableHead>
              <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Units</TableHead>
              <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Occupied</TableHead>
              <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Collected</TableHead>
              <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Overdue</TableHead>
              <TableHead className="pr-5 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {portfolio.map((p) => (
              <TableRow
                key={p.propertyId}
                className="border-b border-border hover:bg-muted/40 cursor-pointer"
                onClick={() => onSelect(p.propertyId, p.role)}
              >
                <TableCell className="pl-5 py-3">
                  <p className="text-sm font-medium text-foreground">{p.propertyName}</p>
                </TableCell>
                <TableCell className="text-sm text-foreground">{p.city || <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-sm text-foreground">{p.totalUnits}</TableCell>
                <TableCell className="text-sm text-foreground">{p.occupiedUnits}</TableCell>
                <TableCell className="text-sm font-mono font-medium text-foreground">{p.totalCollectedThisMonth > 0 ? money(p.totalCollectedThisMonth, p.currency) : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>
                  {p.overdueCount > 0
                    ? <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', background: '#dc262618', border: '1px solid #dc262633', borderRadius: 5, padding: '2px 7px' }}>! {p.overdueCount}</span>
                    : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="pr-5">
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', background: 'var(--muted)', borderRadius: 5, padding: '2px 7px' }}>{p.role}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ── AddUnitModal (used by the overview "Add unit" actions) ────────────────────

function AddUnitModal({ propertyId, onClose, onCreated }: { propertyId: string; onClose: () => void; onCreated: () => void }) {
  const [unitNumber, setUnitNumber] = useState('')
  const [floor, setFloor] = useState('')
  const [monthlyAmount, setMonthlyAmount] = useState('')
  const [depositAmount, setDepositAmount] = useState('')
  const [dueDayOfMonth, setDueDayOfMonth] = useState('5')
  const [gracePeriodDays, setGracePeriodDays] = useState('0')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!unitNumber.trim()) {
      setError('Unit number is required')
      return
    }
    const monthly = Number(monthlyAmount)
    if (!monthlyAmount || Number.isNaN(monthly)) {
      setError('Monthly amount is required')
      return
    }
    setSaving(true)
    try {
      const created = await rentDashboardApi.addUnit(propertyId, {
        unitNumber: unitNumber.trim(),
        floor: floor.trim() || undefined,
        monthlyAmount: monthly,
        depositAmount: depositAmount ? Number(depositAmount) : undefined,
        dueDayOfMonth: Number(dueDayOfMonth) || 5,
        gracePeriodDays: Number(gracePeriodDays) || 0,
      })
      onCreated(created)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add unit')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'var(--card)',
          borderRadius: 16,
          padding: '24px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Add unit</h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)' }}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }} noValidate>
          <label style={{ display: 'grid' }}>
            <span style={fieldLabelStyle}>Unit number *</span>
            <input className="scanny-input" value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} style={fieldInputStyle} disabled={saving} placeholder="A1" />
          </label>
          <label style={{ display: 'grid' }}>
            <span style={fieldLabelStyle}>Floor</span>
            <input className="scanny-input" value={floor} onChange={(e) => setFloor(e.target.value)} style={fieldInputStyle} disabled={saving} placeholder="Ground" />
          </label>
          <label style={{ display: 'grid' }}>
            <span style={fieldLabelStyle}>Monthly amount *</span>
            <input className="scanny-input" type="number" value={monthlyAmount} onChange={(e) => setMonthlyAmount(e.target.value)} style={fieldInputStyle} disabled={saving} placeholder="500000" />
          </label>
          <label style={{ display: 'grid' }}>
            <span style={fieldLabelStyle}>Deposit</span>
            <input className="scanny-input" type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} style={fieldInputStyle} disabled={saving} placeholder="0" />
          </label>
          <label style={{ display: 'grid' }}>
            <span style={fieldLabelStyle}>Due day of month</span>
            <input className="scanny-input" type="number" value={dueDayOfMonth} onChange={(e) => setDueDayOfMonth(e.target.value)} style={fieldInputStyle} disabled={saving} />
          </label>
          <label style={{ display: 'grid' }}>
            <span style={fieldLabelStyle}>Grace period (days)</span>
            <input className="scanny-input" type="number" value={gracePeriodDays} onChange={(e) => setGracePeriodDays(e.target.value)} style={fieldInputStyle} disabled={saving} />
          </label>
          {error && <p className="scanny-error">{error}</p>}
          <button type="submit" disabled={saving} style={btnPrimaryStyle}>
            {saving ? 'Adding…' : 'Add unit'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── UnitSheet (overview slide-over) ────────────────────────────────────────────

function UnitSheet({
  row,
  propertyId,
  currency,
  onClose,
  onChanged,
}: {
  row: UnitDashboardRow
  propertyId: string
  currency: string
  onClose: () => void
  onChanged: () => void
}) {
  const { unit, currentCharge } = row
  const tenant = unit.activeTenant
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Add tenant form
  const [showAdd, setShowAdd] = useState(false)
  const [tName, setTName] = useState('')
  const [tPhone, setTPphone] = useState('')
  const [tEmail, setTEmail] = useState('')
  const [tMoveIn, setTMoveIn] = useState('')
  const [tLeaseEnd, setTLeaseEnd] = useState('')

  async function markPaid() {
    if (!currentCharge) return
    setBusy(true)
    setErr(null)
    try {
      await rentDashboardApi.updateChargeStatus(propertyId, currentCharge.id, 'PAID')
      onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not mark paid')
    } finally {
      setBusy(false)
    }
  }

  async function generateCharge() {
    setBusy(true)
    setErr(null)
    try {
      await rentDashboardApi.generateChargeForUnit(propertyId, unit.id, {
        periodLabel: currentPeriod(),
      })
      onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not generate charge')
    } finally {
      setBusy(false)
    }
  }

  async function addTenant(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!tName.trim() || !tPhone.trim()) {
      setErr('Name and phone are required')
      return
    }
    setBusy(true)
    try {
      await rentDashboardApi.addTenant(propertyId, unit.id, {
        name: tName.trim(),
        phone: tPhone.trim(),
        email: tEmail.trim() || undefined,
        moveInDate: tMoveIn || undefined,
        leaseEnd: tLeaseEnd || undefined,
      })
      onChanged()
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Could not add tenant')
    } finally {
      setBusy(false)
    }
  }

  async function removeTenant() {
    if (!tenant) return
    if (!window.confirm('Deactivate this tenant?')) return
    setBusy(true)
    setErr(null)
    try {
      await rentDashboardApi.deactivateTenant(propertyId, unit.id, tenant.id)
      onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not deactivate tenant')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.35)' }}
      />
      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: 380,
          zIndex: 1101,
          background: 'var(--card)',
          boxShadow: '-12px 0 40px rgba(0,0,0,0.15)',
          overflowY: 'auto',
          padding: '20px 22px 40px',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Unit {unit.unitNumber}</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>{unit.floor || 'No floor'}</p>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)' }}>
            <X size={20} />
          </button>
        </div>

        {err && <p className="scanny-error" style={{ marginBottom: 12, fontSize: 13 }}>{err}</p>}

        {/* Tenant block */}
        <section style={{ borderBottom: '1px solid var(--border)', paddingBottom: 14, marginBottom: 14 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tenant</p>
          {tenant ? (
            <div style={{ marginTop: 6 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{tenant.name}</p>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted-foreground)' }}>{tenant.phone}</p>
              {tenant.email && <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted-foreground)' }}>{tenant.email}</p>}
              <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: 'var(--muted-foreground)' }}>
                {tenant.moveInDate && <span>Move-in {tenant.moveInDate.slice(0, 10)}</span>}
                {tenant.leaseEnd && <span>Lease ends {tenant.leaseEnd.slice(0, 10)}</span>}
              </div>
              <button type="button" disabled={busy} onClick={removeTenant} style={{ ...btnSecondaryStyle, marginTop: 10, color: 'var(--destructive)', borderColor: 'var(--destructive)', padding: '6px 12px' }}>
                Remove tenant
              </button>
            </div>
          ) : showAdd ? (
            <form onSubmit={addTenant} style={{ marginTop: 8, display: 'grid', gap: 8 }}>
              <input className="scanny-input" value={tName} onChange={(e) => setTName(e.target.value)} style={fieldInputStyle} placeholder="Tenant name" disabled={busy} />
              <input className="scanny-input" type="tel" value={tPhone} onChange={(e) => setTPphone(e.target.value)} style={fieldInputStyle} placeholder="Phone" disabled={busy} />
              <input className="scanny-input" type="email" value={tEmail} onChange={(e) => setTEmail(e.target.value)} style={fieldInputStyle} placeholder="Email (optional)" disabled={busy} />
              <input className="scanny-input" type="date" value={tMoveIn} onChange={(e) => setTMoveIn(e.target.value)} style={fieldInputStyle} disabled={busy} />
              <input className="scanny-input" type="date" value={tLeaseEnd} onChange={(e) => setTLeaseEnd(e.target.value)} style={fieldInputStyle} disabled={busy} />
              <button type="submit" disabled={busy} style={btnPrimaryStyle}>Add tenant</button>
              <button type="button" onClick={() => setShowAdd(false)} style={{ ...btnSecondaryStyle, padding: '6px 12px' }}>Cancel</button>
            </form>
          ) : (
            <div style={{ marginTop: 6 }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>Vacant</p>
              <button type="button" onClick={() => setShowAdd(true)} style={{ ...btnSecondaryStyle, marginTop: 8, padding: '6px 12px' }}>Add tenant</button>
            </div>
          )}
        </section>

        {/* Unit QR — always shown so managers can print/share door stickers */}
        {unit.qrCodeUrl && (
          <section style={{ borderBottom: '1px solid var(--border)', paddingBottom: 14, marginBottom: 14 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Unit QR
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted-foreground)' }}>
              Give this to the tenant — they scan it to view activity and pay rent.
            </p>
            <QRCodePanel
              url={unit.qrCodeUrl}
              label={`Unit ${unit.unitNumber}`}
              sublabel={tenant?.name ?? 'Door sticker'}
              defaultExpanded
              size={160}
            />
          </section>
        )}

        {/* Charge block */}
        <section>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Current charge</p>
          {currentCharge ? (
            <div style={{ marginTop: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <StatusBadge status={currentCharge.status} />
                <span style={{ fontSize: 13 }}>{money(currentCharge.amount, currency)}</span>
              </div>
              {currentCharge.outstandingAmount > 0 && currentCharge.status !== 'PAID' && (
                <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--destructive)' }}>
                  Outstanding {money(currentCharge.outstandingAmount, currency)}
                </p>
              )}
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>
                Due {currentCharge.dueDate.slice(0, 10)} · {periodDisplay(currentCharge.periodLabel)}
              </p>
              {currentCharge.status !== 'PAID' && (
                <button type="button" disabled={busy} onClick={markPaid} style={{ ...btnPrimaryStyle, marginTop: 10, padding: '7px 14px' }}>
                  {busy ? '…' : 'Mark paid'}
                </button>
              )}
            </div>
          ) : (
            <div style={{ marginTop: 6 }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>No charge this period.</p>
              <button type="button" disabled={busy} onClick={generateCharge} style={{ ...btnSecondaryStyle, marginTop: 8, padding: '7px 14px' }}>
                {busy ? '…' : 'Generate charge'}
              </button>
            </div>
          )}
        </section>

        <p style={{ margin: '20px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>
          Monthly rent {money(unit.monthlyAmount, currency)}
        </p>
      </div>
    </>
  )
}

// ── MaintenanceTab ────────────────────────────────────────────────────────────

function MaintenanceTab({ allDashboards }: { allDashboards: PropertyDashboard[] }) {
  const [byProp, setByProp] = useState<Record<string, MaintenanceRequest[]>>({})
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    if (allDashboards.length === 0) return
    setLoading(true)
    Promise.all(
      allDashboards.map((pd) =>
        rentDashboardApi.listMaintenance(pd.property.id)
          .then((items) => ({ id: pd.property.id, items }))
          .catch(() => ({ id: pd.property.id, items: [] as MaintenanceRequest[] }))
      )
    ).then((results) => {
      const map: Record<string, MaintenanceRequest[]> = {}
      results.forEach(({ id, items }) => { map[id] = items })
      setByProp(map)
    }).finally(() => setLoading(false))
  }, [allDashboards.map((pd) => pd.property.id).join(',')])

  const allRequests = allDashboards.flatMap((pd) =>
    (byProp[pd.property.id] ?? []).map((r) => ({ ...r, propName: pd.property.name }))
  ).sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())

  async function handleStatus(propId: string, reqId: string, status: string) {
    setUpdatingId(reqId)
    try {
      const updated = await rentDashboardApi.updateMaintenanceStatus(propId, reqId, status)
      setByProp((prev) => ({
        ...prev,
        [propId]: (prev[propId] ?? []).map((r) => r.id === reqId ? updated : r),
      }))
    } catch { /* silent */ }
    setUpdatingId(null)
  }

  const statusColor = (s: string) =>
    s === 'RESOLVED' ? '#059669' : s === 'IN_PROGRESS' ? '#2563eb' : s === 'OPEN' ? '#d97706' : '#6b7280'

  const statusLabel = (s: string) =>
    s === 'RESOLVED' ? 'Resolved' : s === 'IN_PROGRESS' ? 'In progress' : s === 'OPEN' ? 'Open' : s

  const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return iso }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)' }}>Loading…</div>

  if (allRequests.length === 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <Wrench size={32} style={{ opacity: 0.2, display: 'block', margin: '0 auto 12px' }} />
        <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700 }}>No requests yet</p>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>Tenant maintenance requests will appear here.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b border-border">
            <TableHead className="pl-5 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Issue</TableHead>
            <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Tenant</TableHead>
            <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Unit</TableHead>
            <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Property</TableHead>
            <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Submitted</TableHead>
            <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Status</TableHead>
            <TableHead className="pr-5 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allRequests.map((r) => {
            const col = statusColor(r.status)
            return (
              <TableRow key={r.id} className="border-b border-border hover:bg-muted/40">
                <TableCell className="pl-5 py-2.5">
                  <p className="text-sm font-medium text-foreground">{r.title}</p>
                  {r.description && <p className="text-xs text-muted-foreground mt-0.5" style={{ maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.description}</p>}
                </TableCell>
                <TableCell className="text-sm text-foreground">{r.tenantName || <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-sm text-foreground">{r.unitNumber || <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-sm text-foreground">{r.propName}</TableCell>
                <TableCell className="text-sm text-foreground">{fmtDate(r.submittedAt)}</TableCell>
                <TableCell>
                  <span style={{ fontSize: 11, fontWeight: 700, color: col, background: `${col}18`, border: `1px solid ${col}33`, borderRadius: 5, padding: '2px 7px' }}>
                    {statusLabel(r.status)}
                  </span>
                </TableCell>
                <TableCell className="pr-5">
                  {r.status !== 'RESOLVED' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      {r.status === 'OPEN' && (
                        <button
                          type="button"
                          disabled={updatingId === r.id}
                          onClick={() => void handleStatus(r.propertyId, r.id, 'IN_PROGRESS')}
                          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--foreground)' }}
                        >
                          Start
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={updatingId === r.id}
                        onClick={() => void handleStatus(r.propertyId, r.id, 'RESOLVED')}
                        style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, border: 'none', background: '#059669', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        {updatingId === r.id ? '…' : 'Resolve'}
                      </button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

// ── Main RentDashboard ────────────────────────────────────────────────────────

type SidebarTab = 'overview' | 'units' | 'tenants' | 'rent' | 'maintenance' | 'leases'

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 900)
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 900)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return mobile
}

export default function RentDashboard({ onLogout }: { onLogout?: () => void }) {
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('overview')
  const [selectedProperty, setSelectedProperty] = useState<{ id: string; role: string } | null>(null)
  const [activePropId, setActivePropId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showAddUnit, setShowAddUnit] = useState(false)
  const [overviewQrUnit, setOverviewQrUnit] = useState<RentUnit | null>(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(() => readDarkMode())
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('scanny-rent-sidebar-collapsed') === '1' } catch { return false }
  })
  // Unit Floorplan Matrix: fullscreen overlay + filtering for large portfolios
  const [matrixFullscreen, setMatrixFullscreen] = useState(false)
  const [matrixFilter, setMatrixFilter] = useState<'all' | 'occupied' | 'vacant'>('all')
  const [matrixSearch, setMatrixSearch] = useState('')

  // Apply dark mode class whenever it changes
  useEffect(() => { applyDarkMode(darkMode) }, [darkMode])

  // Remember the sidebar collapse preference across reloads
  useEffect(() => {
    try { localStorage.setItem('scanny-rent-sidebar-collapsed', sidebarCollapsed ? '1' : '0') } catch { /* ignore */ }
  }, [sidebarCollapsed])

  // Press D to toggle dark mode (same as merchant app)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'd' && e.key !== 'D') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement ||
          t instanceof HTMLSelectElement || (t instanceof HTMLElement && t.isContentEditable)) return
      e.preventDefault()
      setDarkMode((prev) => { persistDarkMode(!prev); return !prev })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const [account, setAccount] = useState<RentAccount | null>(null)
  const [portfolio, setPortfolio] = useState<PortfolioEntry[]>([])
  const [dashboard, setDashboard] = useState<PropertyDashboard | null>(null)
  const [allDashboards, setAllDashboards] = useState<PropertyDashboard[]>([])
  const [dashLoading, setDashLoading] = useState(false)
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isMobile = useIsMobile()

  // Load account + portfolio on mount
  useEffect(() => {
    let cancelled = false
    Promise.all([rentDashboardApi.getMe(), rentDashboardApi.getPortfolio()])
      .then(([acct, portf]) => {
        if (cancelled) return
        setAccount(acct)
        setPortfolio(portf)
        if (portf.length > 0 && !activePropId) {
          setActivePropId(portf[0].propertyId)
        }
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load dashboard')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load dashboard for the active overview property
  const loadDashboard = useCallback(async () => {
    if (!activePropId) {
      setDashboard(null)
      return
    }
    setDashLoading(true)
    try {
      const d = await rentDashboardApi.getPropertyDashboard(activePropId)
      setDashboard(d)
      // Keep allDashboards in sync: replace or insert the freshly-loaded entry
      // so the Tenants/Rent/Leases tabs don't stale-read old data.
      setAllDashboards((prev) => {
        const idx = prev.findIndex((x) => x.property.id === d.property.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = d
          return next
        }
        return prev
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load property overview')
    } finally {
      setDashLoading(false)
    }
  }, [activePropId])

  // Load all property dashboards for the unit map (grouped by property).
  // Deduplicates against the already-loaded active dashboard so we don't
  // fire N+1 requests — the active property was already fetched by loadDashboard.
  const loadAllDashboards = useCallback(async () => {
    if (portfolio.length === 0) return
    const others = portfolio.filter((p) => p.propertyId !== activePropId)
    if (others.length === 0) return
    try {
      const loaded = await Promise.all(
        others.map((p) => rentDashboardApi.getPropertyDashboard(p.propertyId)),
      )
      setAllDashboards((prev) => {
        // Merge: keep any entries already present (e.g. the active one), add the rest
        const map = new Map(prev.map((d) => [d.property.id, d]))
        for (const d of loaded) map.set(d.property.id, d)
        return Array.from(map.values())
      })
    } catch {
      // non-fatal
    }
  }, [portfolio, activePropId])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  useEffect(() => {
    void loadAllDashboards()
  }, [loadAllDashboards])

  function handleCreatedProperty(property: RentProperty) {
    setShowAdd(false)
    // Reload portfolio and select the new property
    rentDashboardApi
      .getPortfolio()
      .then((portf) => {
        setPortfolio(portf)
        setActivePropId(property.id)
        setSidebarTab('overview')
      })
      .catch(() => {})
  }

  function handleLogout() {
    sessionStorage.removeItem('scanny-rent-authenticated')
    sessionStorage.removeItem('scanny-rent-login-intent')
    if (onLogout) {
      onLogout()
    } else {
      // Fallback: end SSO session and force credential prompt on next visit
      void logoutRentManager(window.location.origin + '/rent/dashboard')
    }
  }

  // The active property's name for the sidebar header
  const activeEntry = portfolio.find((p) => p.propertyId === activePropId) ?? null
  const activePropertyName = dashboard?.property.name ?? activeEntry?.propertyName ?? 'Properties'

  const totalUnits = portfolio.reduce((sum, p) => sum + p.totalUnits, 0)

  // ── Tab data — computed at component level so hooks are always called ─────
  // Use allDashboards when loaded; fall back to single dashboard; empty array when nothing yet.
  const tabDashboards = allDashboards.length > 0 ? allDashboards : (dashboard ? [dashboard] : [])

  const tenantRows = tabDashboards.flatMap((pd) =>
    pd.units.filter((r) => r.unit.activeTenant != null)
      .map((r) => ({ ...r, propertyName: pd.property.name, currency: pd.property.currency }))
  )

  const rentStatusOrder = ['OVERDUE', 'UNPAID', 'PARTIAL', 'PAID', 'WAIVED']
  const rentRows = tabDashboards.flatMap((pd) =>
    pd.units.filter((r) => r.unit.activeTenant != null && r.currentCharge != null)
      .map((r) => ({ ...r, propertyName: pd.property.name, currency: pd.property.currency }))
  ).sort((a, b) => rentStatusOrder.indexOf(a.currentCharge!.status) - rentStatusOrder.indexOf(b.currentCharge!.status))

  const leaseRows = tabDashboards.flatMap((pd) =>
    pd.units.filter((r) => r.unit.activeTenant != null).map((r) => {
      const t = r.unit.activeTenant!
      const daysLeft = t.leaseEnd ? Math.ceil((new Date(t.leaseEnd).getTime() - Date.now()) / 86400000) : null
      return { unit: r.unit, tenant: t, daysLeft, propertyName: pd.property.name }
    })
  ).sort((a, b) => {
    if (a.daysLeft === null && b.daysLeft === null) return 0
    if (a.daysLeft === null) return 1
    if (b.daysLeft === null) return -1
    return a.daysLeft - b.daysLeft
  })

  const tenantPg = usePagination(tenantRows, { initialPageSize: 20, resetKey: tabDashboards.length })
  const rentPg = usePagination(rentRows, { initialPageSize: 20, resetKey: tabDashboards.length })
  const leasePg = usePagination(leaseRows, { initialPageSize: 20, resetKey: tabDashboards.length })

  const navItems: { key: SidebarTab; label: string; icon: typeof LayoutGrid | null; badge?: number }[] = [
    { key: 'overview', label: 'Overview', icon: LayoutGrid },
    { key: 'units', label: 'Properties', icon: Building2, badge: portfolio.length },
    { key: 'tenants', label: 'Tenants', icon: Users },
    { key: 'rent', label: 'Rent', icon: Wallet },
    { key: 'maintenance', label: 'Maintenance', icon: Wrench },
    { key: 'leases', label: 'Leases', icon: FileText },
  ]

  // ── Sidebar ──────────────────────────────────────────────────────────────

  const collapsed = sidebarCollapsed

  const sidebarContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Koddly brand + collapse toggle */}
      <div
        style={{
          padding: collapsed ? '14px 8px 0' : '18px 18px 0',
          borderBottom: '1px solid var(--sidebar-border)',
          paddingBottom: 14,
          display: 'flex',
          flexDirection: collapsed ? 'column' : 'row',
          alignItems: 'center',
          gap: collapsed ? 8 : 9,
        }}
      >
        <img src="/koddlylogo3.png" alt="Koddly" width={26} height={26} style={{ borderRadius: 6, flexShrink: 0 }} />
        {!collapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ fontSize: 15, fontWeight: 800, color: 'var(--sidebar-foreground)', display: 'block', lineHeight: 1.2 }}>Koddly</strong>
            <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--muted-foreground)', display: 'block' }}>Property Management</span>
          </div>
        )}
        <button
          type="button"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setSidebarCollapsed((c) => !c)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 7,
            border: '1px solid var(--sidebar-border)',
            background: 'var(--sidebar-accent)',
            color: 'var(--sidebar-foreground)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            flexShrink: 0,
          }}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>
      {/* Nav */}
      <nav style={{ flex: 1, padding: collapsed ? '4px 4px' : '4px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map((item) => {
          const active = sidebarTab === item.key
          const Icon = item.icon
          return (
            <button
              key={item.key}
              type="button"
              title={collapsed ? item.label : undefined}
              onClick={() => {
                setSidebarTab(item.key)
                setSelectedProperty(null)
                setMobileNavOpen(false)
                setMatrixFullscreen(false)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: collapsed ? 0 : 10,
                padding: collapsed ? '10px 0' : '10px 12px',
                borderRadius: 9,
                fontSize: 14,
                fontWeight: active ? 700 : 500,
                border: 'none',
                background: active ? 'var(--sidebar-accent)' : 'transparent',
                color: active ? 'var(--sidebar-primary)' : 'var(--sidebar-foreground)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                textAlign: 'left',
              }}
            >
              {Icon ? <Icon size={18} /> : <span style={{ width: 18, display: 'inline-block' }} />}
              {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
              {!collapsed && item.badge != null && item.badge > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '1px 7px',
                    borderRadius: 10,
                    background: active ? 'var(--sidebar-primary)' : 'var(--sidebar-accent)',
                    color: active ? 'var(--sidebar-primary-foreground)' : 'var(--muted-foreground)',
                  }}
                >
                  {item.badge}
                </span>
              )}
              {!collapsed && active && <ChevronRight size={16} />}
            </button>
          )
        })}
      </nav>

      {/* Account + logout */}
      <div style={{ borderTop: '1px solid var(--sidebar-border)', padding: collapsed ? '12px 4px' : '14px 18px' }}>
        <div style={{ display: 'flex', flexDirection: collapsed ? 'column' : 'row', alignItems: 'center', gap: collapsed ? 8 : 10, marginBottom: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'var(--sidebar-accent)',
              color: 'var(--sidebar-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            {(account?.name ?? '?').charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--sidebar-foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {account?.name ?? 'Account'}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--muted-foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {account?.email ?? ''}
              </p>
            </div>
          )}
        </div>
        {/* Theme + Logout — combined split button */}
        <div style={{ display: 'flex', flexDirection: collapsed ? 'column' : 'row', borderRadius: 9, border: '1.5px solid var(--sidebar-border)', overflow: 'hidden' }}>
          <button
            type="button"
            title={darkMode ? 'Switch to light mode (D)' : 'Switch to dark mode (D)'}
            onClick={() => setDarkMode((prev) => { persistDarkMode(!prev); return !prev })}
            style={{
              flex: collapsed ? undefined : '0 0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '9px 0',
              background: darkMode ? 'var(--sidebar-accent)' : 'transparent',
              color: 'var(--sidebar-foreground)',
              border: 'none',
              borderRight: collapsed ? 'none' : '1px solid var(--sidebar-border)',
              borderBottom: collapsed ? '1px solid var(--sidebar-border)' : 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button
            type="button"
            title={collapsed ? 'Log out' : undefined}
            onClick={() => setShowLogoutConfirm(true)}
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: collapsed ? 0 : 7,
              padding: '9px 0',
              background: 'transparent',
              color: 'var(--sidebar-foreground)',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <LogOut size={14} />{!collapsed && ' Log out'}
          </button>
        </div>
      </div>
    </div>
  )

  // ── Overview rendering ──────────────────────────────────────────────────

  function renderOverview() {
    if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)' }}>Loading…</div>
    if (error && !dashboard) return <p className="scanny-error" style={{ padding: 20 }}>{error}</p>
    if (!activePropId || portfolio.length === 0) {
      return (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <Building2 size={36} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ marginTop: 0, fontSize: 15 }}>No properties yet.</p>
          <button type="button" onClick={() => setShowAdd(true)} style={{ ...btnPrimaryStyle, marginTop: 16 }}>
            <Plus size={16} /> Add property
          </button>
        </div>
      )
    }
    if (dashLoading && !dashboard) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)' }}>Loading overview…</div>
    if (!dashboard) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted-foreground)' }}>No data.</div>

    const d = dashboard
    const currency = d.property.currency
    const allD = allDashboards.length > 0 ? allDashboards : [d]
    const totalUnitsAll = allD.reduce((s, pd) => s + pd.totalUnits, 0)
    const occupiedUnitsAll = allD.reduce((s, pd) => s + pd.occupiedUnits, 0)
    const vacantAll = totalUnitsAll - occupiedUnitsAll
    const occupancyPct = totalUnitsAll > 0 ? Math.round((occupiedUnitsAll / totalUnitsAll) * 100) : 0
    const collected = allD.reduce((s, pd) => s + pd.totalCollectedThisPeriod, 0)
    const expected = allD.reduce((s, pd) => s + pd.units.reduce((a, r) => a + (r.unit.activeTenant ? r.unit.monthlyAmount : 0), 0), 0)
    const overdueAmount = allD.reduce((s, pd) => s + pd.units.reduce((a, r) => a + (r.currentCharge?.status === 'OVERDUE' ? r.currentCharge.outstandingAmount : 0), 0), 0)
    const overdueTenantCount = allD.reduce((s, pd) => s + pd.units.filter((r) => r.currentCharge?.status === 'OVERDUE').length, 0)
    const overdueItems = allD.flatMap((pd) =>
      pd.units.filter((r) => r.currentCharge && (r.currentCharge.status === 'OVERDUE' || r.currentCharge.status === 'UNPAID') && r.unit.activeTenant)
        .map((r) => ({ ...r, propId: pd.property.id, propName: pd.property.name, propCur: pd.property.currency }))
    )
    const leaseExpiryItems = allD.flatMap((pd) =>
      pd.units.filter((r) => {
        const t = r.unit.activeTenant; if (!t || !t.leaseEnd) return false
        const days = daysUntil(t.leaseEnd); return days != null && days >= 0 && days <= 60
      }).map((r) => ({ ...r, propId: pd.property.id, propName: pd.property.name, propCur: pd.property.currency }))
    )
    const attentionCount = overdueItems.length + leaseExpiryItems.length
    const dashboardsToSearch = allDashboards.length > 0 ? allDashboards : [d]
    const selectedDash = dashboardsToSearch.find((pd) => pd.units.some((r) => r.unit.id === selectedUnitId)) ?? null
    const selectedRow = selectedDash?.units.find((r) => r.unit.id === selectedUnitId) ?? null

    async function markRowPaid(propId: string, chargeId: number) {
      try {
        await rentDashboardApi.updateChargeStatus(propId, chargeId, 'PAID')
        await loadAllDashboards(); await loadDashboard()
      } catch (e) { setError(e instanceof Error ? e.message : 'Could not mark paid') }
    }

    function tileStatus(row: import('./types').UnitDashboardRow): 'paid' | 'late' | 'vacant' | 'ok' {
      if (!row.unit.activeTenant) return 'vacant'
      const s = row.currentCharge?.status
      if (s === 'OVERDUE' || s === 'UNPAID') return 'late'
      if (s === 'PAID' || s === 'WAIVED') return 'paid'
      return 'ok'
    }

    const tileStyles: Record<string, { bg: string; fg: string; border: string; tag?: string; tagBg?: string; tagFg?: string }> = {
      paid:   { bg: 'var(--primary)',       fg: 'var(--primary-foreground)', border: 'transparent' },
      late:   { bg: 'oklch(0.55 0.18 30)',  fg: '#fff', border: 'transparent', tag: 'LATE', tagBg: '#dc2626', tagFg: '#fff' },
      vacant: { bg: 'var(--muted)',          fg: 'var(--muted-foreground)',   border: 'var(--border)', tag: 'VACANT', tagBg: 'var(--muted)', tagFg: 'var(--muted-foreground)' },
      ok:     { bg: 'var(--primary)',       fg: 'var(--primary-foreground)', border: 'transparent' },
    }

    // ── Matrix helpers (shared by the inline card and the fullscreen overlay) ──
    function unitMatchesFilter(row: UnitDashboardRow): boolean {
      if (matrixFilter === 'occupied') return row.unit.activeTenant != null
      if (matrixFilter === 'vacant') return row.unit.activeTenant == null
      return true
    }

    function renderMatrixGroups(wide: boolean) {
      const q = matrixSearch.trim().toLowerCase()
      let anyShown = false
      const groups = allD.map((propDash) => {
        const propOccPct = propDash.totalUnits > 0 ? Math.round((propDash.occupiedUnits / propDash.totalUnits) * 100) : 0
        const units = propDash.units.filter((row) => {
          if (!unitMatchesFilter(row)) return false
          if (q) {
            const num = row.unit.unitNumber.toLowerCase()
            const tenant = (row.unit.activeTenant?.name ?? '').toLowerCase()
            if (!num.includes(q) && !tenant.includes(q)) return false
          }
          return true
        })
        if (units.length === 0) return null
        anyShown = true
        return (
          <div key={propDash.property.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Building2 size={13} color="var(--muted-foreground)" />
                <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {propDash.property.name}
                </span>
                <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>· {units.length}/{propDash.totalUnits} unit{propDash.totalUnits !== 1 ? 's' : ''}</span>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: propOccPct >= 80 ? 'var(--primary)' : 'oklch(0.55 0.18 30)' }}>{propOccPct}% Occupancy</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: wide ? 12 : 10 }}>
              {units.map((row) => {
                const status = tileStatus(row)
                const ts = tileStyles[status]
                const isSelected = selectedUnitId === row.unit.id
                return (
                  <button
                    key={row.unit.id}
                    type="button"
                    onClick={() => setSelectedUnitId(isSelected ? null : row.unit.id)}
                    style={{
                      padding: '8px 12px', borderRadius: 8, minWidth: wide ? 96 : 80,
                      background: isSelected ? 'var(--sidebar-primary)' : ts.bg,
                      color: isSelected ? 'var(--sidebar-primary-foreground)' : ts.fg,
                      border: `1.5px solid ${isSelected ? 'var(--sidebar-primary)' : ts.border}`,
                      cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginBottom: 2 }}>
                      <span style={{ fontWeight: 800, fontSize: 13 }}>{row.unit.unitNumber}</span>
                      {ts.tag && <span style={{ fontSize: 9, fontWeight: 700, background: ts.tagBg, color: ts.tagFg, borderRadius: 3, padding: '1px 4px' }}>{ts.tag}</span>}
                    </div>
                    <div style={{ fontSize: 10, opacity: 0.9 }}>
                      {row.unit.activeTenant ? money(row.unit.monthlyAmount, propDash.property.currency) : 'Available'}
                    </div>
                    {row.unit.activeTenant && <div style={{ fontSize: 9, opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: wide ? 110 : 90 }}>{row.unit.activeTenant.name}</div>}
                    {status === 'vacant' && (
                      <div style={{ fontSize: 9, color: 'var(--primary)', marginTop: 1 }}>+ List Unit</div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })
      return (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {groups}
          {!anyShown && (
            <p style={{ margin: 0, padding: '20px 0', textAlign: 'center', fontSize: 13, color: 'var(--muted-foreground)' }}>
              No units match your filters.
            </p>
          )}
        </div>
      )
    }

    function renderSelectedFooter() {
      if (!selectedRow || !selectedDash) return null
      const goManage = () => {
        setMatrixFullscreen(false)
        setSidebarTab('units')
        setSelectedProperty({ id: selectedDash.property.id, role: portfolio.find((p) => p.propertyId === selectedDash.property.id)?.role ?? 'OWNER_MANAGER' })
      }
      return (
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Home size={14} color="var(--primary-foreground)" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>Selected Unit</p>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700 }}>{selectedRow.unit.unitNumber} · {selectedDash.property.name}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div>
              <p style={{ margin: 0, fontSize: 9, color: 'var(--muted-foreground)' }}>Monthly rent</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--primary)' }}>{money(selectedRow.unit.monthlyAmount, selectedDash.property.currency)}</p>
            </div>
            {selectedRow.unit.activeTenant?.leaseEnd && (
              <div>
                <p style={{ margin: 0, fontSize: 9, color: 'var(--muted-foreground)' }}>Lease expires</p>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: (daysUntil(selectedRow.unit.activeTenant.leaseEnd) ?? 99) <= 30 ? 'oklch(0.55 0.18 30)' : 'var(--foreground)' }}>
                  {selectedRow.unit.activeTenant.leaseEnd ? `in ${daysUntil(selectedRow.unit.activeTenant.leaseEnd)} days` : '—'}
                </p>
              </div>
            )}
            <button type="button" onClick={goManage} style={{ ...btnSecondaryStyle, fontSize: 11, padding: '5px 12px' }}>
              View Lease
            </button>
            <button type="button" onClick={goManage} style={{ ...btnPrimaryStyle, fontSize: 11, padding: '5px 12px' }}>
              Manage
            </button>
          </div>
        </div>
      )
    }

    const now = new Date()
    const monthLabel = now.toLocaleDateString([], { month: 'long', year: 'numeric' })
    const buildingNames = allD.map((pd) => pd.property.name).join(', ')

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Top bar ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>Portfolio Overview</h1>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', padding: '2px 8px', borderRadius: 4, background: 'oklch(0.55 0.18 30)', color: '#fff' }}>LIVE</span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted-foreground)' }}>
              {monthLabel} · {allD.length} building{allD.length !== 1 ? 's' : ''} · {totalUnitsAll} units total ({buildingNames})
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => rentDashboardApi.triggerCsvExport(d.property.id)} style={{ ...btnSecondaryStyle, fontSize: 12, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={13} /> Export CSV
            </button>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {/* Occupancy */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)' }}>Occupancy Rate</span>
              <Home size={14} color="var(--muted-foreground)" />
            </div>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>{occupancyPct}%</p>
            <p style={{ margin: '4px 0 6px', fontSize: 11, color: 'var(--muted-foreground)' }}>{occupiedUnitsAll}/{totalUnitsAll} Units</p>
            <div style={{ height: 4, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${occupancyPct}%`, background: 'var(--primary)', borderRadius: 99 }} />
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 10, color: 'var(--muted-foreground)' }}>
              {allD.map((pd) => `${pd.property.name.split(' ')[0]}: ${pd.totalUnits > 0 ? Math.round((pd.occupiedUnits/pd.totalUnits)*100) : 0}%`).join(' · ')}
            </p>
          </div>

          {/* Rent collected */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)' }}>Rent Collected</span>
              <DollarSign size={14} color="var(--muted-foreground)" />
            </div>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>{money(collected, currency)}</p>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--muted-foreground)' }}>Expected: {money(expected, currency)}</p>
            <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--muted-foreground)' }}>Due {now.toLocaleDateString([], { month: 'short', day: 'numeric' })}</p>
          </div>

          {/* Overdue */}
          <div style={{ background: 'var(--card)', border: `1px solid ${overdueAmount > 0 ? 'oklch(0.55 0.18 30 / 50%)' : 'var(--border)'}`, borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)' }}>Overdue / Arrears</span>
              <AlertTriangle size={14} color={overdueAmount > 0 ? 'oklch(0.55 0.18 30)' : 'var(--muted-foreground)'} />
            </div>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', color: overdueAmount > 0 ? 'oklch(0.55 0.18 30)' : 'inherit' }}>
              {money(overdueAmount, currency)}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--muted-foreground)' }}>
              {overdueTenantCount} tenant{overdueTenantCount !== 1 ? 's' : ''} overdue
            </p>
            {overdueItems.slice(0,2).map((r) => (
              <p key={r.unit.id} style={{ margin: '2px 0 0', fontSize: 10, color: 'oklch(0.55 0.18 30)' }}>
                {r.unit.unitNumber} ({r.propName.split(' ')[0]}) delinquent
              </p>
            ))}
          </div>

          {/* Open maintenance */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)' }}>Open Maintenance</span>
              <Wrench size={14} color="var(--muted-foreground)" />
            </div>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em' }}>0</p>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--muted-foreground)' }}>Active</p>
            <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--primary)' }}>+ All systems clear · 0 tickets</p>
          </div>
        </div>

        {/* ── Main two-column layout ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>

          {/* ── Unit Floorplan Matrix ── */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: 6, background: 'oklch(0.55 0.14 150 / 15%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <LayoutGrid size={14} color="var(--primary)" />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Unit Floorplan Matrix</p>
                  <p style={{ margin: 0, fontSize: 10, color: 'var(--muted-foreground)' }}>Active telemetry by building and allocation status</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {([
                  { key: 'all', label: `All (${totalUnitsAll})` },
                  { key: 'occupied', label: `Occupied (${occupiedUnitsAll})` },
                  { key: 'vacant', label: `Vacant (${vacantAll})` },
                ] as const).map((pill) => (
                  <button
                    key={pill.key}
                    type="button"
                    onClick={() => setMatrixFilter(pill.key)}
                    style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                      border: '1px solid transparent',
                      background: matrixFilter === pill.key ? 'var(--primary)' : 'var(--muted)',
                      color: matrixFilter === pill.key ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                    }}
                  >
                    {pill.label}
                  </button>
                ))}
                <button
                  type="button"
                  title="Open matrix fullscreen"
                  aria-label="Open matrix fullscreen"
                  onClick={() => setMatrixFullscreen(true)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 30, height: 30, borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit',
                    border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)',
                  }}
                >
                  <Maximize2 size={14} />
                </button>
              </div>
            </div>

            {/* Property groups — scrollable so large properties stay compact */}
            <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {renderMatrixGroups(false)}
            </div>

            {/* Selected unit footer bar */}
            {renderSelectedFooter()}
          </div>

          {/* ── Right column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Needs Attention */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={14} color="oklch(0.55 0.18 30)" />
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Needs Attention</span>
                </div>
                {attentionCount > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, background: 'oklch(0.55 0.18 30)', color: '#fff', borderRadius: 4, padding: '3px 10px' }}>
                    {attentionCount} Actions
                  </span>
                )}
              </div>
              {attentionCount === 0 ? (
                <p style={{ padding: '24px 20px', margin: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>All clear — no action needed.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {overdueItems.map((row) => (
                    <div key={`ov-${row.unit.id}`} style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', flexShrink: 0, display: 'inline-block' }} />
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, flex: 1 }}>
                          {row.unit.activeTenant?.name} owes {money(row.currentCharge!.outstandingAmount, row.propCur)}
                        </p>
                        <span style={{ fontSize: 10, fontWeight: 700, background: '#dc2626', color: '#fff', borderRadius: 4, padding: '2px 7px', flexShrink: 0 }}>OVERDUE</span>
                      </div>
                      <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--muted-foreground)', paddingLeft: 16 }}>
                        Unit {row.unit.unitNumber} ({row.propName}) · Rent overdue {row.currentCharge?.dueDate ? `${daysUntil(row.currentCharge.dueDate) != null ? Math.abs(daysUntil(row.currentCharge.dueDate)!) : ''} days` : ''}
                      </p>
                      <div style={{ display: 'flex', gap: 8, paddingLeft: 16 }}>
                        <button
                          type="button"
                          onClick={() => void markRowPaid(row.propId, row.currentCharge!.id)}
                          style={{ ...btnPrimaryStyle, fontSize: 12, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                          <CheckCircle2 size={13} /> Mark paid
                        </button>
                        <button type="button" style={{ ...btnSecondaryStyle, fontSize: 12, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Users size={13} /> Call Tenant
                        </button>
                      </div>
                    </div>
                  ))}
                  {leaseExpiryItems.map((row) => {
                    const days = daysUntil(row.unit.activeTenant!.leaseEnd)!
                    const isUrgent = days <= 14
                    const badgeBg = isUrgent ? 'oklch(0.55 0.18 30)' : '#d97706'
                    return (
                      <div key={`le-${row.unit.id}`} style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: badgeBg, flexShrink: 0, display: 'inline-block' }} />
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, flex: 1 }}>
                            {row.unit.activeTenant!.name}'s lease ends in {days} {days === 1 ? 'day' : 'days'}
                          </p>
                          <span style={{ fontSize: 10, fontWeight: 700, background: badgeBg, color: '#fff', borderRadius: 4, padding: '2px 7px', flexShrink: 0 }}>
                            {isUrgent ? 'EXPIRING' : 'UPCOMING'}
                          </span>
                        </div>
                        <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--muted-foreground)', paddingLeft: 16 }}>
                          Unit {row.unit.unitNumber} ({row.propName}) · Review renewal terms
                        </p>
                        <div style={{ display: 'flex', gap: 8, paddingLeft: 16 }}>
                          <button type="button" style={{ ...btnSecondaryStyle, fontSize: 12, padding: '6px 14px' }}>Send Renewal Survey</button>
                          <button type="button" style={{ ...btnSecondaryStyle, fontSize: 12, padding: '6px 14px' }}>Review Terms</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ── Fullscreen matrix overlay (like the Kitchen board: covers everything) ── */}
        {matrixFullscreen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'var(--background)', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: 'var(--card)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: 'oklch(0.55 0.14 150 / 15%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <LayoutGrid size={15} color="var(--primary)" />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Unit Floorplan Matrix</p>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--muted-foreground)' }}>
                    {allD.length} building{allD.length !== 1 ? 's' : ''} · {totalUnitsAll} units · {occupiedUnitsAll} occupied · {vacantAll} vacant
                  </p>
                </div>
              </div>
              {/* Search */}
              <div style={{ flex: 1, minWidth: 200, display: 'flex', justifyContent: 'center' }}>
                <div style={{ position: 'relative', width: '100%', maxWidth: 360 }}>
                  <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
                  <input
                    value={matrixSearch}
                    onChange={(e) => setMatrixSearch(e.target.value)}
                    placeholder="Search unit number or tenant…"
                    style={{
                      width: '100%', padding: '9px 12px 9px 34px', borderRadius: 9,
                      border: '1px solid var(--border)', background: 'var(--background)',
                      color: 'var(--foreground)', fontFamily: 'inherit', fontSize: 13,
                    }}
                  />
                </div>
              </div>
              {/* Filter pills */}
              <div style={{ display: 'flex', gap: 6 }}>
                {([
                  { key: 'all', label: `All (${totalUnitsAll})` },
                  { key: 'occupied', label: `Occupied (${occupiedUnitsAll})` },
                  { key: 'vacant', label: `Vacant (${vacantAll})` },
                ] as const).map((pill) => (
                  <button
                    key={pill.key}
                    type="button"
                    onClick={() => setMatrixFilter(pill.key)}
                    style={{
                      fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                      border: '1px solid transparent',
                      background: matrixFilter === pill.key ? 'var(--primary)' : 'var(--muted)',
                      color: matrixFilter === pill.key ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                    }}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => { setMatrixFullscreen(false); setSelectedUnitId(null); setMatrixSearch('') }}
                style={{ ...btnSecondaryStyle, padding: '8px 14px' }}
              >
                <Minimize2 size={15} /> Exit fullscreen
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                {renderMatrixGroups(true)}
                {renderSelectedFooter()}
              </div>
            </div>
          </div>
        )}

        {selectedRow && selectedDash && !matrixFullscreen && (
          <UnitSheet
            row={selectedRow}
            propertyId={selectedDash.property.id}
            currency={selectedDash.property.currency}
            onClose={() => setSelectedUnitId(null)}
            onChanged={() => void loadDashboard()}
          />
        )}
      </div>
    )
  }


  // ── Tenants tab ───────────────────────────────────────────────────────────

  function renderTenants() {
    if (loading) return <div style={{ padding: 40, color: 'var(--muted-foreground)', textAlign: 'center' }}>Loading…</div>
    const vacant = tabDashboards.reduce((s, pd) => s + pd.units.filter((r) => !r.unit.activeTenant).length, 0)
    return (
      <div>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Tenants</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted-foreground)' }}>{tenantRows.length} active · {vacant} vacant</p>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border">
                <TableHead className="pl-5 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Tenant</TableHead>
                <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Unit</TableHead>
                <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Property</TableHead>
                <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Phone</TableHead>
                <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Monthly</TableHead>
                <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Status</TableHead>
                <TableHead className="pr-5 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Lease ends</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenantPg.pageItems.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">No active tenants yet.</TableCell>
                </TableRow>
              ) : tenantPg.pageItems.map(({ unit, currentCharge, propertyName, currency: cur }) => {
                const t = unit.activeTenant!
                const sc = currentCharge?.status ?? null
                const col = sc === 'PAID' ? '#059669' : sc === 'OVERDUE' ? '#dc2626' : sc === 'PARTIAL' ? '#d97706' : sc === 'UNPAID' ? '#2563eb' : '#6b7280'
                return (
                  <TableRow key={unit.id} className="border-b border-border hover:bg-muted/40">
                    <TableCell className="pl-5 py-2.5">
                      <p className="text-sm font-medium text-foreground">{t.name}</p>
                      {t.email && <p className="text-xs text-muted-foreground mt-0.5">{t.email}</p>}
                    </TableCell>
                    <TableCell className="text-sm text-foreground">{unit.unitNumber}{unit.floor ? <span className="text-muted-foreground text-xs"> · {unit.floor}</span> : null}</TableCell>
                    <TableCell className="text-sm text-foreground">{propertyName}</TableCell>
                    <TableCell className="text-sm text-foreground">{t.phone || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm font-medium font-mono text-foreground">{money(unit.monthlyAmount, cur)}</TableCell>
                    <TableCell>
                      {sc ? <span style={{ fontSize: 11, fontWeight: 700, color: col, background: `${col}18`, border: `1px solid ${col}33`, borderRadius: 5, padding: '2px 7px' }}>{sc === 'PAID' ? '✓ Paid' : sc === 'OVERDUE' ? '! Overdue' : sc === 'PARTIAL' ? '~ Partial' : sc === 'UNPAID' ? 'Unpaid' : sc}</span> : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="pr-5 text-sm text-foreground">
                      {t.leaseEnd ? new Date(t.leaseEnd).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : <span className="text-muted-foreground">Open-ended</span>}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <div className="border-t border-border px-5 py-3">
            <PaginationBar pagination={tenantPg} hideWhenEmpty={false} />
          </div>
        </div>
      </div>
    )
  }

  // ── Rent tab ──────────────────────────────────────────────────────────────

  function renderRent() {
    if (loading) return <div style={{ padding: 40, color: 'var(--muted-foreground)', textAlign: 'center' }}>Loading…</div>
    const paid = rentRows.filter((r) => r.currentCharge!.status === 'PAID').length
    const overdue = rentRows.filter((r) => r.currentCharge!.status === 'OVERDUE').length
    const unpaid = rentRows.filter((r) => r.currentCharge!.status === 'UNPAID').length
    const partial = rentRows.filter((r) => r.currentCharge!.status === 'PARTIAL').length
    const collected = tabDashboards.reduce((s, pd) => s + pd.totalCollectedThisPeriod, 0)
    const cur = dashboard?.property.currency ?? 'UGX'
    const period = tabDashboards[0]?.currentPeriod ? (() => { try { const [y, m] = tabDashboards[0].currentPeriod.split('-'); return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString([], { month: 'long', year: 'numeric' }) } catch { return tabDashboards[0].currentPeriod } })() : ''
    return (
      <div>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Rent</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted-foreground)' }}>{period}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px,1fr))', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Collected', value: money(collected, cur), color: 'var(--primary)' },
            { label: 'Paid', value: String(paid), color: '#059669' },
            { label: 'Overdue', value: String(overdue), color: '#dc2626' },
            { label: 'Unpaid', value: String(unpaid), color: '#d97706' },
            { label: 'Partial', value: String(partial), color: '#d97706' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card" style={{ padding: '10px 14px' }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</p>
              <p style={{ margin: '3px 0 0', fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border">
                <TableHead className="pl-5 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Tenant</TableHead>
                <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Unit</TableHead>
                <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Property</TableHead>
                <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Charge</TableHead>
                <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Paid</TableHead>
                <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Balance</TableHead>
                <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Status</TableHead>
                <TableHead className="pr-5 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rentPg.pageItems.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">No charges for this period.</TableCell>
                </TableRow>
              ) : rentPg.pageItems.map(({ unit, currentCharge, propertyName, currency: rowCur }) => {
                const charge = currentCharge!
                const sc = charge.status
                const col = sc === 'PAID' ? '#059669' : sc === 'OVERDUE' ? '#dc2626' : sc === 'PARTIAL' ? '#d97706' : sc === 'UNPAID' ? '#2563eb' : '#6b7280'
                return (
                  <TableRow key={charge.id} className="border-b border-border hover:bg-muted/40">
                    <TableCell className="pl-5 py-2.5 text-sm font-medium text-foreground">{unit.activeTenant!.name}</TableCell>
                    <TableCell className="text-sm text-foreground">{unit.unitNumber}</TableCell>
                    <TableCell className="text-sm text-foreground">{propertyName}</TableCell>
                    <TableCell className="text-sm font-mono font-medium text-foreground">{money(charge.amount, rowCur)}</TableCell>
                    <TableCell className="text-sm font-mono text-foreground">{money(charge.paidAmount, rowCur)}</TableCell>
                    <TableCell className="text-sm font-mono text-foreground">{money(charge.outstandingAmount, rowCur)}</TableCell>
                    <TableCell>
                      <span style={{ fontSize: 11, fontWeight: 700, color: col, background: `${col}18`, border: `1px solid ${col}33`, borderRadius: 5, padding: '2px 7px' }}>{sc === 'PAID' ? '✓ Paid' : sc === 'OVERDUE' ? '! Overdue' : sc === 'PARTIAL' ? '~ Partial' : sc === 'UNPAID' ? 'Unpaid' : sc}</span>
                    </TableCell>
                    <TableCell className="pr-5 text-sm text-foreground">
                      {charge.dueDate ? new Date(charge.dueDate).toLocaleDateString([], { day: 'numeric', month: 'short' }) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <div className="border-t border-border px-5 py-3">
            <PaginationBar pagination={rentPg} hideWhenEmpty={false} />
          </div>
        </div>
      </div>
    )
  }

  // ── Maintenance tab ───────────────────────────────────────────────────────

  function renderMaintenance() {
    return (
      <div>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Maintenance</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted-foreground)' }}>Tenant repair requests across all properties</p>
        </div>
        <MaintenanceTab allDashboards={allDashboards.length > 0 ? allDashboards : (dashboard ? [dashboard] : [])} />
      </div>
    )
  }

  // ── Leases tab ────────────────────────────────────────────────────────────

  function renderLeases() {
    if (loading) return <div style={{ padding: 40, color: 'var(--muted-foreground)', textAlign: 'center' }}>Loading…</div>
    const expiring = leaseRows.filter((r) => r.daysLeft != null && r.daysLeft >= 0 && r.daysLeft <= 60).length
    const expired = leaseRows.filter((r) => r.daysLeft != null && r.daysLeft < 0).length
    return (
      <div>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Leases</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted-foreground)' }}>
            {leaseRows.length} total
            {expiring > 0 && <span style={{ color: '#d97706', marginLeft: 8 }}>· {expiring} expiring soon</span>}
            {expired > 0 && <span style={{ color: '#dc2626', marginLeft: 8 }}>· {expired} expired</span>}
          </p>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border">
                <TableHead className="pl-5 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Tenant</TableHead>
                <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Unit</TableHead>
                <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Property</TableHead>
                <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Move-in</TableHead>
                <TableHead className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Lease end</TableHead>
                <TableHead className="pr-5 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Days left</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leasePg.pageItems.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No tenants yet.</TableCell>
                </TableRow>
              ) : leasePg.pageItems.map(({ unit, tenant, daysLeft, propertyName }) => {
                const isExpired = daysLeft != null && daysLeft < 0
                const isUrgent = daysLeft != null && daysLeft >= 0 && daysLeft <= 14
                const isWarning = daysLeft != null && daysLeft > 14 && daysLeft <= 60
                const col = isExpired || isUrgent ? '#dc2626' : isWarning ? '#d97706' : daysLeft !== null ? '#059669' : '#6b7280'
                return (
                  <TableRow key={unit.id} className="border-b border-border hover:bg-muted/40">
                    <TableCell className="pl-5 py-2.5">
                      <p className="text-sm font-medium text-foreground">{tenant.name}</p>
                      {tenant.phone && <p className="text-xs text-muted-foreground mt-0.5">{tenant.phone}</p>}
                    </TableCell>
                    <TableCell className="text-sm text-foreground">{unit.unitNumber}</TableCell>
                    <TableCell className="text-sm text-foreground">{propertyName}</TableCell>
                    <TableCell className="text-sm text-foreground">
                      {tenant.moveInDate ? new Date(tenant.moveInDate).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {tenant.leaseEnd ? new Date(tenant.leaseEnd).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : <span className="text-muted-foreground">Open-ended</span>}
                    </TableCell>
                    <TableCell className="pr-5">
                      {daysLeft === null
                        ? <span className="text-xs text-muted-foreground">—</span>
                        : <span style={{ fontSize: 11, fontWeight: 700, color: col, background: `${col}18`, border: `1px solid ${col}33`, borderRadius: 5, padding: '2px 7px' }}>
                            {isExpired ? `${Math.abs(daysLeft)}d ago` : daysLeft === 0 ? 'Today' : `${daysLeft}d`}
                          </span>}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <div className="border-t border-border px-5 py-3">
            <PaginationBar pagination={leasePg} hideWhenEmpty={false} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100svh', background: 'var(--background)' }}>
      {!isMobile && (
        <aside style={{ width: sidebarCollapsed ? 64 : 240, flexShrink: 0, background: 'var(--sidebar)', borderRight: '1px solid var(--sidebar-border)', position: 'sticky', top: 0, height: '100svh', transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)', overflow: 'hidden' }}>
          {sidebarContent}
        </aside>
      )}
      {isMobile && mobileNavOpen && (
        <>
          <div onClick={() => setMobileNavOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.4)' }} />
          <aside style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: 240, zIndex: 1201, background: 'var(--sidebar)', borderRight: '1px solid var(--sidebar-border)' }}>
            {sidebarContent}
          </aside>
        </>
      )}
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>
        {isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--card)', position: 'sticky', top: 0, zIndex: 100 }}>
            <button type="button" onClick={() => setMobileNavOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--foreground)', padding: 4, display: 'flex', alignItems: 'center' }}>
              <Menu size={22} />
            </button>
            <span style={{ fontSize: 15, fontWeight: 700 }}>
              {sidebarTab === 'overview' ? 'Overview' : sidebarTab === 'units' ? 'Properties' : sidebarTab === 'tenants' ? 'Tenants' : sidebarTab === 'rent' ? 'Rent' : sidebarTab === 'maintenance' ? 'Maintenance' : 'Leases'}
            </span>
          </div>
        )}
        <div style={{ padding: '20px 24px 60px', flex: 1 }}>
          {error && sidebarTab !== 'overview' && <p className="scanny-error" style={{ marginBottom: 16 }}>{error}</p>}
          {sidebarTab === 'units' && (selectedProperty ? (
            <PropertyView propertyId={selectedProperty.id} role={selectedProperty.role} onBack={() => setSelectedProperty(null)} />
          ) : (
            <PortfolioList portfolio={portfolio} onSelect={(id, role) => setSelectedProperty({ id, role })} onAddProperty={() => setShowAdd(true)} />
          ))}
          {sidebarTab === 'overview' && renderOverview()}
          {sidebarTab === 'tenants' && renderTenants()}
          {sidebarTab === 'rent' && renderRent()}
          {sidebarTab === 'maintenance' && renderMaintenance()}
          {sidebarTab === 'leases' && renderLeases()}
        </div>
      </main>
      {showAdd && <AddPropertyModal onCreated={handleCreatedProperty} onClose={() => setShowAdd(false)} />}
      {showLogoutConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setShowLogoutConfirm(false)}>
          <div style={{ background: 'var(--card)', borderRadius: 16, padding: '24px', maxWidth: 360, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800 }}>Log out?</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--muted-foreground)' }}>You'll need to sign in again to access the dashboard.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setShowLogoutConfirm(false)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600 }}>Cancel</button>
              <button type="button" onClick={handleLogout} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: 'var(--destructive, #dc2626)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700 }}>Log out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
