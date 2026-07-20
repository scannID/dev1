import { useState, useEffect } from 'react'
import { adminApi } from '../api/services'
import type { ScansOrdersRange, ScansOrdersSeries } from '../api/types'

type Range = ScansOrdersRange

const RANGES: { key: Range; label: string }[] = [
  { key: 'hourly', label: 'Hourly' },
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
]

const EMPTY: ScansOrdersSeries = {
  range: 'daily',
  scans: [0, 0],
  orders: [0, 0],
  yMax: 10,
  xLabels: ['—', '—'],
}

const VW = 600
const VH = 220
const PL = 40, PR = 10, PT = 16, PB = 28
const CW = VW - PL - PR
const CH = VH - PT - PB

function tx(i: number, n: number) { return PL + (i / Math.max(n - 1, 1)) * CW }
function ty(v: number, max: number) { return PT + CH - (v / Math.max(max, 1)) * CH }

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
  const last = pts[pts.length - 1], first = pts[0]
  return `${smooth(pts)} L${last[0]},${VH - PB} L${first[0]},${VH - PB} Z`
}

function fmt(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`
  return String(v)
}

function peaks(data: number[], t = 0.72) {
  if (!data.length) return []
  const mx = Math.max(...data)
  if (mx <= 0) return []
  return data.reduce<number[]>((a, v, i) => { if (v >= mx * t) a.push(i); return a }, [])
}

function xStep(n: number) {
  if (n <= 7) return 1
  if (n <= 16) return 2
  return Math.ceil(n / 7)
}

export default function MetricsHero() {
  const [range, setRange] = useState<Range>('daily')
  const [series, setSeries] = useState<ScansOrdersSeries>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await adminApi.analytics.getScansOrders(range)
        if (!cancelled) {
          setSeries({
            ...data,
            scans: data.scans?.length ? data.scans : EMPTY.scans,
            orders: data.orders?.length ? data.orders : EMPTY.orders,
            xLabels: data.xLabels?.length ? data.xLabels : EMPTY.xLabels,
            yMax: Math.max(data.yMax || 1, 1),
          })
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load chart')
          setSeries(EMPTY)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [range])

  const d = series
  const n = d.scans.length

  const scanPts = d.scans.map((v, i): [number, number] => [tx(i, n), ty(v, d.yMax)])
  const orderPts = d.orders.map((v, i): [number, number] => [tx(i, n), ty(v, d.yMax)])

  const scanLine = smooth(scanPts)
  const scanArea = areaPath(scanPts)
  const orderLine = smooth(orderPts)
  const orderArea = areaPath(orderPts)

  const scanPeaks = peaks(d.scans)
  const orderPeaks = peaks(d.orders)
  const step = xStep(d.xLabels.length)
  const yTicks = [0.25, 0.5, 0.75, 1].map(f => Math.round(d.yMax * f))

  const totalScans = d.scans.reduce((a, b) => a + b, 0)
  const totalOrders = d.orders.reduce((a, b) => a + b, 0)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      background: 'var(--card)',
      borderRadius: 10,
      overflow: 'hidden',
      border: '1px solid var(--border)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
        padding: '12px 16px 0',
      }}>
        <div>
          <p style={{ margin: 0, fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>
            Platform Activity
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
            Active Scans &amp; Orders
          </p>
        </div>

        <div style={{ display: 'flex', gap: 2, background: 'var(--muted)', borderRadius: 8, padding: 3 }}>
          {RANGES.map(r => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
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
          <span style={{ fontSize: 11, fontWeight: 600, color: '#5ac8fa', marginLeft: 2 }}>{fmt(totalScans)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 20, height: 2, borderRadius: 2, background: '#f07848', display: 'inline-block' }} />
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Orders</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#f07848', marginLeft: 2 }}>{fmt(totalOrders)}</span>
        </div>
        {loading && <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Loading…</span>}
        {error && <span style={{ fontSize: 11, color: 'var(--destructive)' }}>{error}</span>}
      </div>

      <div style={{ flex: 1, minHeight: 0, padding: '4px 0 0' }}>
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="mh-fill-scan" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5ac8fa" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#5ac8fa" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="mh-fill-order" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f07848" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#f07848" stopOpacity="0.02" />
            </linearGradient>
            <filter id="mh-glow-b" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="3.5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="mh-glow-o" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="2.5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {yTicks.map(v => {
            const y = ty(v, d.yMax)
            return (
              <g key={v}>
                <line x1={PL} y1={y} x2={VW - PR} y2={y}
                  stroke="var(--border)" strokeWidth="1" strokeDasharray="4 5" />
                <text x={PL - 5} y={y + 3.5} textAnchor="end" fontSize="8"
                  fill="var(--muted-foreground)"
                  fontFamily="'Outfit Variable', ui-sans-serif, sans-serif">
                  {fmt(v)}
                </text>
              </g>
            )
          })}

          {d.xLabels.map((label, i) => {
            if (i % step !== 0 && i !== d.xLabels.length - 1) return null
            const ri = d.xLabels.length === n
              ? i
              : Math.round(i * (n - 1) / Math.max(d.xLabels.length - 1, 1))
            return (
              <text key={`${label}-${i}`} x={tx(ri, n)} y={VH - 6}
                textAnchor="middle" fontSize="8"
                fill="var(--muted-foreground)"
                fontFamily="'Outfit Variable', ui-sans-serif, sans-serif">
                {label}
              </text>
            )
          })}

          <path d={scanArea} fill="url(#mh-fill-scan)" style={{ transition: 'd 0.4s ease' }} />
          <path d={orderArea} fill="url(#mh-fill-order)" style={{ transition: 'd 0.4s ease' }} />
          <path d={scanLine} fill="none" stroke="#5ac8fa" strokeWidth="2" strokeLinejoin="round" style={{ transition: 'd 0.4s ease' }} />
          <path d={orderLine} fill="none" stroke="#f07848" strokeWidth="1.8" strokeLinejoin="round" style={{ transition: 'd 0.4s ease' }} />

          {scanPeaks.map(i => (
            <g key={`sp-${i}`} filter="url(#mh-glow-b)">
              <circle cx={scanPts[i][0]} cy={scanPts[i][1]} r="5.5" fill="#5ac8fa" opacity="0.22" />
              <circle cx={scanPts[i][0]} cy={scanPts[i][1]} r="3" fill="#5ac8fa" />
              <circle cx={scanPts[i][0]} cy={scanPts[i][1]} r="1.4" fill="#e8f8ff" />
            </g>
          ))}

          {orderPeaks.map(i => (
            <g key={`op-${i}`} filter="url(#mh-glow-o)">
              <circle cx={orderPts[i][0]} cy={orderPts[i][1]} r="4.5" fill="#f07848" opacity="0.22" />
              <circle cx={orderPts[i][0]} cy={orderPts[i][1]} r="2.8" fill="#f07848" />
              <circle cx={orderPts[i][0]} cy={orderPts[i][1]} r="1.3" fill="#ffe0c8" />
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}
