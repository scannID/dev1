import { useState, useMemo } from 'react'
import type { CreatedEventSummary } from '../api/types'

export type TicketPeriod = 'weekly' | 'monthly' | 'yearly' | 'all'

interface Props {
  events: CreatedEventSummary[]
  period: TicketPeriod
}

const FONT = "'Outfit Variable', ui-sans-serif, system-ui, sans-serif"

type SegKey = 'redeemed' | 'unredeemed'

function polarToXY(angleDeg: number, r: number, cx: number, cy: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(
  startDeg: number, endDeg: number,
  outerR: number, innerR: number,
  cx: number, cy: number,
): string {
  const GAP = 1.8
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

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

/** Returns start-of-period cutoff date for filtering events. */
function cutoff(period: TicketPeriod): Date | null {
  if (period === 'all') return null
  const now = new Date()
  if (period === 'weekly')  { const d = new Date(now); d.setDate(d.getDate() - 7);   return d }
  if (period === 'monthly') { const d = new Date(now); d.setMonth(d.getMonth() - 1); return d }
  if (period === 'yearly')  { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); return d }
  return null
}

export default function TicketingDonut({ events, period }: Props) {
  const [hoveredKey, setHoveredKey] = useState<SegKey | null>(null)

  const filtered = useMemo(() => {
    const cut = cutoff(period)
    if (!cut) return events
    return events.filter((e) => new Date(e.createdAt) >= cut)
  }, [events, period])

  const totalTicketsSold = filtered.reduce((s, e) => s + e.paidTickets,     0)
  const totalRedeemed    = filtered.reduce((s, e) => s + e.redeemedTickets, 0)
  const activeEvents     = filtered.filter((e) => e.status === 'ACTIVE').length
  const totalEvents      = filtered.length
  const unredeemed       = Math.max(0, totalTicketsSold - totalRedeemed)
  const redemptionRate   = totalTicketsSold > 0
    ? Math.round((totalRedeemed / totalTicketsSold) * 100)
    : 0

  const segs: { key: SegKey; label: string; value: number; color: string }[] = [
    { key: 'redeemed',   label: 'Redeemed',           value: totalRedeemed, color: '#3b82f6' },
    { key: 'unredeemed', label: 'Sold · not redeemed', value: unredeemed,   color: '#10b981' },
  ]

  const total = segs.reduce((s, seg) => s + seg.value, 0) || 1

  const SIZE = 160, CX = SIZE / 2, CY = SIZE / 2
  const OUTER_R = 68, INNER_R = 44

  let cursor = 0
  const arcs = segs.map((seg) => {
    const start = cursor * 360
    cursor += seg.value / total
    return { ...seg, start, end: cursor * 360 }
  })

  const active = hoveredKey ? arcs.find((a) => a.key === hoveredKey) ?? null : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      {/* ── Donut + legend ── */}
      {totalEvents === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>
          No events in this period.
        </p>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>

          {/* Donut */}
          <div style={{ flexShrink: 0 }}>
            <svg
              width={SIZE} height={SIZE}
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              style={{ display: 'block', overflow: 'visible' }}
              role="img"
              aria-label="Ticketing donut chart"
            >
              {/* fallback ring */}
              {totalTicketsSold === 0 && (
                <circle cx={CX} cy={CY} r={(OUTER_R + INNER_R) / 2}
                  fill="none" stroke="var(--muted)" strokeWidth={OUTER_R - INNER_R} />
              )}

              {arcs.map((seg) => {
                const isHov = hoveredKey === seg.key
                const isAny = hoveredKey !== null
                return (
                  <path
                    key={seg.key}
                    d={arcPath(seg.start, seg.end, OUTER_R, INNER_R, CX, CY)}
                    fill={seg.color}
                    opacity={isAny && !isHov ? 0.38 : 1}
                    style={{
                      transformOrigin: `${CX}px ${CY}px`,
                      transform: `scale(${isHov ? 1.05 : 1})`,
                      transition: 'opacity 0.15s, transform 0.15s',
                      cursor: 'pointer',
                    }}
                    onPointerEnter={() => setHoveredKey(seg.key)}
                    onPointerLeave={() => setHoveredKey(null)}
                  >
                    <title>{seg.label}: {seg.value.toLocaleString()}</title>
                  </path>
                )
              })}

              {/* Centre */}
              <text x={CX} y={CY - 9} textAnchor="middle" fontSize="8"
                fill="var(--muted-foreground)" fontFamily={FONT} fontWeight="500">
                {active ? active.label.split('·')[0].trim() : 'Sold'}
              </text>
              <text x={CX} y={CY + 6} textAnchor="middle" fontSize="13"
                fill="var(--foreground)" fontFamily={FONT} fontWeight="700">
                {active ? fmt(active.value) : fmt(totalTicketsSold)}
              </text>
              <text x={CX} y={CY + 19} textAnchor="middle" fontSize="7.5"
                fill="var(--muted-foreground)" fontFamily={FONT}>
                {active ? 'tickets' : 'tickets sold'}
              </text>
            </svg>
          </div>

          {/* Legend + stats */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {arcs.map((seg) => {
              const isHov = hoveredKey === seg.key
              return (
                <div
                  key={seg.key}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '4px 6px', borderRadius: 7,
                    background: isHov ? 'var(--muted)' : 'transparent',
                    cursor: 'pointer', transition: 'background 0.12s',
                  }}
                  onPointerEnter={() => setHoveredKey(seg.key)}
                  onPointerLeave={() => setHoveredKey(null)}
                >
                  <span style={{
                    width: 9, height: 9, borderRadius: 3,
                    background: seg.color, flexShrink: 0,
                    opacity: hoveredKey !== null && !isHov ? 0.38 : 1,
                    transition: 'opacity 0.15s',
                  }} />
                  <span style={{
                    fontSize: 11, flex: 1,
                    color: isHov ? 'var(--foreground)' : 'var(--muted-foreground)',
                    fontWeight: isHov ? 600 : 400,
                    transition: 'color 0.12s',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {seg.label}
                  </span>
                  <span style={{
                    fontSize: 13, fontWeight: 700,
                    color: isHov ? seg.color : 'var(--foreground)',
                    fontVariantNumeric: 'tabular-nums',
                    transition: 'color 0.12s',
                  }}>
                    {fmt(seg.value)}
                  </span>
                </div>
              )
            })}

            {/* Redemption rate bar */}
            <div style={{ marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Redemption rate
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6' }}>{redemptionRate}%</span>
              </div>
              <div style={{ height: 5, background: 'var(--muted)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  width: `${redemptionRate}%`,
                  height: '100%',
                  background: '#3b82f6',
                  borderRadius: 3,
                  transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
                }} />
              </div>
            </div>

            {/* Events summary */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>
                Active / Total events
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>
                {activeEvents} / {totalEvents}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
