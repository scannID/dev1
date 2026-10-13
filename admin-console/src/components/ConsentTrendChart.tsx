import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { CookieConsentSeries } from '../api/types'

interface Props {
  series: CookieConsentSeries
}

/* ─── Layout ─────────────────────────────────────────────────────────────── */

const VW = 620
const VH = 130
const PL = 30
const PR = 6
const PT = 8
const PB = 20
const CW = VW - PL - PR
const CH = VH - PT - PB

/* ─── Colors ─────────────────────────────────────────────────────────────── */

const C_ACCEPT   = '#ea580c'   // orange — accepted (full consent)
const C_ESSENTIAL = '#64748b'  // slate  — essential-only

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function fmt(v: number) {
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`
  return String(v)
}

function tx(i: number, n: number) {
  return PL + (i / Math.max(n - 1, 1)) * CW
}

function ty(v: number, max: number) {
  return PT + CH - (v / Math.max(max, 1)) * CH
}

function smooth(pts: [number, number][]) {
  if (pts.length < 2) return ''
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 1; i < pts.length; i++) {
    const mx = (pts[i - 1][0] + pts[i][0]) / 2
    d += ` C${mx},${pts[i - 1][1]} ${mx},${pts[i][1]} ${pts[i][0]},${pts[i][1]}`
  }
  return d
}

function areaPath(pts: [number, number][]) {
  if (pts.length < 2) return ''
  const first = pts[0], last = pts[pts.length - 1]
  return `${smooth(pts)} L${last[0]},${VH - PB} L${first[0]},${VH - PB} Z`
}

function xStep(n: number) {
  if (n <= 7)  return 1
  if (n <= 16) return 2
  return Math.ceil(n / 7)
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export default function ConsentTrendChart({ series }: Props) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const n = series.accepted.length

  const acceptPts:  [number, number][] = series.accepted.map((v, i) => [tx(i, n), ty(v, series.yMax)])
  const essentialPts: [number, number][] = series.essential.map((v, i) => [tx(i, n), ty(v, series.yMax)])

  const acceptLine    = smooth(acceptPts)
  const acceptArea    = areaPath(acceptPts)
  const essentialLine = smooth(essentialPts)
  const essentialArea = areaPath(essentialPts)

  // Y-axis ticks
  const yTicks = [0.5, 1].map((f) => Math.round(series.yMax * f))

  // X-axis labels
  const step = xStep(series.xLabels.length)

  // Pointer → index
  const idxFromClientX = useCallback((clientX: number): number | null => {
    const svg = svgRef.current
    if (!svg || n < 1) return null
    const rect = svg.getBoundingClientRect()
    const svgX  = ((clientX - rect.left) / rect.width) * VW
    const plotX = Math.min(Math.max(svgX, PL), VW - PR)
    const t     = (plotX - PL) / Math.max(CW, 1)
    return Math.min(n - 1, Math.max(0, Math.round(t * (n - 1))))
  }, [n])

  const onPointerMove = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    const idx = idxFromClientX(e.clientX)
    if (idx !== null) setActiveIdx(idx)
  }, [idxFromClientX])

  const onPointerLeave = useCallback(() => setActiveIdx(null), [])

  const active = activeIdx !== null ? {
    i: activeIdx,
    label: series.xLabels[activeIdx] ?? '—',
    accepted:  series.accepted[activeIdx]  ?? 0,
    essential: series.essential[activeIdx] ?? 0,
    x: tx(activeIdx, n),
    acceptY:   acceptPts[activeIdx]?.[1]   ?? PT,
    essentialY: essentialPts[activeIdx]?.[1] ?? PT,
  } : null

  const tooltipLeftPct = active ? (active.x / VW) * 100 : 0
  const tooltipSide    = tooltipLeftPct > 60 ? 'right' : 'left'

  const totalAccepted  = series.accepted.reduce((s, v) => s + v, 0)
  const totalEssential = series.essential.reduce((s, v) => s + v, 0)
  const totalAll       = totalAccepted + totalEssential
  const acceptPct      = totalAll > 0 ? Math.round((totalAccepted / totalAll) * 100) : 0

  if (n === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: 0 }}>
        No consent events in this range yet.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: '2px 2px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 16, height: 2, borderRadius: 2, background: C_ACCEPT, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Accepted</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: C_ACCEPT, marginLeft: 2 }}>{fmt(totalAccepted)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 16, height: 2, borderRadius: 2, background: C_ESSENTIAL, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Essential only</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: C_ESSENTIAL, marginLeft: 2 }}>{fmt(totalEssential)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto' }}>
          <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>Accept rate</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: acceptPct >= 50 ? '#16a34a' : 'var(--destructive)' }}>{acceptPct}%</span>
        </div>
      </div>

      {/* ── Chart ───────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', touchAction: 'none', cursor: 'crosshair' }}
           role="img"
           aria-label="Cookie consent trend. Hover to inspect each period.">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VW} ${VH}`}
          style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
          preserveAspectRatio="xMidYMid meet"
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
        >
          <defs>
            <linearGradient id="ctc-accept-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={C_ACCEPT}    stopOpacity="0.2" />
              <stop offset="100%" stopColor={C_ACCEPT}    stopOpacity="0" />
            </linearGradient>
            <linearGradient id="ctc-essential-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={C_ESSENTIAL} stopOpacity="0.14" />
              <stop offset="100%" stopColor={C_ESSENTIAL} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* ── Y-axis grid + labels ───────────────────────────────────── */}
          {yTicks.map((v) => {
            const y = ty(v, series.yMax)
            return (
              <g key={v}>
                <line
                  x1={PL} y1={y} x2={VW - PR} y2={y}
                  stroke="var(--border)" strokeWidth="0.75" strokeDasharray="3 5"
                />
                <text x={PL - 5} y={y + 3.5}
                  textAnchor="end" fontSize="7"
                  fill="var(--muted-foreground)"
                  fontFamily="ui-sans-serif, sans-serif">
                  {fmt(v)}
                </text>
              </g>
            )
          })}

          {/* ── X-axis labels ─────────────────────────────────────────── */}
          {series.xLabels.map((label, i) => {
            if (i % step !== 0 && i !== n - 1) return null
            return (
              <text key={`xl-${i}`}
                x={tx(i, n)} y={VH - 2}
                textAnchor="middle" fontSize="6"
                fill="var(--muted-foreground)"
                fontFamily="ui-sans-serif, sans-serif">
                {label}
              </text>
            )
          })}

          {/* ── Area fills ────────────────────────────────────────────── */}
          <path d={essentialArea} fill="url(#ctc-essential-area)" />
          <path d={acceptArea}    fill="url(#ctc-accept-area)" />

          {/* ── Lines ─────────────────────────────────────────────────── */}
          <path d={essentialLine} fill="none" stroke={C_ESSENTIAL} strokeWidth="1.2"
                strokeLinejoin="round" strokeLinecap="round" />
          <path d={acceptLine}    fill="none" stroke={C_ACCEPT}    strokeWidth="1.2"
                strokeLinejoin="round" strokeLinecap="round" />

          {/* ── Hover crosshair + dots ─────────────────────────────────── */}
          {active && (
            <g pointerEvents="none">
              <line
                x1={active.x} y1={PT}
                x2={active.x} y2={VH - PB}
                stroke="var(--foreground)" strokeOpacity="0.15"
                strokeWidth="0.75" strokeDasharray="2 3"
              />
              {/* accepted dot */}
              <circle cx={active.x} cy={active.acceptY}    r="2.5" fill={C_ACCEPT}    opacity="0.2" />
              <circle cx={active.x} cy={active.acceptY}    r="1.6" fill={C_ACCEPT}    stroke="var(--card)" strokeWidth="0.8" />
              {/* essential dot */}
              <circle cx={active.x} cy={active.essentialY} r="2.5" fill={C_ESSENTIAL} opacity="0.2" />
              <circle cx={active.x} cy={active.essentialY} r="1.6" fill={C_ESSENTIAL} stroke="var(--card)" strokeWidth="0.8" />
            </g>
          )}
        </svg>

        {/* ── Tooltip ───────────────────────────────────────────────────── */}
        {active && (
          <div style={{
            position: 'absolute',
            top: 8,
            ...(tooltipSide === 'left'
              ? { left: `calc(${tooltipLeftPct}% + 10px)` }
              : { right: `calc(${100 - tooltipLeftPct}% + 10px)` }),
            zIndex: 2,
            minWidth: 140,
            padding: '8px 11px',
            borderRadius: 10,
            background: 'color-mix(in oklch, var(--card) 92%, var(--foreground) 8%)',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 24px oklch(0 0 0 / 14%)',
            pointerEvents: 'none',
            backdropFilter: 'blur(8px)',
          }}>
            <p style={{ margin: '0 0 5px', fontSize: 11, fontWeight: 700, color: 'var(--foreground)' }}>
              {active.label}
            </p>
            <div style={{ display: 'grid', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted-foreground)' }}>
                  <span style={{ width: 8, height: 2, borderRadius: 2, background: C_ACCEPT, flexShrink: 0 }} />
                  Accepted
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C_ACCEPT, fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(active.accepted)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted-foreground)' }}>
                  <span style={{ width: 8, height: 2, borderRadius: 2, background: C_ESSENTIAL, flexShrink: 0 }} />
                  Essential
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C_ESSENTIAL, fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(active.essential)}
                </span>
              </div>
              {(active.accepted + active.essential) > 0 && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center',
                  paddingTop: 4, borderTop: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Accept rate</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>
                    {Math.round((active.accepted / (active.accepted + active.essential)) * 100)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Summary chips ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 10, borderTop: '1px solid var(--border)', marginTop: 2 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '3px 8px', borderRadius: 20,
          background: 'color-mix(in oklch, #ea580c 12%, transparent)',
          border: '1px solid color-mix(in oklch, #ea580c 30%, transparent)',
        }}>
          <span style={{ fontSize: 9, fontWeight: 600, color: C_ACCEPT, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Accepted</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--foreground)' }}>{fmt(totalAccepted)}</span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '3px 8px', borderRadius: 20,
          background: 'color-mix(in oklch, #64748b 12%, transparent)',
          border: '1px solid color-mix(in oklch, #64748b 30%, transparent)',
        }}>
          <span style={{ fontSize: 9, fontWeight: 600, color: C_ESSENTIAL, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Essential only</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--foreground)' }}>{fmt(totalEssential)}</span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '3px 8px', borderRadius: 20,
          background: 'var(--muted)',
          border: '1px solid var(--border)',
          marginLeft: 'auto',
        }}>
          <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--muted-foreground)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Accept rate</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: acceptPct >= 50 ? '#16a34a' : 'var(--destructive)' }}>{acceptPct}%</span>
        </div>
      </div>
    </div>
  )
}
