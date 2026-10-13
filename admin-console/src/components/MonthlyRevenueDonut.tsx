import { useState } from 'react'

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type MonthlyPoint = { month: string; revenue: number; transactions: number }

interface Props {
  monthly: MonthlyPoint[]
  currency?: string
}

/* ─── Colors ─────────────────────────────────────────────────────────────── */

// Uses the project's CSS chart variables + primary so they respond to
// light/dark mode automatically. We cycle through chart-1…chart-5 twice,
// mixing in primary for the most recent month.
const PALETTE = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--primary)',
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--primary)',
]

const FONT = "'Outfit Variable', ui-sans-serif, system-ui, sans-serif"

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function currency(amount: number, curr = 'UGX') {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: curr,
    maximumFractionDigits: 0,
  }).format(amount)
}

function shortCurrency(amount: number) {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`
  if (amount >= 1_000_000)     return `${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000)         return `${(amount / 1_000).toFixed(0)}k`
  return String(amount)
}

/** Convert polar → cartesian on a unit circle, then scale + translate. */
function polarToXY(angleDeg: number, r: number, cx: number, cy: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

/** SVG arc path for a donut segment. */
function arcPath(
  startDeg: number,
  endDeg: number,
  outerR: number,
  innerR: number,
  cx: number,
  cy: number,
): string {
  const GAP = 1.2 // degrees gap between segments
  const s = startDeg + GAP / 2
  const e = endDeg   - GAP / 2
  if (e - s <= 0) return ''

  const largeArc = e - s > 180 ? 1 : 0
  const o1 = polarToXY(s, outerR, cx, cy)
  const o2 = polarToXY(e, outerR, cx, cy)
  const i1 = polarToXY(e, innerR, cx, cy)
  const i2 = polarToXY(s, innerR, cx, cy)

  return [
    `M ${o1.x} ${o1.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${o2.x} ${o2.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${i2.x} ${i2.y}`,
    'Z',
  ].join(' ')
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export default function MonthlyRevenueDonut({ monthly, currency: curr = 'UGX' }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  if (!monthly.length) {
    return (
      <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: 0 }}>
        No monthly revenue data yet.
      </p>
    )
  }

  const total = monthly.reduce((s, m) => s + m.revenue, 0)
  const last  = monthly[monthly.length - 1]

  // SVG dimensions
  const SIZE    = 160
  const CX      = SIZE / 2
  const CY      = SIZE / 2
  const OUTER_R = 68
  const INNER_R = 44

  // Compute arc angles
  let cursor = 0
  const segments = monthly.map((m, i) => {
    const frac  = total > 0 ? m.revenue / total : 1 / monthly.length
    const start = cursor * 360
    cursor += frac
    const end   = cursor * 360
    return { ...m, start, end, frac, color: PALETTE[i % PALETTE.length], i }
  })

  const active = hoveredIdx !== null ? segments[hoveredIdx] : null

  // Centre display: show hovered segment or last month total
  const centreRevenue = active ? active.revenue : last.revenue
  const centreLabel   = active ? active.month   : last.month

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>

      {/* ── Donut ────────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <svg
          width={SIZE} height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{ display: 'block', overflow: 'visible' }}
          role="img"
          aria-label="Monthly revenue donut chart"
        >
          {segments.map((seg) => {
            const isHovered = hoveredIdx === seg.i
            const isAny     = hoveredIdx !== null
            const scale     = isHovered ? 1.04 : 1
            return (
              <path
                key={seg.month}
                d={arcPath(seg.start, seg.end, OUTER_R, INNER_R, CX, CY)}
                fill={seg.color}
                opacity={isAny && !isHovered ? 0.45 : 1}
                style={{
                  transformOrigin: `${CX}px ${CY}px`,
                  transform: `scale(${scale})`,
                  transition: 'opacity 0.15s, transform 0.15s',
                  cursor: 'pointer',
                }}
                onPointerEnter={() => setHoveredIdx(seg.i)}
                onPointerLeave={() => setHoveredIdx(null)}
              >
                <title>{seg.month}: {currency(seg.revenue, curr)}</title>
              </path>
            )
          })}

          {/* Centre text */}
          <text
            x={CX} y={CY - 8}
            textAnchor="middle"
            fontSize="8"
            fill="var(--muted-foreground)"
            fontFamily={FONT}
            fontWeight="500"
          >
            {centreLabel}
          </text>
          <text
            x={CX} y={CY + 6}
            textAnchor="middle"
            fontSize="11"
            fill="var(--foreground)"
            fontFamily={FONT}
            fontWeight="700"
          >
            {shortCurrency(centreRevenue)}
          </text>
          <text
            x={CX} y={CY + 18}
            textAnchor="middle"
            fontSize="7"
            fill="var(--muted-foreground)"
            fontFamily={FONT}
          >
            {curr}
          </text>
        </svg>
      </div>

      {/* ── Legend ───────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        minWidth: 0,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '4px 10px',
        alignContent: 'start',
      }}>
        {segments.map((seg) => {
          const isHovered = hoveredIdx === seg.i
          return (
            <div
              key={seg.month}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 5px',
                borderRadius: 6,
                background: isHovered ? 'var(--muted)' : 'transparent',
                cursor: 'pointer',
                transition: 'background 0.12s',
              }}
              onPointerEnter={() => setHoveredIdx(seg.i)}
              onPointerLeave={() => setHoveredIdx(null)}
            >
              <span style={{
                width: 8, height: 8,
                borderRadius: 2,
                background: seg.color,
                flexShrink: 0,
                opacity: hoveredIdx !== null && !isHovered ? 0.45 : 1,
                transition: 'opacity 0.15s',
              }} />
              <span style={{
                fontSize: 10,
                color: isHovered ? 'var(--foreground)' : 'var(--muted-foreground)',
                fontWeight: isHovered ? 600 : 400,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 0,
                transition: 'color 0.12s',
              }}>
                {seg.month}
              </span>
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                color: isHovered ? seg.color : 'var(--foreground)',
                marginLeft: 'auto',
                fontVariantNumeric: 'tabular-nums',
                flexShrink: 0,
                transition: 'color 0.12s',
              }}>
                {shortCurrency(seg.revenue)}
              </span>
            </div>
          )
        })}

        {/* Total row */}
        <div style={{
          gridColumn: '1 / -1',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 6,
          marginTop: 2,
          borderTop: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Total</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>
            {shortCurrency(total)} {curr}
          </span>
        </div>
      </div>
    </div>
  )
}
