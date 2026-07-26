import { getWsBaseUrl } from './lib/realtime'
import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import { ticketsApi, publicTicketsApi, imagesApi } from './api/services'
import type { ImageSearchResult, TicketStats } from './api/types'
import { applyDarkMode, bindThemeHotkey, readDarkMode } from './lib/theme'
import { resizeImageFile } from './lib/resizeImage'
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
  /** Creator-uploaded event sticker / cover (data URL or http URL). */
  eventImageUrl?: string
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
    const configured = String(import.meta.env.VITE_SCAN_BASE_URL || '').replace(/\/$/, '')
    const preferConfigured = configured && !/localhost|127\.0\.0\.1/i.test(configured)
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      const origin = preferConfigured
        ? configured
        : typeof window !== 'undefined'
          ? window.location.origin
          : 'http://localhost:5173'
      return `${origin}${parsed.pathname}${parsed.search}${parsed.hash}`
    }
    // Backend already returned a LAN URL — keep it (phones can open it)
    return url
  } catch {
    return url
  }
}

async function makeEventQrDataUrl(link: string, size = 320) {
  return QRCode.toDataURL(link, {
    color: { dark: '#000000', light: '#ffffff' },
    margin: 4,
    width: size,
    errorCorrectionLevel: 'H',
  })
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

function EventImageBanner({ src, height = 140 }: { src?: string; height?: number }) {
  if (!src) return null
  return (
    <div style={{ position: 'relative', height, background: '#111827' }}>
      <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    </div>
  )
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
      <EventImageBanner src={d.eventImageUrl} />
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
      <EventImageBanner src={d.eventImageUrl} />
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
      <EventImageBanner src={d.eventImageUrl} height={120} />
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
      <EventImageBanner src={d.eventImageUrl} />
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
const SCANN_FONT = "'Outfit Variable', Outfit, ui-sans-serif, system-ui, sans-serif"
const SCANN_MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

const CREATE = {
  ink: '#191410',
  paper: '#F3EEE6',
  card: '#FFFFFF',
  magenta: '#A8195A',
  magentaDeep: '#7A1242',
  gold: '#C08B2C',
  teal: '#0B5F58',
  tealDeep: '#083F3A',
  muted: '#8B8377',
  line: 'rgba(25,20,16,0.10)',
  lineStrong: 'rgba(25,20,16,0.16)',
  fieldBg: '#EDE8DE',
  red: '#B4402E',
  redBg: '#FBEDEA',
}

function fieldStyle(hasError?: boolean): CSSProperties {
  return {
    width: '100%',
    minHeight: 42,
    height: 42,
    padding: '0 12px',
    borderRadius: 6,
    fontSize: 14,
    fontFamily: 'inherit',
    fontWeight: 400,
    background: '#ffffff',
    color: '#111827',
    outline: 'none',
    border: `1px solid ${hasError ? CREATE.red : '#d1d5db'}`,
    boxSizing: 'border-box',
  }
}

function FieldLabel({ children }: { children: string }) {
  return (
    <span
      style={{
        display: 'block',
        fontSize: 14,
        fontWeight: 800,
        letterSpacing: 0,
        textTransform: 'none',
        color: '#374151',
        margin: '0 0 6px',
      }}
    >
      {children}
    </span>
  )
}

function tintTealBtn(extra?: CSSProperties): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    padding: '0 16px',
    borderRadius: 12,
    border: 'none',
    background: 'rgba(11,95,88,0.12)',
    color: CREATE.tealDeep,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    ...extra,
  }
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
              color: on || done ? CREATE.tealDeep : CREATE.muted,
              fontSize: 13,
              fontWeight: on ? 600 : 500,
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
                  background: CREATE.teal,
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
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={addClass} style={tintTealBtn()}>
          + Add class
        </button>
      </div>
      {classes.map((cls) => (
        <div key={cls.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            list={`class-names-${cls.id}`}
            value={cls.name}
            onChange={(e) => updateClass(cls.id, 'name', e.target.value)}
            placeholder="Class name (e.g. VIP)"
            aria-label="Class name"
            style={{ ...fieldStyle(), flex: 1 }}
          />
          <datalist id={`class-names-${cls.id}`}>
            {PRESET_NAMES.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <input
            type="number"
            min="0"
            value={cls.fee}
            onChange={(e) => updateClass(cls.id, 'fee', e.target.value)}
            placeholder="Fee UGX"
            aria-label="Class fee"
            style={{ ...fieldStyle(), flex: 1 }}
          />
          <button
            type="button"
            onClick={() => removeClass(cls.id)}
            aria-label="Remove class"
            style={{
              width: 42,
              height: 42,
              flexShrink: 0,
              borderRadius: 6,
              border: '1px solid rgba(180,64,46,0.25)',
              background: CREATE.redBg,
              color: CREATE.red,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
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
    <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={addTable} style={tintTealBtn()}>
          + Add table
        </button>
      </div>
      {tables.length === 0 ? (
        <p style={{ margin: 0, color: CREATE.muted, fontSize: 12.5 }}>No table bookings yet.</p>
      ) : (
        tables.map((t) => (
          <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input value={t.name} onChange={(e) => updateTable(t.id, 'name', e.target.value)} placeholder="Table name" aria-label="Table name" style={{ ...fieldStyle(), flex: 1 }} />
            <input type="number" min="1" value={t.seats} onChange={(e) => updateTable(t.id, 'seats', e.target.value)} placeholder="Seats" aria-label="Seats" style={{ ...fieldStyle(), width: 90, flex: '0 0 90px' }} />
            <input type="number" min="0" value={t.price} onChange={(e) => updateTable(t.id, 'price', e.target.value)} placeholder="Price" aria-label="Table price" style={{ ...fieldStyle(), flex: 1 }} />
            <button
              type="button"
              onClick={() => removeTable(t.id)}
              aria-label="Remove table"
              style={{
                width: 42,
                height: 42,
                flexShrink: 0,
                borderRadius: 6,
                border: '1px solid rgba(180,64,46,0.25)',
                background: CREATE.redBg,
                color: CREATE.red,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        ))
      )}
    </div>
  )
}

/* ─── Step 3: Ticket Generated ──────────────────────────────────────── */
const CONFIRM = CREATE

function hostInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'SC'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

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
  const hostName = data.host?.trim() || 'Scanny Events'

  async function buildPrintableQr(): Promise<string> {
    const link = purchaseUrl
    if (!link) return qr
    return QRCode.toDataURL(link, {
      color: { dark: '#000000', light: '#ffffff' },
      margin: 4,
      width: 768,
      errorCorrectionLevel: 'H',
    })
  }

  async function qrToFile(): Promise<File | null> {
    try {
      const dataUrl = await buildPrintableQr()
      if (!dataUrl) return null
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const safeName = (data.eventName || 'event').replace(/[^\w-]+/g, '_').slice(0, 40)
      return new File([blob], `${safeName}-qr.png`, { type: 'image/png' })
    } catch {
      return null
    }
  }

  async function downloadQr() {
    try {
      const file = await qrToFile()
      if (!file) {
        toast.error('QR code is not ready yet')
        return
      }
      const objectUrl = URL.createObjectURL(file)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
      toast.success('QR downloaded — open the PNG and scan with your phone camera')
    } catch {
      toast.error('Could not download QR')
    }
  }

  async function handleShare() {
    if (!qr && !purchaseUrl) {
      toast.error('QR code is not ready yet')
      return
    }
    try {
      const file = await qrToFile()
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: data.eventName,
          text: purchaseUrl ? `Scan to get tickets: ${purchaseUrl}` : `QR code for ${data.eventName}`,
        })
        return
      }
      await downloadQr()
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      await downloadQr()
    }
  }

  function handlePrint() {
    window.print()
  }

  const panelItem: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: '15px 18px',
    border: 'none',
    borderBottom: `0.5px solid ${CONFIRM.line}`,
    background: 'transparent',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
    color: CONFIRM.ink,
  }

  return (
    <div
      className="ticket-output-root"
      style={{
        height: '100svh',
        width: '100%',
        background: CONFIRM.paper,
        color: CONFIRM.ink,
        fontFamily: SCANN_FONT,
        padding: '32px 24px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <style>{`
        .print-only { display: none !important; }
        .confirm-panel-item:hover { background: #FAF8F4; }
        .confirm-btn:active { transform: scale(0.98); }
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
            height: auto !important;
            padding: 0 !important;
            background: #fff !important;
            overflow: visible !important;
          }
          .print-qr-img {
            width: 240px !important;
            height: 240px !important;
          }
        }
        @media (max-width: 860px) {
          .confirm-ticket { grid-template-columns: 1fr !important; }
          .confirm-side { border-left: none !important; border-top: 0.5px solid ${CONFIRM.line} !important; }
        }
        @media (max-width: 520px) {
          .confirm-body { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className="print-only" style={{ textAlign: 'center', padding: 24 }}>
        <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#666' }}>
          Scanny · Master Pass
        </p>
        <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 600, fontFamily: SCANN_FONT, color: '#111' }}>{data.eventName}</h1>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: '#444' }}>
          {fmtDateShort(data.date)} · {fmtTime(data.time || '')}
          {data.location ? ` · ${data.location}` : ''}
        </p>
        {qr ? (
          <img className="print-qr-img" src={qr} alt="Event QR code" width={240} height={240} style={{ width: 240, height: 240, border: '2px solid #111', borderRadius: 8, background: '#fff' }} />
        ) : (
          <p style={{ color: '#c00' }}>QR code unavailable</p>
        )}
        <p style={{ margin: '14px 0 0', fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', color: '#111' }}>SCAN TO BUY / ENTER</p>
        <p style={{ margin: '8px 0 0', fontSize: 12, fontFamily: SCANN_MONO, color: '#555' }}>#{data.ticketId}</p>
      </div>

      <div className="no-print" style={{ maxWidth: 1040, width: '100%', margin: '0 auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {revokeMessage ? (
          <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, border: `0.5px solid ${CONFIRM.line}`, background: CONFIRM.card, fontSize: 13, flexShrink: 0 }}>
            {revokeMessage}
          </div>
        ) : null}

        <div
          className="confirm-ticket"
          style={{
            flex: 1,
            minHeight: 0,
            background: CONFIRM.card,
            borderRadius: 20,
            overflow: 'hidden',
            border: `0.5px solid ${CONFIRM.line}`,
            boxShadow: '0 1px 2px rgba(25,20,16,0.04), 0 12px 32px rgba(25,20,16,0.06)',
            display: 'grid',
            gridTemplateColumns: '1.55fr 1fr',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div
              style={{
                position: 'relative',
                height: 190,
                flexShrink: 0,
                overflow: 'hidden',
                background: data.eventImageUrl
                  ? undefined
                  : `radial-gradient(120px 120px at 12% 30%, rgba(201,139,44,0.35), transparent 60%),
                     radial-gradient(160px 160px at 85% 20%, rgba(168,25,90,0.55), transparent 65%),
                     radial-gradient(200px 200px at 60% 90%, rgba(11,95,88,0.55), transparent 65%),
                     linear-gradient(135deg, ${CONFIRM.magentaDeep}, ${CONFIRM.ink} 65%)`,
              }}
            >
              {data.eventImageUrl ? (
                <img src={data.eventImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <svg viewBox="0 0 700 190" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                  <g opacity="0.5" stroke="#E7C77A" strokeWidth="1.4" fill="none">
                    <path d="M40 170 Q60 40 90 20" />
                    <path d="M55 170 Q80 50 118 30" />
                    <path d="M600 20 Q640 90 660 165" />
                    <path d="M585 15 Q615 95 645 170" />
                  </g>
                  <g opacity="0.85" fill="#F0D89A">
                    <circle cx="90" cy="20" r="3.2" />
                    <circle cx="118" cy="30" r="2.4" />
                    <circle cx="660" cy="165" r="3" />
                    <circle cx="645" cy="170" r="2.2" />
                    <circle cx="360" cy="18" r="2.6" />
                    <circle cx="420" cy="150" r="2.2" />
                    <circle cx="250" cy="160" r="2.4" />
                  </g>
                </svg>
              )}
              <span
                style={{
                  position: 'absolute',
                  top: 18,
                  left: 18,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.94)',
                  border: '0.5px solid rgba(255,255,255,0.5)',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: CONFIRM.magentaDeep,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 7L9.5 17.5 4 12" />
                </svg>
                Master pass
              </span>
            </div>

            <div
              className="confirm-body"
              style={{
                padding: '26px 30px 30px',
                display: 'grid',
                gridTemplateColumns: '1fr 176px',
                gap: 28,
                flex: 1,
                minHeight: 0,
                alignContent: 'start',
              }}
            >
              <div>
                <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: CONFIRM.muted }}>
                  Event name
                </p>
                <h1
                  style={{
                    margin: '0 0 22px',
                    fontFamily: SCANN_FONT,
                    fontWeight: 600,
                    fontSize: 30,
                    lineHeight: 1.15,
                    letterSpacing: '-0.01em',
                    color: CONFIRM.ink,
                  }}
                >
                  {data.eventName}
                </h1>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    rowGap: 20,
                    columnGap: 20,
                    paddingBottom: 20,
                    borderBottom: `0.5px solid ${CONFIRM.line}`,
                    marginBottom: 20,
                  }}
                >
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: CONFIRM.muted }}>Date</p>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>{fmtDateShort(data.date)}</p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: CONFIRM.muted }}>Time</p>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>{fmtTime(data.time || '')}</p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: CONFIRM.muted }}>Location</p>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>{data.location || '—'}</p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: CONFIRM.muted }}>Ticket ID</p>
                    <p style={{ margin: 0, fontSize: 13.5, fontWeight: 500, fontFamily: SCANN_MONO, letterSpacing: '0.01em' }}>#{data.ticketId}</p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${CONFIRM.gold}, ${CONFIRM.magenta})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {hostInitials(hostName)}
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: 11, color: CONFIRM.muted, lineHeight: 1.3 }}>Host</span>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 500, lineHeight: 1.3 }}>{hostName}</span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: 16,
                  border: `0.5px solid ${CONFIRM.line}`,
                  borderRadius: 14,
                  background: '#FCFBF9',
                }}
              >
                {qr ? (
                  <img src={qr} alt="Scan for entry QR" style={{ width: '100%', aspectRatio: '1', borderRadius: 6, display: 'block', background: '#fff' }} />
                ) : (
                  <div style={{ width: '100%', aspectRatio: '1', borderRadius: 6, border: `0.5px dashed ${CONFIRM.line}`, display: 'grid', placeItems: 'center', color: CONFIRM.muted, fontSize: 12 }}>
                    QR code
                  </div>
                )}
                <p style={{ margin: '12px 0 0', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: CONFIRM.muted }}>
                  Scan for entry
                </p>
              </div>
            </div>
          </div>

          <div
            className="confirm-side"
            style={{
              borderLeft: `0.5px solid ${CONFIRM.line}`,
              display: 'flex',
              flexDirection: 'column',
              padding: '22px 22px 26px',
              minHeight: 0,
            }}
          >
            <p style={{ margin: '2px 0 12px 4px', fontSize: 11, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: CONFIRM.muted }}>
              Distribute & manage
            </p>

            <div
              style={{
                background: CONFIRM.card,
                borderRadius: 12,
                border: `0.5px solid ${CONFIRM.line}`,
                overflow: 'hidden',
                marginBottom: 'auto',
              }}
            >
              <button type="button" className="confirm-panel-item" onClick={handlePrint} style={panelItem}>
                <span style={{ width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'rgba(11,95,88,0.10)', color: CONFIRM.teal }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
                </span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>Print ticket</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={CONFIRM.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
              </button>
              <button type="button" className="confirm-panel-item" onClick={() => void handleShare()} style={panelItem}>
                <span style={{ width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'rgba(168,25,90,0.10)', color: CONFIRM.magenta }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9" /><path d="M3 12l4-4M3 12l4 4" /></svg>
                </span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>Share QR (WhatsApp)</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={CONFIRM.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
              </button>
              <button type="button" className="confirm-panel-item" onClick={() => void downloadQr()} style={{ ...panelItem, borderBottom: 'none' }}>
                <span style={{ width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'rgba(192,139,44,0.12)', color: CONFIRM.gold }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
                </span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>Download QR</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={CONFIRM.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 20 }}>
              <button
                type="button"
                className="confirm-btn"
                onClick={onCreateAnother}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  background: CONFIRM.tealDeep,
                  color: '#fff',
                  marginBottom: 10,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                Create another event
              </button>
              <button
                type="button"
                className="confirm-btn"
                disabled={revoking}
                onClick={() => onRevoke(data.ticketId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: revoking ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                  background: CONFIRM.redBg,
                  color: CONFIRM.red,
                  border: '0.5px solid rgba(180,64,46,0.25)',
                  opacity: revoking ? 0.7 : 1,
                }}
              >
                {revoking ? 'Revoking…' : 'Revoke master QR'}
              </button>
            </div>
          </div>
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
  eventImageUrl: string
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
    eventImageUrl: '',
  })
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [offerTab, setOfferTab] = useState<'classes' | 'tables'>('classes')
  const [step, setStep] = useState<1 | 2>(1)
  const [imageBusy, setImageBusy] = useState(false)
  const [imageQuery, setImageQuery] = useState('')
  const [imageSearching, setImageSearching] = useState(false)
  const [imageImportingId, setImageImportingId] = useState<string | null>(null)
  const [imageSelectedId, setImageSelectedId] = useState<string | null>(null)
  const [imageResults, setImageResults] = useState<ImageSearchResult[]>([])
  const imageInputRef = useRef<HTMLInputElement>(null)

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function onEventImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file')
      return
    }
    try {
      setImageBusy(true)
      const dataUrl = await resizeImageFile(file, 960, 0.82)
      set('eventImageUrl', dataUrl)
      setImageSelectedId(null)
      toast.success('Event image ready')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not process image')
    } finally {
      setImageBusy(false)
    }
  }

  async function runImageSearch() {
    const q = imageQuery.trim() || form.eventName.trim()
    if (!q) {
      toast.message('Enter a search word, or fill in the event name first')
      return
    }
    if (!imageQuery.trim() && form.eventName.trim()) {
      setImageQuery(form.eventName.trim())
    }
    setImageSearching(true)
    setImageSelectedId(null)
    try {
      const response = await imagesApi.search(q, 20)
      setImageResults(response.results)
      if (response.results.length === 0) {
        toast.message('No photos found. Try another word.')
      }
    } catch (err) {
      setImageResults([])
      toast.error(err instanceof Error ? err.message : 'Photo search failed')
    } finally {
      setImageSearching(false)
    }
  }

  async function useImageResult(result: ImageSearchResult) {
    if (imageImportingId) return
    setImageImportingId(result.id)
    setImageSelectedId(result.id)
    try {
      const dataUrl = await imagesApi.importFromUrl(result.imageUrl)
      set('eventImageUrl', dataUrl)
      toast.success('Photo ready for this event')
    } catch {
      try {
        set('eventImageUrl', result.imageUrl)
        toast.success('Photo linked for this event')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not use this photo')
        setImageSelectedId(null)
      }
    } finally {
      setImageImportingId(null)
    }
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
        eventImageUrl: form.eventImageUrl || undefined,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const choiceBtn = (active: boolean): CSSProperties => ({
    flex: 1,
    minHeight: 42,
    height: 42,
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    borderRadius: 6,
    border: `1px solid ${active ? CREATE.teal : '#d1d5db'}`,
    background: active ? '#e7f7ee' : '#ffffff',
    boxShadow: 'none',
    color: '#111827',
    fontWeight: 800,
    fontSize: 14,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left' as const,
  })

  const cardStyle: CSSProperties = {
    background: CREATE.card,
    borderRadius: 16,
    border: `0.5px solid ${CREATE.line}`,
    boxShadow: '0 1px 2px rgba(25,20,16,0.04), 0 8px 24px rgba(25,20,16,0.05)',
    padding: '22px 24px 24px',
    display: 'grid',
    gap: 12,
  }

  const errStyle: CSSProperties = { color: CREATE.red, fontSize: 12 }

  return (
    <div
      style={{
        height: '100svh',
        width: '100%',
        background: CREATE.paper,
        color: CREATE.ink,
        fontFamily: SCANN_FONT,
        padding: '32px 24px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <style>{`
        * { box-sizing: border-box; }
        .et-scroll {
          overflow: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .et-scroll::-webkit-scrollbar { width: 0; height: 0; display: none; }
      `}</style>

      <div style={{ maxWidth: 760, width: '100%', margin: '0 auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
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
              color: CREATE.muted,
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
        <div className="et-scroll" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <h1
            style={{
              margin: '0 0 6px',
              fontFamily: SCANN_FONT,
              fontWeight: 600,
              fontSize: 30,
              letterSpacing: '-0.01em',
              flexShrink: 0,
            }}
          >
            Event essentials
          </h1>
          <p style={{ margin: '0 0 26px', color: CREATE.muted, fontSize: 14.5, lineHeight: 1.4, flexShrink: 0 }}>
            Define the core parameters of your event experience.
          </p>

          <div style={{ display: 'grid', gap: 0, flex: 1, minHeight: 0, alignContent: 'start', paddingBottom: 8 }}>
            <div style={{ marginBottom: 12 }}>
              <FieldLabel>Event name</FieldLabel>
              <input
                style={fieldStyle(Boolean(touched && errors.eventName))}
                type="text"
                placeholder="Event name"
                aria-label="Event name"
                value={form.eventName}
                onChange={(e) => set('eventName', e.target.value)}
              />
              {touched && errors.eventName && <span style={errStyle}>{errors.eventName}</span>}
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <FieldLabel>Date</FieldLabel>
                <input
                  style={fieldStyle(Boolean(touched && errors.date))}
                  type="date"
                  aria-label="Date"
                  title="Date"
                  value={form.date}
                  onChange={(e) => set('date', e.target.value)}
                />
                {touched && errors.date && <span style={errStyle}>{errors.date}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <FieldLabel>Time</FieldLabel>
                <input
                  style={fieldStyle()}
                  type="time"
                  aria-label="Time"
                  title="Time"
                  value={form.time}
                  onChange={(e) => set('time', e.target.value)}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <FieldLabel>Location</FieldLabel>
                <input
                  style={fieldStyle(Boolean(touched && errors.location))}
                  type="text"
                  placeholder="Location"
                  aria-label="Location"
                  value={form.location}
                  onChange={(e) => set('location', e.target.value)}
                />
                {touched && errors.location && <span style={errStyle}>{errors.location}</span>}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <FieldLabel>Host</FieldLabel>
              <input
                style={fieldStyle(Boolean(touched && errors.host))}
                type="text"
                placeholder="Host"
                aria-label="Host"
                value={form.host}
                onChange={(e) => set('host', e.target.value)}
              />
              {touched && errors.host && <span style={errStyle}>{errors.host}</span>}
            </div>

            <div style={{ ...cardStyle, marginTop: 22 }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600 }}>Event image</p>
                <p style={{ margin: 0, color: CREATE.muted, fontSize: 13 }}>
                  Optional sticker or cover — shown on guest tickets.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
                <input
                  type="search"
                  value={imageQuery}
                  disabled={imageSearching}
                  placeholder={form.eventName.trim() || 'Search photos e.g. concert, gala'}
                  onChange={(e) => setImageQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void runImageSearch()
                    }
                  }}
                  style={{ ...fieldStyle(), flex: 1, minWidth: 0 }}
                  aria-label="Search event photos"
                />
                <button
                  type="button"
                  disabled={imageSearching}
                  onClick={() => void runImageSearch()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 48,
                    padding: '0 20px',
                    borderRadius: 12,
                    border: 'none',
                    background: CREATE.tealDeep,
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: imageSearching ? 'wait' : 'pointer',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {imageSearching ? 'Searching…' : 'Find photos'}
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={imageBusy || Boolean(imageImportingId)}
                  style={tintTealBtn({ cursor: imageBusy ? 'wait' : 'pointer' })}
                >
                  {imageBusy ? 'Processing…' : 'Upload from device'}
                </button>
                {form.eventImageUrl ? (
                  <button
                    type="button"
                    onClick={() => {
                      set('eventImageUrl', '')
                      setImageSelectedId(null)
                    }}
                    disabled={imageBusy || Boolean(imageImportingId)}
                    style={{
                      ...tintTealBtn(),
                      background: 'transparent',
                      color: CREATE.muted,
                      border: `0.5px solid ${CREATE.lineStrong}`,
                    }}
                  >
                    Remove
                  </button>
                ) : null}
              </div>

              {form.eventImageUrl ? (
                <div
                  style={{
                    position: 'relative',
                    height: 140,
                    borderRadius: 12,
                    overflow: 'hidden',
                    border: `0.5px solid ${CREATE.line}`,
                    background: CREATE.fieldBg,
                  }}
                >
                  <img
                    src={form.eventImageUrl}
                    alt="Event preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </div>
              ) : null}

              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => void onEventImage(e)}
                style={{ display: 'none' }}
              />

              {imageResults.length > 0 ? (
                <>
                  <p style={{ margin: 0, fontSize: 12.5, color: CREATE.muted }}>Tap a photo to use it on the ticket.</p>
                  <div
                    className="et-scroll"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
                      gap: 8,
                      maxHeight: '28vh',
                    }}
                  >
                    {imageResults.map((result) => {
                      const busy = imageImportingId === result.id
                      const selected = imageSelectedId === result.id
                      return (
                        <button
                          key={result.id}
                          type="button"
                          disabled={Boolean(imageImportingId)}
                          title={result.alt || result.photographer || 'Use this photo'}
                          onClick={() => void useImageResult(result)}
                          style={{
                            position: 'relative',
                            aspectRatio: '1',
                            borderRadius: 10,
                            overflow: 'hidden',
                            border: selected ? `2px solid ${CREATE.teal}` : `0.5px solid ${CREATE.line}`,
                            padding: 0,
                            cursor: imageImportingId ? 'wait' : 'pointer',
                            opacity: imageImportingId && !busy ? 0.55 : 1,
                            background: CREATE.fieldBg,
                          }}
                        >
                          <img
                            src={result.thumbUrl}
                            alt={result.alt || ''}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                          {busy ? (
                            <span
                              style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'grid',
                                placeItems: 'center',
                                background: 'rgba(0,0,0,0.45)',
                                color: '#fff',
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              …
                            </span>
                          ) : selected ? (
                            <span
                              style={{
                                position: 'absolute',
                                top: 4,
                                right: 4,
                                width: 18,
                                height: 18,
                                borderRadius: '50%',
                                background: CREATE.tealDeep,
                                color: '#fff',
                                display: 'grid',
                                placeItems: 'center',
                                fontSize: 11,
                                fontWeight: 800,
                              }}
                            >
                              ✓
                            </span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : (
                <p style={{ margin: '2px 0 0', fontSize: 12.5, color: CREATE.muted }}>
                  Search or upload — the photo appears on the guest ticket pass.
                </p>
              )}

              <p style={{ margin: 0, fontSize: 12, color: CREATE.muted }}>
                Photos from{' '}
                <a href="https://www.pexels.com" target="_blank" rel="noreferrer" style={{ color: CREATE.tealDeep, textDecoration: 'none' }}>
                  Pexels
                </a>
                .
              </p>
            </div>

            <div style={{ ...cardStyle, marginTop: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Payment details</p>
                <span style={{ display: 'flex', gap: 8 }}>
                  <span
                    aria-hidden
                    style={{
                      width: 28,
                      height: 20,
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: CREATE.fieldBg,
                    }}
                  >
                    <svg width="16" height="12" viewBox="0 0 24 18" fill="none">
                      <rect x="1" y="1" width="22" height="16" rx="2" stroke={CREATE.teal} strokeWidth="1.4" />
                      <line x1="1" y1="7" x2="23" y2="7" stroke={CREATE.teal} strokeWidth="1.4" />
                    </svg>
                  </span>
                  <span
                    aria-hidden
                    style={{
                      width: 28,
                      height: 20,
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: CREATE.fieldBg,
                    }}
                  >
                    <svg width="16" height="14" viewBox="0 0 24 20" fill="none">
                      <path d="M2 8h20M4 8v9M9 8v9M15 8v9M20 8v9M2 17h20M12 1L2 6h20L12 1z" stroke="#639922" strokeWidth="1.4" strokeLinejoin="round" />
                    </svg>
                  </span>
                </span>
              </div>

              <div style={{ display: 'grid', gap: 5 }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
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
                  <span style={errStyle}>{errors.paymentMethod}</span>
                )}
              </div>

              {form.paymentMethod === 'MOBILE_MONEY' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <button
                      type="button"
                      style={{
                        ...choiceBtn(form.mobileProvider === 'MTN'),
                        justifyContent: 'center',
                        padding: '10px 12px',
                        minHeight: 56,
                      }}
                      onClick={() => set('mobileProvider', 'MTN')}
                      aria-label="MTN MoMo"
                      aria-pressed={form.mobileProvider === 'MTN'}
                    >
                      <img src="/mtn.png" alt="MTN" style={{ maxHeight: 28, maxWidth: 88, objectFit: 'contain', display: 'block' }} />
                    </button>
                    <button
                      type="button"
                      style={{
                        ...choiceBtn(form.mobileProvider === 'Airtel'),
                        justifyContent: 'center',
                        padding: '10px 12px',
                        minHeight: 56,
                      }}
                      onClick={() => set('mobileProvider', 'Airtel')}
                      aria-label="Airtel Money"
                      aria-pressed={form.mobileProvider === 'Airtel'}
                    >
                      <img src="/airtel.png" alt="Airtel" style={{ maxHeight: 28, maxWidth: 88, objectFit: 'contain', display: 'block' }} />
                    </button>
                  </div>
                  <div>
                    <FieldLabel>Mobile money number</FieldLabel>
                    <input
                      style={fieldStyle(Boolean(touched && errors.mobileNumber))}
                      type="tel"
                      placeholder="Mobile money number"
                      aria-label="Mobile money number"
                      value={form.mobileNumber}
                      onChange={(e) => set('mobileNumber', e.target.value)}
                    />
                    {touched && errors.mobileNumber && (
                      <span style={errStyle}>{errors.mobileNumber}</span>
                    )}
                  </div>
                </>
              ) : null}

              {form.paymentMethod === 'BANK_ACCOUNT' ? (
                <>
                  <div>
                    <FieldLabel>Bank</FieldLabel>
                    <select
                      style={fieldStyle(Boolean(touched && errors.bankName))}
                      value={form.bankName}
                      onChange={(e) => set('bankName', e.target.value)}
                      aria-label="Bank"
                    >
                      <option value="">Select bank</option>
                      {UG_BANKS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                    {touched && errors.bankName && (
                      <span style={errStyle}>{errors.bankName}</span>
                    )}
                  </div>
                  <div>
                    <FieldLabel>Account number</FieldLabel>
                    <input
                      style={fieldStyle(Boolean(touched && errors.bankAccountNumber))}
                      type="text"
                      placeholder="Account number"
                      aria-label="Account number"
                      value={form.bankAccountNumber}
                      onChange={(e) => set('bankAccountNumber', e.target.value)}
                    />
                    {touched && errors.bankAccountNumber && (
                      <span style={errStyle}>{errors.bankAccountNumber}</span>
                    )}
                  </div>
                </>
              ) : null}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 6,
                  padding: 4,
                  borderRadius: 12,
                  background: CREATE.paper,
                  border: `1px solid ${CREATE.line}`,
                }}
                role="tablist"
                aria-label="General tickets or tables"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={offerTab === 'classes'}
                  onClick={() => setOfferTab('classes')}
                  style={{
                    border: 'none',
                    borderRadius: 9,
                    padding: '10px 12px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    background: offerTab === 'classes' ? CREATE.card : 'transparent',
                    color: offerTab === 'classes' ? CREATE.ink : CREATE.muted,
                    boxShadow: offerTab === 'classes' ? '0 1px 3px rgba(25,20,16,0.08)' : 'none',
                  }}
                >
                General
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={offerTab === 'tables'}
                onClick={() => setOfferTab('tables')}
                style={{
                  border: 'none',
                  borderRadius: 9,
                  padding: '10px 12px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  background: offerTab === 'tables' ? CREATE.card : 'transparent',
                  color: offerTab === 'tables' ? CREATE.ink : CREATE.muted,
                  boxShadow: offerTab === 'tables' ? '0 1px 3px rgba(25,20,16,0.08)' : 'none',
                }}
              >
                Tables{form.tables.length > 0 ? ` (${form.tables.length})` : ''}
              </button>
            </div>

              {offerTab === 'classes' ? (
                <>
                  <ClassesEditor classes={form.ticketClasses} onChange={(v) => set('ticketClasses', v)} />
                  {touched && errors.ticketClasses && <span style={errStyle}>{errors.ticketClasses}</span>}
                </>
              ) : (
                <TablesEditor tables={form.tables} onChange={(v) => set('tables', v)} />
              )}
            </div>

            <button
              type="button"
              onClick={goToGenerate}
              style={{
                width: '100%',
                height: 54,
                marginTop: 26,
                borderRadius: 14,
                border: 'none',
                background: CREATE.tealDeep,
                color: '#fff',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                letterSpacing: '0.01em',
              }}
            >
              Continue
            </button>
          </div>
        </div>
        ) : (
        <div className="et-scroll" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', maxWidth: 380, width: '100%', margin: '0 auto' }}>
          {(() => {
            const previewClass = form.ticketClasses[0]
            const previewFee = currency(previewClass?.fee || '')
            const heroStyle: CSSProperties = form.eventImageUrl
              ? { position: 'relative', height: 78, overflow: 'hidden', background: '#111' }
              : {
                  position: 'relative',
                  height: 78,
                  overflow: 'hidden',
                  background:
                    'radial-gradient(90px 90px at 20% 60%, rgba(192,139,44,0.5), transparent 65%), radial-gradient(110px 110px at 75% 30%, rgba(168,25,90,0.55), transparent 65%), linear-gradient(135deg, #0F0B08, #191410 70%)',
                }
            return (
              <>
                <div
                  style={{
                    background: CREATE.card,
                    borderRadius: 16,
                    overflow: 'hidden',
                    border: `0.5px solid ${CREATE.line}`,
                    boxShadow: '0 1px 2px rgba(25,20,16,0.04), 0 10px 28px rgba(25,20,16,0.07)',
                  }}
                >
                  <div style={heroStyle}>
                    {form.eventImageUrl ? (
                      <img src={form.eventImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <svg viewBox="0 0 380 78" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                        <g stroke="#E7C77A" strokeWidth="1.1" fill="none" opacity="0.9">
                          <path d="M90 40 L90 8 M90 8 L82 18 M90 8 L98 18 M90 8 L76 12 M90 8 L104 12 M90 8 L78 4 M90 8 L102 4" />
                        </g>
                        <g fill="#F0D89A" opacity="0.9">
                          <circle cx="90" cy="8" r="2" />
                          <circle cx="82" cy="18" r="1.4" />
                          <circle cx="98" cy="18" r="1.4" />
                        </g>
                        <g stroke="#D65E8A" strokeWidth="1.1" fill="none" opacity="0.85">
                          <path d="M290 46 L290 14 M290 14 L280 24 M290 14 L300 24 M290 14 L272 20 M290 14 L308 20" />
                        </g>
                        <g fill="#F0A8C6" opacity="0.9">
                          <circle cx="290" cy="14" r="2" />
                          <circle cx="280" cy="24" r="1.4" />
                          <circle cx="300" cy="24" r="1.4" />
                        </g>
                        <g fill="#F0D89A" opacity="0.6">
                          <circle cx="200" cy="20" r="1.2" />
                          <circle cx="230" cy="40" r="1.2" />
                          <circle cx="150" cy="50" r="1.2" />
                          <circle cx="330" cy="45" r="1.2" />
                        </g>
                      </svg>
                    )}
                  </div>

                  <div
                    style={{
                      background: CREATE.tealDeep,
                      color: '#fff',
                      padding: '10px 16px 12px',
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: '0 0 3px', fontSize: 9.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)' }}>
                        Scanny · Event ticket
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontFamily: SCANN_FONT,
                          fontWeight: 600,
                          fontSize: 17,
                          lineHeight: 1.2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {form.eventName || 'Event name'}
                      </p>
                    </div>
                    {previewClass?.name ? (
                      <span
                        style={{
                          background: 'rgba(255,255,255,0.16)',
                          border: '0.5px solid rgba(255,255,255,0.3)',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '4px 12px',
                          borderRadius: 999,
                          whiteSpace: 'nowrap',
                          marginBottom: 2,
                          flexShrink: 0,
                        }}
                      >
                        {previewClass.name}
                      </span>
                    ) : null}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      padding: '16px 16px 14px',
                      gap: 14,
                      borderBottom: `1px dashed ${CREATE.lineStrong}`,
                    }}
                  >
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
                      <div>
                        <p style={{ margin: '0 0 2px', fontSize: 9.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: CREATE.teal }}>Date</p>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{fmtDate(form.date)}</p>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 2px', fontSize: 9.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: CREATE.teal }}>Fee</p>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{previewFee}</p>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 2px', fontSize: 9.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: CREATE.teal }}>Ticket ID</p>
                        <p style={{ margin: 0, fontSize: 11.5, fontWeight: 500, fontFamily: SCANN_MONO }}>TKT-PREVIEW</p>
                      </div>
                    </div>
                    <div
                      style={{
                        width: 78,
                        height: 78,
                        flexShrink: 0,
                        border: `1px dashed ${CREATE.lineStrong}`,
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                      }}
                    >
                      <span style={{ fontSize: 9, color: CREATE.muted, fontWeight: 500 }}>QR code</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 16px' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: CREATE.teal }}>scanny.app · Powered by Scanny</span>
                    <span style={{ fontSize: 9.5, color: CREATE.muted, fontWeight: 500 }}>Non-transferable</span>
                  </div>
                </div>

                <div style={{ marginTop: 32 }}>
                  {[
                    ['Event', form.eventName],
                    ['Host', form.host],
                    ['When', `${fmtDate(form.date)} · ${fmtTime(form.time)}`],
                    ['Where', form.location],
                    ['Pay to', formatPaymentDetails(form) || '—'],
                  ].map(([label, value], i) => (
                    <div
                      key={label}
                      style={{
                        padding: i === 0 ? '0 0 14px' : '14px 0',
                        borderBottom: `0.5px solid ${CREATE.line}`,
                      }}
                    >
                      <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: CREATE.muted }}>
                        {label}
                      </p>
                      <p style={{ margin: 0, fontSize: 17, fontWeight: 500 }}>{value}</p>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleGenerate()}
                  style={{
                    width: '100%',
                    height: 54,
                    marginTop: 28,
                    borderRadius: 14,
                    border: 'none',
                    background: CREATE.tealDeep,
                    color: '#fff',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: submitting ? 'wait' : 'pointer',
                    opacity: submitting ? 0.8 : 1,
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                    <path d="M14 14h3v3h-3zM19 14h2M14 19h2M19 19h2" />
                  </svg>
                  {submitting ? 'Generating…' : 'Generate ticket code'}
                </button>
              </>
            )
          })()}
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

  useEffect(() => {
    // Create-ticket page defaults to light; restore prior preference on leave.
    const previousDark = readDarkMode()
    applyDarkMode(false)
    const unbind = bindThemeHotkey()
    return () => {
      unbind()
      applyDarkMode(previousDark)
    }
  }, [])

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
          ...(data.eventImageUrl ? { eventImageUrl: data.eventImageUrl } : {}),
        }),
      })

      const purchaseLink = rewriteScanUrl(createdTicket.qrCodeUrl)
      const url = await makeEventQrDataUrl(purchaseLink, 320)
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
