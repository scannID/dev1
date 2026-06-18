import { useState } from 'react'
import QRCode from 'qrcode'

/* ─── Tokens ────────────────────────────────────────────────────────── */
const C = {
  dark:    '#14201d',
  darker:  '#0d1612',
  teal:    '#0f766e',
  tealLt:  '#14b8a6',
  border:  '#1e332e',
  muted:   '#6b9e96',
  white:   '#ffffff',
}

/* ─── Types ─────────────────────────────────────────────────────────── */
type TemplateId = 'classic' | 'festival' | 'minimal'

type TicketClass = {
  id: string
  name: string   // Ordinary | VIP | VVIP | custom
  fee: string
}

type TableOption = {
  id: string
  name: string   // e.g. "Table A"
  seats: string  // number of people
  price: string  // price per table
}

type TicketData = {
  eventName: string
  date: string
  paymentDetails: string   // Mobile Money number or bank account
  template: TemplateId
  ticketClasses: TicketClass[]
  tables: TableOption[]
  ticketId: string
  selectedClass: string    // which class this individual ticket is for
}

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

function uid() {
  return 'TKT-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase()
}

function shortId() {
  return Math.random().toString(36).slice(2, 8)
}

const CLASS_ACCENT: Record<string, string> = {
  Ordinary: '#0f766e',
  VIP:      '#7c3aed',
  VVIP:     '#b45309',
}

function classAccent(name: string) {
  return CLASS_ACCENT[name] ?? '#2563eb'
}

/* ═══════════════════════════════════════════════════════════════════════
   TICKET RENDERERS
   ═══════════════════════════════════════════════════════════════════════ */

/* ── 1. CLASSIC ─────────────────────────────────────────────────────── */
function ClassicTicket({ d, qr, small }: { d: Partial<TicketData>; qr?: string; small?: boolean }) {
  const scale = small ? 0.52 : 1
  const cls = d.selectedClass || (d.ticketClasses?.[0]?.name) || 'Ordinary'
  const fee = d.ticketClasses?.find(c => c.name === cls)?.fee || ''
  const accent = classAccent(cls)
  return (
    <div style={{ width: 520, transformOrigin: 'top left', transform: `scale(${scale})`, fontFamily: "'Inter', sans-serif", background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: small ? 'none' : '0 24px 60px rgba(0,0,0,0.4)' }}>
      <div style={{ background: accent, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>ScanIT · Event Ticket</p>
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
            ['Date',    fmtDate(d.date || '')],
            ['Fee',     currency(fee)],
            ['Pay to',  d.paymentDetails || '—'],
            ['Ticket ID', d.ticketId || 'TKT-PREVIEW'],
          ].map(([label, val]) => (
            <div key={label}>
              <p style={{ margin: '0 0 2px', fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: accent }}>{label}</p>
              <p style={{ margin: 0, fontSize: label === 'Fee' ? 18 : 13, fontWeight: label === 'Fee' ? 900 : 600, color: '#111827', letterSpacing: label === 'Fee' ? '-0.02em' : 0, fontFamily: label === 'Ticket ID' ? 'monospace' : 'inherit' }}>{val}</p>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingTop: 4 }}>
          {qr ? <img src={qr} alt="QR" style={{ width: 120, height: 120, borderRadius: 8, border: `2px solid ${accent}33` }} />
              : <div style={{ width: 120, height: 120, borderRadius: 8, background: '#f9fafb', border: '2px dashed #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>QR code</div>}
          <p style={{ margin: 0, fontSize: 9, color: '#9ca3af', textAlign: 'center' }}>Scan to verify</p>
        </div>
      </div>
      <div style={{ background: '#f9fafb', borderTop: '1px dashed #e5e7eb', padding: '9px 24px', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: accent, fontWeight: 700 }}>scanit.app · Powered by ScanIT</span>
        <span style={{ fontSize: 10, color: '#9ca3af' }}>Non-transferable</span>
      </div>
    </div>
  )
}

/* ── 2. FESTIVAL ────────────────────────────────────────────────────── */
function FestivalTicket({ d, qr, small }: { d: Partial<TicketData>; qr?: string; small?: boolean }) {
  const scale = small ? 0.52 : 1
  const cls = d.selectedClass || (d.ticketClasses?.[0]?.name) || 'Ordinary'
  const fee = d.ticketClasses?.find(c => c.name === cls)?.fee || ''
  return (
    <div style={{ width: 520, transformOrigin: 'top left', transform: `scale(${scale})`, fontFamily: "'Inter', sans-serif", background: '#0d1117', borderRadius: 16, overflow: 'hidden', boxShadow: small ? 'none' : '0 24px 60px rgba(0,0,0,0.6)', border: '1px solid #30363d' }}>
      <div style={{ height: 4, background: 'linear-gradient(90deg,#7c3aed,#db2777,#f59e0b)' }} />
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #21262d', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', background: 'linear-gradient(90deg,#c084fc,#f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ScanIT · Festival Ticket</p>
          <h2 style={{ margin: 0, color: '#f0f6fc', fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{d.eventName || 'Event Name'}</h2>
        </div>
        <span style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)', color: '#fff', fontSize: 12, fontWeight: 800, padding: '4px 14px', borderRadius: 20, whiteSpace: 'nowrap', marginTop: 4 }}>{cls}</span>
      </div>
      <div style={{ padding: '18px 24px', display: 'grid', gridTemplateColumns: '1fr 130px', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 14 }}>
          {[['Date', fmtDate(d.date || ''), '#c084fc'], ['Fee', currency(fee), '#34d399'], ['Pay to', d.paymentDetails || '—', '#60a5fa'], ['Ticket ID', d.ticketId || 'TKT-PREVIEW', '#9ca3af']].map(([label, val, col]) => (
            <div key={label}>
              <p style={{ margin: '0 0 2px', fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: col }}>{label}</p>
              <p style={{ margin: 0, fontSize: label === 'Fee' ? 20 : 13, fontWeight: label === 'Fee' ? 900 : 600, color: '#f0f6fc', fontFamily: label === 'Ticket ID' ? 'monospace' : 'inherit' }}>{val}</p>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingTop: 4 }}>
          {qr ? <img src={qr} alt="QR" style={{ width: 120, height: 120, borderRadius: 8, border: '2px solid #7c3aed44' }} />
              : <div style={{ width: 120, height: 120, borderRadius: 8, background: '#161b22', border: '2px dashed #7c3aed44', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#c084fc', fontWeight: 600 }}>QR code</div>}
          <p style={{ margin: 0, fontSize: 9, color: '#6e7681', textAlign: 'center' }}>Scan to verify</p>
        </div>
      </div>
      <div style={{ background: '#161b22', borderTop: '1px solid #21262d', padding: '9px 24px', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, fontWeight: 700, background: 'linear-gradient(90deg,#c084fc,#f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>scanit.app</span>
        <span style={{ fontSize: 10, color: '#6e7681' }}>Non-transferable</span>
      </div>
    </div>
  )
}

/* ── 3. MINIMAL ─────────────────────────────────────────────────────── */
function MinimalTicket({ d, qr, small }: { d: Partial<TicketData>; qr?: string; small?: boolean }) {
  const scale = small ? 0.52 : 1
  const cls = d.selectedClass || (d.ticketClasses?.[0]?.name) || 'Ordinary'
  const fee = d.ticketClasses?.find(c => c.name === cls)?.fee || ''
  return (
    <div style={{ width: 520, transformOrigin: 'top left', transform: `scale(${scale})`, fontFamily: "'Inter', sans-serif", background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: small ? 'none' : '0 24px 60px rgba(0,0,0,0.35)', border: '1px solid #e5e7eb' }}>
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
          {[['Date', fmtDate(d.date || '')], ['Ticket fee', currency(fee)], ['Pay to', d.paymentDetails || '—'], ['Ticket ID', d.ticketId || 'TKT-PREVIEW']].map(([label, val]) => (
            <div key={label} style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: 10 }}>
              <p style={{ margin: '0 0 2px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af' }}>{label}</p>
              <p style={{ margin: 0, fontSize: label === 'Ticket fee' ? 19 : 13, fontWeight: label === 'Ticket fee' ? 900 : 600, color: '#111827', fontFamily: label === 'Ticket ID' ? 'monospace' : 'inherit' }}>{val}</p>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingTop: 4 }}>
          {qr ? <img src={qr} alt="QR" style={{ width: 120, height: 120, borderRadius: 6, border: '1px solid #e5e7eb' }} />
              : <div style={{ width: 120, height: 120, borderRadius: 6, background: '#f9fafb', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>QR code</div>}
          <p style={{ margin: 0, fontSize: 9, color: '#9ca3af', textAlign: 'center' }}>Scan to verify</p>
        </div>
      </div>
      <div style={{ background: '#f9fafb', borderTop: '1px solid #e5e7eb', padding: '9px 28px', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 600 }}>scanit.app · Powered by ScanIT</span>
        <span style={{ fontSize: 10, color: '#9ca3af' }}>Non-transferable</span>
      </div>
    </div>
  )
}

function TicketRenderer({ d, qr, small }: { d: Partial<TicketData>; qr?: string; small?: boolean }) {
  if (d.template === 'festival') return <FestivalTicket d={d} qr={qr} small={small} />
  if (d.template === 'minimal')  return <MinimalTicket  d={d} qr={qr} small={small} />
  return <ClassicTicket d={d} qr={qr} small={small} />
}

/* ─── Template picker ───────────────────────────────────────────────── */
const TEMPLATES: { id: TemplateId; label: string; desc: string }[] = [
  { id: 'classic',  label: 'Classic',  desc: 'Clean header band, white body' },
  { id: 'festival', label: 'Festival', desc: 'Dark full-bleed, neon accents' },
  { id: 'minimal',  label: 'Minimal',  desc: 'White card, understated type' },
]

function TemplatePicker({ value, onChange, formData }: { value: TemplateId; onChange: (t: TemplateId) => void; formData: Partial<TicketData> }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <span style={{ color: C.muted, fontSize: 13, fontWeight: 600 }}>Ticket template — pick how the buyer's ticket looks</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {TEMPLATES.map(t => (
          <button key={t.id} type="button" onClick={() => onChange(t.id)}
            style={{ padding: 0, border: `2px solid ${value === t.id ? C.teal : C.border}`, borderRadius: 12, background: value === t.id ? `${C.teal}11` : C.dark, cursor: 'pointer', overflow: 'hidden', textAlign: 'left', transition: 'border-color 0.15s' }}>
            <div style={{ height: 148, overflow: 'hidden', pointerEvents: 'none', position: 'relative', background: t.id === 'festival' ? '#0d1117' : '#e5e7eb' }}>
              <div style={{ position: 'absolute', top: 10, left: 10 }}>
                <TicketRenderer d={{ ...formData, template: t.id }} small />
              </div>
            </div>
            <div style={{ padding: '10px 12px', borderTop: `1px solid ${value === t.id ? `${C.teal}44` : C.border}` }}>
              <p style={{ margin: 0, color: value === t.id ? C.tealLt : C.white, fontSize: 13, fontWeight: 700 }}>{t.label}</p>
              <p style={{ margin: '2px 0 0', color: C.muted, fontSize: 11 }}>{t.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ─── Shared input style factory ────────────────────────────────────── */
function inp(hasError?: boolean): React.CSSProperties {
  return { width: '100%', padding: '10px 13px', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', background: C.dark, color: C.white, outline: 'none', border: `1.5px solid ${hasError ? '#ef4444' : C.border}` }
}

/* ─── Ticket classes editor ─────────────────────────────────────────── */
const DEFAULT_CLASSES: TicketClass[] = [
  { id: shortId(), name: 'Ordinary', fee: '' },
  { id: shortId(), name: 'VIP',      fee: '' },
  { id: shortId(), name: 'VVIP',     fee: '' },
]

const PRESET_NAMES = ['Ordinary', 'VIP', 'VVIP']

function ClassesEditor({ classes, onChange }: { classes: TicketClass[]; onChange: (c: TicketClass[]) => void }) {
  function updateClass(id: string, field: keyof TicketClass, val: string) {
    onChange(classes.map(c => c.id === id ? { ...c, [field]: val } : c))
  }
  function removeClass(id: string) {
    onChange(classes.filter(c => c.id !== id))
  }
  function addClass() {
    onChange([...classes, { id: shortId(), name: '', fee: '' }])
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: C.muted, fontSize: 13, fontWeight: 600 }}>Ticket classes & pricing</span>
        <button type="button" onClick={addClass}
          style={{ background: `${C.teal}22`, border: `1px solid ${C.teal}44`, color: C.tealLt, fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 7, cursor: 'pointer' }}>
          + Add class
        </button>
      </div>

      {/* Header row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 32px', gap: 8 }}>
        <span style={{ fontSize: 11, color: C.muted, fontWeight: 600, paddingLeft: 2 }}>Class name</span>
        <span style={{ fontSize: 11, color: C.muted, fontWeight: 600, paddingLeft: 2 }}>Fee (UGX)</span>
        <span />
      </div>

      {classes.map((cls) => (
        <div key={cls.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 32px', gap: 8, alignItems: 'center' }}>
          {/* Name — dropdown for presets, free text otherwise */}
          <div style={{ position: 'relative' }}>
            <input
              list={`class-names-${cls.id}`}
              value={cls.name}
              onChange={e => updateClass(cls.id, 'name', e.target.value)}
              placeholder="e.g. VIP"
              style={{ ...inp(), paddingRight: 28 }}
            />
            <datalist id={`class-names-${cls.id}`}>
              {PRESET_NAMES.map(n => <option key={n} value={n} />)}
            </datalist>
            {/* Colour dot */}
            <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 9, height: 9, borderRadius: '50%', background: classAccent(cls.name) }} />
          </div>
          <input
            type="number"
            min="0"
            value={cls.fee}
            onChange={e => updateClass(cls.id, 'fee', e.target.value)}
            placeholder="e.g. 50000"
            style={inp()}
          />
          <button type="button" onClick={() => removeClass(cls.id)}
            style={{ width: 32, height: 32, borderRadius: 7, background: '#7f1d1d22', border: '1px solid #7f1d1d44', color: '#f87171', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            ×
          </button>
        </div>
      ))}

      {classes.length === 0 && (
        <p style={{ color: C.muted, fontSize: 13, margin: '4px 0 0' }}>No classes yet — add at least one.</p>
      )}
    </div>
  )
}

/* ─── Tables editor ─────────────────────────────────────────────────── */
function TablesEditor({ tables, onChange }: { tables: TableOption[]; onChange: (t: TableOption[]) => void }) {
  function updateTable(id: string, field: keyof TableOption, val: string) {
    onChange(tables.map(t => t.id === id ? { ...t, [field]: val } : t))
  }
  function removeTable(id: string) { onChange(tables.filter(t => t.id !== id)) }
  function addTable() {
    onChange([...tables, { id: shortId(), name: `Table ${tables.length + 1}`, seats: '', price: '' }])
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: C.muted, fontSize: 13, fontWeight: 600 }}>Tables (optional)</span>
        <button type="button" onClick={addTable}
          style={{ background: '#7c3aed22', border: '1px solid #7c3aed44', color: '#c4b5fd', fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 7, cursor: 'pointer' }}>
          + Add table
        </button>
      </div>

      {tables.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr 32px', gap: 8 }}>
          {['Table name', 'Seats', 'Price (UGX)', ''].map(h => (
            <span key={h} style={{ fontSize: 11, color: C.muted, fontWeight: 600, paddingLeft: 2 }}>{h}</span>
          ))}
        </div>
      )}

      {tables.map(t => (
        <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr 32px', gap: 8, alignItems: 'center' }}>
          <input value={t.name} onChange={e => updateTable(t.id, 'name', e.target.value)} placeholder="e.g. Table A" style={inp()} />
          <input type="number" min="1" value={t.seats} onChange={e => updateTable(t.id, 'seats', e.target.value)} placeholder="6" style={inp()} />
          <input type="number" min="0" value={t.price} onChange={e => updateTable(t.id, 'price', e.target.value)} placeholder="200000" style={inp()} />
          <button type="button" onClick={() => removeTable(t.id)}
            style={{ width: 32, height: 32, borderRadius: 7, background: '#7f1d1d22', border: '1px solid #7f1d1d44', color: '#f87171', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            ×
          </button>
        </div>
      ))}

      {tables.length === 0 && (
        <p style={{ color: C.muted, fontSize: 12, margin: '2px 0 0' }}>No tables added. Only add if your event has table bookings.</p>
      )}
    </div>
  )
}

/* ─── Ticket output screen ──────────────────────────────────────────── */
function TicketOutput({ data, qr, onBack }: { data: TicketData; qr: string; onBack: () => void }) {
  // If multiple classes, allow switching which class to preview/print
  const [previewClass, setPreviewClass] = useState(data.ticketClasses[0]?.name || '')

  return (
    <div style={{ minHeight: '100vh', background: C.dark, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        @media print { .no-print { display: none !important; } body { background: white !important; } }
      `}</style>

      <div className="no-print" style={{ width: '100%', maxWidth: 560, display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <button onClick={onBack} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, padding: '8px 18px', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>
          ← Edit
        </button>
        <button onClick={() => window.print()} style={{ background: C.teal, border: 'none', color: C.white, padding: '8px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          🖨️ Print / Save PDF
        </button>
      </div>

      {/* Class switcher — only shown if multiple classes */}
      {data.ticketClasses.length > 1 && (
        <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
          {data.ticketClasses.map(cls => (
            <button key={cls.id} type="button" onClick={() => setPreviewClass(cls.name)}
              style={{ padding: '7px 18px', borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: `2px solid ${previewClass === cls.name ? classAccent(cls.name) : C.border}`, background: previewClass === cls.name ? `${classAccent(cls.name)}22` : C.dark, color: previewClass === cls.name ? classAccent(cls.name) : C.muted }}>
              {cls.name} — {currency(cls.fee)}
            </button>
          ))}
        </div>
      )}

      <TicketRenderer d={{ ...data, selectedClass: previewClass }} qr={qr} />

      {/* Tables summary */}
      {data.tables.length > 0 && (
        <div className="no-print" style={{ width: '100%', maxWidth: 560, marginTop: 24, background: C.darker, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
          <p style={{ margin: '0 0 12px', color: C.tealLt, fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Table bookings</p>
          <div style={{ display: 'grid', gap: 8 }}>
            {data.tables.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: C.dark, borderRadius: 9, border: `1px solid ${C.border}` }}>
                <div>
                  <p style={{ margin: 0, color: C.white, fontSize: 14, fontWeight: 700 }}>{t.name}</p>
                  <p style={{ margin: 0, color: C.muted, fontSize: 12 }}>{t.seats} seats</p>
                </div>
                <strong style={{ color: C.tealLt, fontSize: 15 }}>{currency(t.price)}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="no-print" style={{ color: C.muted, fontSize: 13, marginTop: 20, textAlign: 'center', maxWidth: 480 }}>
        Use the class switcher above to preview and print each ticket class separately. Each has a unique QR code.
      </p>
    </div>
  )
}

/* ─── Form ──────────────────────────────────────────────────────────── */
type FormState = {
  eventName: string
  date: string
  paymentDetails: string
  template: TemplateId
  ticketClasses: TicketClass[]
  tables: TableOption[]
}

function TicketForm({ onGenerate }: { onGenerate: (d: TicketData) => void }) {
  const [form, setForm] = useState<FormState>({
    eventName: '',
    date: '',
    paymentDetails: '',
    template: 'classic',
    ticketClasses: DEFAULT_CLASSES.map(c => ({ ...c, id: shortId() })),
    tables: [],
  })
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [touched, setTouched] = useState(false)

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function validate() {
    const e: Partial<Record<string, string>> = {}
    if (!form.eventName.trim())     e.eventName = 'Event name is required'
    if (!form.date)                 e.date = 'Event date is required'
    if (!form.paymentDetails.trim()) e.paymentDetails = 'Add a payment number or bank account'
    if (form.ticketClasses.length === 0) e.ticketClasses = 'Add at least one ticket class'
    if (form.ticketClasses.some(c => !c.name.trim())) e.ticketClasses = 'All classes need a name'
    if (form.ticketClasses.some(c => !c.fee || isNaN(Number(c.fee)))) e.ticketClasses = 'All classes need a valid fee'
    return e
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    onGenerate({
      eventName: form.eventName,
      date: form.date,
      paymentDetails: form.paymentDetails,
      template: form.template,
      ticketClasses: form.ticketClasses,
      tables: form.tables,
      ticketId: uid(),
      selectedClass: form.ticketClasses[0]?.name || '',
    })
  }

  const fieldInp = (field: string): React.CSSProperties => ({
    width: '100%', padding: '11px 14px', borderRadius: 9, fontSize: 15, fontFamily: 'inherit',
    background: C.dark, color: C.white, outline: 'none',
    border: `1.5px solid ${touched && errors[field] ? '#ef4444' : C.border}`,
  })

  return (
    <div style={{ minHeight: '100vh', background: C.dark, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 32px 60px', fontFamily: "'Inter', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap'); * { box-sizing: border-box; }`}</style>

      <div style={{ textAlign: 'center', marginBottom: 36, maxWidth: 960 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${C.teal}22`, border: `1px solid ${C.teal}44`, color: C.tealLt, fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, marginBottom: 16, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.tealLt, display: 'inline-block' }} />
          No sign-in required
        </div>
        <h1 style={{ color: C.white, fontSize: 'clamp(26px,5vw,38px)', fontWeight: 900, letterSpacing: '-0.03em', margin: '0 0 10px' }}>Create Event Ticket</h1>
        <p style={{ color: C.muted, fontSize: 15, lineHeight: 1.6, margin: 0 }}>Set your event details, ticket classes, and payment info — then generate a printable QR ticket.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate style={{ width: '100%', maxWidth: 960, background: C.darker, border: `1px solid ${C.border}`, borderRadius: 18, padding: '32px 32px', display: 'grid', gap: 24 }}>

        {/* ── Row 1: Event name + Date side by side ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ color: C.muted, fontSize: 13, fontWeight: 600 }}>Event name</span>
            <input style={fieldInp('eventName')} type="text" placeholder="e.g. Kampala Rooftop Bash 2025" value={form.eventName} onChange={e => set('eventName', e.target.value)} />
            {touched && errors.eventName && <span style={{ color: '#f87171', fontSize: 12 }}>{errors.eventName}</span>}
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ color: C.muted, fontSize: 13, fontWeight: 600 }}>Event date</span>
            <input style={{ ...fieldInp('date'), colorScheme: 'dark' }} type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            {touched && errors.date && <span style={{ color: '#f87171', fontSize: 12 }}>{errors.date}</span>}
          </label>
        </div>

        {/* ── Row 2: Payment details full width ── */}
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ color: C.muted, fontSize: 13, fontWeight: 600 }}>Payment details — where buyers send money</span>
          <input
            style={fieldInp('paymentDetails')}
            type="text"
            placeholder="e.g. MTN 0771234567 (John D.) or Stanbic 9030012345678"
            value={form.paymentDetails}
            onChange={e => set('paymentDetails', e.target.value)}
          />
          <span style={{ color: '#6b9e96', fontSize: 11 }}>Mobile Money number, bank account, or Airtel Money — this prints on every ticket so buyers know where to pay.</span>
          {touched && errors.paymentDetails && <span style={{ color: '#f87171', fontSize: 12 }}>{errors.paymentDetails}</span>}
        </label>

        <div style={{ borderTop: `1px solid ${C.border}` }} />

        {/* ── Row 3: Ticket classes + Tables side by side ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'start' }}>
          <div>
            <ClassesEditor classes={form.ticketClasses} onChange={v => set('ticketClasses', v)} />
            {touched && errors.ticketClasses && <span style={{ color: '#f87171', fontSize: 12, marginTop: 4, display: 'block' }}>{errors.ticketClasses}</span>}
          </div>
          <TablesEditor tables={form.tables} onChange={v => set('tables', v)} />
        </div>

        <div style={{ borderTop: `1px solid ${C.border}` }} />

        {/* ── Row 4: Template picker full width ── */}
        <TemplatePicker value={form.template} onChange={t => set('template', t)} formData={{ ...form, selectedClass: form.ticketClasses[0]?.name }} />

        <button type="submit" style={{ marginTop: 4, background: C.teal, color: C.white, border: 'none', borderRadius: 10, padding: '14px', fontSize: 16, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          Generate QR Ticket
          <svg width="17" height="17" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </form>
    </div>
  )
}

/* ─── Page root ─────────────────────────────────────────────────────── */
export default function EventTicketPage({ onBack }: { onBack: () => void }) {
  const [ticket, setTicket] = useState<TicketData | null>(null)
  const [qr, setQr] = useState('')

  async function handleGenerate(data: TicketData) {
    const payload = JSON.stringify({
      id: data.ticketId,
      event: data.eventName,
      template: data.template,
      date: data.date,
      classes: data.ticketClasses,
      tables: data.tables,
      payTo: data.paymentDetails,
      issued: new Date().toISOString(),
    })
    try {
      const url = await QRCode.toDataURL(payload, { color: { dark: '#0d1612', light: '#ffffff' }, margin: 1, width: 280, errorCorrectionLevel: 'M' })
      setQr(url)
    } catch { /* QR optional */ }
    setTicket(data)
  }

  if (ticket) {
    return <TicketOutput data={ticket} qr={qr} onBack={() => { setTicket(null); setQr('') }} />
  }

  return (
    <div>
      <div style={{ position: 'fixed', top: 14, left: 16, zIndex: 99 }}>
        <button onClick={onBack} style={{ background: C.darker, border: `1px solid ${C.border}`, color: C.muted, padding: '7px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          ← ScanIT Home
        </button>
      </div>
      <TicketForm onGenerate={handleGenerate} />
    </div>
  )
}
