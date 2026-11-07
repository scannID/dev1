import { useEffect, useState, useCallback } from 'react'
import {
  Building2,
  Search,
  Users,
  ChevronRight,
  X,
  Check,
  Pencil,
  QrCode,
  Copy,
  ArrowLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { InlineSpinner } from '../components/LoadingSpinner'
import { PaginationBar } from '../components/PaginationBar'
import { useServerPagination } from '../hooks/useServerPagination'
import { rentAdminApi } from '../api/services'
import type { AdminPropertyRow, AdminPropertyDetail, AdminRentSummary } from '../api/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function ugx(amount: number) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0,
  }).format(amount)
}

function fmtLateFee(type: string, amount: number): string {
  if (type === 'FLAT')    return ugx(amount)
  if (type === 'PERCENT') return `${(amount / 100).toFixed(2)}%`
  return 'None'
}

function fmtPlatformFee(override: number): string {
  if (override > 0) return ugx(override) + ' (override)'
  return 'Platform default'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function RentPropertiesPage() {
  const [query, setQuery]         = useState('')
  const [summary, setSummary]     = useState<AdminRentSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [totalItems, setTotalItems] = useState(0)

  const pagination = useServerPagination({ totalItems, initialPageSize: 25, resetKey: query })

  const [properties, setProperties]     = useState<AdminPropertyRow[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)

  // ── Detail view (replaces list) ───────────────────────────────────────────
  const [selectedId, setSelectedId]     = useState<string | null>(null)
  const [detail, setDetail]             = useState<AdminPropertyDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailTab, setDetailTab]       = useState<'units' | 'config' | 'info'>('units')

  // ── Fee edit ──────────────────────────────────────────────────────────────
  const [editingFees, setEditingFees]   = useState(false)
  const [feeSaving, setFeeSaving]       = useState(false)
  const [feeForm, setFeeForm]           = useState({
    lateFeeType: 'NONE',
    lateFeeAmount: '0',
    platformFeeOverride: '0',
  })

  // ── QR copy ───────────────────────────────────────────────────────────────
  const [qrCopied, setQrCopied] = useState(false)

  // ── Load summary ──────────────────────────────────────────────────────────
  useEffect(() => {
    setSummaryLoading(true)
    rentAdminApi.getSummary()
      .then((s) => setSummary(s))
      .catch(() => {})
      .finally(() => setSummaryLoading(false))
  }, [])

  // ── Load properties list ──────────────────────────────────────────────────
  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    rentAdminApi.listProperties({
      page: pagination.page,
      limit: pagination.pageSize,
      search: query || undefined,
    })
      .then((res) => {
        setProperties(res.properties)
        setTotalItems(res.total)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load properties'))
      .finally(() => setLoading(false))
  }, [pagination.page, pagination.pageSize, query])

  useEffect(() => { load() }, [load])

  // ── Load detail ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedId) { setDetail(null); return }
    setDetailLoading(true)
    rentAdminApi.getProperty(selectedId)
      .then((d) => {
        setDetail(d)
        setFeeForm({
          lateFeeType: d.property.lateFeeType ?? 'NONE',
          lateFeeAmount: String(d.property.lateFeeAmount ?? 0),
          platformFeeOverride: String(d.property.platformFeeOverride ?? 0),
        })
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load property'))
      .finally(() => setDetailLoading(false))
  }, [selectedId])

  // ── Save fees ─────────────────────────────────────────────────────────────
  async function saveFees() {
    if (!selectedId) return
    setFeeSaving(true)
    try {
      await rentAdminApi.updateFees(selectedId, {
        lateFeeType: feeForm.lateFeeType,
        lateFeeAmount: Number(feeForm.lateFeeAmount) || 0,
        platformFeeOverride: Number(feeForm.platformFeeOverride) || 0,
      })
      toast.success('Fee configuration saved')
      setEditingFees(false)
      load()
      const d = await rentAdminApi.getProperty(selectedId)
      setDetail(d)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save fees')
    } finally {
      setFeeSaving(false)
    }
  }

  // ── Copy QR URL ───────────────────────────────────────────────────────────
  function copyQrUrl(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setQrCopied(true)
      setTimeout(() => setQrCopied(false), 2000)
    }).catch(() => toast.error('Could not copy link'))
  }

  // ── Detail view ───────────────────────────────────────────────────────────
  if (selectedId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Back + header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={() => { setSelectedId(null); setEditingFees(false); setDetailTab('units') }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', fontSize: 13, fontFamily: 'inherit', padding: 0 }}
          >
            <ArrowLeft size={14} /> Properties
          </button>
          {detail && (
            <>
              <span style={{ color: 'var(--border)' }}>/</span>
              <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{detail.property.city || 'No city'}</span>
            </>
          )}
        </div>

        {detailLoading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
            <InlineSpinner label="Loading property…" />
          </div>
        ) : detail ? (
          <>
            {/* ── Title row ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
                {detail.property.name}
              </h2>
            </div>

            {/* ── Tabs ── */}
            <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)' }}>
              {(['units', 'config', 'info'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setDetailTab(tab)}
                  style={{
                    padding: '8px 16px', fontSize: 13, fontWeight: 600, background: 'none', border: 'none',
                    borderBottom: detailTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
                    color: detailTab === tab ? 'var(--primary)' : 'var(--muted-foreground)',
                    cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1, textTransform: 'capitalize',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* ══ UNITS TAB ══ */}
            {detailTab === 'units' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>

                {/* Left: stats + table */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* Stats row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                    {[
                      { label: 'Units',    value: detail.totalUnits },
                      { label: 'Occupied', value: detail.occupiedUnits },
                      { label: 'Overdue',  value: detail.overdueCount, danger: detail.overdueCount > 0 },
                    ].map((s, i) => (
                      <div key={s.label} style={{ padding: '14px 18px', borderRight: i < 2 ? '1px solid var(--border)' : undefined, background: 'var(--card)' }}>
                        <p style={{ margin: 0, fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 500 }}>{s.label}</p>
                        <p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 700, color: s.danger ? 'var(--destructive)' : 'var(--foreground)' }}>
                          {String(s.value)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Units table */}
                  <div className="admin-card">
                    <div className="admin-card-header">
                      <div>
                        <h3>Units</h3>
                        <p>Tenants and payment status</p>
                      </div>
                    </div>
                    <div className="admin-table-wrap">
                      <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)' }}>
                            {['Unit', 'Tenant', 'Monthly rent', 'Status'].map((h) => (
                              <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {detail.tenants.length === 0 ? (
                            <tr>
                              <td colSpan={4} style={{ padding: '20px 16px', color: 'var(--muted-foreground)', fontSize: 13 }}>
                                No active tenants.
                              </td>
                            </tr>
                          ) : (
                            detail.tenants.map((t) => (
                              <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--foreground)', verticalAlign: 'top' }}>
                                  {t.unitNumber}
                                </td>
                                <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary)', color: 'var(--primary-foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                                      {t.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{t.name}</p>
                                      <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--muted-foreground)' }}>
                                        {t.phone}
                                        {t.moveInDate ? ` · since ${fmtDate(t.moveInDate)}` : ''}
                                      </p>
                                      {t.leaseEnd && (
                                        <p style={{ margin: '1px 0 0', fontSize: 10, color: 'var(--muted-foreground)' }}>
                                          ends {t.leaseEnd.slice(0, 10)}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td style={{ padding: '12px 16px', fontFamily: 'monospace', verticalAlign: 'top' }}>
                                  {ugx(t.monthlyAmount)}
                                </td>
                                <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">Active</Badge>
                                </td>
                              </tr>
                            ))
                          )}
                          {/* Vacant rows */}
                          {detail.totalUnits > detail.tenants.length && (
                            Array.from({ length: detail.totalUnits - detail.tenants.length }).map((_, i) => (
                              <tr key={`vacant-${i}`} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--muted-foreground)' }}>—</td>
                                <td style={{ padding: '12px 16px' }}>
                                  <span style={{ fontSize: 13, color: 'var(--muted-foreground)', fontStyle: 'italic' }}>Vacant</span>
                                </td>
                                <td style={{ padding: '12px 16px' }}>—</td>
                                <td style={{ padding: '12px 16px' }}>
                                  <Badge variant="secondary">Vacant</Badge>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Right: Property QR */}
                <div className="admin-card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <QrCode size={14} style={{ color: 'var(--muted-foreground)' }} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Property QR</span>
                    </div>
                  </div>

                  {/* QR code image */}
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                    <img
                      src={`${detail.property.qrCodeUrl?.replace('/rent/pay/', '/api/public/rent/pay/').replace(/\/rent\/pay\/(.+)$/, '/api/public/rent/qr/$1') ?? ''}`}
                      alt="Property QR"
                      style={{ width: 160, height: 160, border: '1px solid var(--border)', borderRadius: 8 }}
                      onError={(e) => {
                        // fallback: show a placeholder if QR image fails
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  </div>

                  <p style={{ margin: '0 0 12px', fontSize: 11, color: 'var(--muted-foreground)', textAlign: 'center', lineHeight: 1.5 }}>
                    Place at the building entrance. Tenants scan, pick their unit, then pay or view activity.
                  </p>

                  {/* URL */}
                  <div style={{ padding: '8px 10px', background: 'var(--muted)', borderRadius: 6, marginBottom: 10, fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {detail.property.qrCodeUrl || '—'}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-1"
                      onClick={() => detail.property.qrCodeUrl && copyQrUrl(detail.property.qrCodeUrl)}
                    >
                      <Copy size={12} />
                      {qrCopied ? 'Copied!' : 'Copy link'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => detail.property.qrCodeUrl && window.open(detail.property.qrCodeUrl, '_blank')}
                    >
                      Open link
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ══ CONFIG TAB ══ */}
            {detailTab === 'config' && (
              <div style={{ maxWidth: 560 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Fee Configuration</h3>
                  {!editingFees && (
                    <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => setEditingFees(true)}>
                      <Pencil size={11} /> Edit
                    </Button>
                  )}
                </div>

                {!editingFees ? (
                  <div style={{ display: 'grid', gap: 12 }}>
                    {[
                      { label: 'Late fee type',   value: detail.property.lateFeeType },
                      { label: 'Late fee amount', value: fmtLateFee(detail.property.lateFeeType, detail.property.lateFeeAmount) },
                      { label: 'Platform fee',    value: fmtPlatformFee(detail.property.platformFeeOverride) },
                    ].map((r) => (
                      <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--muted)', borderRadius: 8 }}>
                        <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{r.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <Label>Late fee type</Label>
                      <Select value={feeForm.lateFeeType} onValueChange={(v) => setFeeForm((f) => ({ ...f, lateFeeType: v }))}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE">None — no late fee</SelectItem>
                          <SelectItem value="FLAT">Flat amount (UGX)</SelectItem>
                          <SelectItem value="PERCENT">Percentage of rent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {feeForm.lateFeeType !== 'NONE' && (
                      <div style={{ display: 'grid', gap: 6 }}>
                        <Label>{feeForm.lateFeeType === 'FLAT' ? 'Late fee amount (UGX)' : 'Late fee percentage (e.g. 5.00 for 5%)'}</Label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Input
                            type="number" min={0} step={feeForm.lateFeeType === 'PERCENT' ? 0.01 : 1000}
                            value={feeForm.lateFeeType === 'PERCENT' ? (Number(feeForm.lateFeeAmount) / 100).toFixed(2) : feeForm.lateFeeAmount}
                            onChange={(e) => {
                              const raw = Number(e.target.value) || 0
                              setFeeForm((f) => ({ ...f, lateFeeAmount: String(f.lateFeeType === 'PERCENT' ? Math.round(raw * 100) : Math.round(raw)) }))
                            }}
                            className="h-9 text-sm w-40"
                          />
                          {feeForm.lateFeeType === 'PERCENT' && <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>%</span>}
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'grid', gap: 6 }}>
                      <Label>Platform fee override (UGX)</Label>
                      <Input type="number" min={0} step={500} value={feeForm.platformFeeOverride} onChange={(e) => setFeeForm((f) => ({ ...f, platformFeeOverride: e.target.value }))} className="h-9 text-sm w-40" />
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--muted-foreground)' }}>0 = use platform-wide default.</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button size="sm" className="gap-1" disabled={feeSaving} onClick={() => void saveFees()}>
                        {feeSaving ? <InlineSpinner label="" /> : <Check size={13} />}
                        {feeSaving ? 'Saving…' : 'Save fees'}
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1" disabled={feeSaving} onClick={() => setEditingFees(false)}>
                        <X size={13} /> Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ══ INFO TAB ══ */}
            {detailTab === 'info' && (
              <div style={{ maxWidth: 560, display: 'grid', gap: 12 }}>
                {[
                  { label: 'ID',       value: detail.property.id,          mono: true },
                  { label: 'Name',     value: detail.property.name },
                  { label: 'Address',  value: detail.property.address || '—' },
                  { label: 'City',     value: detail.property.city || '—' },
                  { label: 'Owner',    value: detail.property.ownerName },
                  { label: 'MoMo',     value: detail.property.ownerMomo,   mono: true },
                  { label: 'Currency', value: detail.property.currency },
                  { label: 'Created',  value: fmtDate(detail.property.createdAt) },
                ].map((r) => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--muted)', borderRadius: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{r.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', fontFamily: r.mono ? 'monospace' : undefined, wordBreak: 'break-all', textAlign: 'right', maxWidth: '60%' }}>{r.value}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    )
  }

  // ── List view ─────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Summary cards ── */}
      <div className="admin-metric-grid cols-2">
        {[
          {
            label: 'Total Properties',
            value: summaryLoading ? '…' : String(summary?.totalProperties ?? '—'),
            sub: 'Across all managers',
            icon: <Building2 size={16} />,
          },
          {
            label: 'Active Tenants',
            value: summaryLoading ? '…' : String(summary?.activeTenants ?? '—'),
            sub: 'Currently occupying a unit',
            icon: <Users size={16} />,
          },
        ].map((c) => (
          <div key={c.label} className="admin-metric-card">
            <span className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {c.icon} {c.label}
            </span>
            <span className="metric-value">{c.value}</span>
            <span className="metric-sub">{c.sub}</span>
          </div>
        ))}
      </div>

      {/* ── Properties table ── */}
      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <h3>All Properties</h3>
            <p>{totalItems} properties across all managers</p>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, city, owner…" className="h-8 pl-8 w-64 text-sm" />
          </div>
        </div>

        {error && <div style={{ padding: '12px 20px', color: 'var(--destructive)', fontSize: 13 }}>{error}</div>}

        <div className="admin-table-wrap">
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Property', 'City', 'Owner', 'Units', 'Tenants', 'Created', ''].map((h) => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: 20 }}><InlineSpinner label="Loading properties…" /></td></tr>
              ) : properties.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 20, color: 'var(--muted-foreground)', fontSize: 13 }}>No properties found.</td></tr>
              ) : (
                properties.map((p) => (
                  <tr
                    key={p.id}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--muted)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    onClick={() => { setSelectedId(p.id); setDetailTab('units'); setEditingFees(false) }}
                  >
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--foreground)' }}>{p.name}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)' }}>{p.city || '—'}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)' }}>{p.ownerName}</td>
                    <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>{p.unitCount}</td>
                    <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>{p.activeTenantCount}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--muted-foreground)', whiteSpace: 'nowrap', fontSize: 12 }}>{fmtDate(p.createdAt)}</td>
                    <td style={{ padding: '10px 16px' }}><ChevronRight size={14} style={{ color: 'var(--muted-foreground)' }} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar pagination={pagination} hideWhenEmpty={false} />
      </div>
    </>
  )
}
