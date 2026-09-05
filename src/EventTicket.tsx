import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type FormEvent } from 'react'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import { DatePicker } from './components/ui/date-picker'
import { MoMoPhoneInput, detectProvider } from './components/MoMoPhoneInput'
import './components/MoMoPhoneInput.css'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Download,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Printer,
  QrCode,
  Search,
  Share2,
  Ticket,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react'
import { usePageMeta } from './hooks/usePageMeta'
import { ticketsApi, publicTicketsApi, imagesApi } from './api/services'
import type {
  EventTicketRecentAttendee,
  EventTicketTrackingMetrics,
  ImageSearchResult,
} from './api/types'
import { applyDarkMode, bindThemeHotkey, readDarkMode } from './lib/theme'
import { buildEventManagerGateUrl, buildTicketGateUrl } from './lib/scanBase'
import { resizeImageFile } from './lib/resizeImage'
import {
  loadCreatedEvents,
  removeCreatedEvent,
  saveCreatedEvent,
  type LocalCreatedEvent,
} from './tickets/createdEventsLocal'

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
  /** Max tickets for this class; empty = unlimited */
  capacity: string
  saleEndsAt?: string
  presaleCode?: string
}

type TableOption = {
  id: string
  name: string
  seats: string
  price: string
  /** How many of this table package can sell; empty = unlimited */
  capacity: string
  saleEndsAt?: string
}

export type EventTicketVisual = {
  eventName: string
  date: string
  time?: string
  saleStartsDate?: string
  saleStartsTime?: string
  saleEndsDate?: string
  saleEndsTime?: string
  location?: string
  host?: string
  hostContact?: string
  paymentDetails: string
  template: TemplateId
  ticketClasses: TicketClass[]
  tables: TableOption[]
  ticketId: string
  /** "Event ID" on the event shell, "Ticket ID" on an attendee's purchased pass. */
  idLabel?: string
  selectedClass: string
  purchaseUrl?: string
  managerUrl?: string
  eventImageUrl?: string
  queueEnabled?: boolean
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

function parseJsonObject(raw?: string): Record<string, unknown> {
  if (!raw) return {}
  const parse = (input: string): unknown => {
    try {
      return JSON.parse(input) as unknown
    } catch {
      return null
    }
  }
  try {
    const parsed = parse(raw)
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
    if (typeof parsed === 'string') {
      const nested = parse(parsed)
      if (nested && typeof nested === 'object') return nested as Record<string, unknown>
    }
    const normalized = raw
      .replace(/([{,]\s*)'([^']+)'\s*:/g, '$1"$2":')
      .replace(/:\s*'([^']*)'/g, ': "$1"')
    const lenient = parse(normalized)
    return lenient && typeof lenient === 'object' ? (lenient as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/** Phone can't open localhost or a different LAN IP — rewrite to the current scan base. */
function rewriteScanUrl(url: string) {
  if (!url) return url
  try {
    const parsed = new URL(url)
    const configured = String(import.meta.env.VITE_SCAN_BASE_URL || '').replace(/\/$/, '')
    const preferConfigured = configured && !/localhost|127\.0\.0\.1/i.test(configured)
    const isLocal =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      /^10\.\d+\.\d+\.\d+$/.test(parsed.hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(parsed.hostname) ||
      /^192\.168\.\d+\.\d+$/.test(parsed.hostname)
    if (isLocal) {
      const origin = preferConfigured
        ? configured
        : typeof window !== 'undefined'
          ? window.location.origin
          : 'http://localhost:5173'
      return `${origin}${parsed.pathname}${parsed.search}${parsed.hash}`
    }
    return url
  } catch {
    return url
  }
}

async function makeEventQrDataUrl(link: string, size = 320, darkColor = '#000000') {
  return QRCode.toDataURL(link, {
    color: { dark: darkColor, light: '#ffffff' },
    margin: 4,
    width: size,
    errorCorrectionLevel: 'H',
  })
}

function uid() {
  return 'ERI-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase()
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

function EventImageBanner({ src, height = 150 }: { src?: string; height?: number }) {
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
const TICKET_FONT = "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif"
const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"

function TicketField({
  label,
  value,
  accent,
  mono,
  large,
  color,
}: {
  label: string
  value: string
  accent?: string
  mono?: boolean
  large?: boolean
  color?: string
}) {
  return (
    <div>
      <p
        style={{
          margin: '0 0 3px',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: accent ?? 'rgba(255,255,255,0.5)',
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: large ? 19 : 13,
          fontWeight: large ? 800 : 600,
          letterSpacing: large ? '-0.02em' : 0,
          color: color ?? 'inherit',
          fontFamily: mono ? MONO : 'inherit',
        }}
      >
        {value}
      </p>
    </div>
  )
}

function QrSlot({
  qr,
  accent,
  placeholder = 'QR code',
  label = 'Paid receipt',
  labelColor,
}: {
  qr?: string
  accent: string
  placeholder?: string
  label?: string
  labelColor?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, paddingTop: 4 }}>
      {qr ? (
        <img src={qr} alt="QR" style={{ width: 124, height: 124, borderRadius: 10, border: `2px solid ${accent}33`, background: '#fff' }} />
      ) : (
        <div
          style={{
            width: 124,
            height: 124,
            borderRadius: 10,
            background: 'rgba(255,255,255,0.04)',
            border: `2px dashed ${accent}55`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            color: labelColor ?? 'rgba(255,255,255,0.4)',
            fontWeight: 600,
          }}
        >
          {placeholder}
        </div>
      )}
      <p style={{ margin: 0, fontSize: 11, color: labelColor ?? 'rgba(255,255,255,0.4)', textAlign: 'center', letterSpacing: '0.04em' }}>
        {label}
      </p>
    </div>
  )
}

function TicketShell({
  width,
  scale,
  small,
  background,
  border,
  boxShadow,
  children,
}: {
  width: number
  scale: number
  small?: boolean
  background: string
  border?: string
  boxShadow?: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        width,
        transformOrigin: 'top left',
        transform: `scale(${scale})`,
        fontFamily: TICKET_FONT,
        background,
        borderRadius: 18,
        overflow: 'hidden',
        boxShadow: small ? 'none' : boxShadow,
        border,
      }}
    >
      {children}
    </div>
  )
}

function ClassicTicket({ d, qr, small }: { d: Partial<TicketData>; qr?: string; small?: boolean }) {
  const scale = small ? 0.52 : 1
  const cls = d.selectedClass || d.ticketClasses?.[0]?.name || 'Ordinary'
  const fee = d.ticketClasses?.find((c) => c.name === cls)?.fee || ''
  const accent = classAccent(cls)
  return (
    <TicketShell
      width={520}
      scale={scale}
      small={small}
      background="#fff"
      boxShadow="0 24px 60px rgba(0,0,0,0.4)"
    >
      <EventImageBanner src={d.eventImageUrl} />
      <div
        style={{
          background: accent,
          padding: '22px 26px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Koddly · Event Ticket
          </p>
          <h2 style={{ margin: '6px 0 0', color: '#fff', fontSize: 23, fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
            {d.eventName || 'Event Name'}
          </h2>
        </div>
        <span
          style={{
            background: 'rgba(255,255,255,0.22)',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            padding: '5px 15px',
            borderRadius: 999,
            whiteSpace: 'nowrap',
            marginTop: 4,
            letterSpacing: '0.04em',
          }}
        >
          {cls}
        </span>
      </div>
      <TicketPerforation color="#f3f4f6" />
      <div style={{ padding: '6px 26px 24px', display: 'grid', gridTemplateColumns: '1fr 134px', gap: 22, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 15 }}>
          <TicketField label="Date" value={fmtDate(d.date || '')} accent={accent} color="#111827" />
          <TicketField label="Fee" value={currency(fee)} accent={accent} color="#111827" large />
          <TicketField label="Pay to" value={d.paymentDetails || '—'} accent={accent} color="#111827" />
          <TicketField label={d.idLabel || 'Event ID'} value={d.ticketId || 'ERI-PREVIEW'} accent={accent} color="#111827" mono />
        </div>
        <QrSlot qr={qr} accent={accent} labelColor="#9ca3af" />
      </div>
      <TicketFooter left="Powered by QbiLabs" leftColor={accent} right="Non-refundable" rightColor="#9ca3af" bg="#f9fafb" />
    </TicketShell>
  )
}

function TicketPerforation({ color }: { color: string }) {
  return (
    <div style={{ position: 'relative', height: 22, background: '#fff', display: 'flex', alignItems: 'center' }}>
      <div style={{ position: 'absolute', left: -12, width: 24, height: 24, borderRadius: '50%', background: color }} />
      <div style={{ flex: 1, margin: '0 22px', borderTop: '2px dashed #d1d5db' }} />
      <div style={{ position: 'absolute', right: -12, width: 24, height: 24, borderRadius: '50%', background: color }} />
    </div>
  )
}

function TicketFooter({
  left,
  leftColor,
  right,
  rightColor,
  bg,
  border = '1px dashed #e5e7eb',
}: {
  left: string
  leftColor: string
  right: string
  rightColor: string
  bg: string
  border?: string
}) {
  return (
    <div style={{ background: bg, borderTop: border, padding: '10px 26px', display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 10, color: leftColor, fontWeight: 700 }}>{left}</span>
      <span style={{ fontSize: 10, color: rightColor }}>{right}</span>
    </div>
  )
}

function FestivalTicket({ d, qr, small }: { d: Partial<TicketData>; qr?: string; small?: boolean }) {
  const scale = small ? 0.52 : 1
  const cls = d.selectedClass || d.ticketClasses?.[0]?.name || 'Ordinary'
  const fee = d.ticketClasses?.find((c) => c.name === cls)?.fee || ''
  return (
    <TicketShell
      width={520}
      scale={scale}
      small={small}
      background="#0d1117"
      border="1px solid #30363d"
      boxShadow="0 24px 60px rgba(0,0,0,0.6)"
    >
      <div style={{ height: 5, background: 'linear-gradient(90deg,#7c3aed,#db2777,#f59e0b)' }} />
      <EventImageBanner src={d.eventImageUrl} />
      <div
        style={{
          padding: '22px 26px 18px',
          borderBottom: '1px solid #21262d',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <p
            style={{
              margin: '0 0 7px',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              background: 'linear-gradient(90deg,#c084fc,#f472b6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Koddly · Festival Ticket
          </p>
          <h2 style={{ margin: 0, color: '#f0f6fc', fontSize: 25, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            {d.eventName || 'Event Name'}
          </h2>
        </div>
        <span
          style={{
            background: 'linear-gradient(135deg,#7c3aed,#db2777)',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            padding: '5px 15px',
            borderRadius: 999,
            whiteSpace: 'nowrap',
            marginTop: 4,
          }}
        >
          {cls}
        </span>
      </div>
      <div style={{ padding: '20px 26px', display: 'grid', gridTemplateColumns: '1fr 134px', gap: 22, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 15 }}>
          <TicketField label="Date" value={fmtDate(d.date || '')} accent="#c084fc" color="#f0f6fc" />
          <TicketField label="Fee" value={currency(fee)} accent="#34d399" color="#f0f6fc" large />
          <TicketField label="Pay to" value={d.paymentDetails || '—'} accent="#60a5fa" color="#f0f6fc" />
          <TicketField label={d.idLabel || 'Event ID'} value={d.ticketId || 'ERI-PREVIEW'} accent="#9ca3af" color="#f0f6fc" mono />
        </div>
        <QrSlot qr={qr} accent="#7c3aed" labelColor="#6e7681" />
      </div>
      <div style={{ background: '#161b22', borderTop: '1px solid #21262d', padding: '10px 26px', display: 'flex', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            background: 'linear-gradient(90deg,#c084fc,#f472b6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Koddly.com
        </span>
        <span style={{ fontSize: 10, color: '#6e7681' }}>Non-transferable</span>
      </div>
    </TicketShell>
  )
}

function MinimalTicket({ d, qr, small }: { d: Partial<TicketData>; qr?: string; small?: boolean }) {
  const scale = small ? 0.52 : 1
  const cls = d.selectedClass || d.ticketClasses?.[0]?.name || 'Ordinary'
  const fee = d.ticketClasses?.find((c) => c.name === cls)?.fee || ''
  return (
    <TicketShell
      width={520}
      scale={scale}
      small={small}
      background="#fff"
      border="1px solid #e5e7eb"
      boxShadow="0 24px 60px rgba(0,0,0,0.35)"
    >
      <div style={{ height: 4, background: '#111827' }} />
      <EventImageBanner src={d.eventImageUrl} height={130} />
      <div
        style={{
          padding: '24px 30px 20px',
          borderBottom: '1px solid #f3f4f6',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <p style={{ margin: '0 0 5px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9ca3af' }}>
            Event Ticket
          </p>
          <h2 style={{ margin: 0, color: '#111827', fontSize: 23, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.2 }}>
            {d.eventName || 'Event Name'}
          </h2>
        </div>
        <span
          style={{
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            color: '#374151',
            fontSize: 11,
            fontWeight: 600,
            padding: '5px 13px',
            borderRadius: 8,
            whiteSpace: 'nowrap',
            marginTop: 4,
          }}
        >
          {cls}
        </span>
      </div>
      <div style={{ padding: '22px 30px', display: 'grid', gridTemplateColumns: '1fr 134px', gap: 22, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 15 }}>
          <div style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: 11 }}>
            <TicketField label="Date" value={fmtDate(d.date || '')} accent="#9ca3af" color="#111827" />
          </div>
          <div style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: 11 }}>
            <TicketField label="Ticket fee" value={currency(fee)} accent="#9ca3af" color="#111827" large />
          </div>
          <div style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: 11 }}>
            <TicketField label="Pay to" value={d.paymentDetails || '—'} accent="#9ca3af" color="#111827" />
          </div>
          <TicketField label={d.idLabel || 'Event ID'} value={d.ticketId || 'ERI-PREVIEW'} accent="#9ca3af" color="#111827" mono />
        </div>
        <QrSlot qr={qr} accent="#e5e7eb" labelColor="#9ca3af" />
      </div>
      <TicketFooter left="Powered by QbiLabs" leftColor="#6b7280" right="Non-transferable" rightColor="#9ca3af" bg="#f9fafb" />
    </TicketShell>
  )
}

function GoldTicket({ d, qr, small }: { d: Partial<TicketData>; qr?: string; small?: boolean }) {
  const scale = small ? 0.52 : 1
  const cls = d.selectedClass || d.ticketClasses?.[0]?.name || 'VIP'
  const fee = d.ticketClasses?.find((c) => c.name === cls)?.fee || ''
  return (
    <TicketShell
      width={520}
      scale={scale}
      small={small}
      background="#0c0a06"
      border="1px solid rgba(201,168,108,0.45)"
      boxShadow="0 24px 60px rgba(0,0,0,0.55)"
    >
      <EventImageBanner src={d.eventImageUrl} />
      <div
        style={{
          padding: '24px 26px 18px',
          background: 'linear-gradient(135deg,#1a160c,#0c0a06)',
          borderBottom: '1px solid rgba(201,168,108,0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <p style={{ margin: '0 0 7px', fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: GOLD_VISUAL.gold }}>
            Koddly · Gold Reserve
          </p>
          <h2 style={{ margin: 0, color: '#f8f1e3', fontSize: 23, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
            {d.eventName || 'Event Name'}
          </h2>
        </div>
        <span
          style={{
            background: 'rgba(201,168,108,0.18)',
            border: '1px solid rgba(201,168,108,0.5)',
            color: GOLD_VISUAL.goldBright,
            fontSize: 11,
            fontWeight: 700,
            padding: '5px 13px',
            borderRadius: 999,
            whiteSpace: 'nowrap',
            marginTop: 4,
          }}
        >
          {cls}
        </span>
      </div>
      <div style={{ padding: '20px 26px', display: 'grid', gridTemplateColumns: '1fr 134px', gap: 22, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 15 }}>
          <TicketField label="Date" value={fmtDate(d.date || '')} accent={GOLD_VISUAL.goldDim} color="#f5efe3" />
          <TicketField label="Fee" value={currency(fee)} accent={GOLD_VISUAL.goldDim} color="#f5efe3" large />
          <TicketField label="Pay to" value={d.paymentDetails || '—'} accent={GOLD_VISUAL.goldDim} color="#f5efe3" />
          <TicketField label={d.idLabel || 'Event ID'} value={d.ticketId || 'ERI-PREVIEW'} accent={GOLD_VISUAL.goldDim} color="#f5efe3" mono />
        </div>
        <QrSlot qr={qr} accent="rgba(201,168,108,0.4)" labelColor={GOLD_VISUAL.goldDim} />
      </div>
      <div
        style={{
          background: '#15120c',
          borderTop: '1px solid rgba(201,168,108,0.2)',
          padding: '10px 26px',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 10, color: GOLD_VISUAL.gold, fontWeight: 700 }}>Koddly.com · Gold Reserve</span>
        <span style={{ fontSize: 10, color: '#6b5a3e' }}>Non-transferable</span>
      </div>
    </TicketShell>
  )
}

export function TicketRenderer({ d, qr, small }: { d: Partial<EventTicketVisual>; qr?: string; small?: boolean }) {
  if (d.template === 'festival') return <FestivalTicket d={d} qr={qr} small={small} />
  if (d.template === 'minimal') return <MinimalTicket d={d} qr={qr} small={small} />
  if (d.template === 'gold') return <GoldTicket d={d} qr={qr} small={small} />
  return <ClassicTicket d={d} qr={qr} small={small} />
}

/* ─── Shared styles ─────────────────────────────────────────────────── */
const CREATE = {
  ink: 'var(--foreground)',
  paper: 'var(--background)',
  card: 'var(--card)',
  magenta: 'var(--destructive)',
  magentaDeep: 'var(--destructive)',
  gold: 'var(--accent)',
  teal: 'var(--primary)',
  tealDeep: 'var(--primary)',
  muted: 'var(--muted-foreground)',
  line: 'var(--border)',
  lineStrong: 'var(--border)',
  fieldBg: 'var(--muted)',
  red: 'var(--destructive)',
  redBg: 'color-mix(in srgb, var(--destructive) 12%, transparent)',
}

function fieldStyle(hasError?: boolean): CSSProperties {
  return {
    width: '100%',
    minHeight: 46,
    height: 46,
    padding: '0 14px',
    borderRadius: 10,
    fontSize: 14,
    fontFamily: 'inherit',
    fontWeight: 500,
    background: 'var(--card)',
    color: 'var(--foreground)',
    outline: 'none',
    border: `1px solid ${hasError ? CREATE.red : 'var(--border)'}`,
    boxSizing: 'border-box',
    transition: 'border-color 160ms ease, box-shadow 160ms ease',
  }
}

function tintTealBtn(extra?: CSSProperties): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 42,
    padding: '0 18px',
    borderRadius: 10,
    border: 'none',
    background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
    color: 'var(--primary)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    transition: 'background-color 160ms ease, transform 120ms ease',
    ...extra,
  }
}

function Stepper({ steps, active }: { steps: { id: string; label: string }[]; active: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 0, marginBottom: 16 }}>
      {steps.map((s, i) => {
        const on = i === active
        const done = i < active
        return (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  background: done
                    ? 'var(--primary)'
                    : on
                      ? 'color-mix(in srgb, var(--primary) 14%, transparent)'
                      : 'var(--muted)',
                  color: done ? '#fff' : on ? 'var(--primary)' : 'var(--muted-foreground)',
                  border: on ? '1.5px solid var(--primary)' : 'none',
                  transition: 'all 200ms ease',
                }}
              >
                {done ? <Check size={14} strokeWidth={3} /> : i + 1}
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: on ? 700 : 500,
                  color: on || done ? 'var(--foreground)' : 'var(--muted-foreground)',
                  letterSpacing: '0.01em',
                }}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  width: 48,
                  height: 2,
                  margin: '0 14px',
                  borderRadius: 2,
                  background: done ? 'var(--primary)' : 'var(--border)',
                  transition: 'background 200ms ease',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─── Classes / tables editors ──────────────────────────────────────── */
const DEFAULT_CLASSES: TicketClass[] = [
  { id: shortId(), name: 'Ordinary', fee: '', capacity: '' },
  { id: shortId(), name: 'VIP', fee: '', capacity: '' },
]

const PRESET_NAMES = ['Ordinary', 'VIP', 'VVIP']

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        width: 46,
        height: 46,
        flexShrink: 0,
        borderRadius: 10,
        border: '1px solid color-mix(in srgb, var(--destructive) 22%, transparent)',
        background: CREATE.redBg,
        color: CREATE.red,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'background-color 160ms ease',
      }}
    >
      <X size={15} strokeWidth={2.4} />
    </button>
  )
}

function ClassesEditor({ classes, onChange }: { classes: TicketClass[]; onChange: (c: TicketClass[]) => void }) {
  function updateClass(id: string, field: keyof TicketClass, val: string) {
    onChange(classes.map((c) => (c.id === id ? { ...c, [field]: val } : c)))
  }
  function removeClass(id: string) {
    onChange(classes.filter((c) => c.id !== id))
  }
  function addClass() {
    onChange([...classes, { id: shortId(), name: '', fee: '', capacity: '' }])
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={addClass} className="et-press" style={tintTealBtn()}>
          <Plus size={15} strokeWidth={2.4} /> Add class
        </button>
      </div>
      {classes.map((cls) => (
        <div key={cls.id} className="et-fade-in" style={{ display: 'grid', gap: 9 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="et-focus"
              list={`class-names-${cls.id}`}
              value={cls.name}
              onChange={(e) => updateClass(cls.id, 'name', e.target.value)}
              placeholder="Class name (e.g. VIP)"
              aria-label="Class name"
              style={{ ...fieldStyle(), flex: '1 1 120px', minWidth: 100 }}
            />
            <datalist id={`class-names-${cls.id}`}>
              {PRESET_NAMES.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <input
              className="et-focus"
              type="number"
              min="0"
              value={cls.fee}
              onChange={(e) => updateClass(cls.id, 'fee', e.target.value)}
              placeholder="Fee UGX"
              aria-label="Class fee"
              style={{ ...fieldStyle(), flex: '1 1 100px', minWidth: 80 }}
            />
            <RemoveButton onClick={() => removeClass(cls.id)} label="Remove class" />
          </div>
          <input
            className="et-focus"
            type="number"
            min="1"
            value={cls.capacity}
            onChange={(e) => updateClass(cls.id, 'capacity', e.target.value)}
            placeholder="Capacity (blank = unlimited)"
            aria-label="Class capacity"
            style={{ ...fieldStyle(), width: '100%' }}
          />
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
    onChange([...tables, { id: shortId(), name: `Table ${tables.length + 1}`, seats: '', price: '', capacity: '1' }])
  }

  return (
    <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={addTable} className="et-press" style={tintTealBtn()}>
          <Plus size={15} strokeWidth={2.4} /> Add table
        </button>
      </div>
      {tables.length === 0 ? (
        <p style={{ margin: 0, color: CREATE.muted, fontSize: 13 }}>No table bookings yet.</p>
      ) : (
        tables.map((t) => (
          <div key={t.id} className="et-fade-in" style={{ display: 'grid', gap: 9 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                className="et-focus"
                value={t.name}
                onChange={(e) => updateTable(t.id, 'name', e.target.value)}
                placeholder="Table name"
                aria-label="Table name"
                style={{ ...fieldStyle(), flex: '1 1 120px', minWidth: 100 }}
              />
              <input
                className="et-focus"
                type="number"
                min="1"
                value={t.seats}
                onChange={(e) => updateTable(t.id, 'seats', e.target.value)}
                placeholder="Seats"
                aria-label="Seats"
                style={{ ...fieldStyle(), flex: '0 1 80px', minWidth: 60 }}
              />
              <input
                className="et-focus"
                type="number"
                min="0"
                value={t.price}
                onChange={(e) => updateTable(t.id, 'price', e.target.value)}
                placeholder="Price"
                aria-label="Table price"
                style={{ ...fieldStyle(), flex: '1 1 100px', minWidth: 80 }}
              />
              <RemoveButton onClick={() => removeTable(t.id)} label="Remove table" />
            </div>
            <input
              className="et-focus"
              type="number"
              min="1"
              value={t.capacity}
              onChange={(e) => updateTable(t.id, 'capacity', e.target.value)}
              placeholder="How many available (blank = unlimited)"
              aria-label="Table capacity"
              style={{ ...fieldStyle(), width: '100%' }}
            />
          </div>
        ))
      )}
    </div>
  )
}

/* ─── Created events QR section ─────────────────────────────────────── */
function CreatedEventsQrSection({
  onTrack,
  onEdit,
}: {
  onTrack: (event: LocalCreatedEvent) => void
  onEdit: (event: LocalCreatedEvent) => void
}) {
  const [events, setEvents] = useState<LocalCreatedEvent[]>(() => loadCreatedEvents())
  const [managerQrMap, setManagerQrMap] = useState<Record<string, string>>({})

  useEffect(() => {
    const refresh = () => setEvents(loadCreatedEvents())
    refresh()
    window.addEventListener('focus', refresh)
    window.addEventListener('kodte-created-events', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('kodte-created-events', refresh)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const missing = events.filter((e) => !managerQrMap[e.eventId])
    if (missing.length === 0) return
    void Promise.all(
      missing.map(async (event) => {
        try {
          const managerLink = event.managerUrl || buildEventManagerGateUrl(event.eventId)
          const managerQr = await makeEventQrDataUrl(managerLink, 320, '#B91C1C')
          return { eventId: event.eventId, managerQr }
        } catch {
          return null
        }
      }),
    ).then((rows) => {
      if (cancelled) return
      setManagerQrMap((prev) => {
        const next = { ...prev }
        for (const row of rows) {
          if (row?.managerQr) next[row.eventId] = row.managerQr
        }
        return next
      })
    })
    return () => {
      cancelled = true
    }
  }, [events, managerQrMap])

  if (events.length === 0) return null

  return (
    <section
      style={{
        flexShrink: 0,
        margin: '0 0 24px',
        padding: 18,
        borderRadius: 16,
        border: `1px solid ${CREATE.line}`,
        background: CREATE.card,
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', color: CREATE.ink }}>
          Created events
        </h2>
        <p style={{ margin: '5px 0 0', fontSize: 12.5, color: CREATE.muted }}>
          Tap the red QR to track tickets for that event. Use the edit icon to edit event details.
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(184px, 1fr))', gap: 12 }}>
        {events.map((event) => {
          const managerQr = managerQrMap[event.eventId]
          return (
            <div
              key={event.eventId}
              className="et-fade-in"
              style={{
                borderRadius: 14,
                border: `1px solid ${CREATE.line}`,
                background: 'var(--background)',
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                onClick={() => onTrack(event)}
                title={event.eventName}
                aria-label={`Track ${event.eventName}`}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: 14,
                  paddingBottom: 8,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  font: 'inherit',
                  color: 'inherit',
                }}
              >
                {managerQr ? (
                  <div>
                    <img
                      src={managerQr}
                      alt=""
                      style={{
                        width: '100%',
                        aspectRatio: '1',
                        borderRadius: 12,
                        display: 'block',
                        background: '#fff',
                        border: '2px solid #B91C1C',
                      }}
                    />
                    <p
                      style={{
                        margin: '7px 0 0',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: '#B91C1C',
                        textAlign: 'center',
                      }}
                    >
                      Manager
                    </p>
                  </div>
                ) : (
                  <div
                    className="et-shimmer"
                    style={{ width: '100%', aspectRatio: '1', borderRadius: 12 }}
                  />
                )}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px 10px' }}>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontFamily: MONO,
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: CREATE.muted,
                    textAlign: 'center',
                    wordBreak: 'break-all',
                    lineHeight: 1.3,
                  }}
                >
                  {event.eventId}
                </span>
                <button
                  type="button"
                  onClick={() => onTrack(event)}
                  title="Track event"
                  aria-label={`Track ${event.eventName || event.eventId}`}
                  className="et-hover"
                  style={{
                    flexShrink: 0,
                    width: 28,
                    height: 28,
                    display: 'grid',
                    placeItems: 'center',
                    border: 'none',
                    borderRadius: 8,
                    background: 'transparent',
                    color: CREATE.muted,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <TrendingUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(event)}
                  title="Edit event"
                  aria-label={`Edit ${event.eventName || event.eventId}`}
                  className="et-hover"
                  style={{
                    flexShrink: 0,
                    width: 28,
                    height: 28,
                    display: 'grid',
                    placeItems: 'center',
                    border: 'none',
                    borderRadius: 8,
                    background: 'transparent',
                    color: CREATE.muted,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = removeCreatedEvent(event.eventId)
                    setEvents(next)
                    setManagerQrMap((prev) => {
                      const copy = { ...prev }
                      delete copy[event.eventId]
                      return copy
                    })
                    try {
                      window.dispatchEvent(new Event('kodte-created-events'))
                    } catch {
                      // ignore
                    }
                    toast.message(`Removed ${event.eventName || event.eventId}`)
                  }}
                  title="Remove from this device"
                  aria-label={`Delete ${event.eventName || event.eventId}`}
                  className="et-hover"
                  style={{
                    flexShrink: 0,
                    width: 28,
                    height: 28,
                    display: 'grid',
                    placeItems: 'center',
                    border: 'none',
                    borderRadius: 8,
                    background: 'transparent',
                    color: CREATE.red,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/* ─── Bought ticket detail + progress card ──────────────────────────── */
function moneyUgx(amount: number, currency = 'UGX') {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: currency || 'UGX',
    maximumFractionDigits: 0,
  }).format(amount)
}

function normalizeTrackQuery(raw: string) {
  const cleaned = raw.trim()
  if (!cleaned) return ''
  const fromText = cleaned.match(/\b(ERI-[A-Z0-9-]{5,}|TKT-[A-Z0-9-]{5,})\b/i)
  const fromPath = cleaned.match(/(?:^|\/)(ERI-[A-Z0-9-]{5,}|TKT-[A-Z0-9-]{5,})(?:$|[/?#])/i)
  const token = fromText?.[1] ?? fromPath?.[1] ?? cleaned
  return token.replace(/^#/, '').toUpperCase()
}

function BoughtTicketDetail({
  attendee,
  eventName,
  onClose,
}: {
  attendee: EventTicketRecentAttendee
  eventName: string
  onClose: () => void
}) {
  const [qr, setQr] = useState('')
  const [error, setError] = useState<string | null>(null)
  const paid = attendee.paymentStatus === 'Paid'
  const payload = attendee.qrPayload?.trim() || ''
  const gateUrl = buildTicketGateUrl(payload || attendee.gateUrl || '')
  const qrSource = gateUrl || payload

  useEffect(() => {
    let cancelled = false
    setQr('')
    setError(null)
    if (!paid || !qrSource) return
    QRCode.toDataURL(qrSource, {
      width: 280,
      margin: 1,
      color: { dark: '#0d1612', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setQr(url)
      })
      .catch(() => {
        if (!cancelled) setError('Could not render ticket QR')
      })
    return () => {
      cancelled = true
    }
  }, [paid, qrSource, attendee.ticketId])

  return (
    <div
      className="et-pop"
      style={{
        marginTop: 16,
        background: CREATE.fieldBg,
        borderRadius: 14,
        border: `1px solid ${CREATE.line}`,
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: CREATE.muted }}>
            Bought ticket
          </p>
          <p style={{ margin: '5px 0 0', fontSize: 16, fontWeight: 700, color: CREATE.ink }}>
            {attendee.holderName || 'Guest'}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: CREATE.muted }}>
            {eventName} · {attendee.ticketType}
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 12, fontFamily: MONO, color: CREATE.muted }}>#{attendee.ticketId}</p>

          <div style={{ marginTop: 13, display: 'grid', gap: 7, fontSize: 13 }}>
            <p style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ color: CREATE.muted }}>Amount:</span>
              <strong>{moneyUgx(attendee.price, attendee.currency)}</strong>
            </p>
            <p style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ color: CREATE.muted }}>Status:</span>
              <strong>
                {attendee.paymentStatus} · {attendee.status}
              </strong>
            </p>
          </div>
        </div>

        <div style={{ flex: '0 0 auto', width: 176, display: 'grid', gap: 10, justifyItems: 'end' }}>
          <button
            type="button"
            onClick={onClose}
            className="et-hover"
            style={{
              background: 'transparent',
              border: 'none',
              color: CREATE.muted,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
              padding: '4px 8px',
              borderRadius: 8,
            }}
          >
            Close
          </button>
          {paid && qr ? (
            <img src={qr} alt="Ticket QR" style={{ width: '100%', aspectRatio: '1', borderRadius: 12, background: '#fff', padding: 8 }} />
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: CREATE.muted }}>
              {paid ? 'Loading QR…' : 'QR appears after the ticket is paid.'}
            </p>
          )}
        </div>
      </div>

      {error ? (
        <p style={{ margin: '12px 0 0', fontSize: 13, color: '#b91c1c' }} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background: CREATE.fieldBg,
        borderRadius: 12,
        padding: '12px 8px',
        textAlign: 'center',
      }}
    >
      <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: CREATE.ink, fontFamily: MONO, lineHeight: 1.1 }}>{value}</p>
      <p style={{ margin: '5px 0 0', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: CREATE.muted }}>
        {label}
      </p>
    </div>
  )
}

function EventProgressCard({
  metrics,
  compact = false,
}: {
  metrics: EventTicketTrackingMetrics
  compact?: boolean
}) {
  const [selected, setSelected] = useState<EventTicketRecentAttendee | null>(null)
  const stats = [
    { label: 'Ordered', value: metrics.orderedTickets },
    { label: 'Bought', value: metrics.purchasedTickets },
    { label: 'Pending', value: metrics.pendingTickets },
    { label: 'Redeemed', value: metrics.redeemedTickets },
  ]

  return (
    <div
      style={{
        background: CREATE.card,
        borderRadius: 14,
        border: `1px solid ${CREATE.line}`,
        padding: compact ? '16px 16px 14px' : '18px 18px 16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: CREATE.muted }}>
            Sales progress
          </p>
          {!compact ? <p style={{ margin: '5px 0 0', fontSize: 15, fontWeight: 600, color: CREATE.ink }}>{metrics.eventName}</p> : null}
        </div>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 500, fontFamily: MONO, color: CREATE.muted }}>#{metrics.ticketId}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginBottom: 13 }}>
        {stats.map((s) => (
          <StatTile key={s.label} label={s.label} value={s.value} />
        ))}
      </div>

      <p style={{ margin: 0, fontSize: 13.5, color: CREATE.ink }}>
        Collected <strong style={{ fontWeight: 700 }}>{moneyUgx(metrics.totalCollected, metrics.currency)}</strong>
        {metrics.host ? <span style={{ color: CREATE.muted }}> · Host {metrics.host}</span> : null}
      </p>

      {!compact && metrics.recentAttendees.length > 0 ? (
        <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: CREATE.muted }}>
            Recent cards · tap bought to view QR
          </p>
          {metrics.recentAttendees.slice(0, 8).map((a) => {
            const isSelected = selected?.ticketId === a.ticketId
            const canOpen = a.paymentStatus === 'Paid'
            return (
              <button
                key={a.ticketId}
                type="button"
                disabled={!canOpen}
                onClick={() => setSelected(isSelected ? null : a)}
                className="et-hover"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '11px 4px',
                  borderTop: `1px solid ${CREATE.line}`,
                  borderLeft: 'none',
                  borderRight: 'none',
                  borderBottom: 'none',
                  background: 'transparent',
                  width: '100%',
                  textAlign: 'left',
                  cursor: canOpen ? 'pointer' : 'default',
                  fontFamily: 'inherit',
                  opacity: canOpen ? 1 : 0.6,
                  borderRadius: 0,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: CREATE.ink }}>
                    {a.holderName || 'Guest'} · {a.ticketType}
                  </p>
                  <p style={{ margin: '3px 0 0', fontSize: 11.5, fontFamily: MONO, color: CREATE.muted }}>
                    #{a.ticketId}
                    {canOpen ? (isSelected ? ' · open' : ' · tap') : ''}
                  </p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{moneyUgx(a.price, a.currency)}</p>
                  <p style={{ margin: '3px 0 0', fontSize: 11.5, color: CREATE.muted }}>{a.paymentStatus}</p>
                </div>
              </button>
            )
          })}
        </div>
      ) : null}

      {selected ? <BoughtTicketDetail attendee={selected} eventName={metrics.eventName} onClose={() => setSelected(null)} /> : null}

      {!compact && metrics.recentAttendees.length === 0 ? (
        <p style={{ margin: '14px 0 0', fontSize: 13, color: CREATE.muted }}>
          No cards ordered yet. Share your QR to start selling.
        </p>
      ) : null}
    </div>
  )
}

function hostInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'SC'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/* ─── Step 3: Ticket Generated ──────────────────────────────────────── */
const CONFIRM = CREATE

function PanelItem({
  icon,
  iconBg,
  iconColor,
  label,
  onClick,
  last,
}: {
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  label: string
  onClick: () => void
  last?: boolean
}) {
  return (
    <button
      type="button"
      className="et-hover"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '15px 18px',
        border: 'none',
        borderBottom: last ? 'none' : `1px solid ${CONFIRM.line}`,
        background: 'transparent',
        cursor: 'pointer',
        fontFamily: 'inherit',
        textAlign: 'left',
        color: CONFIRM.ink,
        borderRadius: 0,
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: iconBg,
          color: iconColor,
        }}
      >
        {icon}
      </span>
      <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{label}</span>
      <ChevronRight size={16} color={CONFIRM.muted} />
    </button>
  )
}

function TicketOutput({
  data,
  qr,
  managerQr,
  onCreateAnother,
  onRevoke,
  revoking,
  revokeMessage,
  metrics,
}: {
  data: TicketData
  qr: string
  managerQr: string
  onCreateAnother: () => void
  onRevoke: (ticketId: string) => Promise<void>
  revoking: boolean
  revokeMessage: string | null
  metrics: EventTicketTrackingMetrics | null
}) {
  const purchaseUrl = data.purchaseUrl || ''
  const hostName = data.host?.trim() || 'Koddly Events'

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

  return (
    <div
      className="ticket-output-root"
      style={{
        minHeight: '100svh',
        width: '100%',
        background: CONFIRM.paper,
        color: CONFIRM.ink,
        fontFamily: TICKET_FONT,
        padding: '36px 24px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div className="no-print" style={{ maxWidth: 1040, width: '100%', margin: '0 auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {revokeMessage ? (
          <div
            className="et-fade-in"
            style={{ marginBottom: 14, padding: '12px 16px', borderRadius: 12, border: `1px solid ${CONFIRM.line}`, background: CONFIRM.card, fontSize: 13, flexShrink: 0 }}
          >
            {revokeMessage}
          </div>
        ) : null}

        <div
          className="confirm-ticket et-pop"
          style={{
            flex: 1,
            minHeight: 0,
            background: CONFIRM.card,
            borderRadius: 22,
            overflow: 'hidden',
            border: `1px solid ${CONFIRM.line}`,
            boxShadow: '0 1px 2px rgba(25,20,16,0.04), 0 16px 40px rgba(25,20,16,0.07)',
            display: 'grid',
            gridTemplateColumns: '1.55fr 1fr',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div
              style={{
                position: 'relative',
                height: 200,
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
                <svg viewBox="0 0 700 200" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                  <g opacity="0.5" stroke="#E7C77A" strokeWidth="1.4" fill="none">
                    <path d="M40 180 Q60 40 90 20" />
                    <path d="M55 180 Q80 50 118 30" />
                    <path d="M600 20 Q640 90 660 175" />
                    <path d="M585 15 Q615 95 645 180" />
                  </g>
                  <g opacity="0.85" fill="#F0D89A">
                    <circle cx="90" cy="20" r="3.2" />
                    <circle cx="118" cy="30" r="2.4" />
                    <circle cx="660" cy="175" r="3" />
                    <circle cx="645" cy="180" r="2.2" />
                    <circle cx="360" cy="18" r="2.6" />
                    <circle cx="420" cy="160" r="2.2" />
                    <circle cx="250" cy="170" r="2.4" />
                  </g>
                </svg>
              )}
              <span
                style={{
                  position: 'absolute',
                  top: 20,
                  left: 20,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 15px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.94)',
                  border: '1px solid rgba(255,255,255,0.5)',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: CONFIRM.magentaDeep,
                }}
              >
                <Check size={13} strokeWidth={2.6} />
              </span>
            </div>

            <div
              className="confirm-body"
              style={{
                padding: '28px 32px 32px',
                display: 'grid',
                gridTemplateColumns: '1fr 184px',
                gap: 30,
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
                    margin: '0 0 24px',
                    fontFamily: TICKET_FONT,
                    fontWeight: 700,
                    fontSize: 32,
                    lineHeight: 1.15,
                    letterSpacing: '-0.02em',
                    color: CONFIRM.ink,
                    overflowWrap: 'break-word',
                    wordBreak: 'break-word',
                  }}
                >
                  {data.eventName}
                </h1>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    rowGap: 22,
                    columnGap: 22,
                    paddingBottom: 22,
                    borderBottom: `1px solid ${CONFIRM.line}`,
                    marginBottom: 22,
                  }}
                >
                  {[
                    ['Date', fmtDateShort(data.date)],
                    ['Time', fmtTime(data.time || '')],
                    ['Location', data.location || '—'],
                    ['Event ID', `#${data.ticketId}`],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <p style={{ margin: '0 0 5px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: CONFIRM.muted }}>{label}</p>
                      <p style={{ margin: 0, fontSize: 15.5, fontWeight: 500, fontFamily: label === 'Event ID' ? MONO : 'inherit' }}>{val}</p>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${CONFIRM.gold}, ${CONFIRM.magenta})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {hostInitials(hostName)}
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: 11, color: CONFIRM.muted, lineHeight: 1.3 }}>Host name</span>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 500, lineHeight: 1.3 }}>{hostName}</span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: 18,
                  border: `1px solid ${CONFIRM.line}`,
                  borderRadius: 16,
                  background: 'var(--background)',
                }}
              >
                {qr ? (
                  <img src={qr} alt="Scan for entry QR" style={{ width: '100%', aspectRatio: '1', borderRadius: 10, display: 'block', background: '#fff' }} />
                ) : (
                  <div className="et-shimmer" style={{ width: '100%', aspectRatio: '1', borderRadius: 10 }} />
                )}
                <p style={{ margin: '13px 0 0', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: CONFIRM.muted, textAlign: 'center' }}>
                  Scan to buy tickets
                </p>
                {managerQr ? (
                  <>
                    <div style={{ width: '100%', height: 1, background: CONFIRM.line, margin: '14px 0 12px' }} />
                    <img src={managerQr} alt="Event manager gate QR" style={{ width: '100%', aspectRatio: '1', borderRadius: 10, display: 'block', background: '#fff', border: '1px solid #B91C1C' }} />
                    <p style={{ margin: '11px 0 0', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B91C1C', textAlign: 'center' }}>
                      Gate manager
                    </p>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div
            className="confirm-side"
            style={{
              borderLeft: `1px solid ${CONFIRM.line}`,
              display: 'flex',
              flexDirection: 'column',
              padding: '24px 24px 28px',
              minHeight: 0,
            }}
          >
            <p style={{ margin: '2px 0 14px 4px', fontSize: 11, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: CONFIRM.muted }}>
              Distribute & manage
            </p>

            {metrics ? (
              <div style={{ marginBottom: 16 }}>
                <EventProgressCard metrics={metrics} compact />
              </div>
            ) : (
              <p style={{ margin: '0 0 14px 4px', fontSize: 12.5, color: CONFIRM.muted }}>Sales progress will appear here as cards are ordered.</p>
            )}

            <div
              style={{
                background: CONFIRM.card,
                borderRadius: 14,
                border: `1px solid ${CONFIRM.line}`,
                overflow: 'hidden',
                marginBottom: 'auto',
              }}
            >
              <PanelItem
                icon={<Printer size={17} />}
                iconBg="color-mix(in srgb, var(--primary) 12%, transparent)"
                iconColor={CONFIRM.teal}
                label="Print ticket"
                onClick={handlePrint}
              />
              <PanelItem
                icon={<Share2 size={17} />}
                iconBg="color-mix(in srgb, var(--destructive) 12%, transparent)"
                iconColor={CONFIRM.magenta}
                label="Share QR (WhatsApp)"
                onClick={() => void handleShare()}
              />
              <PanelItem
                icon={<Download size={17} />}
                iconBg="color-mix(in srgb, var(--accent) 16%, transparent)"
                iconColor={CONFIRM.gold}
                label="Download QR"
                onClick={() => void downloadQr()}
                last
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 22 }}>
              <button
                type="button"
                className="et-press"
                onClick={onCreateAnother}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '15px 16px',
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
                <Plus size={17} strokeWidth={2.4} />
                Create another event
              </button>
              <button
                type="button"
                className="et-press"
                disabled={revoking}
                onClick={() => onRevoke(data.ticketId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '15px 16px',
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: revoking ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                  background: CONFIRM.redBg,
                  color: CONFIRM.red,
                  border: '1px solid color-mix(in srgb, var(--destructive) 22%, transparent)',
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

/* ─── Event categories ───────────────────────────────────────────────── */
export const EVENT_CATEGORIES = [
  'Music, Arts & Culture',
  'Wildlife & Nature',
  'Conferences',
  'Launch Parties',
  'Networking Events',
  'Retreats',
  'Product Launches',
  'Expos & Fairs',
  'Performances',
  'Membership Tickets',
  'Sports',
] as const

type EventCategory = typeof EVENT_CATEGORIES[number]

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
  saleStartsDate?: string
  saleStartsTime?: string
  saleEndsDate?: string
  saleEndsTime?: string
  location: string
  host: string
  hostContact: string
  category: EventCategory | ''
  paymentMethod: PaymentMethod | ''
  mobileProvider: 'MTN' | 'Airtel'
  mobileNumber: string
  bankName: string
  bankAccountNumber: string
  template: TemplateId
  ticketClasses: TicketClass[]
  tables: TableOption[]
  eventImageUrl: string
  queueEnabled?: boolean
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

function SectionCard({ title, subtitle, children, right }: { title: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div
      style={{
        background: CREATE.card,
        borderRadius: 16,
        border: `1px solid ${CREATE.line}`,
        boxShadow: '0 1px 2px rgba(25,20,16,0.03), 0 8px 24px rgba(25,20,16,0.04)',
        padding: '24px 26px 26px',
        display: 'grid',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</p>
          {subtitle ? <p style={{ margin: '4px 0 0', color: CREATE.muted, fontSize: 13 }}>{subtitle}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <span style={{ color: CREATE.red, fontSize: 12, marginTop: 4, display: 'block' }}>{children}</span>
}

function TicketForm({
  onGenerate,
  onBack,
  onTrackLookup,
}: {
  onGenerate: (d: TicketData, editingEventId?: string | null) => Promise<void>
  onBack: () => void
  onTrackLookup: (ticketId: string) => Promise<void>
}) {
  const [form, setForm] = useState<FormState>({
    eventName: '',
    date: '',
    time: '19:00',
    location: '',
    host: '',
    hostContact: '',
    category: '',
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
  const [trackQuery, setTrackQuery] = useState('')
  const [trackBusy, setTrackBusy] = useState(false)
  const [showTools, setShowTools] = useState(false)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [loadingEdit, setLoadingEdit] = useState(false)

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function resetFormToCreate() {
    setForm({
      eventName: '',
      date: '',
      time: '19:00',
      location: '',
      host: '',
      hostContact: '',
      category: '',
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
    setErrors({})
    setTouched(false)
    setOfferTab('classes')
    setStep(1)
    setEditingEventId(null)
    setShowTools(false)
  }

  function parsePayTo(value: string): Pick<
    FormState,
    'paymentMethod' | 'mobileProvider' | 'mobileNumber' | 'bankName' | 'bankAccountNumber'
  > {
    const raw = (value || '').trim()
    if (!raw) {
      return {
        paymentMethod: '',
        mobileProvider: 'MTN',
        mobileNumber: '',
        bankName: '',
        bankAccountNumber: '',
      }
    }
    const [left, right = ''] = raw.split('·').map((p) => p.trim())
    if (/^mtn$/i.test(left)) {
      return { paymentMethod: 'MOBILE_MONEY', mobileProvider: 'MTN', mobileNumber: right || raw, bankName: '', bankAccountNumber: '' }
    }
    if (/^airtel$/i.test(left)) {
      return { paymentMethod: 'MOBILE_MONEY', mobileProvider: 'Airtel', mobileNumber: right || raw, bankName: '', bankAccountNumber: '' }
    }
    return {
      paymentMethod: 'BANK_ACCOUNT',
      mobileProvider: 'MTN',
      mobileNumber: '',
      bankName: UG_BANKS.includes(left as (typeof UG_BANKS)[number]) ? left : 'Other',
      bankAccountNumber: right || raw,
    }
  }

  function toDateParts(iso: string | undefined) {
    if (!iso) return { date: '', time: '19:00' }
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return { date: '', time: '19:00' }
    return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16) }
  }

  async function loadEventForEdit(eventOrId: string | LocalCreatedEvent) {
    const sourceEvent = typeof eventOrId === 'string' ? null : eventOrId
    const sourceSnapshot = sourceEvent?.formSnapshot
    const snapshotClasses: TicketClass[] = (sourceSnapshot?.ticketClasses || [])
      .map((c) => ({
        id: shortId(),
        name: typeof c?.name === 'string' ? c.name : '',
        fee: String(c?.fee ?? ''),
        capacity: c?.capacity == null ? '' : String(c.capacity),
      }))
      .filter((c) => c.name.trim())
    const snapshotTables: TableOption[] = (sourceSnapshot?.tables || [])
      .map((t) => ({
        id: shortId(),
        name: typeof t?.name === 'string' ? t.name : '',
        seats: String(t?.seats ?? ''),
        price: String(t?.price ?? ''),
        capacity: t?.capacity == null ? '' : String(t.capacity),
      }))
      .filter((t) => t.name.trim())
    const normalized = normalizeTrackQuery(typeof eventOrId === 'string' ? eventOrId : eventOrId.eventId)
    const sourceEventDate = toDateParts(sourceEvent?.eventDate || '')
    if (!normalized) {
      toast.message('Choose a valid event ID to edit')
      return
    }
    try {
      setLoadingEdit(true)
      if (sourceSnapshot) {
        const snapPayment = parsePayTo(sourceSnapshot.paymentDetails || '')
        setForm({
          eventName: sourceEvent.eventName || '',
          date: sourceSnapshot.date || '',
          time: sourceSnapshot.time || '19:00',
          location: sourceSnapshot.location || sourceEvent.location || '',
          host: sourceSnapshot.host || sourceEvent.host || '',
          hostContact: sourceSnapshot.hostContact || sourceEvent.hostContact || '',
          paymentMethod: snapPayment.paymentMethod,
          mobileProvider: snapPayment.mobileProvider,
          mobileNumber: snapPayment.mobileNumber,
          bankName: snapPayment.bankName,
          bankAccountNumber: snapPayment.bankAccountNumber,
          template:
            sourceSnapshot.template === 'festival' || sourceSnapshot.template === 'minimal' || sourceSnapshot.template === 'gold'
              ? sourceSnapshot.template
              : 'classic',
          ticketClasses:
            snapshotClasses.length > 0 ? snapshotClasses : DEFAULT_CLASSES.map((c) => ({ ...c, id: shortId() })),
          tables: snapshotTables,
          eventImageUrl: sourceSnapshot.eventImageUrl || '',
        })
        setOfferTab(snapshotTables.length > 0 ? 'tables' : 'classes')
        setStep(1)
        setTouched(false)
        setErrors({})
        setShowTools(false)
        setEditingEventId(normalized)
      }
      const master = await ticketsApi.get(normalized)
      const metaRoot = parseJsonObject(master.metadata)
      const nestedMeta =
        metaRoot.metadata && typeof metaRoot.metadata === 'object'
          ? (metaRoot.metadata as Record<string, unknown>)
          : {}
      const meta = { ...nestedMeta, ...metaRoot }
      const readMetaArray = (...keys: string[]) => {
        for (const key of keys) {
          const value = meta[key]
          if (Array.isArray(value)) return value
        }
        return []
      }
      const readMetaString = (...keys: string[]) => {
        for (const key of keys) {
          const value = meta[key]
          if (typeof value === 'string' && value.trim()) return value.trim()
        }
        return ''
      }
      const ticketClassesRaw = readMetaArray('ticketClasses', 'classes', 'classOptions')
      const tablesRaw = readMetaArray('tables', 'tableOptions')
      const ticketClasses: TicketClass[] = ticketClassesRaw
        .map((item) => {
          const obj = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
          return {
            id: shortId(),
            name:
              typeof obj.name === 'string'
                ? obj.name
                : typeof obj.label === 'string'
                  ? obj.label
                  : typeof obj.ticketType === 'string'
                    ? obj.ticketType
                    : '',
            fee: String(obj.fee ?? obj.price ?? obj.amount ?? ''),
            capacity: obj.capacity == null ? (obj.limit == null ? '' : String(obj.limit)) : String(obj.capacity),
          }
        })
        .filter((c) => c.name.trim())
      const tables: TableOption[] = tablesRaw
        .map((item) => {
          const obj = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
          return {
            id: shortId(),
            name: typeof obj.name === 'string' ? obj.name : typeof obj.label === 'string' ? obj.label : '',
            seats: String(obj.seats ?? obj.seatCount ?? ''),
            price: String(obj.price ?? ''),
            capacity: obj.capacity == null ? (obj.limit == null ? '' : String(obj.limit)) : String(obj.capacity),
          }
        })
        .filter((t) => t.name.trim())
      const normalizeName = (value: string) => value.trim().toLowerCase()
      const snapshotClassByName = new Map(snapshotClasses.map((c) => [normalizeName(c.name), c]))
      const mergedClasses: TicketClass[] = ticketClasses.map((c) => {
        const snap = snapshotClassByName.get(normalizeName(c.name))
        return { ...c, fee: c.fee !== '' ? c.fee : snap?.fee || '', capacity: c.capacity !== '' ? c.capacity : snap?.capacity || '' }
      })
      for (const snap of snapshotClasses) {
        if (!mergedClasses.some((c) => normalizeName(c.name) === normalizeName(snap.name))) {
          mergedClasses.push({ ...snap, id: shortId() })
        }
      }
      const snapshotTableByName = new Map(snapshotTables.map((t) => [normalizeName(t.name), t]))
      const mergedTables: TableOption[] = tables.map((t) => {
        const snap = snapshotTableByName.get(normalizeName(t.name))
        return { ...t, seats: t.seats !== '' ? t.seats : snap?.seats || '', price: t.price !== '' ? t.price : snap?.price || '', capacity: t.capacity !== '' ? t.capacity : snap?.capacity || '' }
      })
      for (const snap of snapshotTables) {
        if (!mergedTables.some((t) => normalizeName(t.name) === normalizeName(snap.name))) {
          mergedTables.push({ ...snap, id: shortId() })
        }
      }
      const payTo =
        readMetaString('payTo', 'paymentDetails', 'paymentDestination')
          ? readMetaString('payTo', 'paymentDetails', 'paymentDestination')
          : sourceSnapshot?.paymentDetails || ''
      const payment = parsePayTo(payTo)
      const dt = toDateParts(master.eventDate)
      const nextClasses =
        mergedClasses.length > 0
          ? mergedClasses
          : snapshotClasses.length > 0
            ? snapshotClasses
            : [{ id: shortId(), name: master.ticketType || 'Ordinary', fee: String(master.price ?? 0), capacity: '' }]
      const nextTables = mergedTables.length > 0 ? mergedTables : snapshotTables
      setForm({
        eventName: master.eventName || '',
        date: dt.date || readMetaString('date') || sourceSnapshot?.date || sourceEventDate.date || '',
        time: dt.time || readMetaString('time') || sourceSnapshot?.time || sourceEventDate.time || '19:00',
        location: readMetaString('location', 'venue') || sourceSnapshot?.location || sourceEvent?.location || '',
        host: readMetaString('host', 'organizer') || sourceSnapshot?.host || sourceEvent?.host || '',
        hostContact: readMetaString('hostContact', 'contact', 'hostPhone') || sourceSnapshot?.hostContact || sourceEvent?.hostContact || '',
        paymentMethod: payment.paymentMethod,
        mobileProvider: payment.mobileProvider,
        mobileNumber: payment.mobileNumber,
        bankName: payment.bankName,
        bankAccountNumber: payment.bankAccountNumber,
        template:
          meta.template === 'festival' || meta.template === 'minimal' || meta.template === 'gold'
            ? meta.template
            : meta.ticketTemplate === 'festival' || meta.ticketTemplate === 'minimal' || meta.ticketTemplate === 'gold'
              ? meta.ticketTemplate
              : sourceSnapshot?.template === 'festival' || sourceSnapshot?.template === 'minimal' || sourceSnapshot?.template === 'gold'
                ? sourceSnapshot.template
                : 'classic',
        ticketClasses: nextClasses,
        tables: nextTables,
        eventImageUrl: readMetaString('eventImageUrl', 'imageUrl') || sourceSnapshot?.eventImageUrl || '',
      })
      setOfferTab(nextTables.length > 0 ? 'tables' : 'classes')
      setStep(1)
      setTouched(false)
      setErrors({})
      setShowTools(false)
      setEditingEventId(master.id)
      toast.success(`Editing ${master.eventName}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load event for editing')
    } finally {
      setLoadingEdit(false)
    }
  }

  async function handleTrackSubmit(e: FormEvent) {
    e.preventDefault()
    const id = normalizeTrackQuery(trackQuery)
    if (!id) {
      toast.message('Enter an event ID like #ERI-7EAB33E')
      return
    }
    try {
      setTrackBusy(true)
      await onTrackLookup(id)
    } finally {
      setTrackBusy(false)
    }
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
    if (!form.hostContact.trim()) e.hostContact = 'Host contact is required'
    if (!form.category) e.category = 'Select a category'
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
      await onGenerate(
        {
          eventName: form.eventName,
          date: form.date,
          time: form.time,
          saleStartsDate: form.saleStartsDate,
          saleStartsTime: form.saleStartsTime,
          saleEndsDate: form.saleEndsDate,
          saleEndsTime: form.saleEndsTime,
          location: form.location,
          host: form.host.trim(),
          hostContact: form.hostContact.trim(),
          paymentDetails: formatPaymentDetails(form),
          template: form.template,
          ticketClasses: form.ticketClasses,
          tables: form.tables,
          ticketId: uid(),
          selectedClass: form.ticketClasses[0]?.name || '',
          eventImageUrl: form.eventImageUrl || undefined,
          category: form.category || undefined,
        } as TicketData & { category?: string },
        editingEventId,
      )
    } finally {
      setSubmitting(false)
    }
  }

  const choiceBtn = (active: boolean): CSSProperties => ({
    flex: 1,
    minHeight: 46,
    height: 46,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '0 14px',
    borderRadius: 10,
    border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
    background: active ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'var(--card)',
    color: active ? 'var(--primary)' : 'var(--foreground)',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 160ms ease',
  })

  const errStyle: CSSProperties = { color: CREATE.red, fontSize: 12 }

  return (
    <div
      style={{
        minHeight: '100svh',
        width: '100%',
        background: CREATE.paper,
        color: CREATE.ink,
        fontFamily: TICKET_FONT,
        padding: '24px 18px 40px',
        boxSizing: 'border-box',
      }}
    >
      <style>{`
        .confirm-ticket { grid-template-columns: 1.55fr 1fr; }
        .confirm-side { border-left: 1px solid ${CONFIRM.line}; }
        .confirm-body { grid-template-columns: 1fr 184px; }
        @media (max-width: 860px) {
          .confirm-ticket { grid-template-columns: 1fr !important; }
          .confirm-side { border-left: none !important; border-top: 1px solid ${CONFIRM.line} !important; }
        }
        @media (max-width: 480px) {
          .confirm-body { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className="et-scroll" style={{ maxWidth: 1020, width: '100%', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => {
              if (step === 2) setStep(1)
              else onBack()
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              background: 'transparent',
              border: 'none',
              color: CREATE.muted,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
              padding: 0,
            }}
          >
            <ArrowLeft size={15} /> {step === 2 ? 'Back to Details' : 'Back'}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Stepper
              steps={[
                { id: 'details', label: 'Details' },
                { id: 'generate', label: 'Generate' },
              ]}
              active={step - 1}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowTools((v) => !v)}
            className="et-hover"
            style={{
              minHeight: 38,
              height: 38,
              padding: '0 14px',
              borderRadius: 10,
              border: `1px solid ${CREATE.line}`,
              background: CREATE.card,
              color: CREATE.ink,
              fontWeight: 600,
              fontSize: 12.5,
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <TrendingUp size={14} />
            {showTools ? 'Hide tracking' : 'Tracking'}
          </button>
        </div>

        {showTools ? (
          <div className="et-fade-in" style={{ display: 'grid', gap: 10, margin: '0 0 18px' }}>
            <form
              noValidate
              onSubmit={(e) => void handleTrackSubmit(e)}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 8,
                padding: 12,
                borderRadius: 14,
                border: `1px solid ${CREATE.line}`,
                background: CREATE.card,
              }}
            >
              <input
                className="et-focus"
                type="search"
                value={trackQuery}
                onChange={(e) => setTrackQuery(e.target.value.toUpperCase())}
                placeholder="Track event · #ERI-7EAB33E"
                aria-label="Track event by ticket ID"
                spellCheck={false}
                style={{ ...fieldStyle(), fontFamily: MONO, fontSize: 13, letterSpacing: '0.02em' }}
              />
              <button
                type="submit"
                disabled={trackBusy}
                className="et-press"
                style={{
                  minHeight: 46,
                  height: 46,
                  padding: '0 18px',
                  borderRadius: 10,
                  border: 'none',
                  background: CREATE.tealDeep,
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: trackBusy ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                  opacity: trackBusy ? 0.75 : 1,
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {trackBusy ? <Loader2 size={15} className="spin" /> : <Search size={15} />}
                {trackBusy ? 'Looking…' : 'Track'}
              </button>
            </form>

            <CreatedEventsQrSection
              onTrack={(event) => {
                void onTrackLookup(event.eventId)
              }}
              onEdit={(event) => {
                void loadEventForEdit(event)
              }}
            />
          </div>
        ) : null}

        {editingEventId ? (
          <div
            className="et-fade-in"
            style={{
              margin: '0 0 14px',
              padding: '12px 14px',
              borderRadius: 12,
              border: `1px solid ${CREATE.line}`,
              background: CREATE.card,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              fontSize: 12.5,
            }}
          >
            <span>
              Editing event <strong style={{ fontFamily: MONO }}>#{editingEventId}</strong>
            </span>
            <button
              type="button"
              onClick={resetFormToCreate}
              disabled={submitting || loadingEdit}
              className="et-hover"
              style={{
                ...tintTealBtn(),
                background: 'transparent',
                color: CREATE.muted,
                border: `1px solid ${CREATE.lineStrong}`,
                height: 34,
              }}
            >
              Create new instead
            </button>
          </div>
        ) : null}

        {loadingEdit ? (
          <p style={{ margin: '0 0 12px', fontSize: 12.5, color: CREATE.muted, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Loader2 size={14} className="spin" /> Loading event for editing…
          </p>
        ) : null}

        {step === 1 ? (
          <div className="et-fade-in">
            <h1
              style={{
                margin: '0 0 6px',
                fontFamily: TICKET_FONT,
                fontWeight: 700,
                fontSize: 32,
                letterSpacing: '-0.02em',
              }}
            >
              Event essentials
            </h1>
            <p style={{ margin: '0 0 28px', color: CREATE.muted, fontSize: 15, lineHeight: 1.5 }}>
              Define the core parameters of your event experience.
            </p>

            <div style={{ display: 'grid', gap: 16 }}>
              <SectionCard title="Basics" subtitle="What, when, and where.">
                <div style={{ display: 'grid', gap: 12 }}>
                  <div>
                    <input
                      className="et-focus"
                      style={fieldStyle(Boolean(touched && errors.eventName))}
                      type="text"
                      placeholder="Event name"
                      aria-label="Event name"
                      value={form.eventName}
                      onChange={(e) => set('eventName', e.target.value)}
                    />
                    {touched && errors.eventName && <FieldError>{errors.eventName}</FieldError>}
                  </div>

                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <DatePicker
                        aria-label="Date"
                        value={form.date}
                        onChange={(v) => set('date', v)}
                        aria-invalid={Boolean(touched && errors.date)}
                        placeholder="Event date"
                      />
                      {touched && errors.date && <FieldError>{errors.date}</FieldError>}
                    </div>
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <input
                        className="et-focus"
                        style={fieldStyle()}
                        type="time"
                        aria-label="Time"
                        title="Time"
                        value={form.time}
                        onChange={(e) => set('time', e.target.value)}
                      />
                    </div>
                    <div style={{ flex: 2, minWidth: 180 }}>
                      <input
                        className="et-focus"
                        style={fieldStyle(Boolean(touched && errors.location))}
                        type="text"
                        placeholder="Location"
                        aria-label="Location"
                        value={form.location}
                        onChange={(e) => set('location', e.target.value)}
                      />
                      {touched && errors.location && <FieldError>{errors.location}</FieldError>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <input
                        className="et-focus"
                        style={fieldStyle(Boolean(touched && errors.host))}
                        type="text"
                        placeholder="Host name"
                        aria-label="Host name"
                        value={form.host}
                        onChange={(e) => set('host', e.target.value)}
                      />
                      {touched && errors.host && <FieldError>{errors.host}</FieldError>}
                    </div>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <input
                        className="et-focus"
                        style={fieldStyle(Boolean(touched && errors.hostContact))}
                        type="text"
                        placeholder="Host contact"
                        aria-label="Host contact"
                        value={form.hostContact}
                        onChange={(e) => set('hostContact', e.target.value)}
                      />
                      {touched && errors.hostContact && <FieldError>{errors.hostContact}</FieldError>}
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <select
                      className="et-focus"
                      style={fieldStyle(Boolean(touched && errors.category))}
                      value={form.category}
                      onChange={(e) => set('category', e.target.value as EventCategory | '')}
                      aria-label="Event category"
                    >
                      <option value="">Select event category *</option>
                      {EVENT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    {touched && errors.category && <FieldError>{errors.category}</FieldError>}
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Sales schedule" subtitle="Optional: set when sales open and close for this event.">
                <div style={{ display: 'grid', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: CREATE.muted, marginBottom: 4 }}>Sales open (leave blank for immediate)</label>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 140 }}>
                        <DatePicker
                          aria-label="Sales open date"
                          value={form.saleStartsDate || ''}
                          onChange={(v) => set('saleStartsDate', v)}
                          placeholder="Any date"
                        />
                      </div>
                      <input
                        className="et-focus"
                        style={{ ...fieldStyle(), flex: 1, minWidth: 100 }}
                        type="time"
                        aria-label="Sales open time"
                        value={form.saleStartsTime || '09:00'}
                        onChange={(e) => set('saleStartsTime', e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: CREATE.muted, marginBottom: 4 }}>Sales close (leave blank to sell until event)</label>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 140 }}>
                        <DatePicker
                          aria-label="Sales close date"
                          value={form.saleEndsDate || ''}
                          onChange={(v) => set('saleEndsDate', v)}
                          placeholder="Any date"
                        />
                      </div>
                      <input
                        className="et-focus"
                        style={{ ...fieldStyle(), flex: 1, minWidth: 100 }}
                        type="time"
                        aria-label="Sales close time"
                        value={form.saleEndsTime || '23:59'}
                        onChange={(e) => set('saleEndsTime', e.target.value)}
                      />
                    </div>
                  </div>

                </div>
              </SectionCard>

              <SectionCard title="Event image" subtitle="Optional sticker or cover — shown on guest tickets.">
                <div style={{ display: 'flex', gap: 10, alignItems: 'stretch', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
                    <input
                      className="et-focus"
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
                      style={{ ...fieldStyle(), paddingRight: 124 }}
                      aria-label="Search event photos"
                    />
                    <button
                      type="button"
                      disabled={imageSearching}
                      onClick={() => void runImageSearch()}
                      className="et-press"
                      style={{
                        position: 'absolute',
                        right: 5,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        height: 36,
                        padding: '0 12px',
                        borderRadius: 8,
                        border: 'none',
                        background: CREATE.tealDeep,
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: imageSearching ? 'wait' : 'pointer',
                        fontFamily: 'inherit',
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      {imageSearching ? <Loader2 size={13} className="spin" /> : <Search size={13} />}
                      {imageSearching ? 'Searching' : 'Find photos'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={imageBusy || Boolean(imageImportingId)}
                    className="et-press"
                    style={{ ...tintTealBtn({ cursor: imageBusy ? 'wait' : 'pointer' }), flexShrink: 0 }}
                  >
                    {imageBusy ? <Loader2 size={15} className="spin" /> : <ImagePlus size={16} />}
                    {imageBusy ? 'Processing' : 'Upload'}
                  </button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {form.eventImageUrl ? (
                    <button
                      type="button"
                      onClick={() => {
                        set('eventImageUrl', '')
                        setImageSelectedId(null)
                      }}
                      disabled={imageBusy || Boolean(imageImportingId)}
                      className="et-hover"
                      style={{
                        ...tintTealBtn(),
                        background: 'transparent',
                        color: CREATE.muted,
                        border: `1px solid ${CREATE.lineStrong}`,
                      }}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>

                {form.eventImageUrl ? (
                  <div
                    className="et-pop"
                    style={{
                      position: 'relative',
                      height: 160,
                      borderRadius: 14,
                      overflow: 'hidden',
                      border: `1px solid ${CREATE.line}`,
                      background: CREATE.fieldBg,
                    }}
                  >
                    <img src={form.eventImageUrl} alt="Event preview" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                ) : null}

                <input ref={imageInputRef} type="file" accept="image/*" onChange={(e) => void onEventImage(e)} style={{ display: 'none' }} />

                {imageResults.length > 0 ? (
                  <>
                    <p style={{ margin: 0, fontSize: 12.5, color: CREATE.muted }}>Tap a photo to use it on the ticket.</p>
                    <div
                      className="et-scroll"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))',
                        gap: 8,
                        maxHeight: '30vh',
                        overflow: 'auto',
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
                              borderRadius: 12,
                              overflow: 'hidden',
                              border: selected ? `2px solid ${CREATE.teal}` : `1px solid ${CREATE.line}`,
                              padding: 0,
                              cursor: imageImportingId ? 'wait' : 'pointer',
                              opacity: imageImportingId && !busy ? 0.55 : 1,
                              background: CREATE.fieldBg,
                            }}
                          >
                            <img src={result.thumbUrl} alt={result.alt || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            {busy ? (
                              <span
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  display: 'grid',
                                  placeItems: 'center',
                                  background: 'rgba(0,0,0,0.45)',
                                  color: '#fff',
                                }}
                              >
                                <Loader2 size={16} className="spin" />
                              </span>
                            ) : selected ? (
                              <span
                                style={{
                                  position: 'absolute',
                                  top: 5,
                                  right: 5,
                                  width: 20,
                                  height: 20,
                                  borderRadius: '50%',
                                  background: CREATE.tealDeep,
                                  color: '#fff',
                                  display: 'grid',
                                  placeItems: 'center',
                                }}
                              >
                                <Check size={12} strokeWidth={3} />
                              </span>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                  </>
                ) : null}
              </SectionCard>

              <SectionCard
                title="Payment details"
                right={
                  <span style={{ display: 'flex', gap: 8 }}>
                    <span
                      aria-hidden
                      style={{
                        width: 30,
                        height: 22,
                        borderRadius: 5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: CREATE.fieldBg,
                      }}
                    >
                      <svg width="17" height="13" viewBox="0 0 24 18" fill="none">
                        <rect x="1" y="1" width="22" height="16" rx="2" stroke={CREATE.teal} strokeWidth="1.4" />
                        <line x1="1" y1="7" x2="23" y2="7" stroke={CREATE.teal} strokeWidth="1.4" />
                      </svg>
                    </span>
                    <span
                      aria-hidden
                      style={{
                        width: 30,
                        height: 22,
                        borderRadius: 5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: CREATE.fieldBg,
                      }}
                    >
                      <svg width="17" height="15" viewBox="0 0 24 20" fill="none">
                        <path d="M2 8h20M4 8v9M9 8v9M15 8v9M20 8v9M2 17h20M12 1L2 6h20L12 1z" stroke="#639922" strokeWidth="1.4" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </span>
                }
              >
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button type="button" style={choiceBtn(form.paymentMethod === 'MOBILE_MONEY')} onClick={() => set('paymentMethod', 'MOBILE_MONEY')}>
                      Mobile Money
                    </button>
                    <button type="button" style={choiceBtn(form.paymentMethod === 'BANK_ACCOUNT')} onClick={() => set('paymentMethod', 'BANK_ACCOUNT')}>
                      Bank
                    </button>
                  </div>
                  {touched && errors.paymentMethod && <FieldError>{errors.paymentMethod}</FieldError>}

                  {form.paymentMethod === 'MOBILE_MONEY' ? (
                    <>
                      <div>
                        <MoMoPhoneInput
                          value={form.mobileNumber}
                          onChange={(v) => {
                            set('mobileNumber', v)
                            const p = detectProvider(v)
                            if (p === 'MTN' || p === 'Airtel') set('mobileProvider', p)
                          }}
                          placeholder="07XX XXX XXX"
                          aria-label="Mobile money number"
                          aria-invalid={Boolean(touched && errors.mobileNumber)}
                          inputStyle={fieldStyle(Boolean(touched && errors.mobileNumber))}
                        />
                        {touched && errors.mobileNumber && <FieldError>{errors.mobileNumber}</FieldError>}
                      </div>
                    </>
                  ) : null}

                  {form.paymentMethod === 'BANK_ACCOUNT' ? (
                    <>
                      <div>
                        <select
                          className="et-focus"
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
                        {touched && errors.bankName && <FieldError>{errors.bankName}</FieldError>}
                      </div>
                      <div>
                        <input
                          className="et-focus"
                          style={fieldStyle(Boolean(touched && errors.bankAccountNumber))}
                          type="text"
                          placeholder="Account number"
                          aria-label="Account number"
                          value={form.bankAccountNumber}
                          onChange={(e) => set('bankAccountNumber', e.target.value)}
                        />
                        {touched && errors.bankAccountNumber && <FieldError>{errors.bankAccountNumber}</FieldError>}
                      </div>
                    </>
                  ) : null}

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 4,
                      padding: 4,
                      borderRadius: 12,
                      background: CREATE.fieldBg,
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
                        padding: '11px 12px',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        background: offerTab === 'classes' ? CREATE.card : 'transparent',
                        color: offerTab === 'classes' ? CREATE.ink : CREATE.muted,
                        boxShadow: offerTab === 'classes' ? '0 1px 3px rgba(25,20,16,0.08)' : 'none',
                        transition: 'all 160ms ease',
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
                        padding: '11px 12px',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        background: offerTab === 'tables' ? CREATE.card : 'transparent',
                        color: offerTab === 'tables' ? CREATE.ink : CREATE.muted,
                        boxShadow: offerTab === 'tables' ? '0 1px 3px rgba(25,20,16,0.08)' : 'none',
                        transition: 'all 160ms ease',
                      }}
                    >
                      Tables{form.tables.length > 0 ? ` (${form.tables.length})` : ''}
                    </button>
                  </div>

                  {offerTab === 'classes' ? (
                    <>
                      <ClassesEditor classes={form.ticketClasses} onChange={(v) => set('ticketClasses', v)} />
                      {touched && errors.ticketClasses && <FieldError>{errors.ticketClasses}</FieldError>}
                    </>
                  ) : (
                    <TablesEditor tables={form.tables} onChange={(v) => set('tables', v)} />
                  )}
                </div>
              </SectionCard>

              <button
                type="button"
                onClick={goToGenerate}
                className="et-press"
                style={{
                  width: '100%',
                  height: 56,
                  borderRadius: 14,
                  border: 'none',
                  background: CREATE.tealDeep,
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                Continue <ArrowRight size={17} />
              </button>
            </div>
          </div>
        ) : (
          <div className="et-fade-in">
            {(() => {
              const previewClass = form.ticketClasses[0]
              const previewFee = currency(previewClass?.fee || '')
              return (
                <>
                  <div
                    style={{
                      background: CREATE.card,
                      borderRadius: 18,
                      overflow: 'hidden',
                      border: `1px solid ${CREATE.line}`,
                      boxShadow: '0 1px 2px rgba(25,20,16,0.04), 0 12px 32px rgba(25,20,16,0.07)',
                    }}
                  >
                    <div
                      style={{
                        position: 'relative',
                        height: 96,
                        overflow: 'hidden',
                        background:
                          'radial-gradient(90px 90px at 20% 60%, rgba(192,139,44,0.5), transparent 65%), radial-gradient(110px 110px at 75% 30%, rgba(168,25,90,0.55), transparent 65%), linear-gradient(135deg, #0F0B08, #191410 70%)',
                      }}
                    >
                      <svg viewBox="0 0 380 96" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                        <g stroke="#E7C77A" strokeWidth="1.1" fill="none" opacity="0.9">
                          <path d="M90 50 L90 10 M90 10 L82 22 M90 10 L98 22 M90 10 L76 16 M90 10 L104 16 M90 10 L78 6 M90 10 L102 6" />
                        </g>
                        <g fill="#F0D89A" opacity="0.9">
                          <circle cx="90" cy="10" r="2" />
                          <circle cx="82" cy="22" r="1.4" />
                          <circle cx="98" cy="22" r="1.4" />
                        </g>
                        <g stroke="#D65E8A" strokeWidth="1.1" fill="none" opacity="0.85">
                          <path d="M290 56 L290 16 M290 16 L280 28 M290 16 L300 28 M290 16 L272 22 M290 16 L308 22" />
                        </g>
                        <g fill="#F0A8C6" opacity="0.9">
                          <circle cx="290" cy="16" r="2" />
                          <circle cx="280" cy="28" r="1.4" />
                          <circle cx="300" cy="28" r="1.4" />
                        </g>
                        <g fill="#F0D89A" opacity="0.6">
                          <circle cx="200" cy="24" r="1.2" />
                          <circle cx="230" cy="48" r="1.2" />
                          <circle cx="150" cy="58" r="1.2" />
                          <circle cx="330" cy="52" r="1.2" />
                        </g>
                      </svg>
                    </div>

                    <div
                      style={{
                        background: CREATE.tealDeep,
                        color: '#fff',
                        padding: '12px 18px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <Ticket size={18} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: '0 0 3px', fontSize: 9.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)' }}>
                          Koddly · Event ticket
                        </p>
                        <p
                          style={{
                            margin: 0,
                            fontFamily: TICKET_FONT,
                            fontWeight: 700,
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
                    </div>

                    <div style={{ padding: '16px 18px', borderBottom: `1px dashed ${CREATE.lineStrong}` }}>
                      <div
                        style={{
                          width: '100%',
                          height: 180,
                          borderRadius: 12,
                          overflow: 'hidden',
                          background: form.eventImageUrl
                            ? CREATE.fieldBg
                            : 'radial-gradient(90px 90px at 20% 60%, rgba(192,139,44,0.45), transparent 65%), radial-gradient(110px 110px at 75% 30%, rgba(168,25,90,0.4), transparent 65%), linear-gradient(135deg, #0F0B08, #191410 70%)',
                          border: `1px solid ${CREATE.lineStrong}`,
                        }}
                      >
                        {form.eventImageUrl ? (
                          <img src={form.eventImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        ) : (
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'rgba(255,255,255,0.5)',
                              fontSize: 12,
                              fontWeight: 600,
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase',
                            }}
                          >
                            Event photo
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 18px' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: CREATE.teal }}>Koddly.com · Powered by Koddly</span>
                      <span style={{ fontSize: 9.5, color: CREATE.muted, fontWeight: 500 }}>Non-transferable</span>
                    </div>
                  </div>

                  <div style={{ marginTop: 32 }}>
                    {[
                      ['Event', form.eventName],
                      ['Price', previewFee],
                      ['Host name', form.host],
                      ['Contact', form.hostContact],
                      ['When', `${fmtDate(form.date)} · ${fmtTime(form.time)}`],
                      ['Where', form.location],
                      ['Pay to', formatPaymentDetails(form) || '—'],
                    ].map(([label, value], i) => (
                      <div
                        key={label}
                        style={{
                          padding: i === 0 ? '0 0 16px' : '16px 0',
                          borderBottom: `1px solid ${CREATE.line}`,
                        }}
                      >
                        <p style={{ margin: '0 0 5px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: CREATE.muted }}>
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
                    className="et-press"
                    style={{
                      width: '100%',
                      height: 64,
                      marginTop: 30,
                      marginBottom: 12,
                      borderRadius: 14,
                      border: 'none',
                      background: CREATE.tealDeep,
                      color: '#fff',
                      fontSize: 17,
                      fontWeight: 700,
                      cursor: submitting ? 'wait' : 'pointer',
                      opacity: submitting ? 0.8 : 1,
                      fontFamily: 'inherit',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                    }}
                  >
                    {submitting ? <Loader2 size={18} className="spin" /> : <QrCode size={18} />}
                    {submitting ? (editingEventId ? 'Saving…' : 'Generating…') : editingEventId ? 'Save event changes' : 'Generate ticket code'}
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
  usePageMeta({
    title: 'Create and sell event tickets',
    description:
      'Create an event, set ticket tiers, and get a shareable QR in minutes. Customers buy tickets on their phone; you scan at the gate. No app required.',
    canonicalPath: '/create-event',
  })

  const [ticket, setTicket] = useState<TicketData | null>(null)
  const [qr, setQr] = useState('')
  const [managerQr, setManagerQr] = useState('')
  const [revoking, setRevoking] = useState(false)
  const [revokeMessage, setRevokeMessage] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<EventTicketTrackingMetrics | null>(null)
  const [trackingOnly, setTrackingOnly] = useState(false)
  const [trackedTicketId, setTrackedTicketId] = useState<string | null>(null)
  const [trackQuery, setTrackQuery] = useState('')
  const [trackBusy, setTrackBusy] = useState(false)
  const [trackLookupError, setTrackLookupError] = useState<string | null>(null)

  useEffect(() => {
    applyDarkMode(readDarkMode())
    const unbind = bindThemeHotkey()
    return () => {
      unbind()
    }
  }, [])

  async function refreshMetrics(ticketId: string) {
    const data = await publicTicketsApi.track(ticketId)
    setMetrics(data)
    setTrackedTicketId(data.ticketId)
    return data
  }

  useEffect(() => {
    if (!trackedTicketId) return
    const poll = () => {
      publicTicketsApi.track(trackedTicketId).then(setMetrics).catch(() => undefined)
    }
    poll()
    const timer = window.setInterval(poll, 10000)
    return () => window.clearInterval(timer)
  }, [trackedTicketId])

  async function handleGenerate(data: TicketData, editingEventId?: string | null) {
    try {
      setRevokeMessage(null)
      setTrackingOnly(false)
      const eventDateIso = new Date(`${data.date}T${data.time || '00:00'}:00.000Z`).toISOString()
      const saleStartsAtIso = data.saleStartsDate
        ? new Date(`${data.saleStartsDate}T${data.saleStartsTime || '00:00'}:00.000Z`).toISOString()
        : undefined
      const saleEndsAtIso = data.saleEndsDate
        ? new Date(`${data.saleEndsDate}T${data.saleEndsTime || '23:59'}:00.000Z`).toISOString()
        : undefined

      const normalizedClasses = data.ticketClasses.map((c) => {
        const capacity = Number(c.capacity)
        return {
          id: c.id,
          name: c.name,
          fee: c.fee,
          ...(Number.isFinite(capacity) && capacity > 0 ? { capacity } : {}),
          ...(c.saleEndsAt ? { saleEndsAt: c.saleEndsAt } : {}),
          ...(c.presaleCode ? { presaleCode: c.presaleCode } : {}),
        }
      })
      const normalizedTables = data.tables.map((t) => {
        const capacity = Number(t.capacity)
        return {
          id: t.id,
          name: t.name,
          seats: t.seats,
          price: t.price,
          ...(Number.isFinite(capacity) && capacity > 0 ? { capacity } : {}),
          ...(t.saleEndsAt ? { saleEndsAt: t.saleEndsAt } : {}),
        }
      })
      const createdTicket = editingEventId
        ? await ticketsApi.updateEvent(editingEventId, {
            eventName: data.eventName,
            eventDate: eventDateIso,
            ticketType: data.ticketClasses[0]?.name || 'EVENT',
            price: Number(data.ticketClasses[0]?.fee || 0),
            currency: 'UGX',
            template: data.template,
            payTo: data.paymentDetails,
            location: data.location,
            time: data.time,
            host: data.host,
            hostContact: data.hostContact,
            eventImageUrl: data.eventImageUrl || '',
            saleStartsAt: saleStartsAtIso,
            saleEndsAt: saleEndsAtIso,
            queueEnabled: Boolean(data.queueEnabled),
            ticketClasses: normalizedClasses.map((c) => ({
              name: c.name,
              fee: Number(c.fee || 0),
              ...(typeof c.capacity === 'number' ? { capacity: c.capacity } : {}),
              ...(c.saleEndsAt ? { saleEndsAt: c.saleEndsAt } : {}),
              ...(c.presaleCode ? { presaleCode: c.presaleCode } : {}),
            })),
            tables: normalizedTables.map((t) => ({
              name: t.name,
              seats: Number(t.seats || 0),
              price: Number(t.price || 0),
              ...(typeof t.capacity === 'number' ? { capacity: t.capacity } : {}),
              ...(t.saleEndsAt ? { saleEndsAt: t.saleEndsAt } : {}),
            })),
          })
        : await publicTicketsApi.createEvent({
            ticketType: data.ticketClasses[0]?.name || 'EVENT',
            eventName: data.eventName,
            eventDate: eventDateIso,
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
              hostContact: data.hostContact,
              ...(saleStartsAtIso ? { saleStartsAt: saleStartsAtIso } : {}),
              ...(saleEndsAtIso ? { saleEndsAt: saleEndsAtIso } : {}),
              ...(data.queueEnabled ? { queueEnabled: true } : {}),
              ticketClasses: normalizedClasses,
              tables: normalizedTables,
              ...(data.eventImageUrl ? { eventImageUrl: data.eventImageUrl } : {}),
            }),
          })

      const purchaseLink = rewriteScanUrl(createdTicket.qrCodeUrl)
      const managerLink = buildEventManagerGateUrl(createdTicket.id)
      const [purchaseQrUrl, managerQrUrl] = await Promise.all([
        makeEventQrDataUrl(purchaseLink, 320, '#000000'),
        makeEventQrDataUrl(managerLink, 320, '#B91C1C'),
      ])
      setQr(purchaseQrUrl)
      setManagerQr(managerQrUrl)
      setTicket({ ...data, ticketId: createdTicket.id, purchaseUrl: purchaseLink, managerUrl: managerLink })
      saveCreatedEvent({
        eventId: createdTicket.id,
        eventName: data.eventName,
        purchaseUrl: purchaseLink,
        managerUrl: managerLink,
        eventDate: eventDateIso,
        location: data.location,
        host: data.host,
        hostContact: data.hostContact,
        formSnapshot: {
          date: data.date,
          time: data.time,
          saleStartsDate: data.saleStartsDate,
          saleStartsTime: data.saleStartsTime,
          saleEndsDate: data.saleEndsDate,
          saleEndsTime: data.saleEndsTime,
          location: data.location,
          host: data.host,
          hostContact: data.hostContact,
          paymentDetails: data.paymentDetails,
          template: data.template,
          ticketClasses: data.ticketClasses.map((c) => ({
            name: c.name,
            fee: c.fee,
            capacity: c.capacity,
            saleEndsAt: c.saleEndsAt,
            presaleCode: c.presaleCode,
          })),
          tables: data.tables.map((t) => ({
            name: t.name,
            seats: t.seats,
            price: t.price,
            capacity: t.capacity,
            saleEndsAt: t.saleEndsAt,
          })),
          eventImageUrl: data.eventImageUrl,
          queueEnabled: data.queueEnabled,
        },
        createdAt: new Date().toISOString(),
      })
      window.dispatchEvent(new Event('kodte-created-events'))
      try {
        await refreshMetrics(createdTicket.id)
      } catch {
        setMetrics(null)
      }
      toast.success(editingEventId ? 'Event updated successfully' : 'Event ticket QR created successfully')
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
      await refreshMetrics(ticketId).catch(() => undefined)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in as a merchant to revoke event QRs.'
      setRevokeMessage(message)
      toast.error(message)
    } finally {
      setRevoking(false)
    }
  }

  async function handleTrackLookup(ticketId: string) {
    const normalized = normalizeTrackQuery(ticketId)
    if (!normalized) {
      toast.message('Enter an event ID like #TKT-10653D22')
      return
    }
    try {
      setTrackingOnly(true)
      setTrackBusy(true)
      setTrackLookupError(null)
      const data = await refreshMetrics(normalized)
      setTrackQuery(data.ticketId)
      setTrackingOnly(true)
      setTicket(null)
      setQr('')
      setManagerQr('')
      toast.success(`Tracking ${data.eventName}`)
    } catch (err) {
      setMetrics(null)
      const message = err instanceof Error ? err.message : 'No event found for that ticket ID'
      setTrackLookupError(message)
      toast.error(message)
    } finally {
      setTrackBusy(false)
    }
  }

  if (ticket) {
    return (
      <TicketOutput
        data={ticket}
        qr={qr}
        managerQr={managerQr}
        onCreateAnother={() => {
          setTicket(null)
          setQr('')
          setManagerQr('')
          setRevokeMessage(null)
          setMetrics(null)
          setTrackedTicketId(null)
          setTrackingOnly(false)
        }}
        onRevoke={handleRevoke}
        revoking={revoking}
        revokeMessage={revokeMessage}
        metrics={metrics}
      />
    )
  }

  if (trackingOnly) {
    return (
      <div
        style={{
          minHeight: '100svh',
          width: '100%',
          background: CREATE.paper,
          color: CREATE.ink,
          fontFamily: TICKET_FONT,
          padding: '36px 24px 40px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ maxWidth: 1020, width: '100%', margin: '0 auto' }}>
          <button
            type="button"
            onClick={() => {
              setTrackingOnly(false)
              setMetrics(null)
              setTrackedTicketId(null)
              setTrackLookupError(null)
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              background: 'transparent',
              border: 'none',
              color: CREATE.muted,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
              padding: 0,
              marginBottom: 20,
            }}
          >
            <ArrowLeft size={15} /> Back to create event
          </button>

          <h1 style={{ margin: '0 0 6px', fontFamily: TICKET_FONT, fontWeight: 700, fontSize: 32, letterSpacing: '-0.02em' }}>Event tracking</h1>
          <p style={{ margin: '0 0 20px', color: CREATE.muted, fontSize: 15, lineHeight: 1.5 }}>
            Look up sales by master ticket ID. Progress refreshes automatically.
          </p>

          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              void handleTrackLookup(normalizeTrackQuery(trackQuery))
            }}
            style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 20 }}
          >
            <input
              className="et-focus"
              type="search"
              value={trackQuery}
              onChange={(e) => setTrackQuery(e.target.value.toUpperCase())}
              placeholder="#ERI-7EAB33E"
              spellCheck={false}
              aria-label="Event ID"
              style={{ ...fieldStyle(), fontFamily: MONO }}
            />
            <button
              type="submit"
              disabled={trackBusy}
              className="et-press"
              style={{
                minHeight: 46,
                height: 46,
                padding: '0 18px',
                borderRadius: 10,
                border: 'none',
                background: CREATE.tealDeep,
                color: '#fff',
                fontWeight: 600,
                fontSize: 13,
                cursor: trackBusy ? 'wait' : 'pointer',
                fontFamily: 'inherit',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {trackBusy ? <Loader2 size={15} className="spin" /> : <Search size={15} />}
              {trackBusy ? 'Looking…' : 'Track'}
            </button>
          </form>

          {trackLookupError ? (
            <p
              className="et-fade-in"
              style={{
                margin: '0 0 16px',
                padding: '12px 14px',
                borderRadius: 12,
                border: `1px solid ${CREATE.red}`,
                background: 'color-mix(in srgb, var(--destructive) 8%, transparent)',
                color: CREATE.red,
                fontSize: 12.5,
                fontWeight: 500,
              }}
            >
              {trackLookupError}
            </p>
          ) : null}

          {metrics ? (
            <EventProgressCard metrics={metrics} />
          ) : (
            <div
              style={{
                border: `1px solid ${CREATE.line}`,
                borderRadius: 14,
                padding: '16px 18px',
                color: CREATE.muted,
                fontSize: 13,
                background: CREATE.card,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              {trackBusy ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
              {trackBusy ? 'Looking up event tracking…' : 'Enter a master Event ID (for example #ERI-7EAB33E) to load tracking.'}
            </div>
          )}
        </div>
      </div>
    )
  }

  return <TicketForm onGenerate={handleGenerate} onBack={onBack} onTrackLookup={handleTrackLookup} />
}
