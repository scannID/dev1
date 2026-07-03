import { useState, useEffect, useRef } from 'react'

type Range = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly'

const RANGES: { key: Range; label: string }[] = [
  { key: 'hourly',  label: 'Hourly'  },
  { key: 'daily',   label: 'Daily'   },
  { key: 'weekly',  label: 'Weekly'  },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly',  label: 'Yearly'  },
]

const DATA: Record<Range, { scans: number[]; orders: number[]; yMax: number; xLabels: string[] }> = {
  hourly: {
    scans:  [320,480,420,600,780,920,1040,880,760,840,980,1120,1040,900,820,760,680,580,520,460,400,360,320,280],
    orders: [28,42,36,55,68,82,96,78,66,74,88,104,96,82,72,66,58,48,44,38,32,28,24,20],
    yMax: 1200,
    xLabels: ['12a','2a','4a','6a','8a','10a','12p','2p','4p','6p','8p','10p'],
  },
  daily: {
    scans:  [4200,5800,4900,7200,6400,8800,7600,9200,8400,10200,9600,8800,10400,9200,8000,7400,8800,10000,9200,8400,7800,9400,10800,9600,8200,7600,9000,10200],
    orders: [380,520,440,640,580,780,680,820,740,900,860,780,920,820,700,640,780,880,820,740,680,840,960,860,720,660,800,920],
    yMax: 12000,
    xLabels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
  },
  weekly: {
    scans:  [28000,32000,38000,44000,52000,48000,56000,62000,58000,68000,72000,64000,70000,78000,74000,80000],
    orders: [2400,2800,3200,3800,4400,4100,4800,5200,4900,5700,6000,5400,5900,6500,6100,6800],
    yMax: 85000,
    xLabels: ['W1','W2','W3','W4','W5','W6','W7','W8','W9','W10','W11','W12','W13','W14','W15','W16'],
  },
  monthly: {
    scans:  [120000,145000,132000,168000,184000,210000,196000,228000,214000,248000,236000,262000],
    orders: [10200,12400,11200,14200,15600,17800,16400,19200,18000,20800,19600,22000],
    yMax: 280000,
    xLabels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  },
  yearly: {
    scans:  [820000,980000,1140000,1320000,1580000],
    orders: [68000,82000,96000,112000,134000],
    yMax: 1700000,
    xLabels: ['2021','2022','2023','2024','2025'],
  },
}

// Fixed logical coordinate space — SVG scales to fit container
const VW = 600
const VH = 220
const PL = 40, PR = 10, PT = 16, PB = 28
const CW = VW - PL - PR
const CH = VH - PT - PB

function tx(i: number, n: number) { return PL + (i / (n - 1)) * CW }
function ty(v: number, max: number) { return PT + CH - (v / max) * CH }

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
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}k`
  return String(v)
}

function peaks(data: number[], t = 0.72) {
  const mx = Math.max(...data)
  return data.reduce<number[]>((a, v, i) => { if (v >= mx * t) a.push(i); return a }, [])
}

function xStep(n: number) {
  if (n <= 7) return 1
  if (n <= 16) return 2
  return Math.ceil(n / 7)
}

// Animate SVG path morph
function useMorphPath(target: string) {
  const [displayed, setDisplayed] = useState(target)
  const [animating, setAnimating] = useState(false)
  const prev = useRef(target)

  useEffect(() => {
    if (target === prev.current) return
    prev.current = target
    setAnimating(true)
    // tiny delay so browser gets the "from" state before transitioning
    const id = setTimeout(() => {
      setDisplayed(target)
      setAnimating(false)
    }, 20)
    return () => clearTimeout(id)
  }, [target])

  return displayed
}

export default function MetricsHero() {
  const [range, setRange] = useState<Range>('daily')
  const d = DATA[range]
  const n = d.scans.length

  const scanPts  = d.scans.map((v, i):  [number, number] => [tx(i, n), ty(v, d.yMax)])
  const orderPts = d.orders.map((v, i): [number, number] => [tx(i, n), ty(v, d.yMax)])

  const scanLine  = smooth(scanPts)
  const scanArea  = areaPath(scanPts)
  const orderLine = smooth(orderPts)
  const orderArea = areaPath(orderPts)

  const scanPeaks  = peaks(d.scans)
  const orderPeaks = peaks(d.orders)
  const step = xStep(n)
  const yTicks = [0.25, 0.5, 0.75, 1].map(f => Math.round(d.yMax * f))

  const totalScans  = d.scans.reduce((a, b) => a + b, 0)
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
      {/* Header */}
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

        {/* Range tabs */}
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

      {/* Legend */}
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
      </div>

      {/* Chart — fills remaining space */}
      <div style={{ flex: 1, minHeight: 0, padding: '4px 0 0' }}>
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="mh-fill-scan" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#5ac8fa" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#5ac8fa" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="mh-fill-order" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#f07848" stopOpacity="0.28" />
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

          {/* Y grid + labels */}
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

          {/* X labels */}
          {d.xLabels.map((label, i) => {
            if (i % step !== 0 && i !== d.xLabels.length - 1) return null
            const ri = Math.round(i * (n - 1) / (d.xLabels.length - 1))
            return (
              <text key={`${label}-${i}`} x={tx(ri, n)} y={VH - 6}
                textAnchor="middle" fontSize="8"
                fill="var(--muted-foreground)"
                fontFamily="'Outfit Variable', ui-sans-serif, sans-serif">
                {label}
              </text>
            )
          })}

          {/* Areas — animated via CSS transition on d attribute */}
          <path
            d={scanArea}
            fill="url(#mh-fill-scan)"
            style={{ transition: 'd 0.4s ease' }}
          />
          <path
            d={orderArea}
            fill="url(#mh-fill-order)"
            style={{ transition: 'd 0.4s ease' }}
          />

          {/* Lines */}
          <path
            d={scanLine}
            fill="none" stroke="#5ac8fa" strokeWidth="2" strokeLinejoin="round"
            style={{ transition: 'd 0.4s ease' }}
          />
          <path
            d={orderLine}
            fill="none" stroke="#f07848" strokeWidth="1.8" strokeLinejoin="round"
            style={{ transition: 'd 0.4s ease' }}
          />

          {/* Scan peak dots */}
          {scanPeaks.map(i => (
            <g key={`sp-${i}`} filter="url(#mh-glow-b)">
              <circle cx={scanPts[i][0]} cy={scanPts[i][1]} r="5.5" fill="#5ac8fa" opacity="0.22" />
              <circle cx={scanPts[i][0]} cy={scanPts[i][1]} r="3"   fill="#5ac8fa" />
              <circle cx={scanPts[i][0]} cy={scanPts[i][1]} r="1.4" fill="#e8f8ff" />
            </g>
          ))}

          {/* Order peak dots */}
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
