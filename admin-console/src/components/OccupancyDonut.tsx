import { useState } from 'react'

interface Props {
  occupied: number
  vacant: number
  totalUnits: number
  totalProperties: number
}

const FONT = "'Outfit Variable', ui-sans-serif, system-ui, sans-serif"

const PALETTE = [
  '#f59e0b', // occupied — amber
  'var(--muted-foreground)', // vacant — muted
]

function polarToXY(angleDeg: number, r: number, cx: number, cy: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(
  startDeg: number,
  endDeg: number,
  outerR: number,
  innerR: number,
  cx: number,
  cy: number,
): string {
  const GAP = 2
  const s = startDeg + GAP / 2
  const e = endDeg - GAP / 2
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

export default function OccupancyDonut({ occupied, vacant, totalUnits, totalProperties }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const total = occupied + vacant || 1
  const pct = Math.round((occupied / total) * 100)

  const SIZE = 160
  const CX = SIZE / 2
  const CY = SIZE / 2
  const OUTER_R = 68
  const INNER_R = 44

  const segments = [
    { label: 'Occupied', value: occupied, color: PALETTE[0] },
    { label: 'Vacant',   value: vacant,   color: PALETTE[1] },
  ].map((seg, i) => {
    return { ...seg, i, frac: seg.value / total }
  })

  // Build arc angles
  let cursor = 0
  const arcs = segments.map((seg) => {
    const start = cursor * 360
    cursor += seg.frac
    return { ...seg, start, end: cursor * 360 }
  })

  const active = hoveredIdx !== null ? arcs[hoveredIdx] : null
  const centreLabel = active ? active.label : `${pct}%`
  const centreValue = active ? active.value.toLocaleString() : totalUnits.toLocaleString()
  const centreSub   = active ? 'units' : 'total units'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>

      {/* ── Donut ── */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <svg
          width={SIZE} height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{ display: 'block', overflow: 'visible' }}
          role="img"
          aria-label="Occupancy donut chart"
        >
          {arcs.map((seg) => {
            const isHovered = hoveredIdx === seg.i
            const isAny     = hoveredIdx !== null
            return (
              <path
                key={seg.label}
                d={arcPath(seg.start, seg.end, OUTER_R, INNER_R, CX, CY)}
                fill={seg.color}
                opacity={isAny && !isHovered ? 0.4 : 1}
                style={{
                  transformOrigin: `${CX}px ${CY}px`,
                  transform: `scale(${isHovered ? 1.05 : 1})`,
                  transition: 'opacity 0.15s, transform 0.15s',
                  cursor: 'pointer',
                }}
                onPointerEnter={() => setHoveredIdx(seg.i)}
                onPointerLeave={() => setHoveredIdx(null)}
              >
                <title>{seg.label}: {seg.value.toLocaleString()} units</title>
              </path>
            )
          })}

          {/* Centre text */}
          <text x={CX} y={CY - 10} textAnchor="middle" fontSize="8"
            fill="var(--muted-foreground)" fontFamily={FONT} fontWeight="500">
            {centreLabel}
          </text>
          <text x={CX} y={CY + 6} textAnchor="middle" fontSize="13"
            fill="var(--foreground)" fontFamily={FONT} fontWeight="700">
            {centreValue}
          </text>
          <text x={CX} y={CY + 18} textAnchor="middle" fontSize="7"
            fill="var(--muted-foreground)" fontFamily={FONT}>
            {centreSub}
          </text>
        </svg>
      </div>

      {/* ── Legend + stats ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {arcs.map((seg) => {
          const isHovered = hoveredIdx === seg.i
          return (
            <div
              key={seg.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 6px',
                borderRadius: 7,
                background: isHovered ? 'var(--muted)' : 'transparent',
                cursor: 'pointer',
                transition: 'background 0.12s',
              }}
              onPointerEnter={() => setHoveredIdx(seg.i)}
              onPointerLeave={() => setHoveredIdx(null)}
            >
              <span style={{
                width: 9, height: 9,
                borderRadius: 3,
                background: seg.color,
                flexShrink: 0,
                opacity: hoveredIdx !== null && !isHovered ? 0.4 : 1,
                transition: 'opacity 0.15s',
              }} />
              <span style={{
                fontSize: 12,
                color: isHovered ? 'var(--foreground)' : 'var(--muted-foreground)',
                fontWeight: isHovered ? 600 : 400,
                transition: 'color 0.12s',
                flex: 1,
              }}>
                {seg.label}
              </span>
              <span style={{
                fontSize: 13,
                fontWeight: 700,
                color: isHovered ? seg.color : 'var(--foreground)',
                fontVariantNumeric: 'tabular-nums',
                transition: 'color 0.12s',
              }}>
                {seg.value.toLocaleString()}
              </span>
            </div>
          )
        })}

        {/* Occupancy rate bar */}
        <div style={{ marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Occupancy rate
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>{pct}%</span>
          </div>
          <div style={{ height: 5, background: 'var(--muted)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${pct}%`,
              height: '100%',
              background: '#f59e0b',
              borderRadius: 3,
              transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
            }} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>Properties</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}>{totalProperties.toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}
