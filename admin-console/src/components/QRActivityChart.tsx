import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type HourPoint = { hour: number; scans: number; orders: number }

interface Props {
  hourly: HourPoint[]
}

/* ─── Layout constants ───────────────────────────────────────────────────── */

const VW = 620
const VH = 130
const PL = 30   // left pad (y-axis labels)
const PR = 6
const PT = 8
const PB = 20   // bottom pad (x-axis labels)
const CW = VW - PL - PR
const CH = VH - PT - PB

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function fmt(v: number) {
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`
  return String(v)
}

function tx(hour: number) {
  // 24 columns; each bar is centred on its hour slot
  return PL + (hour / 23) * CW
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
  if (!pts.length) return ''
  const first = pts[0], last = pts[pts.length - 1]
  return `${smooth(pts)} L${last[0]},${VH - PB} L${first[0]},${VH - PB} Z`
}

/** Width of one bar column (leave a small gap on each side) */
function barWidth() {
  return Math.max(3, (CW / 24) * 0.55)
}

/** 
 * Returns the UTC/local hours that make up "business hours" (8am–10pm).
 * Used to tint the busy band on the chart.
 */
const BUSY_START = 8
const BUSY_END = 22

/* ─── X-axis tick labels ─────────────────────────────────────────────────── */

const X_TICKS = [0, 4, 8, 12, 16, 20, 23]
const X_LABELS: Record<number, string> = {
  0: '12am', 4: '4am', 8: '8am', 12: '12pm', 16: '4pm', 20: '8pm', 23: '11pm',
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export default function QRActivityChart({ hourly }: Props) {
  const [activeHour, setActiveHour] = useState<number | null>(null)
  const chartRef = useRef<SVGSVGElement>(null)

  // Normalise: ensure we always have exactly 24 buckets
  const data: HourPoint[] = Array.from({ length: 24 }, (_, h) => {
    const found = hourly.find((p) => p.hour === h)
    return found ?? { hour: h, scans: 0, orders: 0 }
  })

  const maxScans  = Math.max(...data.map((d) => d.scans), 1)
  const maxOrders = Math.max(...data.map((d) => d.orders), 1)
  const yMax      = Math.max(maxScans, maxOrders)

  // Y-axis grid ticks — fewer at small size
  const yTicks = [0.5, 1].map((f) => Math.round(yMax * f))

  // Order line points
  const orderPts: [number, number][] = data.map((d) => [tx(d.hour), ty(d.orders, yMax)])
  const orderLine = smooth(orderPts)
  const orderArea = areaPath(orderPts)

  // Resolve hover from pointer position
  const hourFromClientX = useCallback((clientX: number): number | null => {
    const svg = chartRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    const svgX  = ((clientX - rect.left) / rect.width) * VW
    const plotX = Math.min(Math.max(svgX, PL), VW - PR)
    const t     = (plotX - PL) / Math.max(CW, 1)
    return Math.min(23, Math.max(0, Math.round(t * 23)))
  }, [])

  const onPointerMove = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    const h = hourFromClientX(e.clientX)
    if (h !== null) setActiveHour(h)
  }, [hourFromClientX])

  const onPointerLeave = useCallback(() => setActiveHour(null), [])

  const active = activeHour !== null ? data[activeHour] : null

  // Tooltip side
  const tooltipLeft = active ? (tx(active.hour) / VW) * 100 : 0
  const tooltipSide = tooltipLeft > 60 ? 'right' : 'left'

  const bw = barWidth()

  // 12-hr label
  function hourLabel(h: number) {
    if (h === 0)  return '12:00 AM'
    if (h === 12) return '12:00 PM'
    return h < 12 ? `${h}:00 AM` : `${h - 12}:00 PM`
  }

  const totalScans  = data.reduce((s, d) => s + d.scans, 0)
  const totalOrders = data.reduce((s, d) => s + d.orders, 0)
  const peakScanHour  = data.reduce((b, d) => (d.scans  > b.scans  ? d : b), data[0])
  const peakOrderHour = data.reduce((b, d) => (d.orders > b.orders ? d : b), data[0])
  const conversion = totalScans > 0 ? Math.round((totalOrders / totalScans) * 1000) / 10 : 0

  const hasData = data.some((d) => d.scans > 0 || d.orders > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Legend + totals ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 12,
        padding: '2px 2px 8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: '#5ac8fa', display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Scans</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#5ac8fa', marginLeft: 2 }}>{fmt(totalScans)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 9, height: 2, borderRadius: 2, background: '#f07848', display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Orders</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#f07848', marginLeft: 2 }}>{fmt(totalOrders)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto' }}>
          <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>Conversion</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground)' }}>{conversion}%</span>
        </div>
      </div>

      {/* ── Chart ───────────────────────────────────────────────────────── */}
      <div
        style={{ position: 'relative', touchAction: 'none', cursor: 'crosshair' }}
        role="img"
        aria-label="QR scans and orders by hour over the last 24 hours. Hover to inspect each hour."
      >
        <svg
          ref={chartRef}
          viewBox={`0 0 ${VW} ${VH}`}
          style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
          preserveAspectRatio="xMidYMid meet"
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
        >
          <defs>
            {/* Scan bar gradient */}
            <linearGradient id="qrac-scan-bar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#5ac8fa" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#5ac8fa" stopOpacity="0.35" />
            </linearGradient>
            {/* Order line area gradient */}
            <linearGradient id="qrac-order-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#f07848" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#f07848" stopOpacity="0" />
            </linearGradient>
            {/* Busy-band gradient (subtle warm tint) */}
            <linearGradient id="qrac-busy-band" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#f59e0b" stopOpacity="0.07" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.03" />
            </linearGradient>
            {/* Hover bar highlight */}
            <linearGradient id="qrac-hover-bar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#5ac8fa" stopOpacity="1" />
              <stop offset="100%" stopColor="#5ac8fa" stopOpacity="0.6" />
            </linearGradient>
            {/* Glow for order dot */}
            <filter id="qrac-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="2.5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* ── Busy-hours background band (8am – 10pm) ──────────────── */}
          <rect
            x={tx(BUSY_START) - bw / 2}
            y={PT}
            width={tx(BUSY_END) - tx(BUSY_START) + bw}
            height={CH}
            fill="url(#qrac-busy-band)"
            rx={4}
          />

          {/* ── Y-axis grid lines + labels ────────────────────────────── */}
          {yTicks.map((v) => {
            const y = ty(v, yMax)
            return (
              <g key={v}>
                <line
                  x1={PL} y1={y} x2={VW - PR} y2={y}
                  stroke="var(--border)" strokeWidth="0.75" strokeDasharray="3 5"
                />
                <text
                  x={PL - 5} y={y + 3.5}
                  textAnchor="end" fontSize="8"
                  fill="var(--muted-foreground)"
                  fontFamily="ui-sans-serif, sans-serif"
                >
                  {fmt(v)}
                </text>
              </g>
            )
          })}

          {/* ── X-axis labels ─────────────────────────────────────────── */}
          {X_TICKS.map((h) => (
            <text
              key={h}
              x={tx(h)} y={VH - 2}
              textAnchor="middle" fontSize="6"
              fill="var(--muted-foreground)"
              fontFamily="ui-sans-serif, sans-serif"
            >
              {X_LABELS[h]}
            </text>
          ))}

          {/* ── Scan bars ─────────────────────────────────────────────── */}
          {data.map((d) => {
            const x    = tx(d.hour) - bw / 2
            const barH = (d.scans / Math.max(yMax, 1)) * CH
            const y    = PT + CH - barH
            const isActive = activeHour === d.hour
            const isPeak   = d.hour === peakScanHour.hour && d.scans > 0
            return (
              <rect
                key={d.hour}
                x={x} y={y}
                width={bw} height={Math.max(barH, 0)}
                fill={isActive ? 'url(#qrac-hover-bar)' : 'url(#qrac-scan-bar)'}
                rx="2"
                opacity={active && !isActive ? 0.45 : 1}
                style={{ transition: 'opacity 0.12s, y 0.3s, height 0.3s' }}
              >
                {isPeak && <title>Peak scan hour</title>}
              </rect>
            )
          })}

          {/* ── Order area fill ───────────────────────────────────────── */}
          <path d={orderArea} fill="url(#qrac-order-area)" />

          {/* ── Order line ────────────────────────────────────────────── */}
          <path
            d={orderLine}
            fill="none"
            stroke="#f07848"
            strokeWidth="1.2"
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ transition: 'd 0.3s ease' }}
          />

          {/* ── Peak scan indicator (crown dot) ───────────────────────── */}
          {peakScanHour.scans > 0 && (
            <g>
              <circle
                cx={tx(peakScanHour.hour)}
                cy={ty(peakScanHour.scans, yMax) - 5}
                r="1.8" fill="#5ac8fa"
              />
              <text
                x={tx(peakScanHour.hour)}
                y={ty(peakScanHour.scans, yMax) - 9}
                textAnchor="middle" fontSize="5"
                fill="#5ac8fa" fontWeight="700"
                fontFamily="ui-sans-serif, sans-serif"
              >
                ▲
              </text>
            </g>
          )}

          {/* ── Peak order dot ────────────────────────────────────────── */}
          {peakOrderHour.orders > 0 && (
            <g filter="url(#qrac-glow)">
              <circle
                cx={tx(peakOrderHour.hour)}
                cy={ty(peakOrderHour.orders, yMax)}
                r="2.5" fill="#f07848" opacity="0.22"
              />
              <circle
                cx={tx(peakOrderHour.hour)}
                cy={ty(peakOrderHour.orders, yMax)}
                r="1.6" fill="#f07848" stroke="#ffe0c8" strokeWidth="0.8"
              />
            </g>
          )}

          {/* ── Hover crosshair + active order dot ────────────────────── */}
          {active && (
            <g pointerEvents="none">
              <line
                x1={tx(active.hour)} y1={PT}
                x2={tx(active.hour)} y2={VH - PB}
                stroke="var(--foreground)" strokeOpacity="0.15"
                strokeWidth="0.75" strokeDasharray="2 3"
              />
              {active.orders > 0 && (
                <>
                  <circle
                    cx={tx(active.hour)}
                    cy={ty(active.orders, yMax)}
                    r="3" fill="#f07848" opacity="0.2"
                  />
                  <circle
                    cx={tx(active.hour)}
                    cy={ty(active.orders, yMax)}
                    r="1.8" fill="#f07848" stroke="#ffe0c8" strokeWidth="0.8"
                  />
                </>
              )}
            </g>
          )}
        </svg>

        {/* ── Tooltip ─────────────────────────────────────────────────── */}
        {active && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              ...(tooltipSide === 'left'
                ? { left: `calc(${tooltipLeft}% + 10px)` }
                : { right: `calc(${100 - tooltipLeft}% + 10px)` }),
              zIndex: 2,
              minWidth: 140,
              padding: '9px 12px',
              borderRadius: 10,
              background: 'color-mix(in oklch, var(--card) 92%, var(--foreground) 8%)',
              border: '1px solid var(--border)',
              boxShadow: '0 8px 24px oklch(0 0 0 / 14%)',
              pointerEvents: 'none',
              backdropFilter: 'blur(8px)',
            }}
          >
            <p style={{
              margin: '0 0 6px',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--foreground)',
            }}>
              {hourLabel(active.hour)}
            </p>
            <div style={{ display: 'grid', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted-foreground)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: '#5ac8fa', flexShrink: 0 }} />
                  Scans
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#5ac8fa', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(active.scans)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted-foreground)' }}>
                  <span style={{ width: 8, height: 3, borderRadius: 2, background: '#f07848', flexShrink: 0 }} />
                  Orders
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#f07848', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(active.orders)}
                </span>
              </div>
              {active.scans > 0 && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center',
                  paddingTop: 5, borderTop: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Conv.</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>
                    {Math.round((active.orders / active.scans) * 1000) / 10}%
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Peak summary chips ──────────────────────────────────────────── */}
      {hasData && totalScans > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          paddingTop: 10,
          borderTop: '1px solid var(--border)',
          marginTop: 2,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '3px 8px', borderRadius: 20,
            background: 'var(--muted)',
            border: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--muted-foreground)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Busy Hours</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--foreground)' }}>8am – 10pm</span>
          </div>
        </div>
      )}
    </div>
  )
}
