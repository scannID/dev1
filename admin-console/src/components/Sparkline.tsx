type SparklineProps = {
  data: number[]
  color?: string
  className?: string
  /** ViewBox height — larger values give a taller chart when stretched. */
  height?: number
  strokeWidth?: number
}

export default function Sparkline({
  data,
  color = 'var(--primary)',
  className = 'admin-sparkline',
  height = 40,
  strokeWidth = 1.1,
}: SparklineProps) {
  if (data.length < 2) return null

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const w = 100
  const h = height
  const pad = Math.max(4, h * 0.1)
  const points = data.map((v, i): [number, number] => [
    (i / (data.length - 1)) * w,
    h - ((v - min) / range) * (h - pad * 2) - pad,
  ])

  let line = `M${points[0][0]},${points[0][1]}`
  for (let i = 1; i < points.length; i++) {
    const mx = (points[i - 1][0] + points[i][0]) / 2
    line += ` C${mx},${points[i - 1][1]} ${mx},${points[i][1]} ${points[i][0]},${points[i][1]}`
  }
  const last = points[points.length - 1]
  const first = points[0]
  const area = `${line} L${last[0]},${h} L${first[0]},${h} Z`
  const id = `sg-${color.replace(/[^a-z0-9]/gi, '')}-${h}`

  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
