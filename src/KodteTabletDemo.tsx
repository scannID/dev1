import { useEffect, useId, useMemo, useState } from 'react'

type OrderRow = {
  id: string
  table: string
  items: string
  total: string
  status: 'Pending' | 'Preparing' | 'Ready' | 'Completed'
  payment: 'Unpaid' | 'Paid'
  isNew?: boolean
}

const baseOrders: OrderRow[] = [
  { id: 'o1', table: 'Table 4', items: '2 items', total: 'UGX 45,000', status: 'Preparing', payment: 'Paid' },
  { id: 'o2', table: 'Table 9', items: '1 item', total: 'UGX 12,000', status: 'Ready', payment: 'Paid' },
  { id: 'o3', table: 'Takeaway', items: '3 items', total: 'UGX 58,000', status: 'Pending', payment: 'Unpaid' },
]

const incomingOrder: OrderRow = {
  id: 'o-new',
  table: 'Table 12',
  items: '2 items',
  total: 'UGX 41,000',
  status: 'Pending',
  payment: 'Unpaid',
  isNew: true,
}

const statusColor: Record<OrderRow['status'], { bg: string; fg: string }> = {
  Pending: { bg: '#FEF3C7', fg: '#92400E' },
  Preparing: { bg: '#DBEAFE', fg: '#1E40AF' },
  Ready: { bg: '#D1FAE5', fg: '#065F46' },
  Completed: { bg: '#F1F5F9', fg: '#475569' },
}

function spikeSeries(seed: number[], intensity = 1): number[] {
  const out = [...seed]
  const last = out[out.length - 1] ?? 10
  const spike = Math.random() > 0.45
  const next = spike
    ? last + (8 + Math.random() * 28) * intensity * (Math.random() > 0.35 ? 1 : -0.55)
    : last + (Math.random() - 0.5) * 6 * intensity
  out.push(Math.max(1, next))
  if (out.length > 14) out.shift()
  return out
}

function MiniSparkline({ data, color, fierce = false }: { data: number[]; color: string; fierce?: boolean }) {
  const uid = useId().replace(/:/g, '')
  const gradientId = `tablet-spark-${uid}`
  const flashId = `tablet-flash-${uid}`

  const { linePath, areaPath, tip } = useMemo(() => {
    if (data.length < 2) return { linePath: '', areaPath: '', tip: null as null | { x: number; y: number } }
    const max = Math.max(...data)
    const min = Math.min(...data)
    const range = max - min || 1
    const pts = data.map((value, index) => {
      const x = (index / (data.length - 1)) * 100
      const y = 100 - ((value - min) / range) * 78 - 8
      return { x, y }
    })
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
    return {
      linePath: line,
      areaPath: `${line} L 100,100 L 0,100 Z`,
      tip: pts[pts.length - 1],
    }
  }, [data])

  if (!linePath || !tip) return null

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={fierce ? 0.55 : 0.4} />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
        <radialGradient id={flashId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.95" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} style={{ transition: 'd 320ms ease-out' }} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={fierce ? 3.2 : 2.4}
        strokeLinecap="square"
        strokeLinejoin="miter"
        vectorEffect="non-scaling-stroke"
        style={{ transition: 'd 320ms ease-out' }}
      />
      <circle cx={tip.x} cy={tip.y} r={fierce ? 3.4 : 2.4} fill={color}>
        {fierce ? (
          <animate attributeName="r" values="2.2;4.2;2.2" dur="0.9s" repeatCount="indefinite" />
        ) : null}
      </circle>
      {fierce ? (
        <circle cx={tip.x} cy={tip.y} r="10" fill={`url(#${flashId})`}>
          <animate attributeName="opacity" values="0.7;0.12;0.7" dur="0.9s" repeatCount="indefinite" />
        </circle>
      ) : null}
    </svg>
  )
}

function StatusPill({ status }: { status: OrderRow['status'] }) {
  const c = statusColor[status]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 7px',
        borderRadius: 999,
        fontSize: 8,
        fontWeight: 700,
        background: c.bg,
        color: c.fg,
        letterSpacing: '0.01em',
      }}
    >
      {status}
    </span>
  )
}

export function KodteTabletDemo() {
  const [orders, setOrders] = useState<OrderRow[]>(baseOrders)
  const [openCount, setOpenCount] = useState(3)
  const [showToast, setShowToast] = useState(false)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [sparks, setSparks] = useState({
    open: [2, 8, 3, 14, 4, 11, 3],
    sales: [30, 90, 42, 120, 55, 150, 70],
    unpaid: [4, 1, 9, 2, 11, 3, 2],
  })

  // Fierce, but steadier sparklines
  useEffect(() => {
    const id = setInterval(() => {
      setSparks((prev) => ({
        open: spikeSeries(prev.open, 1.3),
        sales: spikeSeries(prev.sales, 1.8),
        unpaid: spikeSeries(prev.unpaid, 1.4),
      }))
      setTick((t) => (t ? 0 : 1))
    }, 650)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []

    const run = () => {
      setOrders(baseOrders)
      setOpenCount(3)
      setShowToast(false)
      setHighlightId(null)

      // New order arrives fast
      timers.push(
        setTimeout(() => {
          setShowToast(true)
          setOrders((prev) => [{ ...incomingOrder }, ...prev])
          setOpenCount(4)
          setHighlightId('o-new')
          setSparks((prev) => ({
            ...prev,
            open: spikeSeries([...prev.open, 22], 2.2),
            unpaid: spikeSeries([...prev.unpaid, 16], 2),
          }))
        }, 1600),
      )
      timers.push(setTimeout(() => setShowToast(false), 2800))

      // Status advances quickly
      timers.push(
        setTimeout(() => {
          setOrders((prev) =>
            prev.map((o) => (o.id === 'o-new' ? { ...o, status: 'Preparing' } : o)),
          )
        }, 3200),
      )
      timers.push(
        setTimeout(() => {
          setOrders((prev) =>
            prev.map((o) =>
              o.id === 'o-new' ? { ...o, status: 'Ready', payment: 'Paid', isNew: false } : o,
            ),
          )
          setHighlightId(null)
          setSparks((prev) => ({
            ...prev,
            sales: spikeSeries([...prev.sales, 210], 2.4),
            unpaid: spikeSeries([...prev.unpaid, 1], 1.6),
          }))
        }, 4300),
      )

      timers.push(setTimeout(run, 6200))
    }

    run()
    return () => timers.forEach(clearTimeout)
  }, [])

  const unpaidCount = orders.filter((o) => o.payment === 'Unpaid').length

  return (
    <div
      className="scanny-tablet"
      style={{
        position: 'relative',
        width: 860,
        maxWidth: '100%',
        filter: 'drop-shadow(0 28px 60px rgba(0,0,0,0.28))',
        fontFamily: "'Outfit Variable', Outfit, ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Device bezel */}
      <div
        style={{
          background: 'linear-gradient(145deg, #3a3a3c 0%, #1c1c1e 100%)',
          borderRadius: 36,
          padding: 18,
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)',
        }}
      >
        <div
          style={{
            position: 'relative',
            background: '#f7f6f2',
            borderRadius: 20,
            overflow: 'hidden',
            height: 540,
            border: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          {/* Camera notch */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: 8,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#111',
              zIndex: 5,
              boxShadow: 'inset 0 0 0 1.5px #333',
            }}
          />

          {/* App chrome */}
          <div style={{ display: 'flex', height: '100%' }}>
            {/* Sidebar */}
            <aside
              style={{
                width: 118,
                background: '#ffffff',
                borderRight: '1px solid #e8e6e0',
                padding: '28px 10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14, padding: '0 4px' }}>
                <img
                  src="/kodte-icon.svg"
                  alt="Kodte"
                  style={{
                    width: 28,
                    height: 28,
                    objectFit: 'cover',
                  }}
                />
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#15231c', lineHeight: 1.1 }}>Kodte</div>
                  <div style={{ fontSize: 7.5, color: '#7a867f' }}>Merchant</div>
                </div>
              </div>

              {[
                { label: 'Overview', active: false },
                { label: 'Catalog', active: false },
                { label: 'Orders', active: true, badge: openCount },
                { label: 'Reports', active: false },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 8px',
                    borderRadius: 8,
                    background: item.active ? 'color-mix(in srgb, var(--primary, #2f8f6b) 12%, transparent)' : 'transparent',
                    color: item.active ? 'var(--primary, #2f8f6b)' : '#5c6b63',
                    fontSize: 9,
                    fontWeight: item.active ? 700 : 550,
                  }}
                >
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge != null ? (
                    <span
                      style={{
                        minWidth: 14,
                        height: 14,
                        borderRadius: 7,
                        background: 'var(--primary, #2f8f6b)',
                        color: '#fff',
                        fontSize: 8,
                        fontWeight: 700,
                        display: 'grid',
                        placeItems: 'center',
                        padding: '0 3px',
                        transform: tick ? 'scale(1.18)' : 'scale(1)',
                        transition: 'transform 0.12s ease',
                      }}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </div>
              ))}
            </aside>

            {/* Main */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <header
                style={{
                  padding: '22px 16px 10px',
                  borderBottom: '1px solid #e8e6e0',
                  background: '#fff',
                }}
              >
                <div>
                  <div style={{ fontSize: 8, fontWeight: 650, color: '#8a948c', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Merchant · Orders
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 750, color: '#15231c', marginTop: 2 }}>Orders</div>
                </div>
              </header>

              {/* Metrics */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 8,
                  padding: '10px 12px',
                }}
              >
                {[
                  { label: 'Open orders', value: String(openCount), color: '#3b82f6', spark: sparks.open },
                  { label: 'Paid sales', value: 'UGX 187k', color: '#10b981', spark: sparks.sales },
                  { label: 'Awaiting pay', value: String(unpaidCount), color: '#f59e0b', spark: sparks.unpaid },
                ].map((m) => (
                  <div
                    key={m.label}
                    style={{
                      background: '#fff',
                      border: '1px solid #e8e6e0',
                      borderRadius: 10,
                      padding: '8px 10px',
                    }}
                  >
                    <div style={{ fontSize: 8, color: '#7a867f', fontWeight: 600 }}>{m.label}</div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 750,
                        color: '#15231c',
                        marginTop: 2,
                        transform: tick ? 'translateY(-1px) scale(1.03)' : 'none',
                        transition: 'transform 0.1s ease',
                      }}
                    >
                      {m.value}
                    </div>
                    <div style={{ marginTop: 6, height: 28 }}>
                      <MiniSparkline data={m.spark} color={m.color} fierce />
                    </div>
                  </div>
                ))}
              </div>

              {/* Orders table */}
              <div style={{ flex: 1, padding: '0 12px 12px', overflow: 'hidden' }}>
                <div
                  style={{
                    background: '#fff',
                    border: '1px solid #e8e6e0',
                    borderRadius: 12,
                    overflow: 'hidden',
                    height: '100%',
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.1fr 0.7fr 0.9fr 0.8fr 0.7fr',
                      gap: 6,
                      padding: '7px 10px',
                      borderBottom: '1px solid #eeebe4',
                      fontSize: 8,
                      fontWeight: 700,
                      color: '#8a948c',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                    }}
                  >
                    <span>Order</span>
                    <span>Items</span>
                    <span>Total</span>
                    <span>Status</span>
                    <span>Payment</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {orders.slice(0, 4).map((order) => (
                      <div
                        key={order.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.1fr 0.7fr 0.9fr 0.8fr 0.7fr',
                          gap: 6,
                          padding: '8px 10px',
                          borderBottom: '1px solid #f1efe9',
                          alignItems: 'center',
                          fontSize: 9,
                          background:
                            highlightId === order.id
                              ? 'color-mix(in srgb, var(--primary, #2f8f6b) 10%, #fff)'
                              : '#fff',
                          animation: order.isNew ? 'tabletRowIn 0.22s cubic-bezier(0.2, 1.4, 0.3, 1) both' : undefined,
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <span style={{ fontWeight: 700, color: '#15231c' }}>{order.table}</span>
                        <span style={{ color: '#6b776f' }}>{order.items}</span>
                        <span style={{ fontWeight: 650, color: '#24332c' }}>{order.total}</span>
                        <StatusPill status={order.status} />
                        <span
                          style={{
                            fontWeight: 650,
                            color: order.payment === 'Paid' ? '#059669' : '#b45309',
                          }}
                        >
                          {order.payment}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Toast notification */}
          <div
            style={{
              position: 'absolute',
              top: 18,
              right: 14,
              zIndex: 8,
              background: '#fff',
              border: '1px solid #e8e6e0',
              borderRadius: 12,
              padding: '10px 12px',
              width: 190,
              boxShadow: '0 12px 28px rgba(0,0,0,0.14)',
              opacity: showToast ? 1 : 0,
              transform: showToast ? 'translateY(0) scale(1)' : 'translateY(-14px) scale(0.96)',
              transition: 'opacity 0.15s ease, transform 0.18s cubic-bezier(0.2, 1.3, 0.3, 1)',
              pointerEvents: 'none',
            }}
          >
            <div style={{ fontSize: 9, fontWeight: 750, color: '#15231c' }}>New order received</div>
            <div style={{ fontSize: 8.5, color: '#6b776f', marginTop: 3, lineHeight: 1.4 }}>
              Table 12 · Chicken Plate + Passion Juice
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes tabletRowIn {
          from { opacity: 0; transform: translateY(-14px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
