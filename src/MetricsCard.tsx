import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { scannyApi } from './api/services'
import type { MerchantMetricRange, ScansOrdersSeries } from './api/types'

type BusinessLike = { id: string; name: string }

const EMPTY: ScansOrdersSeries = {
  range: 'week',
  scans: [0, 0],
  orders: [0, 0],
  yMax: 10,
  xLabels: ['—', '—'],
}

const RANGE_META: { key: MerchantMetricRange; label: string; span: string }[] = [
  { key: 'day', label: 'Daily', span: 'last 24 hours' },
  { key: 'week', label: 'Weekly', span: 'last 7 days' },
  { key: 'month', label: 'Monthly', span: 'last 5 weeks' },
  { key: 'year', label: 'Yearly', span: 'last 12 months' },
]

const VW = 600
const VH = 220
const PL = 40
const PR = 10
const PT = 16
const PB = 28
const CW = VW - PL - PR
const CH = VH - PT - PB

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
  const last = pts[pts.length - 1]
  const first = pts[0]
  return `${smooth(pts)} L${last[0]},${VH - PB} L${first[0]},${VH - PB} Z`
}

function fmt(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`
  return String(v)
}

export function MetricsCard({ business }: { business: BusinessLike }) {
  const [range, setRange] = useState<MerchantMetricRange>('week')
  const [data, setData] = useState<ScansOrdersSeries>(EMPTY)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  const rangeRef = useRef(range)
  rangeRef.current = range

  useEffect(() => {
    let cancelled = false
    let debounceTimer: number | null = null

    const applySeries = (series: ScansOrdersSeries, selectedRange: MerchantMetricRange) => {
      setData({
        range: series.range || selectedRange,
        scans: series.scans?.length ? series.scans : EMPTY.scans,
        orders: series.orders?.length ? series.orders : EMPTY.orders,
        yMax: Math.max(10, series.yMax || 10),
        xLabels: series.xLabels?.length ? series.xLabels : EMPTY.xLabels,
      })
    }

    const load = async (silent = false) => {
      const selectedRange = rangeRef.current
      try {
        const series = await scannyApi.businesses.getScansOrders(business.id, selectedRange)
        if (!cancelled) applySeries(series, selectedRange)
      } catch {
        if (!cancelled && !silent) setData({ ...EMPTY, range: selectedRange })
      }
    }

    const scheduleLoad = () => {
      if (debounceTimer != null) window.clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null
        void load(true)
      }, 400)
    }

    void load(false)

    let client: { close: () => void } | null = null
    let started = false

    async function startRealtime() {
      if (started || cancelled) return
      started = true
      const { createRealtimeClient } = await import('./lib/realtime')
      const keycloak = (await import('./keycloak')).default
      if (cancelled) return
      client = createRealtimeClient({
        channels: [`metrics:${business.id}`, `orders:${business.id}`],
        getToken: async () => {
          try {
            await keycloak.updateToken(30)
          } catch {
            /* keep current token */
          }
          return keycloak.token
        },
        poll: () => load(true),
        // Slow safety net only — scans/orders should arrive over the socket.
        pollIntervalMs: 60_000,
        onEvent: (event) => {
          if (
            event.type === 'QR_SCAN_RECORDED' ||
            event.type?.startsWith('ORDER') ||
            event.type === 'ORDERS_CLEARED'
          ) {
            scheduleLoad()
          }
        },
      })
    }

    void startRealtime()
    const onFocus = () => void load(true)
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      if (debounceTimer != null) window.clearTimeout(debounceTimer)
      window.removeEventListener('focus', onFocus)
      client?.close()
    }
  }, [business.id, range])

  const n = data.scans.length
  const yMax = data.yMax
  const scanPts = data.scans.map((v, i): [number, number] => [tx(i, n), ty(v, yMax)])
  const orderPts = data.orders.map((v, i): [number, number] => [tx(i, n), ty(v, yMax)])
  const scanLine = smooth(scanPts)
  const scanArea = areaPath(scanPts)
  const orderLine = smooth(orderPts)
  const orderArea = areaPath(orderPts)
  const yTicks = [0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f))
  const xStep = n <= 7 ? 1 : n <= 16 ? 2 : Math.ceil(n / 7)
  const rangeSpan = RANGE_META.find((r) => r.key === range)?.span ?? ''
  const scansTotal = data.scans.reduce((a, b) => a + b, 0)
  const ordersTotal = data.orders.reduce((a, b) => a + b, 0)

  const indexFromClientX = useCallback(
    (clientX: number) => {
      const el = chartRef.current
      if (!el || n < 1) return null
      const rect = el.getBoundingClientRect()
      if (rect.width <= 0) return null
      const svgX = ((clientX - rect.left) / rect.width) * VW
      const plotX = Math.min(Math.max(svgX, PL), VW - PR)
      const t = (plotX - PL) / Math.max(CW, 1)
      return Math.min(n - 1, Math.max(0, Math.round(t * (n - 1))))
    },
    [n],
  )

  const onChartPointer = useCallback(
    (e: ReactPointerEvent) => {
      const idx = indexFromClientX(e.clientX)
      if (idx !== null) setActiveIndex(idx)
    },
    [indexFromClientX],
  )

  const clearActive = useCallback(() => setActiveIndex(null), [])

  const active =
    activeIndex !== null && activeIndex >= 0 && activeIndex < n
      ? {
          i: activeIndex,
          label: data.xLabels[activeIndex] ?? '—',
          scans: data.scans[activeIndex] ?? 0,
          orders: data.orders[activeIndex] ?? 0,
          x: scanPts[activeIndex]?.[0] ?? PL,
          scanY: scanPts[activeIndex]?.[1] ?? PT,
          orderY: orderPts[activeIndex]?.[1] ?? PT,
        }
      : null

  const conversion =
    active && active.scans > 0
      ? Math.round((active.orders / active.scans) * 1000) / 10
      : active
        ? 0
        : null

  const tooltipLeftPct = active ? (active.x / VW) * 100 : 0
  const tooltipSide = tooltipLeftPct > 62 ? 'right' : 'left'

  return (
    <section
      aria-label={`${business.name} activity metrics`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        minHeight: 360,
        background: 'var(--card)',
        borderRadius: 10,
        overflow: 'hidden',
        border: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          padding: '12px 16px 0',
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--muted-foreground)',
            }}
          >
            Business Activity
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
            Active Scans &amp; Orders
          </p>
        </div>

        <div style={{ display: 'flex', gap: 2, background: 'var(--muted)', borderRadius: 8, padding: 3 }}>
          {RANGE_META.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => {
                setRange(r.key)
                setActiveIndex(null)
              }}
              style={{
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: range === r.key ? 600 : 400,
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                background: range === r.key ? 'var(--card)' : 'transparent',
                color: range === r.key ? 'var(--primary)' : 'var(--muted-foreground)',
                transition: 'all 0.15s',
                boxShadow: range === r.key ? '0 1px 3px oklch(0 0 0 / 12%)' : 'none',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '8px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 20, height: 2, borderRadius: 2, background: '#5ac8fa', display: 'inline-block' }} />
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Scans</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#5ac8fa', marginLeft: 2 }}>
            {fmt(scansTotal)}
          </span>
          <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>· {rangeSpan}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 20, height: 2, borderRadius: 2, background: '#f07848', display: 'inline-block' }} />
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Orders</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#f07848', marginLeft: 2 }}>
            {fmt(ordersTotal)}
          </span>
        </div>
      </div>

      <div
        ref={chartRef}
        style={{
          flex: 1,
          minHeight: 0,
          padding: '4px 0 0',
          position: 'relative',
          touchAction: 'none',
          cursor: 'crosshair',
        }}
        onPointerMove={onChartPointer}
        onPointerDown={onChartPointer}
        onPointerLeave={clearActive}
        role="img"
        aria-label="QR scans and orders over time. Hover or tap a point to see details."
      >
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="mh-m-fill-scan" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5ac8fa" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#5ac8fa" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="mh-m-fill-order" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f07848" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#f07848" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {yTicks.map((v) => {
            const y = ty(v, yMax)
            return (
              <g key={v}>
                <line
                  x1={PL}
                  y1={y}
                  x2={VW - PR}
                  y2={y}
                  stroke="var(--border)"
                  strokeWidth="1"
                  strokeDasharray="4 5"
                />
                <text
                  x={PL - 5}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize="8"
                  fill="var(--muted-foreground)"
                  fontFamily="'Outfit Variable', ui-sans-serif, sans-serif"
                >
                  {fmt(v)}
                </text>
              </g>
            )
          })}

          {data.xLabels.map((label, i) => {
            if (i % xStep !== 0 && i !== data.xLabels.length - 1) return null
            return (
              <text
                key={`${label}-${i}`}
                x={tx(i, n)}
                y={VH - 6}
                textAnchor="middle"
                fontSize="8"
                fill="var(--muted-foreground)"
                fontFamily="'Outfit Variable', ui-sans-serif, sans-serif"
              >
                {label}
              </text>
            )
          })}

          <path d={scanArea} fill="url(#mh-m-fill-scan)" />
          <path d={orderArea} fill="url(#mh-m-fill-order)" />
          <path d={scanLine} fill="none" stroke="#5ac8fa" strokeWidth="2" strokeLinejoin="round" />
          <path d={orderLine} fill="none" stroke="#f07848" strokeWidth="1.8" strokeLinejoin="round" />

          {active && (
            <g pointerEvents="none">
              <line
                x1={active.x}
                y1={PT}
                x2={active.x}
                y2={VH - PB}
                stroke="var(--foreground)"
                strokeOpacity="0.18"
                strokeWidth="1"
                strokeDasharray="3 4"
              />
              <circle cx={active.x} cy={active.scanY} r="6" fill="#5ac8fa" opacity="0.18" />
              <circle cx={active.x} cy={active.scanY} r="3.4" fill="#5ac8fa" stroke="#e8f8ff" strokeWidth="1.2" />
              <circle cx={active.x} cy={active.orderY} r="5.5" fill="#f07848" opacity="0.18" />
              <circle cx={active.x} cy={active.orderY} r="3.1" fill="#f07848" stroke="#ffe0c8" strokeWidth="1.2" />
            </g>
          )}
        </svg>

        {active && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              ...(tooltipSide === 'left'
                ? { left: `calc(${tooltipLeftPct}% + 10px)` }
                : { right: `calc(${100 - tooltipLeftPct}% + 10px)` }),
              zIndex: 2,
              minWidth: 148,
              maxWidth: 210,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'color-mix(in oklch, var(--card) 92%, var(--foreground) 8%)',
              border: '1px solid var(--border)',
              boxShadow: '0 8px 24px oklch(0 0 0 / 14%)',
              pointerEvents: 'none',
              backdropFilter: 'blur(8px)',
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--muted-foreground)',
              }}
            >
              {RANGE_META.find((r) => r.key === range)?.label ?? 'Period'}
            </p>
            <p style={{ margin: '2px 0 8px', fontSize: 13, fontWeight: 650, color: 'var(--foreground)' }}>
              {active.label}
            </p>
            <div style={{ display: 'grid', gap: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted-foreground)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#5ac8fa' }} />
                  Scans
                </span>
                <span style={{ fontSize: 12, fontWeight: 650, color: '#5ac8fa', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(active.scans)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted-foreground)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f07848' }} />
                  Orders
                </span>
                <span style={{ fontSize: 12, fontWeight: 650, color: '#f07848', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(active.orders)}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  paddingTop: 5,
                  borderTop: '1px solid var(--border)',
                }}
              >
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Order rate</span>
                <span style={{ fontSize: 12, fontWeight: 650, color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>
                  {conversion === null ? '—' : `${conversion}%`}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
