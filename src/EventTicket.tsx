import { getWsBaseUrl } from './lib/realtime'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import { ticketsApi, publicTicketsApi } from './api/services'
import type { TicketStats } from './api/types'
import { bindThemeHotkey } from './lib/theme'
/* ─── Theme tokens (follow app light / dark via CSS vars) ───────────── */
const G = {
  bg: 'var(--background)',
  panel: 'var(--card)',
  card: 'var(--card)',
  cardAlt: 'var(--muted)',
  border: 'var(--border)',
  borderSoft: 'var(--border)',
  gold: 'var(--primary)',
  goldBright: 'var(--primary)',
  goldDim: 'var(--muted-foreground)',
  goldText: 'var(--muted-foreground)',
  white: 'var(--foreground)',
  muted: 'var(--muted-foreground)',
  danger: 'var(--destructive)',
  primaryFg: 'var(--primary-foreground)',
  accentSoft: 'color-mix(in srgb, var(--primary) 14%, transparent)',
  borderIdle: 'color-mix(in srgb, var(--foreground) 12%, transparent)',
  surfaceIdle: 'color-mix(in srgb, var(--foreground) 4%, transparent)',
  inputBg: 'var(--background)',
}

/* Fixed palette for the Gold ticket visual only */
const GOLD_VISUAL = {
  gold: '#c9a86c',
  goldBright: '#e0c48a',
  goldDim: '#9a7f4f',
}

const MASTER_IMG =
  'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1200&q=80'
const HOST_AVATAR =
  'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=120&q=80'

/* ─── Types ─────────────────────────────────────────────────────────── */
type TemplateId = 'classic' | 'festival' | 'minimal' | 'gold'

type TicketClass = {
  id: string
  name: string
  fee: string
}

type TableOption = {
  id: string
  name: string
  seats: string
  price: string
}

export type EventTicketVisual = {
  eventName: string
  date: string
  time?: string
  location?: string
  host?: string
  paymentDetails: string
  template: TemplateId
  ticketClasses: TicketClass[]
  tables: TableOption[]
  ticketId: string
  selectedClass: string
  purchaseUrl?: string
}

type TicketData = EventTicketVisual

/* ─── Helpers ───────────────────────────────────────────────────────── */
function currency(val: string) {
  const n = Number(String(val).replace(/[^0-9]/g, ''))
  if (!n) return 'UGX —'
  return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-UG', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })
}

function fmtDateShort(d: string) {
  if (!d) return 'TBD'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtTime(t: string) {
  if (!t) return 'TBD'
  const [h, m] = t.split(':').map(Number)
  if (Number.isNaN(h)) return t
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = ((h + 11) % 12) + 1
  return `${String(hour).padStart(2, '0')}:${String(m || 0).padStart(2, '0')} ${ampm}`
}

/** Phone can't open localhost — rewrite API scan URLs to the LAN scan base. */
function rewriteScanUrl(url: string) {
  if (!url) return url
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') return url
    const configured = String(import.meta.env.VITE_SCAN_BASE_URL || '').replace(/\/$/, '')
    const origin =
      configured && !/localhost|127\.0\.0\.1/i.test(configured)
        ? configured
        : typeof window !== 'undefined'
          ? window.location.origin
          : 'http://localhost:5173'
    return `${origin}${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return url
  }
}

function uid() {
  return 'TKT-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase()
}

function shortId() {
  return Math.random().toString(36).slice(2, 8)
}

const CLASS_ACCENT: Record<string, string> = {
  Ordinary: '#0f766e',
  VIP: '#7c3aed',
  VVIP: '#b45309',
}

function classAccent(name: string) {
  return CLASS_ACCENT[name] ?? '#2563eb'
}

/* ═══════════════════════════════════════════════════════════════════════
   TICKET RENDERERS (purchase / view pages)
   ═══════════════════════════════════════════════════════════════════════ */

function ClassicTicket({ d, qr, small }: { d: Partial<TicketData>; qr?: string; small?: boolean }) {
  const scale = small ? 0.52 : 1
  const cls = d.selectedClass || d.ticketClasses?.[0]?.name || 'Ordinary'
  const fee = d.ticketClasses?.find((c) => c.name === cls)?.fee || ''
  const accent = classAccent(cls)
  return (
    <div style={{ width: 520, transformOrigin: 'top left', transform: `scale(${scale})`, fontFamily: "'Outfit Variable', Outfit, ui-sans-serif, system-ui, sans-serif", background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: small ? 'none' : '0 24px 60px rgba(0,0,0,0.4)' }}>
      <div style={{ background: accent, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Scanny · Event Ticket</p>
          <h2 style={{ margin: '5px 0 0', color: '#fff', fontSize: 22, fontWeight: 900, lineHeight: 1.2, letterSpacing: '-0.02em' }}>{d.eventName || 'Event Name'}</h2>
        </div>
        <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 12, fontWeight: 800, padding: '4px 14px', borderRadius: 20, whiteSpace: 'nowrap', marginTop: 4, letterSpacing: '0.04em' }}>{cls}</span>
      </div>
      <div style={{ position: 'relative', height: 22, background: '#fff', display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: -12, width: 24, height: 24, borderRadius: '50%', background: '#f3f4f6' }} />
        <div style={{ flex: 1, margin: '0 20px', borderTop: '2px dashed #d1d5db' }} />
        <div style={{ position: 'absolute', right: -12, width: 24, height: 24, borderRadius: '50%', background: '#f3f4f6' }} />
      </div>
      <div style={{ padding: '4px 24px 22px', display: 'grid', gridTemplateColumns: '1fr 130px', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 14 }}>
          {[
            ['Date', fmtDate(d.date || '')],
            ['Fee', currency(fee)],
            ['Pay to', d.paymentDetails || '—'],
            ['Ticket ID', d.ticketId || 'TKT-PREVIEW'],
          ].map(([label, val]) => (
            <div key={label}>
              <p style={{ margin: '0 0 2px', fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: accent }}>{label}</p>
              <p style={{ margin: 0, fontSize: label === 'Fee' ? 18 : 13, fontWeight: label === 'Fee' ? 900 : 600, color: '#111827', letterSpacing: label === 'Fee' ? '-0.02em' : 0, fontFamily: label === 'Ticket ID' ? 'monospace' : 'inherit' }}>{val}</p>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingTop: 4 }}>
          {qr ? (
            <img src={qr} alt="QR" style={{ width: 120, height: 120, borderRadius: 8, border: `2px solid ${accent}33` }} />
          ) : (
            <div style={{ width: 120, height: 120, borderRadius: 8, background: '#f9fafb', border: '2px dashed #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>QR code</div>
          )}
          <p style={{ margin: 0, fontSize: 9, color: '#9ca3af', textAlign: 'center' }}>Paid receipt</p>
        </div>
      </div>
      <div style={{ background: '#f9fafb', borderTop: '1px dashed #e5e7eb', padding: '9px 24px', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: accent, fontWeight: 700 }}>scanny.app · Powered by Scanny</span>
        <span style={{ fontSize: 10, color: '#9ca3af' }}>Non-transferable</span>
      </div>
    </div>
  )
}

function FestivalTicket({ d, qr, small }: { d: Partial<TicketData>; qr?: string; small?: boolean }) {
  const scale = small ? 0.52 : 1
  const cls = d.selectedClass || d.ticketClasses?.[0]?.name || 'Ordinary'
  const fee = d.ticketClasses?.find((c) => c.name === cls)?.fee || ''
  return (
    <div style={{ width: 520, transformOrigin: 'top left', transform: `scale(${scale})`, fontFamily: "'Outfit Variable', Outfit, ui-sans-serif, system-ui, sans-serif", background: '#0d1117', borderRadius: 16, overflow: 'hidden', boxShadow: small ? 'none' : '0 24px 60px rgba(0,0,0,0.6)', border: '1px solid #30363d' }}>
      <div style={{ height: 4, background: 'linear-gradient(90deg,#7c3aed,#db2777,#f59e0b)' }} />
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #21262d', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', background: 'linear-gradient(90deg,#c084fc,#f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Scanny · Festival Ticket</p>
          <h2 style={{ margin: 0, color: '#f0f6fc', fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{d.eventName || 'Event Name'}</h2>
        </div>
        <span style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)', color: '#fff', fontSize: 12, fontWeight: 800, padding: '4px 14px', borderRadius: 20, whiteSpace: 'nowrap', marginTop: 4 }}>{cls}</span>
      </div>
      <div style={{ padding: '18px 24px', display: 'grid', gridTemplateColumns: '1fr 130px', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 14 }}>
          {(
            [
              ['Date', fmtDate(d.date || ''), '#c084fc'],
              ['Fee', currency(fee), '#34d399'],
              ['Pay to', d.paymentDetails || '—', '#60a5fa'],
              ['Ticket ID', d.ticketId || 'TKT-PREVIEW', '#9ca3af'],
            ] as const
          ).map(([label, val, col]) => (
            <div key={label}>
              <p style={{ margin: '0 0 2px', fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: col }}>{label}</p>
              <p style={{ margin: 0, fontSize: label === 'Fee' ? 20 : 13, fontWeight: label === 'Fee' ? 900 : 600, color: '#f0f6fc', fontFamily: label === 'Ticket ID' ? 'monospace' : 'inherit' }}>{val}</p>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingTop: 4 }}>
          {qr ? (
            <img src={qr} alt="QR" style={{ width: 120, height: 120, borderRadius: 8, border: '2px solid #7c3aed44' }} />
          ) : (
            <div style={{ width: 120, height: 120, borderRadius: 8, background: '#161b22', border: '2px dashed #7c3aed44', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#c084fc', fontWeight: 600 }}>QR code</div>
          )}
          <p style={{ margin: 0, fontSize: 9, color: '#6e7681', textAlign: 'center' }}>Paid receipt</p>
        </div>
      </div>
      <div style={{ background: '#161b22', borderTop: '1px solid #21262d', padding: '9px 24px', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, fontWeight: 700, background: 'linear-gradient(90deg,#c084fc,#f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>scanny.app</span>
        <span style={{ fontSize: 10, color: '#6e7681' }}>Non-transferable</span>
      </div>
    </div>
  )
}

function MinimalTicket({ d, qr, small }: { d: Partial<TicketData>; qr?: string; small?: boolean }) {
  const scale = small ? 0.52 : 1
  const cls = d.selectedClass || d.ticketClasses?.[0]?.name || 'Ordinary'
  const fee = d.ticketClasses?.find((c) => c.name === cls)?.fee || ''
  return (
    <div style={{ width: 520, transformOrigin: 'top left', transform: `scale(${scale})`, fontFamily: "'Outfit Variable', Outfit, ui-sans-serif, system-ui, sans-serif", background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: small ? 'none' : '0 24px 60px rgba(0,0,0,0.35)', border: '1px solid #e5e7eb' }}>
      <div style={{ height: 3, background: '#111827' }} />
      <div style={{ padding: '22px 28px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9ca3af' }}>Event Ticket</p>
          <h2 style={{ margin: 0, color: '#111827', fontSize: 22, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.2 }}>{d.eventName || 'Event Name'}</h2>
        </div>
        <span style={{ background: '#f9fafb', border: '1px solid #e5e7eb', color: '#374151', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 6, whiteSpace: 'nowrap', marginTop: 4 }}>{cls}</span>
      </div>
      <div style={{ padding: '20px 28px', display: 'grid', gridTemplateColumns: '1fr 130px', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 14 }}>
          {[
            ['Date', fmtDate(d.date || '')],
            ['Ticket fee', currency(fee)],
            ['Pay to', d.paymentDetails || '—'],
            ['Ticket ID', d.ticketId || 'TKT-PREVIEW'],
          ].map(([label, val]) => (
            <div key={label} style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: 10 }}>
              <p style={{ margin: '0 0 2px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af' }}>{label}</p>
              <p style={{ margin: 0, fontSize: label === 'Ticket fee' ? 19 : 13, fontWeight: label === 'Ticket fee' ? 900 : 600, color: '#111827', fontFamily: label === 'Ticket ID' ? 'monospace' : 'inherit' }}>{val}</p>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingTop: 4 }}>
          {qr ? (
            <img src={qr} alt="QR" style={{ width: 120, height: 120, borderRadius: 6, border: '1px solid #e5e7eb' }} />
          ) : (
            <div style={{ width: 120, height: 120, borderRadius: 6, background: '#f9fafb', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>QR code</div>
          )}
          <p style={{ margin: 0, fontSize: 9, color: '#9ca3af', textAlign: 'center' }}>Paid receipt</p>
        </div>
      </div>
      <div style={{ background: '#f9fafb', borderTop: '1px solid #e5e7eb', padding: '9px 28px', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 600 }}>scanny.app · Powered by Scanny</span>
        <span style={{ fontSize: 10, color: '#9ca3af' }}>Non-transferable</span>
      </div>
    </div>
  )
}

function GoldTicket({ d, qr, small }: { d: Partial<TicketData>; qr?: string; small?: boolean }) {
  const scale = small ? 0.52 : 1
  const cls = d.selectedClass || d.ticketClasses?.[0]?.name || 'VIP'
  const fee = d.ticketClasses?.find((c) => c.name === cls)?.fee || ''
  return (
    <div style={{ width: 520, transformOrigin: 'top left', transform: `scale(${scale})`, fontFamily: "'Outfit Variable', Outfit, ui-sans-serif, system-ui, sans-serif", background: '#0c0a06', borderRadius: 16, overflow: 'hidden', boxShadow: small ? 'none' : '0 24px 60px rgba(0,0,0,0.55)', border: '1px solid rgba(201,168,108,0.45)' }}>
      <div style={{ padding: '22px 24px 16px', background: 'linear-gradient(135deg,#1a160c,#0c0a06)', borderBottom: '1px solid rgba(201,168,108,0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: GOLD_VISUAL.gold }}>Scanny · Gold Reserve</p>
          <h2 style={{ margin: 0, color: '#f8f1e3', fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{d.eventName || 'Event Name'}</h2>
        </div>
        <span style={{ background: 'rgba(201,168,108,0.18)', border: '1px solid rgba(201,168,108,0.5)', color: GOLD_VISUAL.goldBright, fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 20, whiteSpace: 'nowrap', marginTop: 4 }}>{cls}</span>
      </div>
      <div style={{ padding: '18px 24px', display: 'grid', gridTemplateColumns: '1fr 130px', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 14 }}>
          {[
            ['Date', fmtDate(d.date || '')],
            ['Fee', currency(fee)],
            ['Pay to', d.paymentDetails || '—'],
            ['Ticket ID', d.ticketId || 'TKT-PREVIEW'],
          ].map(([label, val]) => (
            <div key={label}>
              <p style={{ margin: '0 0 2px', fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: GOLD_VISUAL.goldDim }}>{label}</p>
              <p style={{ margin: 0, fontSize: label === 'Fee' ? 19 : 13, fontWeight: label === 'Fee' ? 900 : 600, color: '#f5efe3', fontFamily: label === 'Ticket ID' ? 'monospace' : 'inherit' }}>{val}</p>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingTop: 4 }}>
          {qr ? (
            <img src={qr} alt="QR" style={{ width: 120, height: 120, borderRadius: 8, border: '2px solid rgba(201,168,108,0.4)' }} />
          ) : (
            <div style={{ width: 120, height: 120, borderRadius: 8, background: '#15120c', border: '2px dashed rgba(201,168,108,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: GOLD_VISUAL.gold, fontWeight: 600 }}>QR code</div>
          )}
          <p style={{ margin: 0, fontSize: 9, color: GOLD_VISUAL.goldDim, textAlign: 'center' }}>Paid receipt</p>
        </div>
      </div>
      <div style={{ background: '#15120c', borderTop: '1px solid rgba(201,168,108,0.2)', padding: '9px 24px', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: GOLD_VISUAL.gold, fontWeight: 700 }}>scanny.app · Gold Reserve</span>
        <span style={{ fontSize: 10, color: '#6b5a3e' }}>Non-transferable</span>
      </div>
    </div>
  )
}

export function TicketRenderer({ d, qr, small }: { d: Partial<EventTicketVisual>; qr?: string; small?: boolean }) {
  if (d.template === 'festival') return <FestivalTicket d={d} qr={qr} small={small} />
  if (d.template === 'minimal') return <MinimalTicket d={d} qr={qr} small={small} />
  if (d.template === 'gold') return <GoldTicket d={d} qr={qr} small={small} />
  return <ClassicTicket d={d} qr={qr} small={small} />
}

/* ─── Shared styles ─────────────────────────────────────────────────── */
function fieldStyle(hasError?: boolean): CSSProperties {
  return {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    fontSize: 14,
    fontFamily: 'inherit',
    background: G.inputBg,
    color: G.white,
    outline: 'none',
    border: `1px solid ${hasError ? G.danger : G.border}`,
  }
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span style={{ color: G.goldText, fontSize: 12, fontWeight: 600, letterSpacing: '0.02em' }}>
      {children}
    </span>
  )
}

function Stepper({
  steps,
  active,
}: {
  steps: { id: string; label: string }[]
  active: number
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 36, marginBottom: 14 }}>
      {steps.map((s, i) => {
        const on = i === active
        const done = i < active
        return (
          <div
            key={s.id}
            style={{
              position: 'relative',
              paddingBottom: 10,
              color: on || done ? G.goldBright : G.muted,
              fontSize: 13,
              fontWeight: on ? 700 : 500,
              letterSpacing: '0.02em',
            }}
          >
            {s.label}
            {on ? (
              <span
                style={{
                  position: 'absolute',
                  left: '50%',
                  bottom: 0,
                  transform: 'translateX(-50%)',
                  width: '100%',
                  height: 2,
                  borderRadius: 2,
                  background: G.gold,
                }}
              />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

/* ─── Classes / tables editors ──────────────────────────────────────── */
const DEFAULT_CLASSES: TicketClass[] = [
  { id: shortId(), name: 'Ordinary', fee: '' },
  { id: shortId(), name: 'VIP', fee: '' },
]

const PRESET_NAMES = ['Ordinary', 'VIP', 'VVIP']

function ClassesEditor({ classes, onChange }: { classes: TicketClass[]; onChange: (c: TicketClass[]) => void }) {
  function updateClass(id: string, field: keyof TicketClass, val: string) {
    onChange(classes.map((c) => (c.id === id ? { ...c, [field]: val } : c)))
  }
  function removeClass(id: string) {
    onChange(classes.filter((c) => c.id !== id))
  }
  function addClass() {
    onChange([...classes, { id: shortId(), name: '', fee: '' }])
  }

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <FieldLabel>Ticket classes</FieldLabel>
        <button
          type="button"
          onClick={addClass}
          style={{
            background: G.accentSoft,
            border: `1px solid ${G.border}`,
            color: G.goldBright,
            fontSize: 11,
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          + Add class
        </button>
      </div>
      {classes.map((cls) => (
        <div key={cls.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 36px', gap: 6, alignItems: 'center' }}>
          <input list={`class-names-${cls.id}`} value={cls.name} onChange={(e) => updateClass(cls.id, 'name', e.target.value)} placeholder="e.g. VIP" style={fieldStyle()} />
          <datalist id={`class-names-${cls.id}`}>
            {PRESET_NAMES.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <input type="number" min="0" value={cls.fee} onChange={(e) => updateClass(cls.id, 'fee', e.target.value)} placeholder="Fee UGX" style={fieldStyle()} />
          <button
            type="button"
            onClick={() => removeClass(cls.id)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.35)',
              color: G.danger,
              fontSize: 16,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

function TablesEditor({ tables, onChange }: { tables: TableOption[]; onChange: (t: TableOption[]) => void }) {
  function updateTable(id: string, field: keyof TableOption, val: string) {
    onChange(tables.map((t) => (t.id === id ? { ...t, [field]: val } : t)))
  }
  function removeTable(id: string) {
    onChange(tables.filter((t) => t.id !== id))
  }
  function addTable() {
    onChange([...tables, { id: shortId(), name: `Table ${tables.length + 1}`, seats: '', price: '' }])
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <FieldLabel>Tables (optional)</FieldLabel>
        <button
          type="button"
          onClick={addTable}
          style={{
            background: G.accentSoft,
            border: `1px solid ${G.border}`,
            color: G.goldBright,
            fontSize: 12,
            fontWeight: 700,
            padding: '6px 12px',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          + Add table
        </button>
      </div>
      {tables.length === 0 ? (
        <p style={{ margin: 0, color: G.muted, fontSize: 12 }}>No table bookings yet.</p>
      ) : (
        tables.map((t) => (
          <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 1fr 36px', gap: 8 }}>
            <input value={t.name} onChange={(e) => updateTable(t.id, 'name', e.target.value)} style={fieldStyle()} />
            <input type="number" min="1" value={t.seats} onChange={(e) => updateTable(t.id, 'seats', e.target.value)} placeholder="Seats" style={fieldStyle()} />
            <input type="number" min="0" value={t.price} onChange={(e) => updateTable(t.id, 'price', e.target.value)} placeholder="Price" style={fieldStyle()} />
            <button type="button" onClick={() => removeTable(t.id)} style={{ borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: G.danger, cursor: 'pointer' }}>
              ×
            </button>
          </div>
        ))
      )}
    </div>
  )
}

/* ─── Step 3: Ticket Generated ──────────────────────────────────────── */
function TicketOutput({
  data,
  qr,
  onCreateAnother,
  onRevoke,
  revoking,
  revokeMessage,
}: {
  data: TicketData
  qr: string
  onCreateAnother: () => void
  onRevoke: (ticketId: string) => Promise<void>
  revoking: boolean
  revokeMessage: string | null
}) {
  const purchaseUrl = data.purchaseUrl || ''

  async function qrToFile(): Promise<File | null> {
    if (!qr) return null
    try {
      const res = await fetch(qr)
      const blob = await res.blob()
      const safeName = (data.eventName || 'event').replace(/[^\w\-]+/g, '_').slice(0, 40)
      return new File([blob], `${safeName}-qr.png`, { type: 'image/png' })
    } catch {
      return null
    }
  }

  function downloadQr() {
    if (!qr) return
    const a = document.createElement('a')
    a.href = qr
    a.download = `${(data.eventName || 'event').replace(/[^\w\-]+/g, '_').slice(0, 40)}-qr.png`
    a.click()
  }

  async function handleShare() {
    if (!qr) {
      toast.error('QR code is not ready yet')
      return
    }
    try {
      const file = await qrToFile()
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: data.eventName,
          text: `QR code for ${data.eventName}`,
        })
        return
      }
      // Desktop / browsers without file share: download QR so it can be attached in WhatsApp
      downloadQr()
      toast.success('QR downloaded — attach the image in WhatsApp')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      downloadQr()
      toast.success('QR downloaded — attach the image in WhatsApp')
    }
  }

  function handlePrint() {
    window.print()
  }

  const actionBtn: CSSProperties = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '14px 16px',
    borderRadius: 12,
    background: G.card,
    border: `1px solid ${G.border}`,
    color: G.white,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
  }

  return (
    <div
      className="ticket-output-root"
      style={{
        minHeight: '100svh',
        width: '100%',
        background: G.bg,
        color: G.white,
        fontFamily: "'Outfit Variable', Outfit, ui-sans-serif, system-ui, sans-serif",
        padding: '36px 24px 48px',
        boxSizing: 'border-box',
      }}
    >
      <style>{`
        * { box-sizing: border-box; }
        .print-only { display: none !important; }
        @media print {
          @page { margin: 12mm; }
          html, body {
            background: #fff !important;
            color: #111 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .ticket-output-root {
            min-height: auto !important;
            padding: 0 !important;
            background: #fff !important;
            color: #111 !important;
          }
          .ticket-gen-grid { display: none !important; }
          .print-qr-img {
            width: 220px !important;
            height: 220px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
        @media (max-width: 960px) {
          .ticket-gen-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Print-only sheet — large QR always visible when printing */}
      <div className="print-only" style={{ textAlign: 'center', padding: 24, fontFamily: 'inherit' }}>
        <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#666' }}>
          Scanny · Master Pass
        </p>
        <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 800, color: '#111' }}>{data.eventName}</h1>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: '#444' }}>
          {fmtDateShort(data.date)} · {fmtTime(data.time || '')}
          {data.location ? ` · ${data.location}` : ''}
        </p>
        {qr ? (
          <img
            className="print-qr-img"
            src={qr}
            alt="Event QR code"
            width={220}
            height={220}
            style={{ width: 220, height: 220, display: '2px solid #111', borderRadius: 8, background: '#fff' }}
          />
        ) : (
          <p style={{ color: '#c00' }}>QR code unavailable</p>
        )}
        <p style={{ margin: '14px 0 0', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', color: '#111' }}>SCAN TO BUY / ENTER</p>
        <p style={{ margin: '8px 0 0', fontSize: 12, fontFamily: 'monospace', color: '#555' }}>#{data.ticketId}</p>
        {purchaseUrl ? (
          <p style={{ margin: '10px 0 0', fontSize: 10, color: '#888', wordBreak: 'break-all' }}>{purchaseUrl}</p>
        ) : null}
      </div>

      <div className="no-print" style={{ textAlign: 'center', marginBottom: 32 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            margin: '0 auto 14px',
            background: G.accentSoft,
            border: `1.5px solid ${G.gold}`,
            display: 'grid',
            placeItems: 'center',
            color: G.goldBright,
            fontSize: 20,
            fontWeight: 800,
          }}
        >
          ✓
        </div>
        <h1 style={{ margin: '0 0 8px', fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em' }}>Ticket Generated</h1>
        <p style={{ margin: 0, color: G.goldText, fontSize: 15 }}>Your event is live. The master access pass is ready for distribution.</p>
      </div>

      {revokeMessage && (
        <div className="no-print" style={{ maxWidth: 1100, margin: '0 auto 16px', padding: '12px 14px', borderRadius: 10, border: `1px solid ${G.border}`, background: G.surfaceIdle, fontSize: 13 }}>
          {revokeMessage}
        </div>
      )}

      <div
        className="ticket-gen-grid no-print"
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.35fr) minmax(280px, 0.75fr)',
          gap: 24,
          alignItems: 'start',
        }}
      >
        <div
          style={{
            background: G.card,
            borderRadius: 20,
            overflow: 'hidden',
            border: `1px solid ${G.border}`,
            boxShadow: '0 20px 50px rgba(0,0,0,0.45)',
          }}
        >
          <div style={{ position: 'relative', height: 220 }}>
            <img src={MASTER_IMG} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <span
              style={{
                position: 'absolute',
                top: 16,
                left: 16,
                background: 'rgba(0,0,0,0.65)',
                border: `1px solid ${G.border}`,
                color: G.goldBright,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.1em',
                padding: '6px 12px',
                borderRadius: 999,
              }}
            >
              MASTER PASS
            </span>
          </div>
          <div style={{ padding: '22px 24px 18px' }}>
            <p style={{ margin: '0 0 6px', color: G.goldText, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em' }}>EVENT NAME</p>
            <h2 style={{ margin: '0 0 18px', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{data.eventName}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start', marginBottom: 20 }}>
              <div style={{ display: 'grid', gap: 14 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 10, letterSpacing: '0.1em', color: G.goldDim, fontWeight: 700 }}>DATE</p>
                  <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{fmtDateShort(data.date)}</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 10, letterSpacing: '0.1em', color: G.goldDim, fontWeight: 700 }}>LOCATION</p>
                  <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{data.location || '—'}</p>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 14 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 10, letterSpacing: '0.1em', color: G.goldDim, fontWeight: 700 }}>TIME</p>
                  <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{fmtTime(data.time || '')}</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 10, letterSpacing: '0.1em', color: G.goldDim, fontWeight: 700 }}>TICKET ID</p>
                  <p style={{ margin: '4px 0 0', fontWeight: 600, fontFamily: 'monospace', fontSize: 13 }}>#{data.ticketId}</p>
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
                padding: '18px 16px 8px',
                borderRadius: 16,
                background: '#fff',
                border: `1px solid ${G.border}`,
              }}
            >
              {qr ? (
                <img
                  src={qr}
                  alt="Scan for entry QR"
                  width={180}
                  height={180}
                  style={{ width: 180, height: 180, display: 'block', background: '#fff' }}
                />
              ) : (
                <div
                  style={{
                    width: 180,
                    height: 180,
                    borderRadius: 8,
                    border: '2px dashed #d1d5db',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#9ca3af',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  QR code
                </div>
              )}
              <span style={{ color: '#111', fontSize: 11, fontWeight: 800, letterSpacing: '0.12em' }}>SCAN FOR ENTRY</span>
            </div>
          </div>
          <div
            style={{
              margin: '0 24px 20px',
              paddingTop: 14,
              borderTop: `1px dashed ${G.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src={HOST_AVATAR} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
              <span style={{ fontSize: 13, color: G.muted }}>Host: {data.host?.trim() || 'Scanny Events'}</span>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: G.goldBright, fontSize: 12, fontWeight: 700 }}>
              <span aria-hidden>✓</span> Verified Event
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div
            style={{
              background: G.card,
              borderRadius: 18,
              border: `1px solid ${G.border}`,
              padding: 18,
              display: 'grid',
              gap: 12,
            }}
          >
            <p style={{ margin: 0, color: G.goldText, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em' }}>DISTRIBUTE & MANAGE</p>
            <button type="button" onClick={handlePrint} style={actionBtn}>
              <span>🖨 Print Ticket</span>
              <span style={{ color: G.muted }}>›</span>
            </button>
            <button type="button" onClick={() => void handleShare()} style={actionBtn}>
              <span>⤴ Share QR (WhatsApp)</span>
              <span style={{ color: G.muted }}>›</span>
            </button>
            <button type="button" onClick={downloadQr} style={actionBtn}>
              <span>📄 Download QR</span>
              <span style={{ color: G.muted }}>›</span>
            </button>
            <button
              type="button"
              onClick={onCreateAnother}
              style={{
                marginTop: 4,
                width: '100%',
                padding: '15px 16px',
                borderRadius: 12,
                border: 'none',
                background: `linear-gradient(135deg, ${G.gold}, color-mix(in srgb, var(--primary) 75%, white))`,
                color: G.primaryFg,
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: '0.06em',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              + CREATE ANOTHER EVENT
            </button>
            <button
              type="button"
              disabled={revoking}
              onClick={() => onRevoke(data.ticketId)}
              style={{
                ...actionBtn,
                color: G.danger,
                borderColor: 'rgba(239,68,68,0.3)',
                background: 'rgba(239,68,68,0.08)',
                justifyContent: 'center',
                opacity: revoking ? 0.7 : 1,
              }}
            >
              {revoking ? 'Revoking…' : 'Revoke master QR'}
            </button>
          </div>

          <div
            style={{
              background: G.cardAlt,
              borderRadius: 14,
              border: `1px solid ${G.border}`,
              padding: 16,
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                border: `1px solid ${G.gold}`,
                color: G.gold,
                display: 'grid',
                placeItems: 'center',
                fontSize: 12,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              i
            </span>
            <p style={{ margin: 0, color: G.goldText, fontSize: 13, lineHeight: 1.5 }}>
              Tickets are automatically synced with the <span style={{ color: G.goldBright, fontWeight: 700 }}>Scanny Guest App</span>. Attendees will receive a confirmation email within 5 minutes.
            </p>
          </div>

          {purchaseUrl ? (
            <p style={{ margin: 0, color: G.muted, fontSize: 12, wordBreak: 'break-all' }}>{purchaseUrl}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/* ─── Form ──────────────────────────────────────────────────────────── */
type PaymentMethod = 'MOBILE_MONEY' | 'BANK_ACCOUNT'

const UG_BANKS = [
  'Stanbic Bank',
  'Absa Bank',
  'Centenary Bank',
  'Equity Bank',
  'dfcu Bank',
  'Orient Bank',
  'Bank of Africa',
  'Cairo Bank',
  'Housing Finance Bank',
  'Other',
] as const

type FormState = {
  eventName: string
  date: string
  time: string
  location: string
  host: string
  paymentMethod: PaymentMethod | ''
  mobileProvider: 'MTN' | 'Airtel'
  mobileNumber: string
  bankName: string
  bankAccountNumber: string
  template: TemplateId
  ticketClasses: TicketClass[]
  tables: TableOption[]
}

function formatPaymentDetails(form: FormState): string {
  if (form.paymentMethod === 'MOBILE_MONEY') {
    return `${form.mobileProvider} · ${form.mobileNumber.trim()}`
  }
  if (form.paymentMethod === 'BANK_ACCOUNT') {
    return `${form.bankName.trim()} · ${form.bankAccountNumber.trim()}`
  }
  return ''
}

function TicketForm({
  onGenerate,
  onBack,
}: {
  onGenerate: (d: TicketData) => Promise<void>
  onBack: () => void
}) {
  const [form, setForm] = useState<FormState>({
    eventName: '',
    date: '',
    time: '19:00',
    location: '',
    host: '',
    paymentMethod: '',
    mobileProvider: 'MTN',
    mobileNumber: '',
    bankName: '',
    bankAccountNumber: '',
    template: 'classic',
    ticketClasses: DEFAULT_CLASSES.map((c) => ({ ...c, id: shortId() })),
    tables: [],
  })
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showExtras, setShowExtras] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function validate() {
    const e: Partial<Record<string, string>> = {}
    if (!form.eventName.trim()) e.eventName = 'Event name is required'
    if (!form.date) e.date = 'Event date is required'
    if (!form.location.trim()) e.location = 'Location is required'
    if (!form.host.trim()) e.host = 'Host name is required'
    if (!form.paymentMethod) e.paymentMethod = 'Choose Mobile Money or Bank'
    if (form.paymentMethod === 'MOBILE_MONEY') {
      if (!form.mobileNumber.trim()) e.mobileNumber = 'Enter the mobile money number'
    }
    if (form.paymentMethod === 'BANK_ACCOUNT') {
      if (!form.bankName.trim()) e.bankName = 'Choose a bank'
      if (!form.bankAccountNumber.trim()) e.bankAccountNumber = 'Enter the account number'
    }
    if (form.ticketClasses.length === 0) e.ticketClasses = 'Add at least one ticket class'
    if (form.ticketClasses.some((c) => !c.name.trim())) e.ticketClasses = 'All classes need a name'
    if (form.ticketClasses.some((c) => !c.fee || isNaN(Number(c.fee)))) e.ticketClasses = 'All classes need a valid fee'
    return e
  }

  function goToGenerate() {
    setTouched(true)
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
    setErrors({})
    setStep(2)
  }

  async function handleGenerate() {
    if (submitting) return
    setTouched(true)
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      setStep(1)
      return
    }
    try {
      setSubmitting(true)
      await onGenerate({
        eventName: form.eventName,
        date: form.date,
        time: form.time,
        location: form.location,
        host: form.host.trim(),
        paymentDetails: formatPaymentDetails(form),
        template: form.template,
        ticketClasses: form.ticketClasses,
        tables: form.tables,
        ticketId: uid(),
        selectedClass: form.ticketClasses[0]?.name || '',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const choiceBtn = (active: boolean): CSSProperties => ({
    padding: '10px 14px',
    borderRadius: 10,
    border: `1.5px solid ${active ? G.gold : G.borderIdle}`,
    background: active ? G.accentSoft : G.surfaceIdle,
    color: active ? G.goldBright : G.white,
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left' as const,
  })

  return (
    <div
      style={{
        height: '100svh',
        width: '100%',
        background: G.bg,
        color: G.white,
        fontFamily: "'Outfit Variable', Outfit, ui-sans-serif, system-ui, sans-serif",
        padding: '16px 24px 18px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <style>{`
        * { box-sizing: border-box; }
      `}</style>

      <div style={{ maxWidth: 860, width: '100%', margin: '0 auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => {
              if (step === 2) setStep(1)
              else onBack()
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: G.muted,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
              padding: 0,
            }}
          >
            ← {step === 2 ? 'Back to Details' : 'Back'}
          </button>
          <span />
        </div>

        <div style={{ flexShrink: 0 }}>
          <Stepper
            steps={[
              { id: 'details', label: 'Details' },
              { id: 'generate', label: 'Generate' },
            ]}
            active={step - 1}
          />
        </div>

        {step === 1 ? (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', flexShrink: 0 }}>Event Essentials</h1>
          <p style={{ margin: '0 0 14px', color: G.goldText, fontSize: 13, lineHeight: 1.4, flexShrink: 0 }}>
            Define the core parameters of your event experience.
          </p>

          <div style={{ display: 'grid', gap: 12, flex: 1, minHeight: 0, alignContent: 'start' }}>
            <label style={{ display: 'grid', gap: 5 }}>
              <FieldLabel>Event Name</FieldLabel>
              <input
                style={fieldStyle(Boolean(touched && errors.eventName))}
                type="text"
                placeholder="e.g., Midnight Gala Tasting"
                value={form.eventName}
                onChange={(e) => set('eventName', e.target.value)}
              />
              {touched && errors.eventName && <span style={{ color: G.danger, fontSize: 12 }}>{errors.eventName}</span>}
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <label style={{ display: 'grid', gap: 5 }}>
                <FieldLabel>Date</FieldLabel>
                <input
                  style={fieldStyle(Boolean(touched && errors.date))}
                  type="date"
                  value={form.date}
                  onChange={(e) => set('date', e.target.value)}
                />
                {touched && errors.date && <span style={{ color: G.danger, fontSize: 12 }}>{errors.date}</span>}
              </label>
              <label style={{ display: 'grid', gap: 5 }}>
                <FieldLabel>Time</FieldLabel>
                <input
                  style={fieldStyle()}
                  type="time"
                  value={form.time}
                  onChange={(e) => set('time', e.target.value)}
                />
              </label>
              <label style={{ display: 'grid', gap: 5 }}>
                <FieldLabel>Location</FieldLabel>
                <input
                  style={fieldStyle(Boolean(touched && errors.location))}
                  type="text"
                  placeholder="Venue or Address"
                  value={form.location}
                  onChange={(e) => set('location', e.target.value)}
                />
                {touched && errors.location && <span style={{ color: G.danger, fontSize: 12 }}>{errors.location}</span>}
              </label>
            </div>

            <label style={{ display: 'grid', gap: 5 }}>
              <FieldLabel>Host</FieldLabel>
              <input
                style={fieldStyle(Boolean(touched && errors.host))}
                type="text"
                placeholder="e.g., Scanny Events"
                value={form.host}
                onChange={(e) => set('host', e.target.value)}
              />
              {touched && errors.host && <span style={{ color: G.danger, fontSize: 12 }}>{errors.host}</span>}
            </label>

            <div
              style={{
                background: G.card,
                border: `1px solid ${G.border}`,
                borderRadius: 14,
                padding: 14,
                display: 'grid',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Payment Details</h3>
                <span style={{ display: 'flex', gap: 10, color: G.gold, fontSize: 14 }}>
                  <span aria-hidden>💳</span>
                  <span aria-hidden>🏛</span>
                </span>
              </div>

              <div style={{ display: 'grid', gap: 5 }}>
                <FieldLabel>How should guests pay?</FieldLabel>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    type="button"
                    style={choiceBtn(form.paymentMethod === 'MOBILE_MONEY')}
                    onClick={() => set('paymentMethod', 'MOBILE_MONEY')}
                  >
                    Mobile Money
                  </button>
                  <button
                    type="button"
                    style={choiceBtn(form.paymentMethod === 'BANK_ACCOUNT')}
                    onClick={() => set('paymentMethod', 'BANK_ACCOUNT')}
                  >
                    Bank
                  </button>
                </div>
                {touched && errors.paymentMethod && (
                  <span style={{ color: G.danger, fontSize: 12 }}>{errors.paymentMethod}</span>
                )}
              </div>

              {form.paymentMethod === 'MOBILE_MONEY' ? (
                <>
                  <div style={{ display: 'grid', gap: 5 }}>
                    <FieldLabel>Provider</FieldLabel>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <button
                        type="button"
                        style={choiceBtn(form.mobileProvider === 'MTN')}
                        onClick={() => set('mobileProvider', 'MTN')}
                      >
                        MTN
                      </button>
                      <button
                        type="button"
                        style={choiceBtn(form.mobileProvider === 'Airtel')}
                        onClick={() => set('mobileProvider', 'Airtel')}
                      >
                        Airtel
                      </button>
                    </div>
                  </div>
                  <label style={{ display: 'grid', gap: 5 }}>
                    <FieldLabel>Mobile money number</FieldLabel>
                    <input
                      style={fieldStyle(Boolean(touched && errors.mobileNumber))}
                      type="tel"
                      placeholder="07XX XXX XXX"
                      value={form.mobileNumber}
                      onChange={(e) => set('mobileNumber', e.target.value)}
                    />
                    {touched && errors.mobileNumber && (
                      <span style={{ color: G.danger, fontSize: 12 }}>{errors.mobileNumber}</span>
                    )}
                  </label>
                </>
              ) : null}

              {form.paymentMethod === 'BANK_ACCOUNT' ? (
                <>
                  <label style={{ display: 'grid', gap: 5 }}>
                    <FieldLabel>Bank</FieldLabel>
                    <select
                      style={fieldStyle(Boolean(touched && errors.bankName))}
                      value={form.bankName}
                      onChange={(e) => set('bankName', e.target.value)}
                    >
                      <option value="">Select bank</option>
                      {UG_BANKS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                    {touched && errors.bankName && (
                      <span style={{ color: G.danger, fontSize: 12 }}>{errors.bankName}</span>
                    )}
                  </label>
                  <label style={{ display: 'grid', gap: 5 }}>
                    <FieldLabel>Account number</FieldLabel>
                    <input
                      style={fieldStyle(Boolean(touched && errors.bankAccountNumber))}
                      type="text"
                      placeholder="Enter account number"
                      value={form.bankAccountNumber}
                      onChange={(e) => set('bankAccountNumber', e.target.value)}
                    />
                    {touched && errors.bankAccountNumber && (
                      <span style={{ color: G.danger, fontSize: 12 }}>{errors.bankAccountNumber}</span>
                    )}
                  </label>
                </>
              ) : null}

              <ClassesEditor classes={form.ticketClasses} onChange={(v) => set('ticketClasses', v)} />
              {touched && errors.ticketClasses && <span style={{ color: G.danger, fontSize: 12 }}>{errors.ticketClasses}</span>}

              <button
                type="button"
                onClick={() => setShowExtras((v) => !v)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: G.goldDim,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  padding: 0,
                  fontFamily: 'inherit',
                }}
              >
                {showExtras ? 'Hide table options' : 'Show table options'}
              </button>
              {showExtras ? <TablesEditor tables={form.tables} onChange={(v) => set('tables', v)} /> : null}
            </div>

            <button
              type="button"
              onClick={goToGenerate}
              style={{
                background: `linear-gradient(135deg, ${G.gold}, color-mix(in srgb, var(--primary) 75%, white))`,
                color: G.primaryFg,
                border: 'none',
                borderRadius: 12,
                padding: '12px 16px',
                fontSize: 14,
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: 'inherit',
                marginTop: 'auto',
              }}
            >
              Continue
            </button>
          </div>
        </div>
        ) : (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>Ready to generate</h1>
          <p style={{ margin: '0 0 14px', color: G.goldText, fontSize: 13, lineHeight: 1.4 }}>
            Confirm the details, then create the master receipt QR for this event.
          </p>

          <div
            style={{
              background: G.card,
              border: `1px solid ${G.border}`,
              borderRadius: 14,
              padding: 18,
              display: 'grid',
              gap: 14,
              marginBottom: 16,
            }}
          >
            {[
              ['Event', form.eventName],
              ['Host', form.host],
              ['When', `${fmtDate(form.date)} · ${fmtTime(form.time)}`],
              ['Where', form.location],
              ['Pay to', formatPaymentDetails(form) || '—'],
              [
                'Classes',
                form.ticketClasses.map((c) => `${c.name} (${currency(c.fee)})`).join(' · ') || '—',
              ],
            ].map(([label, value]) => (
              <div key={String(label)} style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: G.goldDim, textTransform: 'uppercase' }}>
                  {label}
                </span>
                <span style={{ fontSize: 15, fontWeight: 600, color: G.white }}>{value}</span>
              </div>
            ))}
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleGenerate()}
            style={{
                background: `linear-gradient(135deg, ${G.gold}, color-mix(in srgb, var(--primary) 75%, white))`,
                color: G.primaryFg,
              border: 'none',
              borderRadius: 12,
              padding: '14px 18px',
              fontSize: 15,
              fontWeight: 800,
              cursor: submitting ? 'wait' : 'pointer',
              opacity: submitting ? 0.8 : 1,
              fontFamily: 'inherit',
              marginTop: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {submitting ? 'Generating…' : 'Generate receipt QR code'}
          </button>
        </div>
        )}
      </div>
    </div>
  )
}

/* ─── Page root ─────────────────────────────────────────────────────── */
export default function EventTicketPage({ onBack }: { onBack: () => void }) {
  const [ticket, setTicket] = useState<TicketData | null>(null)
  const [qr, setQr] = useState('')
  const [stats, setStats] = useState<TicketStats[]>([])
  const [revoking, setRevoking] = useState(false)
  const [revokeMessage, setRevokeMessage] = useState<string | null>(null)
  const [lastCreatedEventName, setLastCreatedEventName] = useState<string | null>(null)

  useEffect(() => bindThemeHotkey(), [])

  async function loadStats(search?: string) {
    try {
      const data = await ticketsApi.getStats(search)
      setStats(data)
    } catch {
      setStats([])
    }
  }

  useEffect(() => {
    loadStats().catch(() => undefined)
  }, [])

  useEffect(() => {
    const ws = new WebSocket(`${getWsBaseUrl()}/ws/tickets/stats`)
    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as { type?: string; stats?: TicketStats[] }
        if (parsed.type === 'TICKET_STATS_UPDATED' && Array.isArray(parsed.stats)) {
          setStats(parsed.stats)
        }
      } catch {
        // ignore
      }
    }
    return () => ws.close()
  }, [])

  // Keep stats subscription active for live updates without cluttering the new UI.
  void stats

  async function handleGenerate(data: TicketData) {
    try {
      setRevokeMessage(null)
      const createdTicket = await publicTicketsApi.createEvent({
        ticketType: data.ticketClasses[0]?.name || 'EVENT',
        eventName: data.eventName,
        eventDate: new Date(`${data.date}T${data.time || '00:00'}:00.000Z`).toISOString(),
        price: Number(data.ticketClasses[0]?.fee || 0),
        currency: 'UGX',
        usageLimit: 1000000000,
        issuedBy: 'public-web',
        metadata: JSON.stringify({
          reusable: true,
          template: data.template,
          payTo: data.paymentDetails,
          location: data.location,
          time: data.time,
          host: data.host,
          ticketClasses: data.ticketClasses,
          tables: data.tables,
        }),
      })

      const purchaseLink = rewriteScanUrl(createdTicket.qrCodeUrl)
      const url = await QRCode.toDataURL(purchaseLink, {
        color: { dark: '#0d1612', light: '#ffffff' },
        margin: 1,
        width: 280,
        errorCorrectionLevel: 'M',
      })
      setQr(url)
      setLastCreatedEventName(data.eventName)
      setTicket({
        ...data,
        ticketId: createdTicket.id,
        purchaseUrl: purchaseLink,
      })
      await loadStats(data.eventName)
      toast.success('Event ticket QR created successfully')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create ticket'
      toast.error(message)
      throw err
    }
  }

  async function handleRevoke(ticketId: string) {
    try {
      setRevoking(true)
      setRevokeMessage(null)
      await ticketsApi.updateStatus(ticketId, 'Cancelled')
      setRevokeMessage('Ticket revoked successfully. This QR is now disabled.')
      toast.success('Ticket revoked successfully')
      await loadStats(lastCreatedEventName ?? undefined)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in as a merchant to revoke event QRs.'
      setRevokeMessage(message)
      toast.error(message)
    } finally {
      setRevoking(false)
    }
  }

  if (ticket) {
    return (
      <TicketOutput
        data={ticket}
        qr={qr}
        onCreateAnother={() => {
          setTicket(null)
          setQr('')
          setRevokeMessage(null)
        }}
        onRevoke={handleRevoke}
        revoking={revoking}
        revokeMessage={revokeMessage}
      />
    )
  }

  return <TicketForm onGenerate={handleGenerate} onBack={onBack} />
}
